# CesiumOverlayService API 文档

## 概述

`CesiumOverlayService` 是覆盖物统一管理服务：

- 统一创建/更新/删除覆盖物（点、文字、图标、SVG、信息窗、线、面、矩形、圆、圆环等）
- 统一管理覆盖物 id（内部 `overlayMap`）
- 提供点击/悬浮高亮能力（clickHighlight / hoverHighlight）
- 内置点击与 hover 拾取处理（与绘制模块有冲突规避）

源码位于 `src/libs/CesiumOverlayService.ts`，各覆盖物工具类位于 `src/libs/overlay/*`。

## 基本用法

```ts
import { CesiumOverlayService } from '@xingm/vmap-cesium-toolbar';

const overlay = new CesiumOverlayService(viewer);

// 1) 点
const marker = overlay.addMarker({
  id: 'm1',
  position: [116.3974, 39.9093],
  pixelSize: 10,
  clickHighlight: true,
});

// 2) 信息窗
overlay.addInfoWindow({
  id: 'info1',
  position: [116.3974, 39.9093],
  content: '北京',
  showArrow: true,
});

// 3) 更新位置
overlay.updateOverlayPosition('m1', [121.4737, 31.2304]);

// 4) 显示/隐藏
overlay.setOverlayVisible('info1', false);

// 5) 清理
overlay.removeAllOverlays();
overlay.destroy();
```

## 坐标类型：OverlayPosition

大多数覆盖物都使用 `OverlayPosition` 描述位置：

- `Cesium.Cartesian3`
- `[lon, lat]`
- `[lon, lat, height]`

注意：内部会校验坐标是否为有限数（NaN/Infinity 会抛错或被忽略）。

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

创建后会：

- 在 `viewer.container` 内部插入一个信息窗容器（用于 HTML InfoWindow）
- 注册实体 click/hover 的 ScreenSpaceEventHandler

## 高亮相关

### toggleOverlayHighlight

```ts
toggleOverlayHighlight(entity: OverlayEntity, reason?: 'click' | 'hover'): void
```

对一个覆盖物（或复合覆盖物组）切换高亮状态。

### setOverlayHighlight

```ts
setOverlayHighlight(entityOrId: OverlayEntity | string, enabled: boolean, reason?: 'click' | 'hover'): boolean
```

显式开启/关闭某覆盖物高亮。

### clickHighlight / hoverHighlight 选项

多数覆盖物 options 都支持：

```ts
clickHighlight?: boolean | { color?: Cesium.Color | string; fillAlpha?: number }
hoverHighlight?: boolean | { color?: Cesium.Color | string; fillAlpha?: number }
```

- `color`：高亮主色（默认 yellow）
- `fillAlpha`：面填充高亮透明度（默认 0.35）

## 创建覆盖物（add 系列）

> 以下方法都会把最终 id 写入内部 `overlayMap`，便于后续用 id 更新/删除。

```ts
addMarker(options: MarkerOptions): Cesium.Entity
addLabel(options: LabelOptions): Cesium.Entity
addIcon(options: IconOptions): Cesium.Entity
addSvg(options: SvgOptions): Cesium.Entity
addInfoWindow(options: InfoWindowOptions): Cesium.Entity
addPolyline(options: PolylineOptions): Cesium.Entity
addPolygon(options: PolygonOptions): Cesium.Entity
addRectangle(options: RectangleOptions): Cesium.Entity
addCircle(options: CircleOptions): Cesium.Entity
addRing(options: RingOptions): Cesium.Entity
```

## 入参说明（options）

以下 options 类型与源码/类型声明保持一致（可参考 `src/types/index.d.ts` 与 `src/libs/overlay/*`）。

### 通用字段（多数覆盖物都支持）

- `id?: string`
  - 覆盖物 id。不传则自动生成。
- `clickHighlight?: boolean | { color?: Cesium.Color | string; fillAlpha?: number }`
  - 点击高亮。`color` 默认 yellow；`fillAlpha` 默认 0.35（面填充高亮透明度）。
- `hoverHighlight?: boolean | { color?: Cesium.Color | string; fillAlpha?: number }`
  - 悬浮高亮。
- `onClick?: (entity: Cesium.Entity) => void`
  - 覆盖物被点击时回调。

### addMarker(options: MarkerOptions)

- `position: OverlayPosition`：位置（`Cartesian3` / `[lon,lat]` / `[lon,lat,height]`）
- `pixelSize?: number`：点大小（像素，默认 10）
- `color?: Cesium.Color | string`：填充色（默认 red）
- `outlineColor?: Cesium.Color | string`：描边色（默认 white）
- `outlineWidth?: number`：描边宽度（默认 2）
- `heightReference?: Cesium.HeightReference` ：高度参考（默认 `Cesium.HeightReference.CLAMP_TO_GROUND`）
- `scaleByDistance?: Cesium.NearFarScalar`：随距离缩放
- `disableDepthTestDistance?: number`：深度测试距离（默认 `Infinity`）

### addLabel(options: LabelOptions)

- `position: OverlayPosition` ：位置
- `text: string`：文字内容
- `font?: string`：字体（如 `'14px sans-serif'`）
- `fillColor?: Cesium.Color | string`：文字颜色
- `outlineColor?: Cesium.Color | string` ：文字描边色
- `outlineWidth?: number` ：文字描边宽度
- `style?: Cesium.LabelStyle` ：文字样式（默认 `Cesium.LabelStyle.FILL_AND_OUTLINE`）
- `pixelOffset?: Cesium.Cartesian2`：像素偏移
- `eyeOffset?: Cesium.Cartesian3` ：视角偏移
- `horizontalOrigin?: Cesium.HorizontalOrigin` ：水平对齐（默认 `Cesium.HorizontalOrigin.CENTER`）
- `verticalOrigin?: Cesium.VerticalOrigin` ：垂直对齐（默认 `Cesium.VerticalOrigin.CENTER`）
- `heightReference?: Cesium.HeightReference` ：高度参考（默认 `Cesium.HeightReference.CLAMP_TO_GROUND`）
- `scale?: number` ：整体缩放
- `showBackground?: boolean` ：是否显示背景
- `backgroundColor?: Cesium.Color | string` ：背景色
- `backgroundPadding?: Cesium.Cartesian2` ：背景内边距
- `disableDepthTestDistance?: number` ：深度测试距离（默认 `Infinity`）

### addIcon(options: IconOptions)

- `position: OverlayPosition` ：位置
- `image: string`：图片 URL/路径
- `width?: number` / `height?: number`：尺寸（像素）
- `scale?: number`：整体缩放
- `rotation?: number`：旋转（弧度）
- `pixelOffset?: Cesium.Cartesian2` ：像素偏移
- `eyeOffset?: Cesium.Cartesian3` ：视角偏移
- `horizontalOrigin?: Cesium.HorizontalOrigin` ：水平对齐（默认 `Cesium.HorizontalOrigin.CENTER`）
- `verticalOrigin?: Cesium.VerticalOrigin` ：垂直对齐（默认 `Cesium.VerticalOrigin.CENTER`）
- `heightReference?: Cesium.HeightReference` ：高度参考（默认 `Cesium.HeightReference.CLAMP_TO_GROUND`）
- `disableDepthTestDistance?: number` ：深度测试距离（默认 `Infinity`）
- `color?: Cesium.Color | string`：颜色叠加（部分材质/图片可能不明显）

### addSvg(options: SvgOptions)

- `position: OverlayPosition`
- `svg: string`：SVG 字符串（内部会转为 image 使用）
- 其余字段与 `IconOptions` 基本一致（`width/height/scale/rotation/pixelOffset/...`）

### addInfoWindow(options: InfoWindowOptions)

InfoWindow 是 HTML 覆盖物（会向 `viewer.container` 注入 DOM 容器）。

- `position: OverlayPosition` ：位置
- `content: string | HTMLElement`：内容
- `width?: number` / `height?: number` ：尺寸（像素）
- `pixelOffset?: Cesium.Cartesian2 | { x: number; y: number }` ：像素偏移
- `show?: boolean`：是否显示（默认 true）
- `closable?: boolean`：是否可关闭
- `onClick?: (entity: any) => void`：点击回调
- `onClose?: (entity: any) => void`：关闭回调
- `backgroundColor?: string`：背景色
- `color?: string`：文字颜色
- `font?: string`：字体
- `className?: string` / `style?: Partial<CSSStyleDeclaration>`：自定义样式
- `hideWhenOutOfView?: boolean`：离开视野时是否隐藏
- `anchorHeight?: number` / `anchorPixel?: number`：锚点相关（用于微调“气泡”与点位关系）
- `tailGap?: number`：箭头尾部间距
- `showArrow?: boolean` / `arrowSize?: number`：是否显示箭头及大小
- `positionOffset?: 'top' | 'bottom' | ...`：相对位置（用于控制窗体在点的哪一侧）
- `updateInterval?: number`：位置更新频率（ms）

### addPolyline(options: PolylineOptions)

- `positions: OverlayPosition[]`：折线点位数组（至少 2 个点）
- `width?: number`：线宽（像素）
- `material?: Cesium.MaterialProperty | Cesium.Color | string`：线材质/颜色
- `clampToGround?: boolean`：是否贴地

### addPolygon(options: PolygonOptions)

- `positions: OverlayPosition[]`：多边形点位数组（至少 3 个点）
- `layerKey?: string`
  - primitive 模式下的“业务图层键”。用于解决多个半透明面叠加时的边界不清/覆盖顺序不稳定问题。
  - 同一 `layerKey` 的覆盖物会被组织到同一个 primitive layer 中；不同 `layerKey` 会按“首次出现顺序”确定上下层。
- `renderMode?: 'auto' | 'entity' | 'primitive'`
  - `auto`（默认）：仅在“贴地 + 粗边框 + 纯色”等条件下可能切换为 primitive
  - `entity`：标准 Entity 方式
  - `primitive`：更适合大批量静态贴地覆盖物，但对材质/参数有约束
- `material?: Cesium.MaterialProperty | Cesium.Color | string`：填充材质/颜色
- `outline?: boolean`：是否描边
- `outlineColor?: Cesium.Color | string`
- `outlineWidth?: number`：描边宽度（粗边框是 primitive 选择的重要条件之一）
- `clampToGround?: boolean`：是否贴地
- `heightReference?: Cesium.HeightReference` ：高度参考（默认贴地）
- `extrudedHeight?: number`：拉伸高度（设置后通常会导致无法使用 primitive）

### addRectangle(options: RectangleOptions)

- `coordinates: Cesium.Rectangle`：矩形范围（`Cesium.Rectangle.fromDegrees(west,south,east,north)`）
- `layerKey?: string`：同 `PolygonOptions.layerKey`（primitive 分层键）
- `renderMode?: 'auto' | 'entity' | 'primitive'`：同 `PolygonOptions`
- `material?: Cesium.MaterialProperty | Cesium.Color | string` ：填充材质/颜色
- `outline?: boolean` ：是否描边
- `outlineColor?: Cesium.Color | string` ：描边颜色
- `outlineWidth?: number` ：描边宽度（粗边框是 primitive 选择的重要条件之一）
- `clampToGround?: boolean` ：是否贴地
- `height?: number` / `heightReference?: Cesium.HeightReference` ：高度（默认贴地）
- `extrudedHeight?: number` ：拉伸高度（设置后通常会导致无法使用 primitive）
- `heightEpsilon?: number`：高度容差

### addCircle(options: CircleOptions)

- `position: OverlayPosition`：圆心
- `radius: number`：半径（米）
- `layerKey?: string`：同 `PolygonOptions.layerKey`（primitive 分层键）
- `renderMode?: 'auto' | 'entity' | 'primitive'` ：同 `PolygonOptions`
- `material?: Cesium.MaterialProperty | Cesium.Color | string` ：填充材质/颜色
- `outline?: boolean` ：是否描边
- `outlineColor?: Cesium.Color | string` ：描边颜色
- `outlineWidth?: number`：粗边框时会走“环形方案/primitive 条件”
- `segments?: number`：分段数（越大越圆滑，默认实现会给一个合理值）
- `clampToGround?: boolean` ：是否贴地
- `heightReference?: Cesium.HeightReference` ：高度参考（默认贴地）
- `extrudedHeight?: number` ：拉伸高度（设置后通常会导致无法使用 primitive）
- `heightEpsilon?: number`：高度容差

### addRing(options: RingOptions)

- `position: OverlayPosition`：中心点
- `radius: number`：半径（米）
- `color?: Cesium.Color | string`：外层发光颜色
- `width?: number` / `glowWidth?: number`：线宽/外层发光线宽
- `glowPower?: number`：发光强度（0-1）
- `segments?: number`：分段数（默认 128）
- `clampToGround?: boolean`：是否贴地（默认 true）

内层线（白色芯子）相关：

- `showInnerLine?: boolean`：是否绘制内层线（默认 true）
- `lineColor?: Cesium.Color | string` ：内层线颜色
- `lineWidth?: number` ：内层线宽
- `lineStyle?: 'solid' | 'dashed'` ：内层线样式
- `lineMaterialMode?: 'stripe' | 'dash'` ：内层线材质模式（默认 `stripe`）
- `stripeRepeat?: number` ：内层线材质重复次数（默认 10）
- `dashLength?: number` ：内层线材质间隔长度（默认 10）
- `dashPattern?: number` ：内层线材质间隔模式（默认 0b10101010）
- `gapColor?: Cesium.Color | string` ：内层线材质间隔颜色（默认 `Cesium.Color.BLACK`）

### 关于 id

- 若 `options.id` 未传，服务会自动生成唯一 id
- 返回值是 `Cesium.Entity`（部分 primitive 模式下会返回“代理 entity”，不一定在 `viewer.entities` 集合内）

### 关于 primitive 渲染模式（性能）

部分覆盖物支持 `renderMode: 'primitive' | 'entity' | 'auto'`：

- `circle/polygon/rectangle` 在满足“贴地 + 粗边框 + 纯色”等条件时，`auto` 可能会选择 primitive 分支
- primitive 分支一般更适合“大批量静态覆盖物”，但对材质/参数有约束

具体约束请以对应 options 的注释为准（例如 `CircleOptions`、`PolygonOptions`）。

### primitive 分层叠加（layerKey）与边界清晰

当 `circle/polygon/rectangle` 选择 `renderMode: 'primitive'`（或 `auto` 进入 primitive 分支）且存在多个半透明面重叠时，推荐为不同业务区域显式传入 `layerKey`（如 `detect/alarm/control`）。

实现行为（用于稳定叠加视觉效果）：

- **全局 two-pass**：先绘制所有 fill（填充），再绘制所有 ring/border（边框）。因此边框会始终压在所有填充之上，重叠区域也能保持边界清晰。
- **按 layerKey 分层**：不同 `layerKey` 会创建独立的 primitive layer；layer 的上下顺序按该 `layerKey` **首次出现的创建顺序**确定（不是按字母排序）。
- **不传 layerKey**：会进入默认层，适用于不需要业务分层时的普通叠加。

示例：

```ts
overlay.addPolygon({
  positions: [...],
  material: Cesium.Color.BLUE.withAlpha(0.25),
  outline: true,
  outlineColor: Cesium.Color.BLUE,
  outlineWidth: 10,
  renderMode: 'primitive',
  layerKey: 'detect',
});

overlay.addPolygon({
  positions: [...],
  material: Cesium.Color.RED.withAlpha(0.25),
  outline: true,
  outlineColor: Cesium.Color.RED,
  outlineWidth: 10,
  renderMode: 'primitive',
  layerKey: 'alarm',
});
```

注意：半透明 fill 的“混色”是正常的，但 `layerKey + two-pass` 能保证 **边框不会被其他填充盖住**，并让层级顺序稳定可控。

## 管理方法

### getOverlay

```ts
getOverlay(id: string): Cesium.Entity | undefined
```

### removeOverlay

```ts
removeOverlay(id: string): boolean
```

会同时处理：

- InfoWindow 的 DOM 清理
- 复合覆盖物关联实体（如 `_innerEntity` / `_borderEntity`）
- primitive 批处理资源释放（交由对应 Map* 工具类 remove）

### removeAllOverlays

```ts
removeAllOverlays(): void
```

### updateOverlayPosition

```ts
updateOverlayPosition(id: string, position: OverlayPosition): boolean
```

注意：

- 对 `Marker/Label/Icon/SVG/Circle/Ring/InfoWindow` 会进行实际位置更新
- 对 `Polyline/Polygon`（entity 模式）目前只给出提示（需要多个点位，单点更新不够表达）

### setOverlayVisible

```ts
setOverlayVisible(id: string, visible: boolean): boolean
```

会联动复合覆盖物的关联实体与 InfoWindow DOM。

### getAllOverlayIds / getAllOverlays

```ts
getAllOverlayIds(): string[]
getAllOverlays(): Cesium.Entity[]
```

### destroy

```ts
destroy(): void
```

释放资源并移除服务创建的 InfoWindow 容器。

## 与绘制模块的交互说明

绘制模块（DrawHelper）绘制期间会在 viewer 上挂载内部标记，用于临时屏蔽 overlay 的 pick/click/hover，以减少“结束绘制的那次点击/双击”误触覆盖物。
