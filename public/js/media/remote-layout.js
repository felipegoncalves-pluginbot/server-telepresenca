/**
 * Encaixa o vídeo remoto em pixels inteiros. O elemento <video> fica oculto
 * (WebRTC continua decodificando nele) e um <canvas> desenha cada frame com
 * escala uniforme inteira — evita moiré/faixas do object-fit:fill + subpixel.
 *
 * @param {HTMLVideoElement | null} videoEl
 * @param {HTMLElement | null} stageEl
 * @param {{ hostEl?: HTMLElement | null, canvasEl?: HTMLCanvasElement | null }} [options]
 */
export function bindRemoteVideoLayout(videoEl, stageEl, options = {}) {
  if (!videoEl || !stageEl) {
    return () => {};
  }

  const host = options.hostEl || videoEl;
  const canvas = options.canvasEl || null;
  const ctx = canvas ? canvas.getContext("2d", { alpha: false }) : null;

  let layoutRaf = 0;
  let drawRaf = 0;
  /** @type {ReturnType<typeof computeIntegerVideoLayout> | null} */
  let layout = null;
  /** @type {number} */
  let videoFrameHandle = 0;

  const syncLayout = () => {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    if (!vw || !vh || !sw || !sh) {
      return;
    }

    const next = computeIntegerVideoLayout(sw, sh, vw, vh);
    if (!next) {
      return;
    }

    layout = next;
    host.style.width = `${next.width}px`;
    host.style.height = `${next.height}px`;
    host.style.left = `${next.left}px`;
    host.style.top = `${next.top}px`;
    host.dataset.layoutSynced = "1";

    if (canvas && ctx) {
      if (canvas.width !== next.width || canvas.height !== next.height) {
        canvas.width = next.width;
        canvas.height = next.height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, next.width, next.height);
      }
      scheduleDraw();
    }
  };

  const scheduleLayout = () => {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(syncLayout);
  };

  const drawFrame = () => {
    if (!canvas || !ctx || !layout) {
      return;
    }
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh || videoEl.readyState < 2) {
      return;
    }

    const rect = computeIntegerDrawRect(layout.width, layout.height, vw, vh);
    try {
      ctx.drawImage(videoEl, 0, 0, vw, vh, rect.x, rect.y, rect.w, rect.h);
    } catch {
      /* frame ainda não decodificado */
    }
  };

  const scheduleDraw = () => {
    if (!canvas) {
      return;
    }
    cancelAnimationFrame(drawRaf);
    drawRaf = requestAnimationFrame(drawFrame);
  };

  const onVideoFrame = () => {
    drawFrame();
    if (typeof videoEl.requestVideoFrameCallback === "function") {
      videoFrameHandle = videoEl.requestVideoFrameCallback(onVideoFrame);
    }
  };

  const startVideoFrameLoop = () => {
    if (!canvas || typeof videoEl.requestVideoFrameCallback !== "function") {
      return;
    }
    stopVideoFrameLoop();
    videoFrameHandle = videoEl.requestVideoFrameCallback(onVideoFrame);
  };

  const stopVideoFrameLoop = () => {
    if (videoFrameHandle && typeof videoEl.cancelVideoFrameCallback === "function") {
      videoEl.cancelVideoFrameCallback(videoFrameHandle);
      videoFrameHandle = 0;
    }
  };

  videoEl.addEventListener("loadedmetadata", () => {
    scheduleLayout();
    startVideoFrameLoop();
  });
  videoEl.addEventListener("resize", scheduleLayout);
  videoEl.addEventListener("playing", startVideoFrameLoop);

  const observer =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleLayout) : null;
  observer?.observe(stageEl);
  scheduleLayout();

  return () => {
    observer?.disconnect();
    cancelAnimationFrame(layoutRaf);
    cancelAnimationFrame(drawRaf);
    stopVideoFrameLoop();
    videoEl.removeEventListener("loadedmetadata", scheduleLayout);
    videoEl.removeEventListener("resize", scheduleLayout);
    videoEl.removeEventListener("playing", startVideoFrameLoop);
    delete host.dataset.layoutSynced;
  };
}

/**
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} videoWidth
 * @param {number} videoHeight
 */
export function computeIntegerVideoLayout(
  viewportWidth,
  viewportHeight,
  videoWidth,
  videoHeight,
) {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return null;
  }

  const viewportAr = viewportWidth / viewportHeight;
  const videoAr = videoWidth / videoHeight;
  let width;
  let height;
  if (viewportAr > videoAr) {
    height = Math.max(1, Math.floor(viewportHeight));
    width = Math.max(1, Math.floor(height * videoAr));
  } else {
    width = Math.max(1, Math.floor(viewportWidth));
    height = Math.max(1, Math.floor(width / videoAr));
  }

  return {
    width,
    height,
    left: Math.floor((viewportWidth - width) / 2),
    top: Math.floor((viewportHeight - height) / 2),
  };
}

/**
 * Retângulo de destino inteiro para letterbox uniforme (sem distorção).
 *
 * @param {number} boxW
 * @param {number} boxH
 * @param {number} videoW
 * @param {number} videoH
 */
export function computeIntegerDrawRect(boxW, boxH, videoW, videoH) {
  const scale = Math.min(boxW / videoW, boxH / videoH);
  const w = Math.max(1, Math.floor(videoW * scale));
  const h = Math.max(1, Math.floor(videoH * scale));
  return {
    x: Math.floor((boxW - w) / 2),
    y: Math.floor((boxH - h) / 2),
    w,
    h,
  };
}
