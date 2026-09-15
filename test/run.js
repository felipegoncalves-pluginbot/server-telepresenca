import { run } from "./helpers/harness.js";

await import("./client/i18n.test.js");
await import("./client/registry.test.js");
await import("./client/video-quality.test.js");
await import("./client/ice-queue.test.js");
await import("./client/handshake.test.js");
await import("./contract/capabilities.test.js");
await import("./contract/robots-matrix.test.js");
await import("./contract/control.test.js");
await import("./contract/events-parity.test.js");
await import("./server/config.test.js");
await import("./server/ice-servers.test.js");
await import("./server/log.test.js");
await import("./server/rooms.test.js");

await run();
