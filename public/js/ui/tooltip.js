/**
 * @typedef {object} TooltipOptions
 * @property {number} [enterDelayMs=180] - Delay in milliseconds before showing tooltip on first hover.
 * @property {number} [warmWindowMs=350] - Milliseconds window for instant transition between adjacent buttons.
 * @property {Document} [doc] - Document reference (defaults to global document).
 * @property {(el: HTMLElement) => string | null} [getLabel] - Custom label extractor.
 */

/**
 * @param {Document} doc
 * @param {HTMLElement | Document} root
 * @returns {{ el: HTMLElement | null, created: boolean }}
 */
function getOrCreateTooltipElement(doc, root) {
  let tooltipEl = doc.getElementById("hudTooltip");
  if (tooltipEl) return { el: tooltipEl, created: false };

  if (doc.createElement) {
    tooltipEl = doc.createElement("div");
    tooltipEl.id = "hudTooltip";
    tooltipEl.className = "hud-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    tooltipEl.setAttribute("aria-hidden", "true");
    (doc.body || root).appendChild(tooltipEl);
    return { el: tooltipEl, created: true };
  }
  return { el: null, created: false };
}

/**
 * @param {HTMLElement} el
 * @param {((el: HTMLElement) => string | null) | undefined} customResolver
 * @returns {string | null}
 */
function resolveLabel(el, customResolver) {
  if (typeof customResolver === "function") {
    return customResolver(el);
  }
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();
  const dataTip = el.getAttribute("data-tooltip");
  if (dataTip?.trim()) return dataTip.trim();
  return null;
}

/**
 * @param {any} target
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
function findMatchingElement(target, selector) {
  if (!target || typeof target !== "object") return null;
  if (typeof target.closest === "function") {
    return target.closest(selector);
  }
  if (typeof target.matches === "function" && target.matches(selector)) {
    return target;
  }
  return null;
}

/**
 * @param {HTMLElement} tooltipEl
 * @param {HTMLElement} target
 */
function positionTooltip(tooltipEl, target) {
  if (typeof target.getBoundingClientRect !== "function") return;
  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const topY = rect.top - 8;
  tooltipEl.style.left = `${Math.round(centerX)}px`;
  tooltipEl.style.top = `${Math.round(topY)}px`;
}

/**
 * @param {object} cfg
 * @param {HTMLElement | Document} cfg.root
 * @param {Document} cfg.doc
 * @param {string} cfg.selector
 * @param {(btn: HTMLElement) => void} cfg.onEnter
 * @param {(btn: HTMLElement) => void} cfg.onLeave
 * @param {() => void} cfg.onDismiss
 * @returns {() => void}
 */
function attachTooltipListeners(cfg) {
  const onPointerEnter = (/** @type {Event} */ e) => {
    const btn = findMatchingElement(e.target, cfg.selector);
    if (btn) cfg.onEnter(btn);
  };
  const onPointerLeave = (/** @type {Event} */ e) => {
    const btn = findMatchingElement(e.target, cfg.selector);
    if (btn) cfg.onLeave(btn);
  };
  const onFocusIn = (/** @type {FocusEvent} */ e) => {
    const btn = findMatchingElement(e.target, cfg.selector);
    if (btn) cfg.onEnter(btn);
  };
  const onFocusOut = (/** @type {FocusEvent} */ e) => {
    const btn = findMatchingElement(e.target, cfg.selector);
    if (btn) cfg.onLeave(btn);
  };
  const onClick = (/** @type {MouseEvent} */ e) => {
    if (findMatchingElement(e.target, cfg.selector)) cfg.onDismiss();
  };
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === "Escape") cfg.onDismiss();
  };

  cfg.root.addEventListener("mouseenter", onPointerEnter, true);
  cfg.root.addEventListener("mouseleave", onPointerLeave, true);
  cfg.root.addEventListener("focusin", onFocusIn, true);
  cfg.root.addEventListener("focusout", onFocusOut, true);
  cfg.root.addEventListener("click", onClick, true);
  cfg.doc.addEventListener("keydown", onKeyDown, true);

  return () => {
    cfg.root.removeEventListener("mouseenter", onPointerEnter, true);
    cfg.root.removeEventListener("mouseleave", onPointerLeave, true);
    cfg.root.removeEventListener("focusin", onFocusIn, true);
    cfg.root.removeEventListener("focusout", onFocusOut, true);
    cfg.root.removeEventListener("click", onClick, true);
    cfg.doc.removeEventListener("keydown", onKeyDown, true);
  };
}

/**
 * Initializes accessible floating tooltips with warm-delay (Discord/Google Meet style).
 *
 * @param {HTMLElement | Document} root
 * @param {string} selector
 * @param {TooltipOptions} [options]
 * @returns {{ destroy: () => void, update: () => void }}
 */
export function initTooltips(root, selector = ".ctrl", options = {}) {
  const doc =
    options.doc ||
    (typeof document !== "undefined"
      ? document
      : root.ownerDocument || /** @type {Document} */ (root));

  const enterDelayMs = options.enterDelayMs ?? 180;
  const warmWindowMs = options.warmWindowMs ?? 350;
  const { el: tooltipEl, created: createdElement } = getOrCreateTooltipElement(
    doc,
    root,
  );

  /** @type {ReturnType<typeof setTimeout> | null} */
  let enterTimer = null;
  let lastCloseTimestamp = 0;
  /** @type {HTMLElement | null} */
  let currentTarget = null;

  /**
   * @param {HTMLElement} target
   * @param {boolean} [isWarm=false]
   */
  function show(target, isWarm = false) {
    if (!tooltipEl) return;
    const label = resolveLabel(target, options.getLabel);
    if (!label) return hide();
    tooltipEl.textContent = label;
    currentTarget = target;
    positionTooltip(tooltipEl, target);
    if (isWarm) {
      tooltipEl.classList.add("is-sliding");
    } else {
      tooltipEl.classList.remove("is-sliding");
    }
    tooltipEl.setAttribute("aria-hidden", "false");
    tooltipEl.classList.add("is-visible");
  }

  function hide() {
    if (enterTimer) clearTimeout(enterTimer);
    enterTimer = null;
    if (tooltipEl) {
      if (tooltipEl.getAttribute("aria-hidden") === "false") {
        lastCloseTimestamp = Date.now();
      }
      tooltipEl.setAttribute("aria-hidden", "true");
      tooltipEl.classList.remove("is-visible");
      tooltipEl.classList.remove("is-sliding");
    }
    currentTarget = null;
  }

  function handleEnter(/** @type {HTMLElement} */ btn) {
    if (btn.disabled || btn.hasAttribute("disabled")) return hide();
    if (enterTimer) clearTimeout(enterTimer);
    if (Date.now() - lastCloseTimestamp < warmWindowMs) {
      show(btn, true);
    } else {
      enterTimer = setTimeout(() => {
        show(btn, false);
        enterTimer = null;
      }, enterDelayMs);
    }
  }

  const cleanupListeners = attachTooltipListeners({
    root,
    doc,
    selector,
    onEnter: handleEnter,
    onLeave: (btn) => {
      if (btn === currentTarget) hide();
    },
    onDismiss: hide,
  });

  return {
    destroy() {
      hide();
      cleanupListeners();
      if (createdElement && tooltipEl?.remove) tooltipEl.remove();
    },
    update() {
      if (currentTarget && tooltipEl?.classList.contains("is-visible")) {
        show(currentTarget);
      }
    },
  };
}
