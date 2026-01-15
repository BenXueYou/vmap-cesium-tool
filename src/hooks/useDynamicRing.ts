
import * as Cesium from "cesium";
import type { Viewer } from "cesium";

export type CleanupFn = () => void;

export type RingDirection = "outward" | "inward";

export type AddDynamicRingOptions = {
	position: Cesium.Cartesian3;
	color?: Cesium.Color;
	width?: number;
	height?: number;
	scale?: number;
	direction?: RingDirection;
	imageSize?: number;
	disableDepthTestDistance?: number;
};

export type DynamicRingInstance = {
	billboard: Cesium.Billboard;
	color: Cesium.Color;
	direction: RingDirection;
};

const _ringCanvasCache = new Map<number, HTMLCanvasElement>();

export function getRingCanvas(size = 128) {
	const cached = _ringCanvasCache.get(size);
	if (cached) return cached;

	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		_ringCanvasCache.set(size, canvas);
		return canvas;
	}

	const cx = size / 2;
	const cy = size / 2;
	const inner = size * 0.28;
	const outer = size * 0.42;

	ctx.clearRect(0, 0, size, size);

	// soft outer glow
	const glow = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer * 1.5);
	// NOTE: 使用白色/灰度纹理，方便用 billboard.color 任意染色
	glow.addColorStop(0, "rgba(255,255,255,0.0)");
	glow.addColorStop(0.55, "rgba(255,255,255,0.35)");
	glow.addColorStop(1, "rgba(255,255,255,0.0)");
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(cx, cy, outer * 1.5, 0, Math.PI * 2);
	ctx.fill();

	// crisp ring
	ctx.strokeStyle = "rgba(255,255,255,1.0)";
	ctx.lineWidth = Math.max(2, size * 0.06);
	ctx.beginPath();
	ctx.arc(cx, cy, (inner + outer) / 2, 0, Math.PI * 2);
	ctx.stroke();

	_ringCanvasCache.set(size, canvas);
	return canvas;
}

export function addDynamicRing(
	collection: Cesium.BillboardCollection,
	options: AddDynamicRingOptions,
): DynamicRingInstance {
	const direction: RingDirection = options.direction ?? "outward";
	const color = (options.color ?? new Cesium.Color(0.0, 1.0, 1.0, 1.0)).clone();
	const image = getRingCanvas(options.imageSize ?? 128);

	const billboard = collection.add({
		position: options.position,
		image,
		color,
		sizeInMeters: true,
		width: options.width ?? 900,
		height: options.height ?? 900,
		scale: options.scale ?? 1.0,
		disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
	});

	return { billboard, color, direction };
}

function smoothstep(edge0: number, edge1: number, x: number) {
	const t = Cesium.Math.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
	return t * t * (3.0 - 2.0 * t);
}

export type StartDynamicRingOptions = {
	lon: number;
	lat: number;
	/** 任选其一：radiusMeters / diameterMeters / widthMeters+heightMeters */
	radiusMeters?: number;
	diameterMeters?: number;
	widthMeters?: number;
	heightMeters?: number;
	color?: Cesium.Color;
	/** 发散方向：outward(由小到大) / inward(由大到小) */
	direction?: RingDirection;
	heightOffset?: number;
	imageSize?: number;
	disableDepthTestDistance?: number;
	// animation
	period?: number;
	baseScale?: number;
	scaleRange?: number;
	baseAlpha?: number;
};

/**
 * 一站式：创建光圈 + 贴地采样 + preRender 动画，并返回 cleanup
 */
export function startDynamicRing(viewer: Viewer, options: StartDynamicRingOptions): CleanupFn {
	const {
		lon,
		lat,
		radiusMeters,
		diameterMeters,
		widthMeters,
		heightMeters,
		color,
		direction = "outward",
		heightOffset = 10,
		imageSize = 128,
		disableDepthTestDistance = Number.POSITIVE_INFINITY,
		period = 1.3,
		baseScale = 0.8,
		scaleRange = 2.2,
		baseAlpha = 0.9,
	} = options;

	const resolvedWidth =
		widthMeters ??
		(diameterMeters ?? (radiusMeters ?? 600) * 2);
	const resolvedHeight =
		heightMeters ??
		(diameterMeters ?? (radiusMeters ?? 600) * 2);

	const collection = new Cesium.BillboardCollection();
	viewer.scene.primitives.add(collection);

	const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);

	const ring = addDynamicRing(collection, {
		position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
		color: color ?? new Cesium.Color(0.0, 1.0, 1.0, 0.0),
		width: resolvedWidth,
		height: resolvedHeight,
		scale: baseScale,
		direction,
		imageSize,
		disableDepthTestDistance,
	});

	const phase0 = Math.random();
	const startMs = performance.now();
	let disposed = false;

	// 采样地形高程（一次性），把光圈贴到地表起伏上
	(async () => {
		try {
			const provider = viewer.terrainProvider;
			if (!provider) return;

			const sampler = (Cesium as any).sampleTerrainMostDetailed as
				| ((terrainProvider: any, positions: any[]) => Promise<any[]>)
				| undefined;
			if (!sampler) return;

			const updated = await sampler(provider, [cartographic]);
			if (disposed) return;

			const c = updated?.[0];
			const h = (c?.height ?? 0) + heightOffset;
			ring.billboard.position = Cesium.Cartesian3.fromRadians(
				cartographic.longitude,
				cartographic.latitude,
				h,
			);
		} catch {
			// 采样失败时保持默认高度（不影响闪烁演示）
		}
	})();

	const removePreRender = viewer.scene.preRender.addEventListener(() => {
		const tSec = (performance.now() - startMs) / 1000.0;
		const phase = (tSec / period + phase0) % 1.0;

		const rise = smoothstep(0.0, 0.15, phase);
		const fall = 1.0 - smoothstep(0.55, 0.85, phase);
		const pulse = Cesium.Math.clamp(rise * fall, 0.0, 1.0);

		ring.color.alpha = baseAlpha * pulse;
		ring.billboard.color = ring.color;

		const outwardScale = baseScale + scaleRange * smoothstep(0.0, 1.0, phase);
		const inwardScale = baseScale + scaleRange * (1.0 - smoothstep(0.0, 1.0, phase));
		ring.billboard.scale = ring.direction === "inward" ? inwardScale : outwardScale;
	});

	return () => {
		disposed = true;
		removePreRender();
		viewer.scene.primitives.remove(collection);
		if (!collection.isDestroyed?.()) {
			collection.destroy();
		}
	};
}
