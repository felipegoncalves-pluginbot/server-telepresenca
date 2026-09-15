/**
 * @param {RTCPeerConnection | null} pc
 * @param {object | null} preset
 */
export async function applyOutgoingVideoQuality(pc, preset) {
  if (!pc || !preset) return false;
  const sender = pc
    .getSenders()
    .find((item) => item.track && item.track.kind === "video");
  if (!sender) return false;

  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }

  const encoding = { ...params.encodings[0] };

  if (preset.adaptive || preset.maxBitrateKbps <= 0) {
    delete encoding.maxBitrate;
    encoding.scaleResolutionDownBy = 1;
  } else {
    encoding.maxBitrate = preset.maxBitrateKbps * 1000;
    const targetHeight = preset.height > 0 ? preset.height : 720;
    const settings = sender.track?.getSettings?.();
    const sourceHeight = settings?.height || 720;
    const scale = Math.max(1, sourceHeight / targetHeight);
    encoding.scaleResolutionDownBy = scale;
  }

  params.encodings = [encoding];
  await sender.setParameters(params);
  return true;
}

/**
 * @param {object | null} preset
 */
export function captureFormatKey(preset) {
  if (!preset || preset.adaptive) return "auto";
  const width = Number(preset.width) || 0;
  const height = Number(preset.height) || 0;
  const fps = Number(preset.fps) || 0;
  return `${width}x${height}@${fps}`;
}
