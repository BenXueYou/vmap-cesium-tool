import type { CoordSystem, DrawMode, DrawResult, ToolbarConfig } from "../../src/index";
import type { PlaygroundMapProvider } from "../mapServiceConfig";

export type HighlightReason = "click" | "hover";
export type PlaygroundDrawMode = Exclude<DrawMode, null | "point">;

export interface OverlayInventoryItem {
  id: string;
  kind: string;
  visible: boolean;
}

export interface DrawInventoryItem {
  id: string;
  type: PlaygroundDrawMode;
}

export interface ToolbarFormState {
  mapProvider: PlaygroundMapProvider;
  position: ToolbarConfig["position"];
  direction: ToolbarConfig["direction"];
  buttonSize: number;
  buttonSpacing: number;
  zIndex: number;
  backgroundColor: string;
  borderColor: string;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  searchPanelBackground: string;
  searchWidth: number;
  defaultPlaceNameChecked: boolean;
  defaultNoFlyZoneChecked: boolean;
}

export interface OverlayFormState {
  hoverEnabled: boolean;
  clickPickMinIntervalMs: number;
  pickWidth: number;
  pickHeight: number;
  drillLimit: number;
  highlightReason: HighlightReason;
  markerLabel: string;
  circleRadius: number;
  rectangleWidth: number;
  rectangleHeight: number;
  infoTitle: string;
  infoBody: string;
}

export interface DrawFormState {
  mode: PlaygroundDrawMode;
  outputCoordSystem: CoordSystem;
  clampToGround: boolean;
  selfIntersectionEnabled: boolean;
  selfIntersectionAllowTouch: boolean;
  selfIntersectionAllowContinue: boolean;
}

export interface DrawStatusState {
  isDrawing: boolean;
  currentMode: PlaygroundDrawMode | null;
  lastSummary: string;
  lastCoordSystem: CoordSystem | "";
  lastResult: DrawResult | null;
}

export type PlaygroundShowMessage = (text: string, timeout?: number) => void;
