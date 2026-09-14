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

  const els = {
    roomId: document.getElementById("roomId"),
    btnConnect: document.getElementById("btnConnect"),
    btnHangup: document.getElementById("btnHangup"),
    btnToggleMic: document.getElementById("btnToggleMic"),
    btnToggleCam: document.getElementById("btnToggleCam"),
    btnSendCommand: document.getElementById("btnSendCommand"),
    localVideo: document.getElementById("localVideo"),
    remoteVideo: document.getElementById("remoteVideo"),
    remotePlaceholder: document.getElementById("remotePlaceholder"),
    statusChip: document.getElementById("statusChip"),
    selfState: document.getElementById("selfState"),
    robotState: document.getElementById("robotState"),
    rtcState: document.getElementById("rtcState"),
    movementControls: document.getElementById("movementControls"),
  };

  let socket = null;
  let pc = null;
  let localStream = null;
  let makingOffer = false;
  let ignoreOffer = false;
  let isPolite = true; // operator is polite peer
  let connected = false;

  function setStatus(text, mode = "") {
    els.statusChip.textContent = text;
    els.statusChip.className = `status-chip ${mode}`.trim();
  }

  function setRtcState(text) {
    els.rtcState.textContent = text;
  }

  function updateRoomUi(state) {
    els.selfState.textContent = state?.operator ? "online" : "offline";
    els.robotState.textContent = state?.robot ? "online" : "offline";
    if (state?.robotCapabilities) {
      applyRobotCapabilities(state.robotCapabilities);
    }
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn(
        "navigator.mediaDevices não disponível neste navegador/contexto (HTTP sem TLS). Conectando em modo controle/recepção de vídeo.",
      );
      return null;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      els.localVideo.srcObject = localStream;
      return localStream;
    } catch (err) {
      console.warn("Não foi possível obter microfone/câmera do operador:", err);
      return null;
    }
  }

  function cleanupPeer() {
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
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const stream = await ensureMedia();
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    } else {
      // Modo de somente recepção (recvonly): permite receber o vídeo/áudio do robô e controlá-lo
      // mesmo se o navegador bloquear acesso ao microfone/webcam do operador por restrição HTTP.
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch (e) {
        console.warn("Falha ao registrar transceivers recvonly:", e);
      }
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
      const [stream] = event.streams;
      els.remoteVideo.srcObject = stream;
      els.remotePlaceholder.classList.add("hidden");
      setStatus("Em telepresença", "live");
    };

    pc.onconnectionstatechange = () => {
      setRtcState(pc.connectionState);
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setStatus("Conexão WebRTC instável", "online");
      }
      if (pc.connectionState === "connected") {
        setStatus("Em telepresença", "live");
      }
    };

    pc.onsignalingstatechange = () => {
      // no-op; useful for debugging
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

  function setConnectedUi(isConnected) {
    connected = isConnected;
    els.btnConnect.disabled = isConnected;
    els.btnHangup.disabled = !isConnected;
    els.btnToggleMic.disabled = !isConnected;
    els.btnToggleCam.disabled = !isConnected;
    els.btnSendCommand.disabled = !isConnected;
    if (els.movementControls) {
      els.movementControls.disabled = !isConnected;
    }
    els.roomId.disabled = isConnected;
  }

  async function connect() {
    const roomId = (els.roomId.value || "telepresenca").trim();
    if (!roomId) {
      alert("Informe o nome da sala.");
      return;
    }

    const stream = await ensureMedia();
    if (
      !stream &&
      !window.isSecureContext &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
      setStatus(
        "Acesso HTTP: Modo controle e recepção de vídeo ativado",
        "online",
      );
    }

    socket = io({ transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      setStatus("Conectado ao servidor", "online");
      socket.emit("join", { roomId, role: "operator" }, (ack) => {
        if (ack && !ack.ok) {
          alert(ack.error || "Falha ao entrar na sala");
          disconnect();
          return;
        }
        updateRoomUi(ack);
      });
    });

    socket.on("joined", async (payload) => {
      setConnectedUi(true);
      setStatus("Aguardando o robô…", "online");
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      }
      if (payload.peerPresent) {
        await startCallAsOfferer();
      }
    });

    socket.on("peer-joined", async (payload) => {
      els.robotState.textContent = "online";
      if (payload?.robotCapabilities) {
        applyRobotCapabilities(payload.robotCapabilities);
      }
      await startCallAsOfferer();
    });

    socket.on("peer-left", () => {
      els.robotState.textContent = "offline";
      cleanupPeer();
      setStatus("Robô desconectado", "online");
    });

    socket.on("room-state", updateRoomUi);

    socket.on("signal", async (message) => {
      try {
        await handleSignal(message);
      } catch (err) {
        console.error(err);
        setRtcState("erro");
      }
    });

    socket.on("hangup", () => {
      cleanupPeer();
      setStatus("Chamada encerrada pelo robô", "online");
    });

    socket.on("disconnect", () => {
      setStatus("Desconectado", "");
      setConnectedUi(false);
      cleanupPeer();
      updateRoomUi({ operator: false, robot: false });
    });
  }

  function disconnect() {
    if (socket) {
      socket.emit("hangup");
      socket.emit("leave");
      socket.disconnect();
      socket = null;
    }
    cleanupPeer();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
      els.localVideo.srcObject = null;
    }
    setConnectedUi(false);
    setStatus("Desconectado", "");
    updateRoomUi({ operator: false, robot: false });
    els.btnToggleMic.textContent = "Mic: ligado";
    els.btnToggleCam.textContent = "Câm: ligada";
  }

  els.btnConnect.addEventListener("click", () => {
    connect().catch((err) => {
      console.error(err);
      alert(err.message);
    });
  });

  els.btnHangup.addEventListener("click", disconnect);

  els.btnToggleMic.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    els.btnToggleMic.textContent = track.enabled ? "Mic: ligado" : "Mic: mudo";
  });

  els.btnToggleCam.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    els.btnToggleCam.textContent = track.enabled ? "Câm: ligada" : "Câm: off";
  });

  function sendControl(action) {
    if (!socket || !connected) return;
    socket.volatile.emit("control", { action });
    if (action === "beep") {
      setStatus("Comando enviado ao robô", "online");
    }
  }

  let activeMovement = null;
  let movementHeartbeat = null;
  let robotCapabilities = null;

  function applyRobotCapabilities(caps) {
    robotCapabilities = caps && typeof caps === "object" ? caps : null;
    updateMovementHint();
  }

  /** Ré contínua só quando o robô anuncia sensor traseiro + modo continuous. */
  function isContinuousBackward() {
    const mode = robotCapabilities?.locomotion?.backwardMode;
    return mode === "continuous";
  }

  function updateMovementHint() {
    const hint = document.querySelector("#movementControls .hint");
    if (!hint) return;
    if (isContinuousBackward()) {
      hint.textContent =
        "Use os botões ou o teclado (WASD / Setas / Espaço). Ré contínua disponível.";
      return;
    }
    const dist =
      robotCapabilities?.locomotion?.backwardPulseDistanceM ?? 0.2;
    hint.textContent =
      `Frente/giros: segure. Ré: um clique ≈ ${Math.round(dist * 100)} cm (sem sensor traseiro).`;
  }

  function sendBackwardPulse() {
    if (!connected || !socket) return;
    sendControl("backward");
  }

  function startMovement(action) {
    if (!action || !connected || !socket) return;

    // Ré por pulso: um comando por toque/tecla — robô reforça no firmware.
    if (action === "backward" && !isContinuousBackward()) {
      sendBackwardPulse();
      return;
    }

    if (activeMovement === action) return;

    stopMovement(false);
    activeMovement = action;
    sendControl(action);

    // Heartbeat contínuo a cada 200ms enquanto o operador mantiver pressionado.
    // Garante que o watchdog do robô (500ms) permaneça ativo sem enviar chamadas excessivas.
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

  // Intercepta perda de foco da aba para garantir parada do robô
  window.addEventListener("blur", () => {
    stopMovement(true);
  });

  // Botões de controle na interface web (clique para beep, segurar/soltar para movimento)
  document.querySelectorAll("[data-control]").forEach((btn) => {
    const action = btn.dataset.control;

    if (action === "beep") {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        sendControl("beep");
      });
      return;
    }

    if (action === "stop") {
      btn.addEventListener("click", () => {
        stopMovement(true);
      });
      return;
    }

    const onPointerDown = (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      startMovement(action);
    };

    const onPointerUp = (e) => {
      e.preventDefault();
      stopMovement(true);
    };

    btn.addEventListener("mousedown", onPointerDown);
    btn.addEventListener("mouseup", onPointerUp);
    btn.addEventListener("mouseleave", onPointerUp);
    btn.addEventListener("touchstart", onPointerDown, { passive: false });
    btn.addEventListener("touchend", onPointerUp, { passive: false });
    btn.addEventListener("touchcancel", onPointerUp, { passive: false });
  });

  // Atalhos de teclado ergonômicos e suaves (WASD / Setas / Espaço)
  window.addEventListener("keydown", (e) => {
    if (!connected || !socket) return;
    const tag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    if (tag === "input" || tag === "textarea") return;
    if (e.repeat) return; // Ignora repetição do SO para eliminar travamentos e DEVICE_CONFLICT

    const key = e.key.toLowerCase();
    let action = null;

    if (key === "arrowup" || key === "w") action = "forward";
    else if (key === "arrowdown" || key === "s") action = "backward";
    else if (key === "arrowleft" || key === "a") action = "left";
    else if (key === "arrowright" || key === "d") action = "right";
    else if (key === " " || key === "escape") {
      e.preventDefault();
      stopMovement(true);
      return;
    }

    if (action) {
      e.preventDefault();
      startMovement(action);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!connected || !socket) return;
    const key = e.key.toLowerCase();
    if (key === "arrowdown" || key === "s") {
      if (!isContinuousBackward()) {
        return;
      }
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
      e.preventDefault();
      stopMovement(true);
    }
  });

  // Inicialização automática a partir de parâmetros de URL (padrão de acesso / convite)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    const autoConnect =
      urlParams.get("autoConnect") === "true" ||
      urlParams.get("auto") === "true";

    if (roomParam && els.roomId) {
      els.roomId.value = roomParam.trim();
    }

    if (autoConnect && roomParam) {
      connect().catch((err) => {
        console.error("Falha na autoconexão da telepresença:", err);
      });
    }
  } catch (e) {
    console.warn("Erro ao processar parâmetros da URL:", e);
  }
})();
