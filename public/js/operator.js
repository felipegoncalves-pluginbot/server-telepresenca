import { beepFeature } from "./features/beep.js";
import { flashlightFeature } from "./features/flashlight.js";
import { createLocomotionFeature } from "./features/locomotion.js";
import { createFeatureRegistry } from "./features/registry.js";
import { createVideoQualityFeature, savePresetId } from "./features/video-quality.js";
import { createMediaController } from "./media/local.js";
import { normalizeCapabilities } from "./protocol/capabilities.js";
import {
  EVENT_JOINED,
  EVENT_PEER_JOINED,
  EVENT_PEER_LEFT,
  EVENT_ROOM_STATE,
  EVENT_SIGNAL,
} from "./protocol/events.js";
import { createSignalingClient } from "./signaling/client.js";
import { hostById } from "./ui/dom.js";
import { bindLangSwitch } from "./ui/lang-switch.js";
import { createStatus } from "./ui/status.js";
import { fetchIceServers } from "./webrtc/ice.js";
import { createPeerController } from "./webrtc/peer.js";
import { applyOutgoingVideoQuality } from "./webrtc/quality.js";

function resolveRoomId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("room") || params.get("roomId");
    if (fromUrl?.trim()) return fromUrl.trim();
  } catch (_) {
    /* ignore */
  }
  return "telepresenca";
}

/**
 * @param {object} options
 * @param {ReturnType<import("./ui/dom.js").queryDom>} options.els
 * @param {import("./i18n/index.js").i18n} options.i18n
 * @param {typeof io} options.ioClient
 */
export function createOperator({ els, i18n, ioClient }) {
  const t = (key, vars) => i18n.t(key, vars);
  const status = createStatus(els, t);
  const lang = bindLangSwitch(els, i18n);
  const signaling = createSignalingClient(ioClient);

  const roomId = resolveRoomId();
  let iceServers = [];
  let connected = false;
  let connecting = false;
  let robotCapabilities = null;
  let qualityApplying = false;

  const locomotion = createLocomotionFeature(els, t);
  const videoQuality = createVideoQualityFeature(els, t);
  const registry = createFeatureRegistry([
    locomotion,
    beepFeature,
    videoQuality,
    flashlightFeature,
  ]);

  const peer = createPeerController({
    els,
    getIceServers: () => iceServers,
    getSocket: () => signaling.getSocket(),
    getLocalStream: () => media.getLocalStream(),
    ensureMedia: () => media.ensureMedia(),
    setRtcState: status.setRtcState,
    setStatus: status.setStatus,
    onRemoteVideo(reason) {
      if (reason === "connected") {
        const preset = videoQuality.getPanel()?.getSelectedPreset();
        if (preset) {
          signaling.sendVideoQuality(preset.id);
          applyOutgoingVideoQuality(peer.getPc(), preset).catch((err) =>
            console.warn(err),
          );
        }
      }
    },
  });

  const media = createMediaController({
    els,
    t,
    getPc: () => peer.getPc(),
    startCallAsOfferer: () => peer.startCallAsOfferer(),
    getSocket: () => signaling.getSocket(),
  });

  function isConnected() {
    return connected;
  }

  function featureContext() {
    return {
      sendControl: (action, value, opts) => {
        if (!connected) return;
        signaling.sendControl(action, value, opts);
      },
      sendVideoQuality: (presetId) => {
        if (!connected) return;
        signaling.sendVideoQuality(presetId);
      },
      t,
      host: (id) => hostById(id, els),
      isConnected,
      caps: robotCapabilities,
      onQualityPresetChange: handleQualityPresetChange,
    };
  }

  function applyRobotCapabilities(caps) {
    robotCapabilities = normalizeCapabilities(caps);
    videoQuality.applyCapabilities(robotCapabilities);
    registry.apply(robotCapabilities, featureContext());
    locomotion.updateMovementHint();
  }

  async function handleQualityPresetChange(preset) {
    if (!preset || qualityApplying) return;
    qualityApplying = true;
    try {
      savePresetId(preset.id);
      videoQuality.refreshLabels();
      if (els.qualityBadge) {
        const badge = { auto: "A", low: "L", mid: "M", high: "H", max: "X" };
        els.qualityBadge.textContent =
          badge[preset.id] || preset.id.slice(0, 1).toUpperCase();
      }
      if (connected) signaling.sendVideoQuality(preset.id);
      if (connected && signaling.getSocket()) {
        await applyOutgoingVideoQuality(peer.getPc(), preset);
      }
    } finally {
      qualityApplying = false;
    }
  }

  async function beginCallWithRobot() {
    await media.ensureMedia({ timeoutMs: 4000 });
    await peer.startCallAsOfferer();
    peer.scheduleOfferRetryIfNeeded();
  }

  function setConnectedUi(isConnectedFlag) {
    connected = isConnectedFlag;
    connecting = false;
    els.btnHangup.disabled = !isConnectedFlag;
    els.btnToggleMic.disabled = !isConnectedFlag;
    els.btnToggleCam.disabled = !isConnectedFlag;
    if (els.btnVideoQuality) els.btnVideoQuality.disabled = !isConnectedFlag;
    if (els.btnSendCommand) els.btnSendCommand.disabled = !isConnectedFlag;
    locomotion.setEnabled(isConnectedFlag);
    const flashlightBtn = els.featureHost?.querySelector('[data-feature="flashlight"]');
    if (flashlightBtn) flashlightBtn.disabled = !isConnectedFlag;
    if (isConnectedFlag) {
      status.showEnded(false);
    } else {
      videoQuality.setPanelOpen(false);
    }
  }

  function refreshDynamicText() {
    const statusKey = els.statusChip.dataset.i18n;
    if (statusKey) els.statusChip.textContent = t(statusKey);
    if (els.placeholderText?.dataset.i18n) {
      els.placeholderText.textContent = t(els.placeholderText.dataset.i18n);
    }
    els.roomLabel.textContent = t("room.label", { id: roomId });
    els.btnHangup.setAttribute("aria-label", t("call.hangup"));
    if (els.btnSendCommand) {
      els.btnSendCommand.setAttribute("aria-label", t("media.beep"));
    }
    lang.updateLangFlag();
    locomotion.refreshLabels();
    videoQuality.refreshLabels();
    media.refreshMediaButtons(connected);
    const flashlightBtn = els.featureHost?.querySelector('[data-feature="flashlight"]');
    if (flashlightBtn) {
      flashlightBtn.setAttribute("aria-label", t("media.flashlight"));
    }
  }

  async function connect() {
    if (signaling.getSocket() || connecting) return;
    connecting = true;
    status.showEnded(false);
    status.setPlaceholder("status.connecting");
    status.setStatus("status.connecting", "online");
    els.remotePlaceholder.classList.remove("hidden");

    iceServers = await fetchIceServers();

    media.ensureMedia({ timeoutMs: 0 }).then((stream) => {
      if (
        !stream &&
        !window.isSecureContext &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1"
      ) {
        status.setStatus("status.httpRecvOnly", "online");
      }
    });

    const socket = signaling.connect();

    socket.on("connect", async () => {
      status.setStatus("status.connected", "online");
      const ack = await signaling.join(roomId);
      if (ack && !ack.ok) {
        status.setStatus("status.joinFailed", "");
        disconnect({ ended: true });
        return;
      }
      if (ack?.robotCapabilities) {
        applyRobotCapabilities(ack.robotCapabilities);
      }
    });

    socket.on(EVENT_JOINED, async (payload) => {
      if (Array.isArray(payload?.iceServers) && payload.iceServers.length) {
        iceServers = payload.iceServers;
      }
      setConnectedUi(true);
      status.setPlaceholder("status.waitingRobot");
      status.setStatus("status.waitingRobot", "online");
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      } else {
        registry.apply(robotCapabilities, featureContext());
      }
      if (payload.peerPresent) {
        await beginCallWithRobot();
      }
    });

    socket.on(EVENT_PEER_JOINED, async (payload) => {
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      }
      await beginCallWithRobot();
    });

    socket.on(EVENT_PEER_LEFT, () => {
      peer.cleanupPeer();
      status.setPlaceholder("status.waitingRobot");
      status.setStatus("status.robotLeft", "online");
    });

    socket.on(EVENT_ROOM_STATE, (state) => {
      if (state?.robotCapabilities) {
        applyRobotCapabilities(state.robotCapabilities);
      }
    });

    socket.on(EVENT_SIGNAL, async (message) => {
      try {
        await peer.handleSignal(message);
      } catch (err) {
        console.error(err);
        status.setRtcState("error");
      }
    });

    socket.on("hangup", () => {
      peer.cleanupPeer();
      status.setPlaceholder("status.endedByRobot");
      status.setStatus("status.endedByRobot", "online");
    });

    socket.on("disconnect", () => {
      locomotion.stopMovement(true);
      status.setStatus("status.disconnected", "");
      setConnectedUi(false);
      peer.cleanupPeer();
      status.showEnded(true);
    });
  }

  function disconnect({ ended = true } = {}) {
    locomotion.stopMovement(true);
    videoQuality.setPanelOpen(false);
    signaling.hangupAndLeave();
    peer.cleanupPeer();
    media.stopLocal();
    setConnectedUi(false);
    status.setStatus("status.disconnected", "");
    media.refreshMediaButtons(false);
    if (ended) status.showEnded(true);
  }

  function bind() {
    registry.apply(null, featureContext());

    els.btnHangup.addEventListener("click", () => disconnect({ ended: true }));
    els.btnRejoin.addEventListener("click", () => {
      connect().catch((err) => console.error(err));
    });
    els.btnToggleMic.addEventListener("click", () => {
      media.toggleMic(connected).catch((err) => console.error(err));
    });
    els.btnToggleCam.addEventListener("click", () => {
      media.toggleCam(connected).catch((err) => console.error(err));
    });

    document.addEventListener("localechange", refreshDynamicText);
    refreshDynamicText();
  }

  return { bind, connect, disconnect, roomId };
}
