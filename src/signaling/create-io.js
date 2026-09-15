import { Server } from "socket.io";

/**
 * @param {import("node:http").Server} httpServer
 * @param {string | string[]} corsOrigin
 */
export function createIo(httpServer, corsOrigin) {
  return new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });
}
