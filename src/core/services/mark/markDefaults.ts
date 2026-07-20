import type { MarkDrawType } from './markTypes';

export const DEFAULT_MARK_COLORS: Record<MarkDrawType, string> = {
  point: '#ff5a5f',
  polyline: '#2d8cf0',
  polygon: 'rgba(45, 140, 240, 0.35)',
  rectangle: 'rgba(54, 179, 126, 0.35)',
  circle: 'rgba(250, 173, 20, 0.35)',
};
