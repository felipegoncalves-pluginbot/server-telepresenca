const os = require('os');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'telepresenca-signaling' });
});

/** @type {Map<string, { operator?: string, robot?: string }>} */
const rooms = new Map();

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

function roomState(roomId) {
  const room = rooms.get(roomId) || {};
  return {
    roomId,
    operator: Boolean(room.operator),
    robot: Boolean(room.robot),
  };
}

function leaveRoom(socket) {
  const { roomId, role } = socket.data;
  if (!roomId || !role) return;

  const room = rooms.get(roomId);
  if (!room) return;

  if (room[role] === socket.id) {
    delete room[role];
  }

  socket.to(roomId).emit('peer-left', { role, socketId: socket.id });
  socket.leave(roomId);

  if (!room.operator && !room.robot) {
    rooms.delete(roomId);
  } else {
    rooms.set(roomId, room);
  }

  io.to(roomId).emit('room-state', roomState(roomId));
  socket.data.roomId = undefined;
  socket.data.role = undefined;
}

io.on('connection', (socket) => {
  console.log(`[+] connected ${socket.id}`);

  socket.on('join', ({ roomId, role }, ack) => {
    try {
      if (!roomId || typeof roomId !== 'string') {
        throw new Error('roomId inválido');
      }
      if (role !== 'operator' && role !== 'robot') {
        throw new Error('role deve ser "operator" ou "robot"');
      }

      leaveRoom(socket);

      const room = rooms.get(roomId) || {};
      if (room[role] && room[role] !== socket.id) {
        const previous = io.sockets.sockets.get(room[role]);
        if (previous) {
          previous.emit('replaced', { role });
          previous.data.roomId = undefined;
          previous.data.role = undefined;
          previous.leave(roomId);
        }
      }

      room[role] = socket.id;
      rooms.set(roomId, room);
      socket.data.roomId = roomId;
      socket.data.role = role;
      socket.join(roomId);

      const peerRole = role === 'operator' ? 'robot' : 'operator';
      const peerId = room[peerRole];

      socket.emit('joined', {
        roomId,
        role,
        peerPresent: Boolean(peerId),
      });

      if (peerId) {
        socket.to(peerId).emit('peer-joined', { role, socketId: socket.id });
      }

      io.to(roomId).emit('room-state', roomState(roomId));
      console.log(`[*] ${socket.id} joined room=${roomId} as ${role}`);

      if (typeof ack === 'function') {
        ack({ ok: true, ...roomState(roomId) });
      }
    } catch (err) {
      console.error(`[!] join error: ${err.message}`);
      if (typeof ack === 'function') {
        ack({ ok: false, error: err.message });
      } else {
        socket.emit('error-message', { message: err.message });
      }
    }
  });

  socket.on('signal', (payload) => {
    const { roomId, role } = socket.data;
    if (!roomId || !role || !payload || !payload.type) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const targetRole = role === 'operator' ? 'robot' : 'operator';
    const targetId = room[targetRole];
    if (!targetId) return;

    io.to(targetId).emit('signal', {
      type: payload.type,
      data: payload.data,
      from: role,
    });
  });

  socket.on('control', (payload) => {
    const { roomId, role } = socket.data;
    if (!roomId || role !== 'operator' || !payload) return;

    const room = rooms.get(roomId);
    if (!room?.robot) return;

    io.to(room.robot).emit('control', {
      action: payload.action,
      value: payload.value,
      from: 'operator',
    });
  });

  socket.on('hangup', () => {
    const { roomId } = socket.data;
    if (!roomId) return;
    socket.to(roomId).emit('hangup', { from: socket.data.role });
  });

  socket.on('leave', () => {
    leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[-] disconnected ${socket.id}`);
    leaveRoom(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = getLanAddresses();
  console.log('');
  console.log('========================================');
  console.log('  Telepresença — servidor WebRTC');
  console.log('========================================');
  console.log(`  Local:   http://localhost:${PORT}`);
  addresses.forEach((ip) => {
    console.log(`  Rede:    http://${ip}:${PORT}`);
  });
  console.log('========================================');
  console.log('  Abra o front no notebook e use o IP');
  console.log('  acima no app Android.');
  console.log('========================================');
  console.log('');
});
