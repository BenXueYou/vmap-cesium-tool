import { describe, expect, it } from 'vitest';
import * as Cesium from 'cesium';
import { Rectangle } from '../src/core/entities/Rectangle';

function createViewerStub() {
  const store: Cesium.Entity[] = [];
  return {
    entities: {
      add(entityLike: Cesium.Entity | Cesium.Entity.ConstructorOptions) {
        const entity = entityLike instanceof Cesium.Entity ? entityLike : new Cesium.Entity(entityLike);
        store.push(entity);
        return entity;
      },
      remove(entity: Cesium.Entity) {
        const index = store.indexOf(entity);
        if (index >= 0) {
          store.splice(index, 1);
          return true;
        }
        return false;
      },
      contains(entity: Cesium.Entity) {
        return store.includes(entity);
      },
    },
    isDestroyed() {
      return false;
    },
  } as unknown as Cesium.Viewer;
}

describe('Rectangle visibility', () => {
  it('hides both ring border and inner fill for thick rectangles', () => {
    const viewer = createViewerStub();
    const rectangle = new Rectangle(viewer, {
      id: 'rect-thick',
      coordinates: Cesium.Rectangle.fromDegrees(120, 30, 120.01, 30.01),
      material: Cesium.Color.RED.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 20,
    });

    const root = rectangle.getEntity() as Cesium.Entity & { _innerEntity?: Cesium.Entity };
    expect(root.show).toBe(true);
    expect(root._innerEntity?.show).toBe(true);

    rectangle.setVisible(false);

    expect(root.show).toBe(false);
    expect(root._innerEntity?.show).toBe(false);
  });
});
