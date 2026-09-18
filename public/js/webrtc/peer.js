import {
  EVENT_SIGNAL,
  SIGNAL_ANSWER,
  SIGNAL_ICE_CANDIDATE,
  SIGNAL_OFFER,
} from "../protocol/events.js";
import { hasRenderableRemoteVideo } from "./handshake.js";
import { createIceQueue } from "./ice-queue.js";

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
  let controlChannel = null;
  const iceQueue = createIceQueue();

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
    try {
      video.muted = true;
      await video.play();
    } catch (_) {
      /* autoplay muted still blocked — rare */
    }
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
    } catch (_) {
      video.muted = true;
      unlockRemoteAudioOnce();
      try {
        await video.play();
      } catch (__) {
        /* wait for gesture */
      }
    }
  }

  function cleanupPeer({ resetRetry = true } = {}) {
    if (resetRetry) clearOfferRetry();
    iceQueue.reset();
    if (controlChannel) {
      controlChannel.onopen = null;
      controlChannel.onclose = null;
      controlChannel.onerror = null;
      try {
        controlChannel.close();
      } catch {
        /* ignore close error */
      }
      controlChannel = null;
    }
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

  async function createPeerConnection({ resetRetry = true } = {}) {
    cleanupPeer({ resetRetry });
    const iceServers = getIceServers() || [];
    pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    try {
      controlChannel = pc.createDataChannel("control", {
        ordered: false,
        maxRetransmits: 0,
      });
    } catch (err) {
      console.warn("Falha ao criar DataChannel:", err);
    }

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
      if (event.track?.kind !== "video") {
        if (
          event.track?.kind === "audio" &&
          event.streams?.[0] &&
          !els.remoteVideo.srcObject
        ) {
          els.remoteVideo.srcObject = event.streams[0];
        }
        return;
      }
      const [remoteStream] = event.streams;
      els.remoteVideo.srcObject = remoteStream || new MediaStream([event.track]);
      els.remotePlaceholder.classList.add("hidden");
      setStatus("status.live", "live");
      playRemoteWithSound();
      if (typeof onRemoteVideo === "function") onRemoteVideo("track");
    };

    pc.onconnectionstatechange = () => {
      setRtcState(pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("status.webrtcUnstable", "online");
      }
      if (pc.connectionState === "connected") {
        setStatus("status.live", "live");
        if (hasRenderableRemoteVideo(els.remoteVideo)) {
          clearOfferRetry();
        }
        if (typeof onRemoteVideo === "function") onRemoteVideo("connected");
      }
    };

    return pc;
  }

  async function startCallAsOfferer({ iceRestart = false } = {}) {
    const socket = getSocket();
    if (!socket) return;
    if (!pc) await createPeerConnection();
    makingOffer = true;
    try {
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      socket.emit(EVENT_SIGNAL, {
        type: SIGNAL_OFFER,
        data: pc.localDescription,
      });
    } finally {
      makingOffer = false;
    }
  }

  function scheduleOfferRetryIfNeeded() {
    clearOfferRetryTimer();
    offerRetryTimer = setTimeout(async () => {
      if (!getSocket() || !pc) return;
      if (hasRenderableRemoteVideo(els.remoteVideo)) {
        clearOfferRetry();
        return;
      }
      if (offerRetryCount >= MAX_OFFER_RETRIES) return;
      const state = pc.connectionState;
      if (state === "connected" || state === "connecting") {
        offerRetryCount += 1;
        if (offerRetryCount < MAX_OFFER_RETRIES) scheduleOfferRetryIfNeeded();
        return;
      }
      offerRetryCount += 1;
      console.warn("Sem vídeo do robô; renegociando.", offerRetryCount, state);
      try {
        if (state === "failed" || state === "disconnected") {
          await startCallAsOfferer({ iceRestart: true });
        }
      } catch (err) {
        console.warn("Offer retry failed", err);
      }
      scheduleOfferRetryIfNeeded();
    }, 4000);
  }

  async function addIceCandidate(candidate) {
    if (!pc || !candidate) return;
    if (iceQueue.enqueueIfNeeded(candidate)) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!ignoreOffer) {
        console.warn("ICE candidate error", err);
      }
    }
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
      await iceQueue.flush((candidate) => pc.addIceCandidate(candidate));
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
      await iceQueue.flush((candidate) => pc.addIceCandidate(candidate));
      return;
    }

    if (message.type === SIGNAL_ICE_CANDIDATE && message.data) {
      await addIceCandidate(message.data);
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
    sendDataChannelControl(action, value) {
      if (controlChannel && controlChannel.readyState === "open") {
        try {
          controlChannel.send(JSON.stringify({ action, value }));
          return true;
        } catch (err) {
          console.warn("Erro ao enviar via DataChannel:", err);
        }
      }
      return false;
    },
    isDataChannelReady() {
      return Boolean(controlChannel && controlChannel.readyState === "open");
    },
  };
}
