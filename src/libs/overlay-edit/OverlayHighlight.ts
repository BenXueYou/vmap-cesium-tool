import * as Cesium from "cesium";
import type { Entity } from "cesium";
import type { DrawEntity } from "../drawHelper";
import type { OverlayEntity } from "../overlay/types";
import type { MapCircle } from "../overlay/MapCircle";
import type { MapPolygon } from "../overlay/MapPolygon";
import type { MapRectangle } from "../overlay/MapRectangle";

export interface OverlayHighlightHost {
	getEntities(): Cesium.EntityCollection;
	getOverlayById(id: string): (DrawEntity & OverlayEntity) | undefined;
	getPropertyValue<T>(prop: any, fallback: T): T;
	getNumberProperty(prop: any, fallback: number): number;
	getCircle(): MapCircle;
	getPolygon(): MapPolygon;
	getRectangle(): MapRectangle;
}

export class OverlayHighlight {
	private static readonly DEFAULT_HIGHLIGHT_COLOR = Cesium.Color.YELLOW;
	private static readonly DEFAULT_HIGHLIGHT_FILL_ALPHA = 0.35;
	private static readonly DEFAULT_HIGHLIGHT_GLOW_POWER = 0.25;
	private static readonly GLOW_OUTLINE_ROOT_ID_PROP = "__vmapOverlayRootId";

	private readonly entities: Cesium.EntityCollection;

	constructor(private readonly host: OverlayHighlightHost) {
		this.entities = host.getEntities();
	}

	public mapGlowOutlineEntityToRoot(entity: Cesium.Entity): (DrawEntity & OverlayEntity) | null {
		const rootId = this.getEntityPropertyString(entity, OverlayHighlight.GLOW_OUTLINE_ROOT_ID_PROP);
		if (!rootId) return null;
		const root = this.host.getOverlayById(rootId);
		return root ? (root as DrawEntity & OverlayEntity) : null;
	}

	public setOverlayHighlightReason(targets: Entity[], reason: "click" | "hover", enabled: boolean): void {
		for (const e of targets) {
			const oe = e as OverlayEntity;
			if (!oe._highlightState) oe._highlightState = {};
			(oe._highlightState as any)[reason] = enabled;

			const hasAny = !!(oe._highlightState.click || oe._highlightState.hover);
			if (!hasAny) {
				this.restoreOverlayHighlightStyle(oe);
			} else {
				this.applyOverlayHighlightStyle(oe);
			}
		}
	}

	public toggleOverlayHighlight(entity: OverlayEntity, reason: "click" | "hover" = "click"): void {
		const targets = (entity._highlightEntities && entity._highlightEntities.length > 0)
			? entity._highlightEntities
			: [entity];

		const shouldEnable = !targets.some((e) => !!(e as OverlayEntity)._highlightState?.[reason]);
		this.setOverlayHighlightReason(targets, reason, shouldEnable);
	}

	public setOverlayHighlight(entityOrId: OverlayEntity | string, enabled: boolean, reason: "click" | "hover" = "click"): boolean {
		const entity = (typeof entityOrId === "string")
			? (this.host.getOverlayById(entityOrId) as OverlayEntity | undefined)
			: entityOrId;

		if (!entity) return false;

		const targets = (entity._highlightEntities && entity._highlightEntities.length > 0)
			? entity._highlightEntities
			: [entity];

		this.setOverlayHighlightReason(targets, reason, enabled);
		return true;
	}

	private getEntityPropertyString(entity: Cesium.Entity, key: string): string | null {
		try {
			const props: any = (entity as any).properties;
			if (!props) return null;
			const v: any = props[key];
			if (v === undefined || v === null) return null;
			if (typeof v.getValue === "function") {
				const got = v.getValue(Cesium.JulianDate.now());
				if (got === undefined || got === null) return null;
				return String(got);
			}
			return String(v);
		} catch {
			return null;
		}
	}

	private getPropertyValue<T>(prop: any, fallback: T): T {
		return this.host.getPropertyValue(prop, fallback);
	}

	private getNumberProperty(prop: any, fallback: number): number {
		return this.host.getNumberProperty(prop, fallback);
	}

	private resolveHighlightOptions(raw: any): { color: Cesium.Color; fillAlpha: number } {
		const fillAlphaRaw = (typeof raw === "object" && raw) ? (raw as any).fillAlpha : undefined;
		const fillAlpha =
			typeof fillAlphaRaw === "number"
				? Cesium.Math.clamp(fillAlphaRaw, 0.0, 1.0)
				: OverlayHighlight.DEFAULT_HIGHLIGHT_FILL_ALPHA;

		const colorRaw = (typeof raw === "object" && raw) ? (raw as any).color : undefined;
		const resolveColor = (input?: Cesium.Color | string): Cesium.Color => {
			try {
				if (!input) return OverlayHighlight.DEFAULT_HIGHLIGHT_COLOR;
				if (input instanceof Cesium.Color) return input;
				return Cesium.Color.fromCssColorString(String(input));
			} catch {
				return OverlayHighlight.DEFAULT_HIGHLIGHT_COLOR;
			}
		};
		const color = resolveColor(colorRaw);
		return { color, fillAlpha };
	}

	private getActiveHighlightOptions(entity: OverlayEntity): { color: Cesium.Color; fillAlpha: number } {
		const state = entity._highlightState;
		const raw = state?.click ? entity._clickHighlight : (state?.hover ? entity._hoverHighlight : undefined);
		return this.resolveHighlightOptions(raw);
	}

	private getClosedPositions(positions: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
		const list = positions.slice();
		if (list.length >= 2) {
			const first = list[0];
			const last = list[list.length - 1];
			if (!Cesium.Cartesian3.equals(first, last)) list.push(first);
		}
		return list;
	}

	private generateEllipseOutlinePositions(center: Cesium.Cartesian3, semiMajor: number, semiMinor: number, rotationRad: number, segments: number): Cesium.Cartesian3[] {
		const a = Math.max(0, Number(semiMajor) || 0);
		const b = Math.max(0, Number(semiMinor) || 0);
		const n = Math.max(16, Math.min(512, Math.floor(segments) || 128));
		if (!(a > 0) || !(b > 0) || !center) return [];

		const frame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
		const cosR = Math.cos(rotationRad || 0);
		const sinR = Math.sin(rotationRad || 0);
		const result: Cesium.Cartesian3[] = [];

		for (let i = 0; i < n; i++) {
			const t = (i / n) * Cesium.Math.TWO_PI;
			const x0 = Math.cos(t) * a;
			const y0 = Math.sin(t) * b;
			const x = cosR * x0 - sinR * y0;
			const y = sinR * x0 + cosR * y0;
			const pLocal = new Cesium.Cartesian3(x, y, 0);
			const pWorld = Cesium.Matrix4.multiplyByPoint(frame, pLocal, new Cesium.Cartesian3());
			result.push(pWorld);
		}
		return this.getClosedPositions(result);
	}

	private ensureGlowOutline(root: OverlayEntity, color: Cesium.Color): void {
		try {
			if (root._highlightGlowEntity) return;

			if (root._overlayType !== "polygon-primitive" && root._overlayType !== "circle-primitive" && root._overlayType !== "rectangle-primitive") {
				const border = root._borderEntity as OverlayEntity | undefined;
				if (root._isThickOutline && border && (border as any).polyline) {
					return;
				}
			}

			let positions: Cesium.Cartesian3[] = [];
			if (Array.isArray((root as any)._primitiveOutlinePositions) && (root as any)._primitiveOutlinePositions.length > 0) {
				positions = (root as any)._primitiveOutlinePositions as Cesium.Cartesian3[];
			}

			if (positions.length === 0 && root.polygon) {
				const h: any = (root.polygon as any).hierarchy;
				const hv: any = (h && typeof h.getValue === "function") ? h.getValue(Cesium.JulianDate.now()) : h;
				const outer: Cesium.Cartesian3[] | undefined = hv?.positions || hv;
				if (Array.isArray(outer) && outer.length > 2) {
					positions = this.getClosedPositions(outer as Cesium.Cartesian3[]);
				}
			}

			if (positions.length === 0 && root.rectangle) {
				const cProp: any = (root.rectangle as any).coordinates;
				const rect: Cesium.Rectangle | undefined = (cProp && typeof cProp.getValue === "function") ? cProp.getValue(Cesium.JulianDate.now()) : cProp;
				if (rect && Number.isFinite((rect as any).west)) {
					const h = (root._clampToGround ?? true) ? 0 : (root._baseHeight ?? 0);
					const base = [
						Cesium.Cartesian3.fromRadians(rect.west, rect.south, h),
						Cesium.Cartesian3.fromRadians(rect.east, rect.south, h),
						Cesium.Cartesian3.fromRadians(rect.east, rect.north, h),
						Cesium.Cartesian3.fromRadians(rect.west, rect.north, h),
					];
					positions = this.getClosedPositions(base);
				}
			}

			if (positions.length === 0) {
				const centerCarto = (root as any)._centerCartographic as Cesium.Cartographic | undefined;
				if (centerCarto && Number.isFinite(centerCarto.longitude) && Number.isFinite(centerCarto.latitude)) {
					const h = (root._clampToGround ?? true) ? 0 : (root._baseHeight ?? 0);
					const center = Cesium.Cartesian3.fromRadians(centerCarto.longitude, centerCarto.latitude, h);
					const radius = Number((root as any)._outerRadius ?? 0);
					const seg = Number((root as any)._ringSegments ?? 128);
					if (radius > 0) {
						positions = this.generateEllipseOutlinePositions(center, radius, radius, 0, seg);
					}
				} else if (root.ellipse && root.position) {
					const center = root.position.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3;
					const el: any = root.ellipse;
					const a = this.getNumberProperty(el.semiMajorAxis, 0);
					const b = this.getNumberProperty(el.semiMinorAxis, 0);
					const rot = this.getNumberProperty(el.rotation, 0);
					positions = this.generateEllipseOutlinePositions(center, a, b, rot, 128);
				}
			}

			if (!positions || positions.length < 4) return;

			const clampToGround = root._clampToGround ?? true;
			const widthBase = Math.max(
				2,
				Number((root as any)._outlineWidth ?? 1) || 1,
				Number((root.rectangle as any)?.outlineWidth?.getValue?.(Cesium.JulianDate.now()) ?? 1) || 1,
				Number((root.polygon as any)?.outlineWidth?.getValue?.(Cesium.JulianDate.now()) ?? 1) || 1
			);

			const glowId = `__vmap__highlight_glow__${String((root as any).id)}`;
			const existed = this.entities.getById(glowId);
			if (existed) {
				try { this.entities.remove(existed); } catch { /* ignore */ }
			}

			const glowEntity = this.entities.add({
				id: glowId,
				polyline: {
					positions,
					width: widthBase + 2,
					material: new Cesium.PolylineGlowMaterialProperty({
						color,
						glowPower: OverlayHighlight.DEFAULT_HIGHLIGHT_GLOW_POWER,
					}),
					clampToGround,
					...(clampToGround ? { zIndex: 999 } : {}),
				},
			});

			try {
				(glowEntity as any).properties = new Cesium.PropertyBag({
					[OverlayHighlight.GLOW_OUTLINE_ROOT_ID_PROP]: String((root as any).id),
				});
			} catch {
				// ignore
			}

			root._highlightGlowEntity = glowEntity;
		} catch {
			// ignore
		}
	}

	private removeGlowOutline(root: OverlayEntity): void {
		const glow = root._highlightGlowEntity;
		if (!glow) return;
		try {
			this.entities.remove(glow);
		} catch {
			// ignore
		}
		root._highlightGlowEntity = undefined;
	}

	private applyOverlayHighlightStyle(entity: OverlayEntity): void {
		if (!entity._highlightOriginalStyle) entity._highlightOriginalStyle = {};

		const root = (entity._highlightEntities && entity._highlightEntities.length > 0)
			? (entity._highlightEntities[0] as OverlayEntity)
			: entity;

		const { color: hl, fillAlpha } = this.getActiveHighlightOptions(entity);

		if (entity._overlayType === "circle-primitive") {
			this.host.getCircle().applyPrimitiveHighlight(entity, hl, fillAlpha);
			this.ensureGlowOutline(root, hl);
			return;
		}
		if (entity._overlayType === "polygon-primitive") {
			this.host.getPolygon().applyPrimitiveHighlight(entity, hl, fillAlpha);
			this.ensureGlowOutline(root, hl);
			return;
		}
		if (entity._overlayType === "rectangle-primitive") {
			this.host.getRectangle().applyPrimitiveHighlight(entity, hl, fillAlpha);
			this.ensureGlowOutline(root, hl);
			return;
		}

		if (entity.point) {
			const p = entity.point;
			if (!entity._highlightOriginalStyle.point) {
				entity._highlightOriginalStyle.point = {
					pixelSize: p.pixelSize,
					color: p.color,
					outlineColor: p.outlineColor,
					outlineWidth: p.outlineWidth,
				};
			}
			const pixelSize = this.getNumberProperty(p.pixelSize, 10);
			const outlineWidth = this.getNumberProperty(p.outlineWidth, 2);
			p.pixelSize = new Cesium.ConstantProperty(pixelSize + 3);
			p.color = new Cesium.ConstantProperty(hl.withAlpha(0.9));
			p.outlineColor = new Cesium.ConstantProperty(hl);
			p.outlineWidth = new Cesium.ConstantProperty(Math.max(3, outlineWidth + 1));
		}

		if (entity.label) {
			const l = entity.label;
			if (!entity._highlightOriginalStyle.label) {
				entity._highlightOriginalStyle.label = {
					fillColor: l.fillColor,
					outlineColor: l.outlineColor,
					outlineWidth: l.outlineWidth,
					scale: l.scale,
				};
			}
			const scale = this.getNumberProperty(l.scale, 1);
			const outlineWidth = this.getNumberProperty(l.outlineWidth, 2);
			l.fillColor = new Cesium.ConstantProperty(hl);
			l.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK);
			l.outlineWidth = new Cesium.ConstantProperty(Math.max(2, outlineWidth));
			l.scale = new Cesium.ConstantProperty(scale * 1.08);
		}

		if (entity.billboard) {
			const b = entity.billboard;
			if (!entity._highlightOriginalStyle.billboard) {
				entity._highlightOriginalStyle.billboard = {
					scale: b.scale,
					color: b.color,
				};
			}
			const scale = this.getNumberProperty(b.scale, 1);
			b.scale = new Cesium.ConstantProperty(scale * 1.08);
			b.color = new Cesium.ConstantProperty(hl);
		}

		if (entity.polyline) {
			const pl = entity.polyline;
			if (!entity._highlightOriginalStyle.polyline) {
				entity._highlightOriginalStyle.polyline = {
					width: pl.width,
					material: pl.material,
				};
			}
			const width = this.getNumberProperty(pl.width, 2);
			pl.width = new Cesium.ConstantProperty(width + 2);

			const glowPower = (pl.material instanceof Cesium.PolylineGlowMaterialProperty)
				? (pl.material as any).glowPower
				: undefined;
			pl.material = new Cesium.PolylineGlowMaterialProperty({
				color: hl,
				glowPower: typeof glowPower === "number" ? glowPower : OverlayHighlight.DEFAULT_HIGHLIGHT_GLOW_POWER,
			});
		}

		if (entity.polygon) {
			const pg = entity.polygon;
			if (!entity._highlightOriginalStyle.polygon) {
				entity._highlightOriginalStyle.polygon = {
					outline: (pg as any).outline,
					outlineColor: pg.outlineColor,
					outlineWidth: pg.outlineWidth,
					material: pg.material,
				};
			}

			(pg as any).outline = new Cesium.ConstantProperty(true);
			this.ensureGlowOutline(root, hl);
		}

		if (entity.rectangle) {
			const r = entity.rectangle;
			if (!entity._highlightOriginalStyle.rectangle) {
				entity._highlightOriginalStyle.rectangle = {
					outline: (r as any).outline,
					outlineColor: r.outlineColor,
					outlineWidth: r.outlineWidth,
					material: r.material,
				};
			}
			(r as any).outline = new Cesium.ConstantProperty(true);
			this.ensureGlowOutline(root, hl);
		}

		if (entity.ellipse) {
			const el = entity.ellipse;
			if (!entity._highlightOriginalStyle.ellipse) {
				entity._highlightOriginalStyle.ellipse = {
					outline: (el as any).outline,
					outlineColor: el.outlineColor,
					outlineWidth: el.outlineWidth,
					material: el.material,
				};
			}
			(el as any).outline = new Cesium.ConstantProperty(true);
			this.ensureGlowOutline(root, hl);
		}

		entity._isHighlighted = true;
	}

	private restoreOverlayHighlightStyle(entity: OverlayEntity): void {
		const root = (entity._highlightEntities && entity._highlightEntities.length > 0)
			? (entity._highlightEntities[0] as OverlayEntity)
			: entity;

		if (entity._overlayType === "circle-primitive") {
			this.removeGlowOutline(root);
			this.host.getCircle().restorePrimitiveHighlight(entity);
			return;
		}
		if (entity._overlayType === "polygon-primitive") {
			this.removeGlowOutline(root);
			this.host.getPolygon().restorePrimitiveHighlight(entity);
			return;
		}
		if (entity._overlayType === "rectangle-primitive") {
			this.removeGlowOutline(root);
			this.host.getRectangle().restorePrimitiveHighlight(entity);
			return;
		}

		if (!entity._isHighlighted) return;
		const orig = entity._highlightOriginalStyle;
		if (!orig) {
			entity._isHighlighted = false;
			return;
		}

		if (entity.point && orig.point) {
			const p = entity.point;
			p.pixelSize = orig.point.pixelSize;
			p.color = orig.point.color;
			p.outlineColor = orig.point.outlineColor;
			p.outlineWidth = orig.point.outlineWidth;
		}

		if (entity.label && orig.label) {
			const l = entity.label;
			l.fillColor = orig.label.fillColor;
			l.outlineColor = orig.label.outlineColor;
			l.outlineWidth = orig.label.outlineWidth;
			l.scale = orig.label.scale;
		}

		if (entity.billboard && orig.billboard) {
			const b = entity.billboard;
			b.scale = orig.billboard.scale;
			b.color = orig.billboard.color;
		}

		if (entity.polyline && orig.polyline) {
			const pl = entity.polyline;
			pl.width = orig.polyline.width;
			pl.material = orig.polyline.material;
		}

		if (entity.polygon && orig.polygon) {
			const pg = entity.polygon;
			(pg as any).outline = orig.polygon.outline;
			pg.outlineColor = orig.polygon.outlineColor;
			pg.outlineWidth = orig.polygon.outlineWidth;
			pg.material = orig.polygon.material;
		}

		if (entity.rectangle && orig.rectangle) {
			const r = entity.rectangle;
			(r as any).outline = orig.rectangle.outline;
			r.outlineColor = orig.rectangle.outlineColor;
			r.outlineWidth = orig.rectangle.outlineWidth;
			r.material = orig.rectangle.material;
		}

		if (entity.ellipse && orig.ellipse) {
			const el = entity.ellipse;
			(el as any).outline = orig.ellipse.outline;
			el.outlineColor = orig.ellipse.outlineColor;
			el.outlineWidth = orig.ellipse.outlineWidth;
			el.material = orig.ellipse.material;
		}

		this.removeGlowOutline(root);

		entity._isHighlighted = false;
	}
}
