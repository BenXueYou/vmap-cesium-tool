import type * as Cesium from 'cesium';

export function createRoundedLabelCanvas(
  text: string,
  options: {
    font: string;
    textColor: Cesium.Color;
    backgroundColor: Cesium.Color;
    borderRadius: number;
  },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }

  const horizontalPadding = 12;
  const verticalPadding = 8;
  context.font = options.font;
  const metrics = context.measureText(text);
  const fontSizeMatch = options.font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 13;
  const textHeight = Math.ceil(fontSize * 1.3);
  const width = Math.ceil(metrics.width + horizontalPadding * 2);
  const height = Math.ceil(textHeight + verticalPadding * 2);
  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.font = options.font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = options.backgroundColor.toCssColorString();
  drawRoundedRect(context, 0, 0, width, height, Math.min(options.borderRadius, height / 2, width / 2));
  context.fill();
  context.fillStyle = options.textColor.toCssColorString();
  context.fillText(text, width / 2, height / 2);

  return canvas;
}

export function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}