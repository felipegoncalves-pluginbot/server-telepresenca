import http from "node:http";
import os from "node:os";
import path from "node:path";
import { loadConfig, loadEnvFile, ROOT_DIR } from "./config.js";
import { createApp } from "./http/create-app.js";
import { buildIceServers } from "./ice/ice-servers.js";
import { createLogger } from "./log.js";
import { createRoomStore } from "./rooms/store.js";
import { createIo } from "./signaling/create-io.js";
import { attachSignaling } from "./signaling/handlers.js";

loadEnvFile();
const config = loadConfig();
const log = createLogger();
const iceServers = buildIceServers(config);
const rooms = createRoomStore();

const app = createApp({
  publicDir: path.join(ROOT_DIR, "public"),
  iceServers,
  corsOrigin: config.corsOrigin,
});
const server = http.createServer(app);
const io = createIo(server, config.corsOrigin);
attachSignaling(io, { rooms, iceServers, log });

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

server.listen(config.port, "0.0.0.0", () => {
  const addresses = getLanAddresses();
  log.info("");
  log.info("========================================");
  log.info("  Telepresença — servidor WebRTC");
  log.info("========================================");
  log.info(`  Local:   http://localhost:${config.port}`);
  for (const ip of addresses) {
    log.info(`  Rede:    http://${ip}:${config.port}`);
  }
  log.info(`  ICE:     ${iceServers.length} server(s)`);
  log.info("========================================");
  log.info("  Abra o front no notebook e use o IP");
  log.info("  acima no app Android.");
  log.info("========================================");
  log.info("");
});
