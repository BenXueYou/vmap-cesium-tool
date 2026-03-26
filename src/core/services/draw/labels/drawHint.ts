import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';

import { createRoundedLabelCanvas } from './measurementCanvas';
import type { DrawMode, ResolvedMeasurementLabelStyle } from '../types/drawTypes';

export function buildHintText(mode: DrawMode, pointCount: number): string {
  if (!mode) {
    return '';
  }

  if (pointCount === 0) {
    if (mode === 'line' || mode === 'polygon') {
      return '地图上点击，绘制第一个点';
    }

    return '左击绘制区域';
  }

  if (mode === 'line') {
    if (pointCount === 1) {
      return '地图上点击，绘制下一点，实时计算距离';
    }

    return '左击继续绘制，右键删除点位，双击结束测距';
  }

  if (mode === 'polygon') {
    if (pointCount === 1) {
      return '地图上点击，绘制第二个点';
    }

    if (pointCount === 2) {
      return '地图上点击，绘制第三个点，开始计算面积';
    }

    return '左击继续绘制，右键删除点位，双击结束测面积';
  }

  return '左击绘制区域，右键删除点位，双击结束绘制';
}

export class DrawHintController {
  constructor(private readonly viewer: Viewer) {}

  createHintBillboardGraphics(text: string, style: ResolvedMeasurementLabelStyle): Cesium.BillboardGraphics {
    return new Cesium.BillboardGraphics({
      image: this.createHintBubbleCanvas(text, style),
      pixelOffset: style.pixelOffset,
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }

  createHintBubbleCanvas(text: string, style: ResolvedMeasurementLabelStyle): HTMLCanvasElement {
    return createRoundedLabelCanvas(text, {
      font: style.font,
      textColor: style.textColor,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
    });
  }

  show(position: Cartesian3, text: string, style: ResolvedMeasurementLabelStyle): Entity {
    return this.viewer.entities.add({
      position,
      billboard: this.createHintBillboardGraphics(text, style),
    });
  }

  update(entity: Entity, position: Cartesian3, text: string, style: ResolvedMeasurementLabelStyle): void {
    entity.position = new Cesium.ConstantPositionProperty(position);
    if (!entity.billboard) {
      entity.billboard = this.createHintBillboardGraphics(text, style);
      return;
    }

    entity.billboard.image = new Cesium.ConstantProperty(this.createHintBubbleCanvas(text, style));
    entity.billboard.pixelOffset = new Cesium.ConstantProperty(style.pixelOffset);
  }

  remove(entity: Entity | null): null {
    if (entity) {
      this.viewer.entities.remove(entity);
    }

    return null;
  }
}