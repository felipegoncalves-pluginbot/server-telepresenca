import { waitWithTimeout } from "../webrtc/handshake.js";

/**
 * @param {object} options
 * @param {object} options.els
 * @param {(key: string) => string} options.t
 * @param {() => RTCPeerConnection | null} options.getPc
 * @param {() => Promise<void>} options.startCallAsOfferer
 * @param {() => unknown} options.getSocket
 */
export function createMediaController({
  els,
  t,
  getPc,
  startCallAsOfferer,
  getSocket,
}) {
  let localStream = null;
  let mediaRequest = null;
  let mediaGeneration = 0;

  function micTrack() {
    return localStream ? localStream.getAudioTracks()[0] : null;
  }

  function camTrack() {
    return localStream ? localStream.getVideoTracks()[0] : null;
  }

  function refreshMediaButtons(connected) {
    const mic = micTrack();
    const cam = camTrack();
    const micOn = Boolean(mic?.enabled);
    const camOn = Boolean(cam?.enabled);
    els.btnToggleMic.classList.toggle("is-off", connected && !micOn);
    els.btnToggleCam.classList.toggle("is-off", connected && !camOn);
    els.btnToggleMic.setAttribute(
      "aria-label",
      t(micOn ? "media.micOn" : "media.micOff"),
    );
    els.btnToggleCam.setAttribute(
      "aria-label",
      t(camOn ? "media.camOn" : "media.camOff"),
    );
    els.localPip.classList.toggle("hidden", !camOn);
  }

  async function attachLocalMediaToPeer() {
    const pc = getPc();
    if (!pc || !localStream) return;
    let upgraded = false;
    for (const track of localStream.getTracks()) {
      const transceiver = pc.getTransceivers().find((item) => {
        const senderKind = item.sender?.track?.kind;
        const receiverKind = item.receiver?.track?.kind;
        return senderKind === track.kind || receiverKind === track.kind;
      });
      if (transceiver?.sender) {
        if (
          transceiver.direction === "recvonly" ||
          transceiver.direction === "inactive"
        ) {
          transceiver.direction = "sendrecv";
          upgraded = true;
        }
        if (transceiver.sender.track !== track) {
          await transceiver.sender.replaceTrack(track);
          upgraded = true;
        }
      } else {
        pc.addTrack(track, localStream);
        upgraded = true;
      }
    }
    if (upgraded && getSocket() && pc.signalingState === "stable") {
      await startCallAsOfferer();
    }
  }

  async function ensureMedia({ timeoutMs = 0 } = {}) {
    if (localStream) return localStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn(
        "navigator.mediaDevices unavailable in this context; recvonly mode.",
      );
      return null;
    }
    if (!mediaRequest) {
      const generation = mediaGeneration;
      mediaRequest = navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        })
        .then((stream) => {
          if (generation !== mediaGeneration) {
            stream.getTracks().forEach((track) => {
              track.stop();
            });
            return null;
          }
          localStream = stream;
          els.localVideo.srcObject = stream;
          refreshMediaButtons(true);
          return attachLocalMediaToPeer().then(() => stream);
        })
        .catch((err) => {
          console.warn("Operator camera/microphone unavailable:", err);
          mediaRequest = null;
          return null;
        });
    }
    if (!timeoutMs) return mediaRequest;
    return waitWithTimeout(mediaRequest, timeoutMs, localStream);
  }

  function stopLocal() {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      localStream = null;
      els.localVideo.srcObject = null;
    }
    mediaGeneration += 1;
    mediaRequest = null;
  }

  async function toggleMic(connected) {
    if (!connected) return;
    if (!localStream) {
      await ensureMedia();
      await attachLocalMediaToPeer();
    }
    const track = micTrack();
    if (!track) return;
    track.enabled = !track.enabled;
    refreshMediaButtons(connected);
  }

  async function toggleCam(connected) {
    if (!connected) return;
    if (!localStream) {
      await ensureMedia();
      await attachLocalMediaToPeer();
    }
    const track = camTrack();
    if (!track) return;
    track.enabled = !track.enabled;
    refreshMediaButtons(connected);
  }

  return {
    ensureMedia,
    attachLocalMediaToPeer,
    refreshMediaButtons,
    stopLocal,
    toggleMic,
    toggleCam,
    getLocalStream: () => localStream,
  };
}
