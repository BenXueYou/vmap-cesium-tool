<template>
  <div class="app-shell">
    <div id="cesiumContainer" class="map-host"></div>

    <div class="locale-panel">
      <div class="locale-title">{{ labels.switch }}</div>
      <label class="locale-row">
        <span class="locale-label">{{ labels.current }}</span>
        <select class="locale-select" :value="locale" @change="onLocaleSelect">
          <option value="zh-CN">{{ labels.zh }}</option>
          <option value="en-US">{{ labels.en }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useMapInit } from "./useMapInit";
import { i18n } from "../src/i18n";

type Locale = "zh-CN" | "en-US";

const { initMap, destroyMap } = useMapInit("cesiumContainer");

const locale = ref<Locale>(i18n.getLocale() as Locale);
let unsubscribeI18n: (() => void) | null = null;

const labels = computed(() => ({
  switch: i18n.t("app.lang.switch", undefined, locale.value),
  current: i18n.t("app.lang.current", undefined, locale.value),
  zh: i18n.t("app.lang.zh", undefined, locale.value),
  en: i18n.t("app.lang.en", undefined, locale.value),
}));

const onLocaleSelect = (event: Event) => {
  const nextLocale = (event.target as HTMLSelectElement).value as Locale;
  i18n.setLocale(nextLocale, { persist: true });
};

onMounted(async () => {
  i18n.configure({
    persist: true,
    useStoredLocale: true,
  });

  locale.value = i18n.getLocale() as Locale;
  unsubscribeI18n = i18n.onLocaleChange((nextLocale) => {
    locale.value = nextLocale as Locale;
  });

  await initMap();
});

onBeforeUnmount(() => {
  unsubscribeI18n?.();
  unsubscribeI18n = null;
  destroyMap();
});
</script>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.map-host {
  width: 100%;
  height: 100%;
}

.locale-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1200;
  min-width: 180px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(12, 20, 34, 0.86) 0%, rgba(20, 37, 66, 0.82) 100%);
  box-shadow: 0 12px 32px rgba(2, 8, 23, 0.28);
  backdrop-filter: blur(12px);
}

.locale-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #e2e8f0;
}

.locale-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.locale-label {
  flex: 0 0 auto;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.82);
}

.locale-select {
  flex: 1 1 auto;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
  font-size: 13px;
  outline: none;
}

.locale-select option {
  color: #111827;
}
</style>