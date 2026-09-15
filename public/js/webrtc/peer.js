import {
  EVENT_SIGNAL,
  SIGNAL_ANSWER,
  SIGNAL_ICE_CANDIDATE,
  SIGNAL_OFFER,
} from "../protocol/events.js";

const MAX_OFFER_RETRIES = 2;

/**
 * @param {object} options
 */
export function createPeerController({
  els,
  getIceServers,
  getSocket,
  getLocalStream,
  ensureMedia,
  setRtcState,
  setStatus,
  onRemoteVideo,
}) {
  let pc = null;
  let makingOffer = false;
  let ignoreOffer = false;
  const isPolite = true;
  let offerRetryTimer = null;
  let offerRetryCount = 0;
  let audioUnlockBound = false;

  function hasRemoteVideoTrack() {
    const stream = els.remoteVideo?.srcObject;
    if (!stream) return false;
    return stream.getVideoTracks().some((track) => track.readyState === "live");
  }

  function clearOfferRetryTimer() {
    if (offerRetryTimer) {
      clearTimeout(offerRetryTimer);
      offerRetryTimer = null;
    }
  }

  function clearOfferRetry() {
    clearOfferRetryTimer();
    offerRetryCount = 0;
  }

  function unlockRemoteAudioOnce() {
    if (audioUnlockBound) return;
    audioUnlockBound = true;
    const unlock = () => {
      audioUnlockBound = false;
      playRemoteWithSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  async function playRemoteWithSound() {
    const video = els.remoteVideo;
    if (!video.srcObject) return;
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
    } catch (_) {
      unlockRemoteAudioOnce();
    }
  }

  function cleanupPeer() {
    clearOfferRetry();
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.close();
      pc = null;
    }
    els.remoteVideo.srcObject = null;
    els.remotePlaceholder.classList.remove("hidden");
    setRtcState("idle");
  }

  async function createPeerConnection() {
    cleanupPeer();
    const iceServers = getIceServers() || [];
    pc = new RTCPeerConnection({ iceServers });
    const localStream = getLocalStream();

    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    } else {
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch (err) {
        console.warn("Failed to add recvonly transceivers:", err);
      }
      ensureMedia();
    }

    pc.onicecandidate = (event) => {
      const socket = getSocket();
      if (event.candidate && socket) {
        socket.emit(EVENT_SIGNAL, {
          type: SIGNAL_ICE_CANDIDATE,
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.track?.kind !== "video") return;
      const [remoteStream] = event.streams;
      els.remoteVideo.srcObject = remoteStream;
      els.remotePlaceholder.classList.add("hidden");
      setStatus("status.live", "live");
      clearOfferRetry();
      playRemoteWithSound();
      if (typeof onRemoteVideo === "function") onRemoteVideo();
    };

    pc.onconnectionstatechange = () => {
      setRtcState(pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("status.webrtcUnstable", "online");
      }
      if (pc.connectionState === "connected") {
        setStatus("status.live", "live");
        if (typeof onRemoteVideo === "function") onRemoteVideo("connected");
      }
    };

    return pc;
  }

  async function startCallAsOfferer() {
    const socket = getSocket();
    if (!pc) await createPeerConnection();
    makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit(EVENT_SIGNAL, {
        type: SIGNAL_OFFER,
        data: pc.localDescription,
      });
    } finally {
      makingOffer = false;
    }
  }

  function scheduleOfferRetryIfNeeded(beginCall) {
    clearOfferRetryTimer();
    offerRetryTimer = setTimeout(async () => {
      if (!getSocket() || !pc || hasRemoteVideoTrack()) return;
      if (offerRetryCount >= MAX_OFFER_RETRIES) return;
      offerRetryCount += 1;
      console.warn("Sem vídeo do robô; reenviando offer.", offerRetryCount);
      await beginCall();
    }, 4500);
  }

  async function handleSignal(message) {
    if (!message?.type) return;
    const socket = getSocket();

    if (!pc) {
      await createPeerConnection();
    }

    if (message.type === SIGNAL_OFFER) {
      const offerCollision = makingOffer || pc.signalingState !== "stable";
      ignoreOffer = !isPolite && offerCollision;
      if (ignoreOffer) return;

      await pc.setRemoteDescription(message.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(EVENT_SIGNAL, {
        type: SIGNAL_ANSWER,
        data: pc.localDescription,
      });
      return;
    }

    if (message.type === SIGNAL_ANSWER) {
      await pc.setRemoteDescription(message.data);
      return;
    }

    if (message.type === SIGNAL_ICE_CANDIDATE && message.data) {
      try {
        await pc.addIceCandidate(message.data);
      } catch (err) {
        if (!ignoreOffer) {
          console.warn("ICE candidate error", err);
        }
      }
    }
  }

  return {
    getPc: () => pc,
    cleanupPeer,
    createPeerConnection,
    startCallAsOfferer,
    handleSignal,
    scheduleOfferRetryIfNeeded,
    clearOfferRetry,
    playRemoteWithSound,
  };
}
