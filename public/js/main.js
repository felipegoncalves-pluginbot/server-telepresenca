import { i18n } from "./i18n/index.js";
import { createOperator } from "./operator.js";
import { queryDom } from "./ui/dom.js";

async function boot() {
  if (typeof io !== "function") {
    throw new Error("socket.io UMD missing");
  }
  await i18n.init();
  i18n.apply();
  const els = queryDom();
  const operator = createOperator({ els, i18n, ioClient: io });
  operator.bind();
  await operator.connect();
}

boot().catch((err) => {
  console.error(err);
  const chip = document.getElementById("statusChip");
  if (chip) {
    chip.textContent = "Desconectado";
    chip.className = "status-chip";
  }
  document.getElementById("endedOverlay")?.classList.remove("hidden");
});
