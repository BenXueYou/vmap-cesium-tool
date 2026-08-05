import { describe, expect, it, vi } from 'vitest';

import { MeasurementService } from '../src/libs/toolBar/MeasurementService';

describe('MeasurementService', () => {
  it('enables distance labels by default for measurement mode', () => {
    const drawHelper = {
      startDrawingLine: vi.fn(),
    };
    const service = new MeasurementService({} as never, drawHelper);

    service.startDistanceMeasurement();

    expect(drawHelper.startDrawingLine).toHaveBeenCalledWith(
      expect.objectContaining({ showDistanceLabel: true }),
    );
  });

  it('enables area labels by default for measurement mode', () => {
    const drawHelper = {
      startDrawingPolygon: vi.fn(),
    };
    const service = new MeasurementService({} as never, drawHelper);

    service.startAreaMeasurement();

    expect(drawHelper.startDrawingPolygon).toHaveBeenCalledWith(
      expect.objectContaining({ showAreaLabel: true }),
    );
  });
});
