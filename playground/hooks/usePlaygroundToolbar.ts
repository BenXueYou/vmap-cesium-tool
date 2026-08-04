import { computed, reactive, ref, type ShallowRef } from "vue";
import type { Viewer } from "cesium";
import type { CustomButtonConfig, ToolbarConfig, ToolbarService } from "../../src/index";
import { toolbarButtonConfigs } from "../z.const";
import type { PlaygroundShowMessage, ToolbarFormState } from "./playgroundTypes";

const DEFAULT_TOOLBAR_BUTTON_ID = toolbarButtonConfigs[0]?.id ?? "search";

type UsePlaygroundToolbarOptions = {
  toolbarService: ShallowRef<ToolbarService | null>;
  viewer: ShallowRef<Viewer | null>;
  showMessage: PlaygroundShowMessage;
};

export function usePlaygroundToolbar({
  toolbarService,
  viewer,
  showMessage,
}: UsePlaygroundToolbarOptions) {
  const toolbarForm = reactive<ToolbarFormState>({
    mapProvider: "tdt",
    position: "bottom-right",
    direction: "column",
    buttonSize: 36,
    buttonSpacing: 8,
    zIndex: 1100,
    backgroundColor: "transparent",
    borderColor: "transparent",
    buttonBackgroundColor: "rgba(0, 0, 0, 0.52)",
    buttonBorderColor: "rgba(9, 109, 236, 0.85)",
    searchPanelBackground: "rgba(7, 35, 73, 0.92)",
    searchWidth: 210,
    defaultPlaceNameChecked: true,
    defaultNoFlyZoneChecked: true,
  });

  const toolbarButtonState = reactive<Record<string, boolean>>(
    Object.fromEntries(toolbarButtonConfigs.map((button) => [button.id, true])),
  );

  const toolbarRuntimePatch = reactive({
    title: "",
    backgroundColor: "",
    color: "",
  });

  const customToolbarButton = reactive({
    id: "custom-api",
    title: "API",
    icon: "API",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
  });

  const selectedToolbarButtonId = ref(DEFAULT_TOOLBAR_BUTTON_ID);
  const mountedCustomButtonId = ref("");

  const toolbarReady = computed(() => !!toolbarService.value && !!viewer.value);
  const toolbarButtonOptions = computed(() => {
    const ids = toolbarButtonConfigs.map((button) => button.id);
    if (mountedCustomButtonId.value) {
      ids.push(mountedCustomButtonId.value);
    }
    return ids;
  });

  function cloneToolbarButtons(): CustomButtonConfig[] {
    return toolbarButtonConfigs
      .filter((button) => toolbarButtonState[button.id])
      .map((button) => ({
        ...button,
        backgroundColor: toolbarForm.buttonBackgroundColor,
        borderColor: toolbarForm.buttonBorderColor,
      }));
  }

  function resetToolbarState() {
    const currentSelection = selectedToolbarButtonId.value;
    mountedCustomButtonId.value = "";
    if (!toolbarButtonConfigs.some((button) => button.id === currentSelection)) {
      selectedToolbarButtonId.value = DEFAULT_TOOLBAR_BUTTON_ID;
    }
  }

  function applyToolbarStyle() {
    const service = toolbarService.value;
    if (!service) {
      showMessage("ToolbarService 未初始化");
      return;
    }

    service.setToolbarPosition("top-right", {
      offsetTop: 24,
      offsetRight: 240,
    });
  }

  function applyToolbarRuntimeStyle() {
    const service = toolbarService.value;
    if (!service) {
      showMessage("ToolbarService 未初始化");
      return;
    }

    const patch: Partial<ToolbarConfig> = {
      position: toolbarForm.position,
      direction: toolbarForm.direction,
      buttonSize: toolbarForm.buttonSize,
      buttonSpacing: toolbarForm.buttonSpacing,
      backgroundColor: toolbarForm.backgroundColor,
      borderColor: toolbarForm.borderColor,
      zIndex: toolbarForm.zIndex,
    };

    service.updateToolbarStyle(patch);
    showMessage("Toolbar 样式已更新");
  }

  function closeToolbarMenus() {
    const service = toolbarService.value;
    if (!service) {
      showMessage("ToolbarService 未初始化");
      return;
    }

    service.closeAllMenus();
  }

  function showToolbarButton() {
    toolbarService.value?.showButton(selectedToolbarButtonId.value);
  }

  function hideToolbarButton() {
    toolbarService.value?.hideButton(selectedToolbarButtonId.value);
  }

  function enableToolbarButton() {
    toolbarService.value?.enableButton(selectedToolbarButtonId.value);
  }

  function disableToolbarButton() {
    toolbarService.value?.disableButton(selectedToolbarButtonId.value);
  }

  function patchToolbarButton() {
    const service = toolbarService.value;
    if (!service) {
      return;
    }

    const patch: Partial<CustomButtonConfig> = {};
    if (toolbarRuntimePatch.title) patch.title = toolbarRuntimePatch.title;
    if (toolbarRuntimePatch.backgroundColor) patch.backgroundColor = toolbarRuntimePatch.backgroundColor;
    if (toolbarRuntimePatch.color) patch.color = toolbarRuntimePatch.color;

    service.updateButton(selectedToolbarButtonId.value, patch);
    showMessage(`按钮 ${selectedToolbarButtonId.value} 已更新`);
  }

  function mountCustomToolbarButton() {
    const service = toolbarService.value;
    if (!service) {
      showMessage("ToolbarService 未初始化");
      return;
    }

    if (mountedCustomButtonId.value) {
      service.removeButton(mountedCustomButtonId.value);
    }

    service.addCustomButton(
      {
        id: customToolbarButton.id,
        icon: customToolbarButton.icon,
        title: customToolbarButton.title,
        backgroundColor: customToolbarButton.backgroundColor,
        color: "#ffffff",
        borderColor: "rgba(96, 165, 250, 0.4)",
      },
      () => {
        showMessage(`自定义按钮 ${customToolbarButton.id} 已点击`);
      },
    );

    mountedCustomButtonId.value = customToolbarButton.id;
    selectedToolbarButtonId.value = customToolbarButton.id;
    showMessage(`自定义按钮 ${customToolbarButton.id} 已挂载`);
  }

  function removeCustomToolbarButton() {
    const service = toolbarService.value;
    if (!service || !mountedCustomButtonId.value) {
      return;
    }

    service.removeButton(mountedCustomButtonId.value);
    mountedCustomButtonId.value = "";
    selectedToolbarButtonId.value = DEFAULT_TOOLBAR_BUTTON_ID;
    showMessage("自定义按钮已移除");
  }

  return {
    toolbarReady,
    toolbarForm,
    toolbarButtonState,
    toolbarRuntimePatch,
    customToolbarButton,
    selectedToolbarButtonId,
    toolbarButtonOptions,
    cloneToolbarButtons,
    resetToolbarState,
    applyToolbarStyle,
    applyToolbarRuntimeStyle,
    closeToolbarMenus,
    showToolbarButton,
    hideToolbarButton,
    enableToolbarButton,
    disableToolbarButton,
    patchToolbarButton,
    mountCustomToolbarButton,
    removeCustomToolbarButton,
  };
}
