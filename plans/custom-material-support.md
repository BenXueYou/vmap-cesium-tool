# vmap-cesium-tool 自定义材质支持分析与改造方案

> 分析日期：2026-06-01  
> 涉及模块：`src/libs/overlay/`、`src/libs/drawHelper/`

---

## 一、背景

`vmap-cesium-tool` 对外提供两套图形绘制/覆盖物工具：

- **overlay**：静态覆盖物，`MapCircle` / `MapPolygon` / `MapPolyline` / `MapRectangle` / `MapRing` / `MapMarker` / `MapIcon` / `MapLabel`
- **drawHelper**：交互式绘制，`DrawCircle` / `DrawPolygon` / `DrawLine` / `DrawRectangle`（均基于 `BaseDraw`）

业务侧若需使用条纹、棋盘、图片、动态水波等 Cesium 内置或自定义 `MaterialProperty`，需提前评估哪些路径已支持、哪些存在缺口。

---

## 二、当前支持状态

### 2.1 overlay 模块

| 类 | `material` 字段类型 | entity 模式 | primitive 模式 |
|---|---|---|---|
| `MapCircle` | `MaterialProperty \| Color \| string` | ✅ 完整支持 | ⚠️ 仅纯色（自动降级至 entity） |
| `MapPolygon` | `MaterialProperty \| Color \| string` | ✅ 完整支持 | ⚠️ 仅纯色（自动降级至 entity） |
| `MapPolyline` | `MaterialProperty \| Color \| string` | ✅ 完整支持 | — |
| `MapRectangle` | `MaterialProperty \| Color \| string` | ✅ 完整支持 | ⚠️ 仅纯色（自动降级至 entity） |
| `MapRing` | 无 `material` 字段 | ❌ 仅颜色控制 | — |
| `MapMarker` | 无 `material` 字段 | N/A（点实体） | — |
| `MapIcon` | 无 `material` 字段 | N/A（图标实体） | — |
| `MapLabel` | 无 `material` 字段 | N/A（文字实体） | — |

**说明：**

- entity 模式下，`resolveMaterial()` 已将 `MaterialProperty` 原样传入 Cesium 实体，自定义材质正常生效。
- primitive 模式使用 `PerInstanceColorAppearance`，Cesium 架构层限制只能承载 `Color`；传入复杂材质时内部调用 `resolveMaterialColor()` 返回 `null`，自动通过 `canUsePrimitive() === false` 降级为 entity 模式，**不报错、不崩溃，但 primitive 批处理失效**。
- `MapRing` 用 `lineMaterialMode: 'stripe' | 'dash'` 做了内置有限材质切换，但没有开放通用 `material` 字段。

### 2.2 drawHelper 模块

| 类 | 颜色字段类型 | 支持 MaterialProperty | 
|---|---|---|
| `DrawLine` | `strokeColor?: Color \| string` | ❌ |
| `DrawCircle` | `fillColor?: Color \| string`，`outlineColor?: Color \| string` | ❌ |
| `DrawPolygon` | `fillColor?: Color \| string`，`strokeColor?: Color \| string` | ❌ |
| `DrawRectangle` | `fillColor?: Color \| string`，`outlineColor?: Color \| string` | ❌ |

所有绘制类的 `DrawOptions` 颜色字段类型被收窄为 `Color | string`，在 `updateDrawingEntity()`（预览阶段）和 `finishDrawing()`（落图阶段）均硬编码为 `new Cesium.ColorMaterialProperty(resolvedColor)`，**无法透传 `MaterialProperty`**。

---

## 三、缺口汇总

| # | 缺口描述 | 影响范围 | 优先级 |
|---|---|---|---|
| G-1 | `DrawOptions.fillColor/strokeColor/outlineColor` 类型无 `MaterialProperty` | 所有绘制工具 | 高 |
| G-2 | `DrawCircle/DrawPolygon/DrawLine/DrawRectangle` 落图实体材质硬编码 `ColorMaterialProperty` | 绘制结果图形 | 高 |
| G-3 | 预览阶段（`updateDrawingEntity`）材质也硬编码 `ColorMaterialProperty` | 绘制交互过程 | 中（预览可不支持复杂材质） |
| G-4 | `MapRing` 无通用 `material` 字段 | 环形覆盖物 | 中 |
| G-5 | primitive 模式不支持复杂材质（Cesium 架构限制） | 批量渲染场景 | 低（已自动降级） |

---

## 四、修复方案

### 方案 A：仅修复 drawHelper（最小改动，推荐优先）

#### A-1：扩展 `BaseDraw.ts` 的 `DrawOptions`

```ts
// src/libs/drawHelper/BaseDraw.ts
export interface DrawOptions {
  // 扩展：支持 MaterialProperty（向后兼容，原 Color | string 依然有效）
  strokeColor?: Cesium.MaterialProperty | Cesium.Color | string;
  strokeWidth?: number;
  fillColor?: Cesium.MaterialProperty | Cesium.Color | string;
  outlineColor?: Cesium.MaterialProperty | Cesium.Color | string;
  outlineWidth?: number;
  // ... 其余字段不变
}
```

#### A-2：在 `BaseDraw` 中添加 `resolveMaterial()` 工具方法

```ts
// 在 BaseDraw 类中添加 protected 方法
protected resolveMaterial(
  color?: Cesium.MaterialProperty | Cesium.Color | string,
  defaultColor: Cesium.Color = Cesium.Color.WHITE
): Cesium.MaterialProperty {
  if (!color) return new Cesium.ColorMaterialProperty(defaultColor);
  if (typeof color === 'string') {
    return new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(color));
  }
  if (color instanceof Cesium.Color) {
    return new Cesium.ColorMaterialProperty(color);
  }
  // MaterialProperty 原样返回
  return color as Cesium.MaterialProperty;
}
```

#### A-3：修改各子类落图阶段（`finishDrawing`）

以 `DrawPolygon` 为例：

```ts
// Before
const fillColor = this.drawOptions?.fillColor
  ? this.resolveColor(this.drawOptions.fillColor)      // ← 只能处理 Color
  : Cesium.Color.LIGHTGREEN.withAlpha(0.3);

polygon: {
  material: new Cesium.ColorMaterialProperty(fillColor), // ← 硬编码
}

// After
const fillMaterial = this.resolveMaterial(
  this.drawOptions?.fillColor,
  Cesium.Color.LIGHTGREEN.withAlpha(0.3)
);

polygon: {
  material: fillMaterial,  // ← 直接透传 MaterialProperty
}
```

同样逻辑适用于 `DrawCircle`（椭圆填充）、`DrawLine`（折线 material）、`DrawRectangle`（矩形填充）。

#### A-4：预览阶段（`updateDrawingEntity`）——可选

预览阶段通常用低透明度纯色即可，建议保持纯色预览，落图时才应用自定义材质，降低改动面。如需预览也支持，同样将 `ColorMaterialProperty(fillColor)` 替换为 `resolveMaterial(fillMaterial)` 即可。

---

### 方案 B：补充 `MapRing` 的 `material` 字段（可选）

`MapRing` 目前用 `lineMaterialMode` 控制有限内置样式。若业务需要更灵活的自定义线材质，可在 `RingOptions` 中新增：

```ts
export interface RingOptions {
  // 新增：自定义线材质（优先级高于 lineMaterialMode）
  material?: Cesium.MaterialProperty | Color | string;
  // ... 原有字段不变
}
```

内部在设置 polyline 材质时优先使用 `material`，否则沿用原有 `lineMaterialMode` 逻辑。

---

## 五、业务侧使用示例（改造完成后）

### 5.1 overlay 覆盖物（当前已可用）

```ts
import * as Cesium from 'cesium';

// 条纹材质
const stripeMaterial = new Cesium.StripeMaterialProperty({
  evenColor: Cesium.Color.WHITE.withAlpha(0.5),
  oddColor: Cesium.Color.BLUE.withAlpha(0.5),
  repeat: 10,
});

mapCircle.add({
  position: [116.4, 39.9],
  radius: 500,
  material: stripeMaterial,   // ✅ entity 模式已支持
  outlineWidth: 3,
});

mapPolygon.add({
  positions: [[116.3, 39.8], [116.5, 39.8], [116.5, 40.0], [116.3, 40.0]],
  material: new Cesium.ImageMaterialProperty({ image: '/textures/pattern.png' }),
});
```

### 5.2 drawHelper 绘制（改造后可用）

```ts
drawPolygon.startDrawing({
  fillColor: new Cesium.StripeMaterialProperty({
    evenColor: Cesium.Color.YELLOW.withAlpha(0.4),
    oddColor: Cesium.Color.TRANSPARENT,
    repeat: 8,
  }),
  strokeColor: Cesium.Color.ORANGE,
  strokeWidth: 2,
});
```

---

## 六、注意事项

1. **primitive 模式不可用复杂材质**：这是 Cesium `PerInstanceColorAppearance` 的根本限制，无法通过修改插件代码解决。若业务必须 primitive 批处理 + 自定义材质，需使用 `Primitive` + 自定义 `MaterialAppearance`，属于较大规模重构。

2. **动态材质性能**：`CallbackProperty` 类型的 `MaterialProperty`（如动态水波）在大量实体场景下会导致每帧调用回调，注意性能。

3. **向后兼容**：`DrawOptions` 扩展时原有 `Color | string` 类型是子集，改为 `MaterialProperty | Color | string` 不会破坏现有调用方。

4. **高亮恢复**：overlay 的 `clickHighlight` / `hoverHighlight` 高亮逻辑在还原时依赖 `_highlightOriginalStyle.material`，若传入自定义 `MaterialProperty`，需确认 `OverlayHighlight.ts` 中还原逻辑能正确恢复原始 `MaterialProperty` 引用（而非转换为颜色后恢复）。

---

## 七、改动文件清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/libs/drawHelper/BaseDraw.ts` | 扩展接口 + 新增方法 | `DrawOptions` 类型扩展；新增 `resolveMaterial()` |
| `src/libs/drawHelper/DrawCircle.ts` | 逻辑修改 | `finishDrawing` 改用 `resolveMaterial()` |
| `src/libs/drawHelper/DrawPolygon.ts` | 逻辑修改 | `finishDrawing` 改用 `resolveMaterial()` |
| `src/libs/drawHelper/DrawLine.ts` | 逻辑修改 | `finishDrawing` 改用 `resolveMaterial()` |
| `src/libs/drawHelper/DrawRectangle.ts` | 逻辑修改 | `finishDrawing` 改用 `resolveMaterial()` |
| `src/libs/overlay/MapRing.ts` | 可选扩展 | `RingOptions` 新增 `material` 字段 |
