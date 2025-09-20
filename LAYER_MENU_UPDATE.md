# 图层菜单布局优化

## 修改内容

已成功调整图层按钮的弹出浮窗样式，将图层选项从横向排列改为纵向排列。

### 主要修改点：

1. **菜单容器样式优化**：
   - 增加了 `display: flex` 和 `flex-direction: column` 确保纵向布局
   - 调整了 `min-width` 从 200px 到 220px，增加了 `max-width: 280px`
   - 优化了阴影效果和圆角
   - 增加了内边距从 8px 到 12px

2. **地图类型区域样式**：
   - 为 `mapTypeSection` 添加了 `display: flex` 和 `flex-direction: column`
   - 设置了 `gap: 4px` 来增加选项之间的间距
   - 优化了标题样式，增加了颜色和字体大小

3. **图层选项项样式**：
   - 增加了 `width: 100%` 和 `box-sizing: border-box` 确保完整宽度
   - 调整了内边距从 `6px` 到 `8px 12px`
   - 优化了圆角从 3px 到 4px

4. **缩略图样式**：
   - 增加了尺寸从 20px 到 24px
   - 添加了 `flex-shrink: 0` 防止压缩
   - 优化了圆角

5. **标签样式**：
   - 添加了 `flex: 1` 让标签占据剩余空间
   - 设置了明确的颜色 `#333`

6. **选中标记样式**：
   - 添加了 `flex-shrink: 0` 防止压缩
   - 增加了字体大小到 16px

### 修改后的效果：

- ✅ 图层选项现在明确地纵向排列
- ✅ 每个选项占据完整的菜单宽度
- ✅ 缩略图、标签和选中标记水平对齐
- ✅ 选项之间有适当的间距
- ✅ 整体视觉效果更加清晰和专业

### 代码结构：

```typescript
// 菜单容器 - 纵向布局
menu.style.cssText = `
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 280px;
  padding: 12px;
  // ... 其他样式
`;

// 地图类型区域 - 纵向排列
mapTypeSection.style.cssText = `
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

// 每个图层选项 - 水平布局，垂直堆叠
mapTypeItem.style.cssText = `
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  // ... 其他样式
`;
```

这样的布局确保了：
- 图层选项垂直排列（从上到下）
- 每个选项内部的元素（缩略图、标签、选中标记）水平对齐
- 整体布局清晰、易用
