import {
  EVENT_CONTROL,
  EVENT_HANGUP,
  EVENT_JOIN,
  EVENT_LEAVE,
  EVENT_VIDEO_QUALITY,
  ROLE_OPERATOR,
} from "../protocol/events.js";

/**
 * @param {typeof io} ioClient
 */
export function createSignalingClient(ioClient) {
  let socket = null;

  function connect() {
    socket = ioClient({ transports: ["websocket", "polling"] });
    return socket;
  }

  function join(roomId, extra = {}) {
    if (!socket) return;
    return new Promise((resolve) => {
      socket.emit(
        EVENT_JOIN,
        { roomId, role: ROLE_OPERATOR, ...extra },
        (ack) => {
          resolve(ack);
        },
      );
    });
  }

  /**
   * @param {string} action
   * @param {unknown} [value]
   * @param {{ volatile?: boolean }} [opts]
   */
  function sendControl(action, value, opts = {}) {
    if (!socket) return;
    const payload = value === undefined ? { action } : { action, value };
    if (opts.volatile) {
      socket.volatile.emit(EVENT_CONTROL, payload);
      return;
    }
    socket.emit(EVENT_CONTROL, payload);
  }

  function sendVideoQuality(presetId) {
    if (!socket || !presetId) return;
    socket.emit(EVENT_VIDEO_QUALITY, { presetId });
  }

  function hangupAndLeave() {
    if (!socket) return;
    socket.emit(EVENT_HANGUP);
    socket.emit(EVENT_LEAVE);
    socket.disconnect();
    socket = null;
  }

  function disconnectSocket() {
    if (!socket) return;
    socket.disconnect();
    socket = null;
  }

  return {
    connect,
    join,
    sendControl,
    sendVideoQuality,
    hangupAndLeave,
    disconnectSocket,
    getSocket: () => socket,
  };
}
