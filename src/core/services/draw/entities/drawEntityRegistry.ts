import type { Entity, Viewer } from 'cesium';

export class DrawEntityRegistry {
  private readonly groups = new WeakMap<Entity, Entity[]>();

  bindAuxiliary(primary: Entity, auxiliary: Entity[]): void {
    const linked = [...auxiliary];
    this.groups.set(primary, linked);
    (primary as Entity & { _drawAuxiliaryEntities?: Entity[] })._drawAuxiliaryEntities = linked;
  }

  getAuxiliary(primary: Entity): Entity[] {
    return [...(this.groups.get(primary) ?? [])];
  }

  removeGroup(viewer: Viewer, primary: Entity): Entity[] {
    const auxiliary = this.getAuxiliary(primary);
    auxiliary.forEach((entity) => viewer.entities.remove(entity));
    viewer.entities.remove(primary);
    return auxiliary;
  }

  clear(viewer: Viewer, entities: Entity[], auxiliaryEntities: Entity[]): void {
    const uniqueEntities = new Set<Entity>([...entities, ...auxiliaryEntities]);
    uniqueEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
  }
}