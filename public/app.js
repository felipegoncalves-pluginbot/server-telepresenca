(() => {
  const ICE_SERVERS = [
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'e1ca1b27bab29178931be09e',
      credential: 'QxjyO2ESeBWGmsOS',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: 'e1ca1b27bab29178931be09e',
      credential: 'QxjyO2ESeBWGmsOS',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'e1ca1b27bab29178931be09e',
      credential: 'QxjyO2ESeBWGmsOS',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'e1ca1b27bab29178931be09e',
      credential: 'QxjyO2ESeBWGmsOS',
    },
  ];

  const els = {
    roomId: document.getElementById('roomId'),
    btnConnect: document.getElementById('btnConnect'),
    btnHangup: document.getElementById('btnHangup'),
    btnToggleMic: document.getElementById('btnToggleMic'),
    btnToggleCam: document.getElementById('btnToggleCam'),
    btnSendCommand: document.getElementById('btnSendCommand'),
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    remotePlaceholder: document.getElementById('remotePlaceholder'),
    statusChip: document.getElementById('statusChip'),
    selfState: document.getElementById('selfState'),
    robotState: document.getElementById('robotState'),
    rtcState: document.getElementById('rtcState'),
  };

  let socket = null;
  let pc = null;
  let localStream = null;
  let makingOffer = false;
  let ignoreOffer = false;
  let isPolite = true; // operator is polite peer
  let connected = false;

  function setStatus(text, mode = '') {
    els.statusChip.textContent = text;
    els.statusChip.className = `status-chip ${mode}`.trim();
  }

  function setRtcState(text) {
    els.rtcState.textContent = text;
  }

  function updateRoomUi(state) {
    els.selfState.textContent = state?.operator ? 'online' : 'offline';
    els.robotState.textContent = state?.robot ? 'online' : 'offline';
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    els.localVideo.srcObject = localStream;
    return localStream;
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
    els.remotePlaceholder.classList.remove('hidden');
    setRtcState('idle');
  }

  async function createPeerConnection() {
    cleanupPeer();
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const stream = await ensureMedia();
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          type: 'ice-candidate',
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      els.remoteVideo.srcObject = stream;
      els.remotePlaceholder.classList.add('hidden');
      setStatus('Em telepresença', 'live');
    };

    pc.onconnectionstatechange = () => {
      setRtcState(pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('Conexão WebRTC instável', 'online');
      }
      if (pc.connectionState === 'connected') {
        setStatus('Em telepresença', 'live');
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
      socket.emit('signal', {
        type: 'offer',
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

    if (message.type === 'offer') {
      const offerCollision = makingOffer || pc.signalingState !== 'stable';
      ignoreOffer = !isPolite && offerCollision;
      if (ignoreOffer) return;

      await pc.setRemoteDescription(message.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', {
        type: 'answer',
        data: pc.localDescription,
      });
      return;
    }

    if (message.type === 'answer') {
      await pc.setRemoteDescription(message.data);
      return;
    }

    if (message.type === 'ice-candidate' && message.data) {
      try {
        await pc.addIceCandidate(message.data);
      } catch (err) {
        if (!ignoreOffer) {
          console.warn('ICE candidate error', err);
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
    els.roomId.disabled = isConnected;
  }

  async function connect() {
    const roomId = (els.roomId.value || 'telepresenca').trim();
    if (!roomId) {
      alert('Informe o nome da sala.');
      return;
    }

    try {
      await ensureMedia();
    } catch (err) {
      alert('Não foi possível acessar câmera/microfone: ' + err.message);
      return;
    }

    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setStatus('Conectado ao servidor', 'online');
      socket.emit('join', { roomId, role: 'operator' }, (ack) => {
        if (ack && !ack.ok) {
          alert(ack.error || 'Falha ao entrar na sala');
          disconnect();
          return;
        }
        updateRoomUi(ack);
      });
    });

    socket.on('joined', async (payload) => {
      setConnectedUi(true);
      setStatus('Aguardando o robô…', 'online');
      if (payload.peerPresent) {
        await startCallAsOfferer();
      }
    });

    socket.on('peer-joined', async () => {
      els.robotState.textContent = 'online';
      await startCallAsOfferer();
    });

    socket.on('peer-left', () => {
      els.robotState.textContent = 'offline';
      cleanupPeer();
      setStatus('Robô desconectado', 'online');
    });

    socket.on('room-state', updateRoomUi);

    socket.on('signal', async (message) => {
      try {
        await handleSignal(message);
      } catch (err) {
        console.error(err);
        setRtcState('erro');
      }
    });

    socket.on('hangup', () => {
      cleanupPeer();
      setStatus('Chamada encerrada pelo robô', 'online');
    });

    socket.on('disconnect', () => {
      setStatus('Desconectado', '');
      setConnectedUi(false);
      cleanupPeer();
      updateRoomUi({ operator: false, robot: false });
    });
  }

  function disconnect() {
    if (socket) {
      socket.emit('hangup');
      socket.emit('leave');
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
    setStatus('Desconectado', '');
    updateRoomUi({ operator: false, robot: false });
    els.btnToggleMic.textContent = 'Mic: ligado';
    els.btnToggleCam.textContent = 'Câm: ligada';
  }

  els.btnConnect.addEventListener('click', () => {
    connect().catch((err) => {
      console.error(err);
      alert(err.message);
    });
  });

  els.btnHangup.addEventListener('click', disconnect);

  els.btnToggleMic.addEventListener('click', () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    els.btnToggleMic.textContent = track.enabled ? 'Mic: ligado' : 'Mic: mudo';
  });

  els.btnToggleCam.addEventListener('click', () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    els.btnToggleCam.textContent = track.enabled ? 'Câm: ligada' : 'Câm: off';
  });

  document.querySelectorAll('[data-control]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!socket || !connected || btn.disabled) return;
      const action = btn.dataset.control;
      // Envio imediato via Socket.IO (WebSocket) — menor latência possível no canal de sinalização.
      socket.volatile.emit('control', { action });
      if (action === 'beep') {
        setStatus('Comando enviado ao robô', 'online');
      }
    });
  });

  // Inicialização automática a partir de parâmetros de URL (padrão de acesso / convite)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const autoConnect = urlParams.get('autoConnect') === 'true' || urlParams.get('auto') === 'true';

    if (roomParam && els.roomId) {
      els.roomId.value = roomParam.trim();
    }

    if (autoConnect && roomParam) {
      connect().catch((err) => {
        console.error('Falha na autoconexão da telepresença:', err);
      });
    }
  } catch (e) {
    console.warn('Erro ao processar parâmetros da URL:', e);
  }
})();
