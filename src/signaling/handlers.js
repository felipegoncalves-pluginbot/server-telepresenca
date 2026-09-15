import {
  isKnownRole,
  normalizeRole,
  peerRole,
  ROLE_OPERATOR,
  ROLE_ROBOT,
} from "../protocol/events.js";

/**
 * @param {import("socket.io").Server} io
 * @param {object} deps
 * @param {ReturnType<import("../rooms/store.js").createRoomStore>} deps.rooms
 * @param {unknown[]} deps.iceServers
 * @param {ReturnType<import("../log.js").createLogger>} deps.log
 */
export function attachSignaling(io, { rooms, iceServers, log }) {
  /**
   * @param {import("socket.io").Socket} socket
   */
  function leaveRoom(socket) {
    const { roomId, role } = socket.data;
    if (!roomId || !role) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room[role] === socket.id) {
      delete room[role];
    }

    socket.to(roomId).emit("peer-left", { role, socketId: socket.id });
    socket.leave(roomId);

    if (!room.operator && !room.robot) {
      rooms.delete(roomId);
    } else {
      rooms.set(roomId, room);
    }

    io.to(roomId).emit("room-state", rooms.state(roomId));
    socket.data.roomId = undefined;
    socket.data.role = undefined;
  }

  io.on("connection", (socket) => {
    log.info(`[+] connected ${socket.id}`);

    socket.on("join", ({ roomId, role, capabilities }, ack) => {
      try {
        if (!roomId || typeof roomId !== "string") {
          throw new Error("roomId inválido");
        }
        const effectiveRole = normalizeRole(role);
        if (!isKnownRole(effectiveRole)) {
          throw new Error('role deve ser "operator", "visitor" ou "robot"');
        }

        leaveRoom(socket);

        const room = rooms.ensure(roomId);
        if (
          effectiveRole === ROLE_ROBOT &&
          capabilities &&
          typeof capabilities === "object"
        ) {
          room.robotCapabilities = capabilities;
        }
        if (room[effectiveRole] && room[effectiveRole] !== socket.id) {
          const previous = io.sockets.sockets.get(room[effectiveRole]);
          if (previous) {
            previous.emit("replaced", { role: effectiveRole });
            previous.data.roomId = undefined;
            previous.data.role = undefined;
            previous.leave(roomId);
          }
        }

        room[effectiveRole] = socket.id;
        rooms.set(roomId, room);
        socket.data.roomId = roomId;
        socket.data.role = effectiveRole;
        socket.join(roomId);

        const peerId = room[peerRole(effectiveRole)];

        socket.emit("joined", {
          roomId,
          role: effectiveRole,
          peerPresent: Boolean(peerId),
          robotCapabilities:
            effectiveRole === ROLE_OPERATOR
              ? room.robotCapabilities || null
              : undefined,
          iceServers,
        });

        if (peerId) {
          socket.to(peerId).emit("peer-joined", {
            role: effectiveRole,
            socketId: socket.id,
            robotCapabilities:
              effectiveRole === ROLE_ROBOT ? room.robotCapabilities || null : undefined,
          });
        }

        io.to(roomId).emit("room-state", rooms.state(roomId));
        log.info(`[*] ${socket.id} joined room=${roomId} as ${effectiveRole}`);

        if (typeof ack === "function") {
          ack({ ok: true, ...rooms.state(roomId) });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`[!] join error: ${message}`);
        if (typeof ack === "function") {
          ack({ ok: false, error: message });
        } else {
          socket.emit("error-message", { message });
        }
      }
    });

    socket.on("signal", (payload) => {
      const { roomId, role } = socket.data;
      if (!roomId || !role || !payload?.type) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const targetId = room[peerRole(role)];
      if (!targetId) return;

      io.to(targetId).emit("signal", {
        type: payload.type,
        data: payload.data,
        from: role,
      });
    });

    socket.on("control", (payload) => {
      const { roomId, role } = socket.data;
      if (!roomId || role !== ROLE_OPERATOR || !payload) return;

      const room = rooms.get(roomId);
      if (!room?.robot) return;

      io.to(room.robot).emit("control", {
        action: payload.action,
        value: payload.value,
        from: ROLE_OPERATOR,
      });
    });

    socket.on("video-quality", (payload) => {
      const { roomId, role } = socket.data;
      if (!roomId || role !== ROLE_OPERATOR || !payload) return;

      const presetId =
        typeof payload.presetId === "string" ? payload.presetId.trim() : "";
      if (!presetId) return;

      const room = rooms.get(roomId);
      if (!room?.robot) return;

      io.to(room.robot).emit("video-quality", {
        presetId,
        from: ROLE_OPERATOR,
      });
    });

    socket.on("hangup", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      socket.to(roomId).emit("hangup", { from: socket.data.role });
    });

    socket.on("leave", () => {
      leaveRoom(socket);
    });

    socket.on("disconnect", () => {
      log.info(`[-] disconnected ${socket.id}`);
      leaveRoom(socket);
    });
  });
}
