import { CesiumMapMark, type MarkDrawResult } from '../src';

export function createMarkDemo(viewer: any) {
  const mark = new CesiumMapMark(viewer, {
    showToolbar: true,
    buttons: ['point', 'polyline', 'polygon', 'rectangle', 'circle'],
    continuous: false,
    defaultColor: '#00A3FF',
    colors: {
      rectangle: '#FF8A00',
    },
    callbacks: {
      onDrawEnd: (result: MarkDrawResult | null) => {
        console.log('draw end', result);
      },
      onWorkAreaDrawEnd: (result: MarkDrawResult | null) => {
        console.log('work area end', result);
      },
      onEditChange: (result: MarkDrawResult | null) => {
        console.log('editing', result);
      },
      onEditEnd: (result: MarkDrawResult | null) => {
        console.log('edit end', result);
      },
      onColorChange: (color: string, drawType?: string) => {
        console.log('color changed', drawType, color);
      },
    },
  });

  return mark;
}

export function drawRectangleWorkArea(mark: any) {
  mark.startWorkAreaDraw('rectangle', 'noFly', {
    outputCoordSystem: 'WGS84',
  });
}
