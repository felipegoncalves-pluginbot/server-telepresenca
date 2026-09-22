/**
 * Encaixa o vídeo remoto em pixels inteiros para reduzir moiré de subpixel
 * na escala do navegador (faixas horizontais em movimento).
 *
 * @param {HTMLVideoElement | null} videoEl
 * @param {HTMLElement | null} stageEl
 */
export function bindRemoteVideoLayout(videoEl, stageEl) {
  if (!videoEl || !stageEl) {
    return () => {};
  }

  const sync = () => {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    if (!vw || !vh || !sw || !sh) {
      return;
    }

    const viewportAr = sw / sh;
    const videoAr = vw / vh;
    let width;
    let height;
    if (viewportAr > videoAr) {
      height = Math.max(1, Math.floor(sh));
      width = Math.max(1, Math.floor(height * videoAr));
    } else {
      width = Math.max(1, Math.floor(sw));
      height = Math.max(1, Math.floor(width / videoAr));
    }

    videoEl.style.width = `${width}px`;
    videoEl.style.height = `${height}px`;
    videoEl.style.left = `${Math.floor((sw - width) / 2)}px`;
    videoEl.style.top = `${Math.floor((sh - height) / 2)}px`;
    videoEl.dataset.layoutSynced = "1";
  };

  videoEl.addEventListener("loadedmetadata", sync);
  videoEl.addEventListener("resize", sync);
  const observer =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
  observer?.observe(stageEl);
  sync();

  return () => {
    observer?.disconnect();
    videoEl.removeEventListener("loadedmetadata", sync);
    videoEl.removeEventListener("resize", sync);
    delete videoEl.dataset.layoutSynced;
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
