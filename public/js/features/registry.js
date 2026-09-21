/**
 * @typedef {object} FeatureContext
 * @property {(action: string, value?: unknown, opts?: { volatile?: boolean }) => void} sendControl
 * @property {(presetId: string) => void} sendVideoQuality
 * @property {(key: string, vars?: Record<string, unknown>) => string} t
 * @property {(id: string) => HTMLElement | null} host
 * @property {() => boolean} isConnected
 * @property {object | null} [caps]
 */

/**
 * @typedef {object} FeatureModule
 * @property {string} id
 * @property {boolean} [optIn]
 * @property {(caps: object | null) => boolean} isAvailable
 * @property {(ctx: FeatureContext) => (() => void) | void} mount
 * @property {(caps: object | null, ctx: FeatureContext) => void} [update]
 * @property {(payload: unknown) => void} [onStatus]
 * @property {() => void} [refreshLabels]
 * @property {(enabled: boolean) => void} [setEnabled]
 */

/**
 * @param {FeatureModule[]} features
 */
export function createFeatureRegistry(features) {
  /** @type {Map<string, () => void>} */
  const mounted = new Map();
  /** @type {unknown} */
  let lastStatus = null;

  /**
   * @param {object | null} caps
   * @param {FeatureContext} ctx
   */
  function apply(caps, ctx) {
    const nextCtx = { ...ctx, caps };
    for (const feature of features) {
      const shouldMount = feature.isAvailable(caps);
      const unmount = mounted.get(feature.id);
      if (shouldMount && !unmount) {
        const stop = feature.mount(nextCtx);
        mounted.set(feature.id, typeof stop === "function" ? stop : () => {});
        if (lastStatus && typeof feature.onStatus === "function") {
          feature.onStatus(lastStatus);
        }
      } else if (shouldMount && unmount && typeof feature.update === "function") {
        feature.update(caps, nextCtx);
      } else if (!shouldMount && unmount) {
        unmount();
        mounted.delete(feature.id);
      }
    }
  }

  /**
   * @param {unknown} payload
   */
  function applyStatus(payload) {
    lastStatus = payload;
    for (const feature of features) {
      if (mounted.has(feature.id) && typeof feature.onStatus === "function") {
        feature.onStatus(payload);
      }
    }
  }

  function refreshLabels() {
    for (const feature of features) {
      if (mounted.has(feature.id) && typeof feature.refreshLabels === "function") {
        feature.refreshLabels();
      }
    }
  }

  function setEnabled(enabled) {
    for (const feature of features) {
      if (mounted.has(feature.id) && typeof feature.setEnabled === "function") {
        feature.setEnabled(enabled);
      }
    }
  }

  function unmountAll() {
    for (const stop of mounted.values()) {
      stop();
    }
    mounted.clear();
    lastStatus = null;
  }

  return {
    apply,
    applyStatus,
    refreshLabels,
    setEnabled,
    unmountAll,
    isMounted: (id) => mounted.has(id),
  };
}
