import { captureFormatKey } from "./quality.js";

/**
 * Espera no máximo `ms` e devolve `fallback` se a promise não resolver.
 * Não cancela a promise original — getUserMedia pode completar depois.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export function waitWithTimeout(promise, ms, fallback) {
  if (!ms || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Reiniciar a PeerConnection só faz sentido quando o formato de captura
 * realmente mudou E já havia um formato aplicado nesta sessão.
 * lastAppliedCaptureKey nulo (primeira chamada) NÃO deve resetar o PC —
 * isso era o bug "clicar em qualidade destrava a tela".
 *
 * @param {string | null | undefined} previousKey
 * @param {object | null | undefined} preset
 */
export function shouldRestartForCapture(previousKey, preset) {
  if (!previousKey || !preset) return false;
  return captureFormatKey(preset) !== previousKey;
}

/**
 * Track "live" sem frames ainda (muted) não conta como vídeo no ar.
 * Usado para retry de offer / ICE restart.
 *
 * @param {{ videoWidth?: number, videoHeight?: number, srcObject?: { getVideoTracks?: () => Array<{ readyState?: string, muted?: boolean }> } | null } | null} videoEl
 */
export function hasRenderableRemoteVideo(videoEl) {
  if (!videoEl) return false;
  if ((videoEl.videoWidth || 0) > 0 && (videoEl.videoHeight || 0) > 0) {
    return true;
  }
  const stream = videoEl.srcObject;
  if (!stream || typeof stream.getVideoTracks !== "function") return false;
  return stream
    .getVideoTracks()
    .some((track) => track.readyState === "live" && track.muted === false);
}
