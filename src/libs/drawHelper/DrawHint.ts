import type { Color } from 'cesium';

interface DrawHintOverrideConfig {
  text?: string | null;
  fillColor?: Color;
  outlineColor?: Color;
}

// 绘图提示助手存根实现
export class DrawHintHelper {
  constructor(...args: any[]) {}

  private overrideText: string | null = null;

  showHint(text: string): void {
    // 存根实现
    this.overrideText = text;
  }

  hideHint(): void {
    // 存根实现
    this.overrideText = null;
  }

  updateHint(position: any, text: string): void {
    // 存根实现
    this.overrideText = text;
  }

  clear(): void {
    this.overrideText = null;
  }

  refreshTextOnly(): void {}

  updatePosition(position: any): void {}

  handleSceneModeChanged(): void {}

  setOverride(config?: DrawHintOverrideConfig, timeoutMs?: number): void {
    void timeoutMs;
    this.overrideText = config?.text ?? null;
  }

  getDrawHintText(): string {
    return this.overrideText ?? '';
  }
}