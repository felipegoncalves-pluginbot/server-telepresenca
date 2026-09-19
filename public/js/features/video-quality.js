import { bindPopoverDismiss } from "../ui/popover.js";

const STORAGE_KEY = "telepresenca.videoQuality.v2";

export const DEFAULT_PRESETS = [
  {
    id: "auto",
    labelKey: "video.preset.auto",
    width: 0,
    height: 0,
    fps: 0,
    maxBitrateKbps: 0,
    adaptive: true,
  },
  {
    id: "low",
    labelKey: "video.preset.low",
    width: 640,
    height: 480,
    fps: 15,
    maxBitrateKbps: 800,
    adaptive: false,
  },
  {
    id: "mid",
    labelKey: "video.preset.mid",
    width: 1280,
    height: 720,
    fps: 15,
    maxBitrateKbps: 1500,
    adaptive: false,
  },
  {
    id: "high",
    labelKey: "video.preset.high",
    width: 1280,
    height: 720,
    fps: 30,
    maxBitrateKbps: 2500,
    adaptive: false,
  },
  {
    id: "max",
    labelKey: "video.preset.max",
    width: 1920,
    height: 1080,
    fps: 30,
    maxBitrateKbps: 4500,
    adaptive: false,
  },
];

function clonePreset(preset) {
  return { ...preset };
}

function normalizePreset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (!id) return null;
  return {
    id,
    labelKey: raw.labelKey || `video.preset.${id}`,
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
    fps: Number(raw.fps) || 0,
    maxBitrateKbps: Number(raw.maxBitrateKbps) || 0,
    adaptive: Boolean(raw.adaptive),
  };
}

export function resolveVideoCapabilities(robotCapabilities) {
  const video = robotCapabilities?.video;
  const robotPresets = Array.isArray(video?.presets)
    ? video.presets.map(normalizePreset).filter(Boolean)
    : [];

  const presets =
    robotPresets.length > 0 ? robotPresets : DEFAULT_PRESETS.map(clonePreset);

  const defaultPreset =
    typeof video?.defaultPreset === "string" && video.defaultPreset
      ? video.defaultPreset
      : "high";

  const hasPreset = presets.some((item) => item.id === defaultPreset);
  return {
    presets,
    defaultPreset: hasPreset ? defaultPreset : presets[0]?.id || "high",
    hardwareEncoder: Boolean(video?.hardwareEncoder),
    adaptiveSupported: video?.adaptiveSupported !== false,
  };
}

export function loadSavedPresetId(fallbackId) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && typeof saved === "string") return saved;
  } catch (_) {
    /* ignore */
  }
  return fallbackId || "high";
}

export function savePresetId(presetId) {
  try {
    localStorage.setItem(STORAGE_KEY, presetId);
  } catch (_) {
    /* ignore */
  }
}

export function createVideoQualityPanel(options) {
  const { root, slider, thumb, ticks, valueLabel, closeButton, t, onPresetChange } =
    options;

  let presets = DEFAULT_PRESETS.map(clonePreset);
  let selectedIndex = 0;
  let dragging = false;
  let panelOpen = false;
  let commitIndex = 0;

  function presetByIndex(index) {
    return presets[Math.max(0, Math.min(presets.length - 1, index))];
  }

  function indexOfPresetId(presetId) {
    const idx = presets.findIndex((item) => item.id === presetId);
    return idx >= 0 ? idx : 0;
  }

  function refreshLabels() {
    const preset = presetByIndex(selectedIndex);
    if (valueLabel) {
      valueLabel.textContent = t(preset.labelKey);
    }
    if (ticks) {
      ticks.querySelectorAll("[data-index]").forEach((node) => {
        const idx = Number(node.getAttribute("data-index"));
        node.classList.toggle("is-active", idx === selectedIndex);
        const tickPreset = presetByIndex(idx);
        node.setAttribute("aria-selected", idx === selectedIndex ? "true" : "false");
        const label = node.querySelector(".quality-tick-label");
        if (label) {
          label.textContent = t(tickPreset.labelKey);
          label.dataset.i18n = tickPreset.labelKey;
        }
      });
    }
    if (thumb && slider) {
      const ratio = presets.length <= 1 ? 0 : selectedIndex / (presets.length - 1);
      thumb.style.left = `${ratio * 100}%`;
    }
    if (slider) {
      slider.setAttribute(
        "aria-valuetext",
        t("video.currentQuality", { quality: t(preset.labelKey) }),
      );
      slider.setAttribute("aria-valuenow", String(selectedIndex));
      slider.setAttribute("aria-valuemax", String(Math.max(presets.length - 1, 0)));
    }
  }

  function renderTicks() {
    if (!ticks) return;
    ticks.innerHTML = "";
    presets.forEach((preset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quality-tick";
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      button.innerHTML = `<span class="quality-tick-mark" aria-hidden="true"></span><span class="quality-tick-label" data-i18n="${preset.labelKey}"></span>`;
      button.addEventListener("click", () => {
        selectIndex(index, { commit: true });
      });
      ticks.appendChild(button);
    });
    refreshLabels();
  }

  function selectIndex(index, { commit = false } = {}) {
    const next = Math.max(0, Math.min(presets.length - 1, index));
    selectedIndex = next;
    refreshLabels();
    const preset = presetByIndex(selectedIndex);
    if (commit && commitIndex !== selectedIndex) {
      commitIndex = selectedIndex;
      if (typeof onPresetChange === "function") {
        onPresetChange(preset, selectedIndex);
      }
    }
    return preset;
  }

  function setPresets(nextPresets, defaultPresetId) {
    presets =
      Array.isArray(nextPresets) && nextPresets.length > 0
        ? nextPresets.map(clonePreset)
        : DEFAULT_PRESETS.map(clonePreset);
    const saved = loadSavedPresetId(defaultPresetId || "high");
    selectedIndex = indexOfPresetId(saved);
    commitIndex = selectedIndex;
    renderTicks();
    return presetByIndex(selectedIndex);
  }

  function setPanelOpen(open) {
    panelOpen = Boolean(open);
    if (root) root.classList.toggle("hidden", !panelOpen);
  }

  function pointerToIndex(clientX) {
    if (!slider) return selectedIndex;
    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return selectedIndex;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = ratio * (presets.length - 1);
    return Math.round(raw);
  }

  function bindSlider() {
    if (!slider || !thumb) return;

    slider.addEventListener("pointerdown", (event) => {
      dragging = true;
      slider.setPointerCapture(event.pointerId);
      selectIndex(pointerToIndex(event.clientX), { commit: false });
    });

    slider.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      selectIndex(pointerToIndex(event.clientX), { commit: false });
    });

    const finishDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      try {
        slider.releasePointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
      selectIndex(pointerToIndex(event.clientX), { commit: true });
    };

    slider.addEventListener("pointerup", finishDrag);
    slider.addEventListener("pointercancel", finishDrag);

    slider.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        selectIndex(selectedIndex + 1, { commit: true });
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        selectIndex(selectedIndex - 1, { commit: true });
      } else if (event.key === "Home") {
        event.preventDefault();
        selectIndex(0, { commit: true });
      } else if (event.key === "End") {
        event.preventDefault();
        selectIndex(presets.length - 1, { commit: true });
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => setPanelOpen(false));
  }

  bindSlider();
  renderTicks();

  return {
    setPresets,
    getSelectedPreset() {
      return presetByIndex(selectedIndex);
    },
    setPanelOpen,
    isPanelOpen: () => panelOpen,
    refreshLabels,
  };
}

const QUALITY_BADGE = {
  auto: "A",
  low: "L",
  mid: "M",
  high: "H",
  max: "X",
};

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createVideoQualityFeature(els, t) {
  let panel = null;
  let videoCapabilities = resolveVideoCapabilities(null);
  /** @type {((preset: object) => Promise<void>) | null} */
  let onChange = null;

  function updateQualityBadge(preset) {
    if (!els.qualityBadge || !preset) return;
    els.qualityBadge.textContent =
      QUALITY_BADGE[preset.id] || preset.id.slice(0, 1).toUpperCase();
  }

  function updateTrackFill(preset) {
    if (!els.qualityTrackFill || !panel) return;
    const presets = videoCapabilities?.presets || DEFAULT_PRESETS;
    const index = presets.findIndex((item) => item.id === preset.id);
    const ratio = presets.length <= 1 ? 0 : Math.max(0, index) / (presets.length - 1);
    els.qualityTrackFill.style.width = `${ratio * 100}%`;
  }

  function setPanelOpen(open) {
    if (!panel || !els.btnVideoQuality) return;
    panel.setPanelOpen(open);
    els.btnVideoQuality.setAttribute("aria-expanded", open ? "true" : "false");
  }

  return {
    id: "video-quality",
    optIn: false,
    isAvailable() {
      return true;
    },
    /**
     * @param {import("./registry.js").FeatureContext} ctx
     */
    mount(ctx) {
      onChange = ctx.onQualityPresetChange || null;
      panel = createVideoQualityPanel({
        root: els.qualityPanel,
        slider: els.qualitySlider,
        thumb: els.qualityThumb,
        ticks: els.qualityTicks,
        valueLabel: els.qualityValueLabel,
        closeButton: els.btnCloseQuality,
        t,
        onPresetChange(preset) {
          if (typeof onChange === "function") {
            onChange(preset).catch((err) => console.error(err));
          }
        },
      });
      const initialPreset = panel.setPresets(
        videoCapabilities.presets,
        loadSavedPresetId(videoCapabilities.defaultPreset),
      );
      updateQualityBadge(initialPreset);
      updateTrackFill(initialPreset);

      const onQualityClick = (event) => {
        event.stopPropagation();
        if (!ctx.isConnected()) return;
        setPanelOpen(!panel?.isPanelOpen());
      };
      if (els.btnVideoQuality) {
        els.btnVideoQuality.addEventListener("click", onQualityClick);
      }

      const host =
        els.btnVideoQuality?.closest(".popover-host") || els.qualityPanel;
      const unbindDismiss = host
        ? bindPopoverDismiss(host, {
            isOpen: () => Boolean(panel?.isPanelOpen()),
            setOpen: setPanelOpen,
          })
        : () => {};

      return () => {
        if (els.btnVideoQuality) {
          els.btnVideoQuality.removeEventListener("click", onQualityClick);
        }
        unbindDismiss();
        setPanelOpen(false);
        panel = null;
      };
    },
    update(caps) {
      videoCapabilities = resolveVideoCapabilities(caps);
      if (!panel) return;
      const preset = panel.setPresets(
        videoCapabilities.presets,
        loadSavedPresetId(videoCapabilities.defaultPreset),
      );
      updateQualityBadge(preset);
      updateTrackFill(preset);
    },
    getPanel: () => panel,
    setPanelOpen,
    refreshLabels() {
      panel?.refreshLabels();
      if (els.btnVideoQuality) {
        els.btnVideoQuality.setAttribute("aria-label", t("video.openPanel"));
      }
      if (els.btnCloseQuality) {
        els.btnCloseQuality.setAttribute("aria-label", t("dialog.close"));
      }
    },
    applyCapabilities(caps) {
      this.update(caps);
    },
  };
}
