import { i18n } from "./i18n/index.js";
import { createInviteRejoin, runInviteGate, showInviteMessage } from "./invite/gate.js";
import { bindRemoteVideoLayout } from "./media/remote-layout.js";
import { createOperator } from "./operator.js";
import { queryDom } from "./ui/dom.js";

async function boot() {
  if (typeof io !== "function") {
    throw new Error("socket.io UMD missing");
  }
  await i18n.init();
  i18n.apply();
  const els = queryDom();
  bindRemoteVideoLayout(els.remoteVideo, document.querySelector(".stage"), {
    hostEl: els.remoteVideoHost,
    canvasEl: els.remoteVideoCanvas,
  });
  const session = await runInviteGate({ els, i18n });
  if (session === false) return;

  const operator = createOperator({
    els,
    i18n,
    ioClient: io,
    roomId: session ? session.roomId : undefined,
    expiresAt: session ? session.expiresAt : null,
    beforeConnect: createInviteRejoin(session, {
      onDenied(key) {
        showInviteMessage(els, (item) => i18n.t(item), key);
      },
    }),
  });
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
