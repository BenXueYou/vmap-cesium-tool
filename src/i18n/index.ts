import { i18n as coreI18n, type I18nLike } from "../libs/i18n";
import zhCN from "./zh-CN";
import enUS from "./en-US";

if (typeof coreI18n.addMessages === "function") {
  coreI18n.addMessages("zh-CN", zhCN, { merge: true });
  coreI18n.addMessages("en-US", enUS, { merge: true });
}

export const i18n = coreI18n;
export type { I18nLike };