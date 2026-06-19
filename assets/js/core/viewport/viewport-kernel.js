(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("../../app/app-shell-viewport-owner.js"));
    return;
  }

  if (root) {
    const kernelApi = root.KlevGoViewportKernel || null;
    if (kernelApi) {
      root.KlevGoViewportKernelAdapter = factory(kernelApi);
    }
  }
})(typeof window !== "undefined" ? window : null, function (kernelApi) {
  "use strict";

  if (!kernelApi) return null;

  const calculateViewportKernel =
    kernelApi.calculateViewportKernel || kernelApi.calculateAppShellViewport;
  const createViewportKernel =
    kernelApi.createViewportKernel || kernelApi.createAppShellViewportOwner;

  return Object.freeze({
    VIEWPORT_KERNEL_ROLE: kernelApi.VIEWPORT_KERNEL_ROLE || "core-viewport-kernel",
    VIEWPORT_KERNEL_ENTRYPOINT:
      kernelApi.VIEWPORT_KERNEL_ENTRYPOINT || "assets/js/app/app-shell-viewport-owner.js",
    CSS_VARIABLES: kernelApi.CSS_VARIABLES,
    KG_CSS_VARIABLES: kernelApi.KG_CSS_VARIABLES,
    HEADER_FRAME_CSS_VARIABLES: kernelApi.HEADER_FRAME_CSS_VARIABLES,
    TOUCHBAR_FRAME_CSS_VARIABLES: kernelApi.TOUCHBAR_FRAME_CSS_VARIABLES,
    calculateViewportKernel,
    createViewportKernel,
    calculateAppShellViewport: kernelApi.calculateAppShellViewport,
    createAppShellViewportOwner: kernelApi.createAppShellViewportOwner
  });
});
