import { beepFeature } from "./features/beep.js";
import { flashlightFeature } from "./features/flashlight.js";
import { createHeadFeature } from "./features/head.js";
import { createLocomotionFeature } from "./features/locomotion.js";
import { createPowerFeature } from "./features/power.js";
import { createFeatureRegistry } from "./features/registry.js";
import { createVideoQualityFeature, savePresetId } from "./features/video-quality.js";
import { createVolumeFeature } from "./features/volume.js";
import { createMediaController } from "./media/local.js";
import { normalizeCapabilities } from "./protocol/capabilities.js";
import {
  EVENT_JOINED,
  EVENT_PEER_JOINED,
  EVENT_PEER_LEFT,
  EVENT_REPLACED,
  EVENT_ROOM_STATE,
  EVENT_SESSION_EXPIRED,
  EVENT_SIGNAL,
  EVENT_STATUS,
} from "./protocol/events.js";
import { createSignalingClient } from "./signaling/client.js";
import { hostById } from "./ui/dom.js";
import { createSessionCountdown } from "./invite/countdown.js";
import {
  endedOverlayState,
  isTransientDisconnect,
  paintCallEnded,
  RECONNECT_GRACE_MS,
} from "./invite/reconnect.js";
import { bindLangSwitch } from "./ui/lang-switch.js";
import { createStatus } from "./ui/status.js";
import { fetchIceServers } from "./webrtc/ice.js";
import { liveStatusKey, liveStatusMode } from "./webrtc/ice-path.js";
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
export function createOperator({
  els,
  i18n,
  ioClient,
  roomId: roomIdOption,
  expiresAt = null,
  beforeConnect = null,
}) {
  const t = (key, vars) => i18n.t(key, vars);
  const status = createStatus(els, t);
  const lang = bindLangSwitch(els, i18n);
  const signaling = createSignalingClient(ioClient);

  const roomId = roomIdOption || resolveRoomId();
  const inviteBound = typeof beforeConnect === "function";
  let graceTimer = null;
  let endedByExpiry = false;
  let endedByReplace = false;
  const countdown = createSessionCountdown({
    els,
    t,
    expiresAt,
    onExpired() {
      endedByExpiry = true;
      disconnect({ ended: true });
    },
  });
  let iceServers = [];
  let meteredAllowed = false;
  let connected = false;
  let connecting = false;
  let robotCapabilities = null;
  let qualityApplying = false;
  let callStartInFlight = false;

  const locomotion = createLocomotionFeature(els, t);
  const head = createHeadFeature(els, t);
  const videoQuality = createVideoQualityFeature(els, t);
  const power = createPowerFeature(els, t);
  const volume = createVolumeFeature(els, t);
  const registry = createFeatureRegistry([
    locomotion,
    head,
    beepFeature,
    videoQuality,
    flashlightFeature,
    power,
    volume,
  ]);

  const peer = createPeerController({
    els,
    getIceServers: () => (meteredAllowed ? iceServers : []),
    getFallbackIceServers: () => iceServers,
    onUseMetered() {
      meteredAllowed = true;
    },
    onIcePath(kind) {
      status.setStatus(liveStatusKey(kind), liveStatusMode(kind));
    },
    getSocket: () => signaling.getSocket(),
    getLocalStream: () => media.getLocalStream(),
    ensureMedia: () => media.ensureMedia(),
    setRtcState: status.setRtcState,
    setStatus: status.setStatus,
    onRemoteVideo(reason) {
      if (reason === "connected" || reason === "track") {
        const preset = videoQuality.getPanel()?.getSelectedPreset();
        if (preset) {
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
        const sentViaP2P = peer.sendDataChannelControl(action, value);
        if (!sentViaP2P) {
          signaling.sendControl(action, value, opts);
        }
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
    if (callStartInFlight) return;
    callStartInFlight = true;
    try {
      await media.ensureMedia({ timeoutMs: 4000 });
      await peer.startCallAsOfferer();
      peer.scheduleOfferRetryIfNeeded();
    } finally {
      callStartInFlight = false;
    }
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
    head.setEnabled(isConnectedFlag);
    volume.setEnabled(isConnectedFlag);
    const flashlightBtn = els.featureHost?.querySelector('[data-feature="flashlight"]');
    if (flashlightBtn) flashlightBtn.disabled = !isConnectedFlag;
    if (isConnectedFlag) {
      status.showEnded(false);
    } else {
      videoQuality.setPanelOpen(false);
      registry.setEnabled?.(false);
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
    if (els.btnSendCommand && !registry.isMounted("beep")) {
      els.btnSendCommand.setAttribute("aria-label", t("media.ringStart"));
    }
    lang.updateLangFlag();
    countdown.paint();
    locomotion.refreshLabels();
    head.refreshLabels();
    videoQuality.refreshLabels();
    registry.refreshLabels();
    media.refreshMediaButtons(connected);
    const flashlightBtn = els.featureHost?.querySelector('[data-feature="flashlight"]');
    if (flashlightBtn) {
      flashlightBtn.setAttribute("aria-label", t("media.flashlight"));
    }
  }

  function clearGrace() {
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  }

  function paintEnded(flags = {}) {
    paintCallEnded(
      endedOverlayState({
        expired: endedByExpiry,
        replaced: endedByReplace,
        inviteBound,
        expiresAt,
        ...flags,
      }),
      status,
      els,
      t,
    );
  }

  function armGrace() {
    clearGrace();
    graceTimer = setTimeout(() => {
      paintEnded({ transient: false });
    }, RECONNECT_GRACE_MS);
  }

  async function connect({ force = false } = {}) {
    if (endedByExpiry || connecting) return;
    if (signaling.getSocket()) {
      if (!force) return;
      signaling.disconnectSocket();
    }
    if (typeof beforeConnect === "function") {
      const allowed = await beforeConnect();
      if (allowed === false) return;
    }
    connecting = true;
    meteredAllowed = false;
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
      if (endedByExpiry) return;
      endedByReplace = false;
      clearGrace();
      status.setStatus("status.connected", "online");
      const ack = await signaling.join(roomId, expiresAt ? { expiresAt } : {});
      if (ack && !ack.ok) {
        if (String(ack.error || "").includes("expired")) endedByExpiry = true;
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
      countdown.start();
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
      meteredAllowed = false;
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

    socket.on(EVENT_STATUS, (payload) => {
      registry.applyStatus(payload);
    });

    socket.on("hangup", () => {
      peer.cleanupPeer();
      status.setPlaceholder("status.endedByRobot");
      status.setStatus("status.endedByRobot", "online");
    });

    socket.on(EVENT_REPLACED, () => {
      endedByReplace = true;
      clearGrace();
      peer.cleanupPeer();
      paintEnded({ replaced: true });
    });

    socket.on(EVENT_SESSION_EXPIRED, () => {
      endedByExpiry = true;
      disconnect({ ended: true });
    });

    socket.on("disconnect", (reason) => {
      locomotion.stopMovement(true);
      peer.cleanupPeer();
      setConnectedUi(false);
      if (endedByExpiry) {
        paintEnded({ expired: true });
        return;
      }
      if (endedByReplace || !isTransientDisconnect(reason)) {
        paintEnded({ replaced: endedByReplace, transient: false });
        return;
      }
      paintEnded({ transient: true });
      armGrace();
    });
  }

  function disconnect({ ended = true } = {}) {
    clearGrace();
    countdown.stop();
    locomotion.stopMovement(true);
    videoQuality.setPanelOpen(false);
    signaling.hangupAndLeave();
    peer.cleanupPeer();
    media.stopLocal();
    setConnectedUi(false);
    media.refreshMediaButtons(false);
    if (ended) paintEnded({ expired: endedByExpiry, replaced: endedByReplace });
  }

  function bind() {
    registry.apply(null, featureContext());

    els.btnHangup.addEventListener("click", () => disconnect({ ended: true }));
    els.btnRejoin.addEventListener("click", () => {
      endedByExpiry = false;
      endedByReplace = false;
      connect({ force: true }).catch((err) => console.error(err));
    });
    els.btnToggleMic.addEventListener("click", () => {
      media.toggleMic(connected).catch((err) => console.error(err));
    });
    els.btnToggleCam.addEventListener("click", () => {
      media.toggleCam(connected).catch((err) => console.error(err));
    });

    document.addEventListener("localechange", refreshDynamicText);
    refreshDynamicText();
    countdown.start();
  }

  return { bind, connect, disconnect, roomId };
}
