/**
 * @typedef {{ operator?: string, robot?: string, robotCapabilities?: object | null, lastStatus?: object | null, expiresAt?: number | null, expiryTimer?: ReturnType<typeof setTimeout> | null }} Room
 * @typedef {{ roomId: string, operator: boolean, robot: boolean, robotCapabilities: object | null }} RoomState
 */

export function createRoomStore() {
  /** @type {Map<string, Room>} */
  const rooms = new Map();

  return {
    /**
     * @param {string} roomId
     * @returns {Room | undefined}
     */
    get(roomId) {
      return rooms.get(roomId);
    },

    /**
     * @param {string} roomId
     * @returns {Room}
     */
    ensure(roomId) {
      const existing = rooms.get(roomId);
      if (existing) return existing;
      /** @type {Room} */
      const created = {};
      rooms.set(roomId, created);
      return created;
    },

    /**
     * @param {string} roomId
     * @param {Room} room
     */
    set(roomId, room) {
      rooms.set(roomId, room);
    },

    /**
     * @param {string} roomId
     */
    delete(roomId) {
      rooms.delete(roomId);
    },

    /**
     * @param {string} roomId
     * @returns {RoomState}
     */
    state(roomId) {
      const room = rooms.get(roomId) || {};
      return {
        roomId,
        operator: Boolean(room.operator),
        robot: Boolean(room.robot),
        robotCapabilities: room.robotCapabilities || null,
      };
    },
  };
}
