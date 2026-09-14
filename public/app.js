(() => {
  const ICE_SERVERS = [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "e1ca1b27bab29178931be09e",
      credential: "QxjyO2ESeBWGmsOS",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "e1ca1b27bab29178931be09e",
      credential: "QxjyO2ESeBWGmsOS",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "e1ca1b27bab29178931be09e",
      credential: "QxjyO2ESeBWGmsOS",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "e1ca1b27bab29178931be09e",
      credential: "QxjyO2ESeBWGmsOS",
    },
  ];

  const DEFAULT_ROOM = "telepresenca";
  const t = (key, vars) => window.TeleI18n.t(key, vars);
  const MOVEMENT_I18N = {
    forward: "movement.forward",
    backward: "movement.backward",
    left: "movement.left",
    right: "movement.right",
    stop: "movement.stop",
  };
  const RTC_I18N = {
    idle: "rtc.idle",
    connecting: "rtc.connecting",
    connected: "rtc.connected",
    disconnected: "rtc.disconnected",
    failed: "rtc.failed",
    error: "rtc.error",
  };

  const VQ = window.TeleVideoQuality;

  const els = {
    btnHangup: document.getElementById("btnHangup"),
    btnRejoin: document.getElementById("btnRejoin"),
    btnToggleMic: document.getElementById("btnToggleMic"),
    btnToggleCam: document.getElementById("btnToggleCam"),
    btnVideoQuality: document.getElementById("btnVideoQuality"),
    btnCloseQuality: document.getElementById("btnCloseQuality"),
    qualityPanel: document.getElementById("qualityPanel"),
    qualitySlider: document.getElementById("qualitySlider"),
    qualityThumb: document.getElementById("qualityThumb"),
    qualityTrackFill: document.getElementById("qualityTrackFill"),
    qualityTicks: document.getElementById("qualityTicks"),
    qualityValueLabel: document.getElementById("qualityValueLabel"),
    qualityBadge: document.getElementById("qualityBadge"),
    btnSendCommand: document.getElementById("btnSendCommand"),
    localVideo: document.getElementById("localVideo"),
    localPip: document.getElementById("localPip"),
    remoteVideo: document.getElementById("remoteVideo"),
    remotePlaceholder: document.getElementById("remotePlaceholder"),
    placeholderText: document.querySelector("#remotePlaceholder p"),
    statusChip: document.getElementById("statusChip"),
    movementHint: document.getElementById("movementHint"),
    joystick: document.getElementById("joystick"),
    kbdHint: document.getElementById("kbdHint"),
    roomLabel: document.getElementById("roomLabel"),
    endedOverlay: document.getElementById("endedOverlay"),
    langToggle: document.getElementById("langToggle"),
    langMenu: document.getElementById("langMenu"),
    langCurrentFlag: document.getElementById("langCurrentFlag"),
  };

  const FLAG_BY_LOCALE = {
    "pt-BR": "assets/flags/br.png",
    en: "assets/flags/us.png",
    es: "assets/flags/es.png",
    fr: "assets/flags/fr.png",
  };

  const KEY_FEEDBACK = {
    w: "w",
    arrowup: "w",
    a: "a",
    arrowleft: "a",
    s: "s",
    arrowdown: "s",
    d: "d",
    arrowright: "d",
  };

  let socket = null;
  let pc = null;
  let localStream = null;
  let makingOffer = false;
  let ignoreOffer = false;
  let isPolite = true;
  let connected = false;
  let connecting = false;
  let roomId = DEFAULT_ROOM;
  let joystick = null;
  let robotCapabilities = null;
  let videoCapabilities = VQ ? VQ.resolveVideoCapabilities(null) : null;
  let qualityPanel = null;
  let qualityApplying = false;
  let lastAppliedCaptureKey = null;
  let offerRetryTimer = null;
  let offerRetryCount = 0;
  const MAX_OFFER_RETRIES = 2;
  let activeMovement = null;
  let movementHeartbeat = null;
  let mediaRequest = null;
  let mediaGeneration = 0;
  let audioUnlockBound = false;

  function resolveRoomId() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("room") || params.get("roomId");
      if (fromUrl && fromUrl.trim()) return fromUrl.trim();
    } catch (_) {
      /* ignore */
    }
    return DEFAULT_ROOM;
  }

  function setPlaceholder(key) {
    if (!els.placeholderText) return;
    els.placeholderText.dataset.i18n = key;
    els.placeholderText.textContent = t(key);
  }

  function setStatus(key, mode = "") {
    els.statusChip.textContent = t(key);
    els.statusChip.dataset.i18n = key;
    els.statusChip.className = `status-chip ${mode}`.trim();
  }

  function setRtcState(state) {
    els.statusChip.dataset.rtc = state || "";
    const key = RTC_I18N[state];
    if (!key) {
      els.statusChip.removeAttribute("title");
      return;
    }
    els.statusChip.title = t(key);
  }

  function showEnded(show) {
    els.endedOverlay.classList.toggle("hidden", !show);
  }

  function micTrack() {
    return localStream ? localStream.getAudioTracks()[0] : null;
  }

  function camTrack() {
    return localStream ? localStream.getVideoTracks()[0] : null;
  }

  function refreshMediaButtons() {
    const mic = micTrack();
    const cam = camTrack();
    const micOn = Boolean(mic && mic.enabled);
    const camOn = Boolean(cam && cam.enabled);
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

  function refreshDynamicText() {
    const statusKey = els.statusChip.dataset.i18n;
    if (statusKey) els.statusChip.textContent = t(statusKey);
    if (els.placeholderText?.dataset.i18n) {
      els.placeholderText.textContent = t(els.placeholderText.dataset.i18n);
    }
    els.roomLabel.textContent = t("room.label", { id: roomId });
    els.btnHangup.setAttribute("aria-label", t("call.hangup"));
    els.btnSendCommand.setAttribute("aria-label", t("media.beep"));
    if (els.btnVideoQuality) {
      els.btnVideoQuality.setAttribute("aria-label", t("video.openPanel"));
    }
    els.joystick.setAttribute("aria-label", t("movement.joystick"));
    els.joystick.title = t("movement.hintKeyboard");
    if (els.kbdHint) {
      els.kbdHint.setAttribute("aria-label", t("movement.hintKeyboard"));
    }
    updateLangFlag();
    updateMovementHint();
    refreshMediaButtons();
    qualityPanel?.refreshLabels();
  }

  function updateLangFlag() {
    const locale = window.TeleI18n.locale;
    const src = FLAG_BY_LOCALE[locale] || FLAG_BY_LOCALE["pt-BR"];
    if (els.langCurrentFlag) els.langCurrentFlag.src = src;
    if (els.langToggle) {
      els.langToggle.setAttribute("aria-label", t("lang.group"));
      els.langToggle.title = t(`lang.${locale}`);
    }
  }

  function setLangMenuOpen(open) {
    if (!els.langMenu || !els.langToggle) return;
    els.langMenu.classList.toggle("hidden", !open);
    els.langToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setKeyFeedback(key, on) {
    const mapped = KEY_FEEDBACK[key];
    if (!mapped || !els.kbdHint) return;
    const cap = els.kbdHint.querySelector(`[data-key="${mapped}"]`);
    if (cap) cap.classList.toggle("is-active", on);
  }

  function isContinuousBackward() {
    return robotCapabilities?.locomotion?.backwardMode === "continuous";
  }

  function updateMovementHint() {
    if (!els.movementHint) return;
    if (isContinuousBackward()) {
      els.movementHint.textContent = t("movement.hintContinuous");
      return;
    }
    const dist = robotCapabilities?.locomotion?.backwardPulseDistanceM ?? 0.2;
    els.movementHint.textContent = t("movement.hintPulse", {
      cm: Math.round(dist * 100),
    });
  }

  function applyRobotCapabilities(caps) {
    robotCapabilities = caps && typeof caps === "object" ? caps : null;
    if (VQ) {
      videoCapabilities = VQ.resolveVideoCapabilities(robotCapabilities);
      if (qualityPanel) {
        const preset = qualityPanel.setPresets(
          videoCapabilities.presets,
          VQ.loadSavedPresetId(videoCapabilities.defaultPreset),
        );
        updateQualityBadge(preset);
        sendVideoQualityToRobot(preset.id);
      }
    }
    updateMovementHint();
  }

  const QUALITY_BADGE = {
    auto: "A",
    low: "L",
    mid: "M",
    high: "H",
    max: "X",
  };

  function updateQualityBadge(preset) {
    if (!els.qualityBadge || !preset) return;
    els.qualityBadge.textContent =
      QUALITY_BADGE[preset.id] || preset.id.slice(0, 1).toUpperCase();
  }

  function sendVideoQualityToRobot(presetId) {
    if (!socket || !connected || !presetId) return;
    socket.emit("video-quality", { presetId });
  }

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

  async function beginCallWithRobot() {
    const preset = qualityPanel?.getSelectedPreset();
    if (preset) {
      sendVideoQualityToRobot(preset.id);
    }
    await startCallAsOfferer();
    scheduleOfferRetryIfNeeded();
  }

  function scheduleOfferRetryIfNeeded() {
    clearOfferRetryTimer();
    offerRetryTimer = setTimeout(async () => {
      if (!connected || !pc || hasRemoteVideoTrack()) return;
      if (offerRetryCount >= MAX_OFFER_RETRIES) return;
      offerRetryCount += 1;
      console.warn("Sem vídeo do robô; reenviando offer.", offerRetryCount);
      await beginCallWithRobot();
    }, 4500);
  }

  async function applyLocalVideoQuality(preset) {
    if (!pc || !VQ || !preset) return;
    try {
      await VQ.applyOutgoingVideoQuality(pc, preset);
    } catch (err) {
      console.warn("Failed to apply outgoing video quality:", err);
    }
  }

  async function handleQualityPresetChange(preset) {
    if (!preset || qualityApplying) return;
    qualityApplying = true;
    try {
      VQ.savePresetId(preset.id);
      updateQualityBadge(preset);
      if (els.qualityTrackFill && qualityPanel) {
        const presets = videoCapabilities?.presets || VQ.DEFAULT_PRESETS;
        const index = presets.findIndex((item) => item.id === preset.id);
        const ratio =
          presets.length <= 1 ? 0 : Math.max(0, index) / (presets.length - 1);
        els.qualityTrackFill.style.width = `${ratio * 100}%`;
      }
      sendVideoQualityToRobot(preset.id);
      if (connected && socket) {
        const captureKey = VQ.captureFormatKey(preset);
        const needsRenegotiation = captureKey !== lastAppliedCaptureKey;
        if (needsRenegotiation) {
          await resetVideoConnection();
          lastAppliedCaptureKey = captureKey;
        } else {
          await applyLocalVideoQuality(preset);
        }
      }
    } finally {
      qualityApplying = false;
    }
  }

  async function resetVideoConnection() {
    if (!connected || !socket) return;
    cleanupPeer();
    setPlaceholder("status.connecting");
    setStatus("status.connecting", "online");
    await createPeerConnection();
    await startCallAsOfferer();
    const preset = qualityPanel?.getSelectedPreset();
    if (preset) {
      sendVideoQualityToRobot(preset.id);
      await applyLocalVideoQuality(preset);
      lastAppliedCaptureKey = VQ.captureFormatKey(preset);
    }
  }

  function setQualityPanelOpen(open) {
    if (!qualityPanel || !els.btnVideoQuality) return;
    qualityPanel.setPanelOpen(open);
    els.btnVideoQuality.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setConnectedUi(isConnected) {
    connected = isConnected;
    connecting = false;
    els.btnHangup.disabled = !isConnected;
    els.btnToggleMic.disabled = !isConnected;
    els.btnToggleCam.disabled = !isConnected;
    els.btnVideoQuality.disabled = !isConnected;
    els.btnSendCommand.disabled = !isConnected;
    if (joystick) joystick.setEnabled(isConnected);
    if (isConnected) {
      showEnded(false);
    } else {
      setQualityPanelOpen(false);
    }
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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
            stream.getTracks().forEach((track) => track.stop());
            return null;
          }
          localStream = stream;
          els.localVideo.srcObject = stream;
          refreshMediaButtons();
          playRemoteWithSound();
          return attachLocalMediaToPeer().then(() => stream);
        })
        .catch((err) => {
          console.warn("Operator camera/microphone unavailable:", err);
          mediaRequest = null;
          return null;
        });
    }
    return mediaRequest;
  }

  async function attachLocalMediaToPeer() {
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
    if (upgraded && socket && pc.signalingState === "stable") {
      await startCallAsOfferer();
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

  async function createPeerConnection() {
    cleanupPeer();
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
      if (event.candidate && socket) {
        socket.emit("signal", {
          type: "ice-candidate",
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
    };

    pc.onconnectionstatechange = () => {
      setRtcState(pc.connectionState);
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setStatus("status.webrtcUnstable", "online");
      }
      if (pc.connectionState === "connected") {
        setStatus("status.live", "live");
        const preset = qualityPanel?.getSelectedPreset();
        if (preset) {
          sendVideoQualityToRobot(preset.id);
          applyLocalVideoQuality(preset).catch((err) => console.warn(err));
          lastAppliedCaptureKey = VQ.captureFormatKey(preset);
        }
      }
    };

    return pc;
  }

  async function startCallAsOfferer() {
    if (!pc) await createPeerConnection();
    makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", {
        type: "offer",
        data: pc.localDescription,
      });
    } finally {
      makingOffer = false;
    }
  }

  async function handleSignal(message) {
    if (!message || !message.type) return;

    if (!pc) {
      await createPeerConnection();
    }

    if (message.type === "offer") {
      const offerCollision = makingOffer || pc.signalingState !== "stable";
      ignoreOffer = !isPolite && offerCollision;
      if (ignoreOffer) return;

      await pc.setRemoteDescription(message.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", {
        type: "answer",
        data: pc.localDescription,
      });
      return;
    }

    if (message.type === "answer") {
      await pc.setRemoteDescription(message.data);
      return;
    }

    if (message.type === "ice-candidate" && message.data) {
      try {
        await pc.addIceCandidate(message.data);
      } catch (err) {
        if (!ignoreOffer) {
          console.warn("ICE candidate error", err);
        }
      }
    }
  }

  async function connect() {
    if (socket || connecting) return;
    connecting = true;
    showEnded(false);
    setPlaceholder("status.connecting");
    setStatus("status.connecting", "online");
    els.remotePlaceholder.classList.remove("hidden");

    ensureMedia().then((stream) => {
      if (
        !stream &&
        !window.isSecureContext &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1"
      ) {
        setStatus("status.httpRecvOnly", "online");
      }
    });

    socket = io({ transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      setStatus("status.connected", "online");
      socket.emit("join", { roomId, role: "operator" }, (ack) => {
        if (ack && !ack.ok) {
          setStatus("status.joinFailed", "");
          disconnect({ ended: true });
          return;
        }
        if (ack?.robotCapabilities) {
          applyRobotCapabilities(ack.robotCapabilities);
        }
      });
    });

    socket.on("joined", async (payload) => {
      setConnectedUi(true);
      setPlaceholder("status.waitingRobot");
      setStatus("status.waitingRobot", "online");
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      }
      if (payload.peerPresent) {
        await beginCallWithRobot();
      }
    });

    socket.on("peer-joined", async (payload) => {
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      }
      await beginCallWithRobot();
    });

    socket.on("peer-left", () => {
      cleanupPeer();
      setPlaceholder("status.waitingRobot");
      setStatus("status.robotLeft", "online");
    });

    socket.on("room-state", (state) => {
      if (state?.robotCapabilities) {
        applyRobotCapabilities(state.robotCapabilities);
      }
    });

    socket.on("signal", async (message) => {
      try {
        await handleSignal(message);
      } catch (err) {
        console.error(err);
        setRtcState("error");
      }
    });

    socket.on("hangup", () => {
      cleanupPeer();
      setPlaceholder("status.endedByRobot");
      setStatus("status.endedByRobot", "online");
    });

    socket.on("disconnect", () => {
      stopMovement(true);
      setStatus("status.disconnected", "");
      setConnectedUi(false);
      cleanupPeer();
      showEnded(true);
    });
  }

  function disconnect({ ended = true } = {}) {
    stopMovement(true);
    setQualityPanelOpen(false);
    if (socket) {
      socket.emit("hangup");
      socket.emit("leave");
      socket.disconnect();
      socket = null;
    }
    cleanupPeer();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
      els.localVideo.srcObject = null;
    }
    mediaGeneration += 1;
    mediaRequest = null;
    setConnectedUi(false);
    setStatus("status.disconnected", "");
    refreshMediaButtons();
    if (ended) showEnded(true);
  }

  function sendControl(action) {
    if (!socket || !connected) return;
    socket.volatile.emit("control", { action });
  }

  function sendBackwardPulse() {
    if (!connected || !socket) return;
    sendControl("backward");
  }

  function startMovement(action) {
    if (!action || !connected || !socket) return;

    if (action === "backward" && !isContinuousBackward()) {
      sendBackwardPulse();
      return;
    }

    if (activeMovement === action) return;

    stopMovement(false);
    activeMovement = action;
    sendControl(action);

    movementHeartbeat = setInterval(() => {
      if (activeMovement && connected && socket) {
        sendControl(activeMovement);
      } else {
        clearInterval(movementHeartbeat);
        movementHeartbeat = null;
      }
    }, 200);
  }

  function stopMovement(sendStop = true) {
    if (movementHeartbeat) {
      clearInterval(movementHeartbeat);
      movementHeartbeat = null;
    }
    if (activeMovement) {
      activeMovement = null;
      if (sendStop && connected && socket) {
        sendControl("stop");
      }
    }
  }

  async function toggleMic() {
    if (!connected) return;
    if (!localStream) {
      await ensureMedia();
      await attachLocalMediaToPeer();
    }
    const track = micTrack();
    if (!track) return;
    track.enabled = !track.enabled;
    refreshMediaButtons();
  }

  async function toggleCam() {
    if (!connected) return;
    if (!localStream) {
      await ensureMedia();
      await attachLocalMediaToPeer();
    }
    const track = camTrack();
    if (!track) return;
    track.enabled = !track.enabled;
    refreshMediaButtons();
  }

  function bindControls() {
    if (VQ) {
      qualityPanel = VQ.createVideoQualityPanel({
        root: els.qualityPanel,
        slider: els.qualitySlider,
        thumb: els.qualityThumb,
        ticks: els.qualityTicks,
        valueLabel: els.qualityValueLabel,
        closeButton: els.btnCloseQuality,
        t,
        onPresetChange(preset) {
          handleQualityPresetChange(preset).catch((err) => console.error(err));
        },
      });
      const initialPreset = qualityPanel.setPresets(
        videoCapabilities.presets,
        VQ.loadSavedPresetId(videoCapabilities.defaultPreset),
      );
      updateQualityBadge(initialPreset);
      const ratio =
        videoCapabilities.presets.length <= 1
          ? 0
          : videoCapabilities.presets.findIndex((item) => item.id === initialPreset.id) /
            (videoCapabilities.presets.length - 1);
      if (els.qualityTrackFill) {
        els.qualityTrackFill.style.width = `${Math.max(0, ratio) * 100}%`;
      }
    }

    if (els.btnVideoQuality) {
      els.btnVideoQuality.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!connected) return;
        setQualityPanelOpen(!qualityPanel?.isPanelOpen());
      });
    }

    document.addEventListener("click", (event) => {
      if (!qualityPanel?.isPanelOpen()) return;
      const panel = els.qualityPanel;
      const button = els.btnVideoQuality;
      if (panel?.contains(event.target) || button?.contains(event.target)) return;
      setQualityPanelOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && qualityPanel?.isPanelOpen()) {
        setQualityPanelOpen(false);
      }
    });

    els.btnHangup.addEventListener("click", () => disconnect({ ended: true }));
    els.btnRejoin.addEventListener("click", () => {
      connect().catch((err) => console.error(err));
    });
    els.btnToggleMic.addEventListener("click", () => {
      toggleMic().catch((err) => console.error(err));
    });
    els.btnToggleCam.addEventListener("click", () => {
      toggleCam().catch((err) => console.error(err));
    });
    els.btnSendCommand.addEventListener("click", () => {
      if (els.btnSendCommand.disabled) return;
      sendControl("beep");
    });

    if (els.langToggle) {
      els.langToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        setLangMenuOpen(els.langMenu.classList.contains("hidden"));
      });
    }
    document.addEventListener("click", (event) => {
      const root = document.getElementById("langSwitch");
      if (!root || root.contains(event.target)) return;
      setLangMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setLangMenuOpen(false);
    });

    joystick = window.createTeleJoystick(els.joystick, {
      onDirection(action) {
        startMovement(action);
        els.joystick.setAttribute(
          "aria-valuetext",
          t(MOVEMENT_I18N[action] || MOVEMENT_I18N.stop),
        );
      },
      onEnd() {
        stopMovement(true);
        els.joystick.setAttribute("aria-valuetext", t(MOVEMENT_I18N.stop));
      },
    });
    joystick.setEnabled(false);

    document.querySelectorAll("[data-locale]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.TeleI18n.setLocale(btn.getAttribute("data-locale"));
        setLangMenuOpen(false);
      });
    });

    document.addEventListener("localechange", refreshDynamicText);
  }

  window.addEventListener("blur", () => {
    stopMovement(true);
  });

  window.addEventListener("keydown", (event) => {
    if (!connected || !socket) return;
    const tag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    if (tag === "input" || tag === "textarea") return;
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    let action = null;

    if (key === "arrowup" || key === "w") action = "forward";
    else if (key === "arrowdown" || key === "s") action = "backward";
    else if (key === "arrowleft" || key === "a") action = "left";
    else if (key === "arrowright" || key === "d") action = "right";
    else if (key === " " || key === "escape") {
      event.preventDefault();
      stopMovement(true);
      return;
    }

    if (action) {
      event.preventDefault();
      setKeyFeedback(key, true);
      startMovement(action);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (!connected || !socket) return;
    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "s") {
      if (!isContinuousBackward()) return;
    }
    const movementKeys = [
      "w",
      "s",
      "a",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ];
    if (movementKeys.includes(key)) {
      event.preventDefault();
      setKeyFeedback(key, false);
      stopMovement(true);
    }
  });

  async function boot() {
    roomId = resolveRoomId();
    await window.TeleI18n.init();
    window.TeleI18n.apply();
    bindControls();
    refreshDynamicText();
    await connect();
  }

  boot().catch((err) => {
    console.error(err);
    setStatus("status.disconnected", "");
    showEnded(true);
  });
})();
