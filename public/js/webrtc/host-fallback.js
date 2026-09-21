const DEFAULT_TIMEOUT_MS = 7000;

/**
 * Começa sem STUN/TURN. Se o caminho direto não conectar, aplica os
 * servidores de reserva uma vez e reinicia o ICE.
 *
 * @param {object} options
 * @param {() => RTCPeerConnection | null} options.getPc
 * @param {() => RTCIceServer[]} options.getFallbackServers
 * @param {() => void} [options.onUseMetered]
 * @param {(opts: { iceRestart: boolean, escalate: boolean }) => Promise<void>} options.restart
 * @param {number} [options.timeoutMs]
 */
export function createHostFallback({
  getPc,
  getFallbackServers,
  onUseMetered,
  restart,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  let used = false;
  let connected = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  return {
    reset() {
      used = false;
      connected = false;
      clearTimer();
    },
    markConnected() {
      connected = true;
      clearTimer();
    },
    arm() {
      clearTimer();
      if (used || connected) return;
      timer = setTimeout(() => {
        this.escalate("timeout").catch((err) =>
          console.warn("Falha ao escalar ICE", err),
        );
      }, timeoutMs);
    },
    /**
     * @param {string} reason
     */
    async escalate(reason) {
      if (used) return;
      const servers = getFallbackServers() || [];
      const connection = getPc();
      if (!connection || !servers.length) return;
      used = true;
      clearTimer();
      console.warn(
        `Caminho direto não conectou (${reason}). Último caso: STUN/TURN Metered.`,
      );
      if (typeof onUseMetered === "function") onUseMetered();
      connection.setConfiguration({
        iceServers: servers,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      await restart({ iceRestart: true, escalate: true });
    },
  };
}

/**
 * @param {{ type?: string, sdp?: string } | null | undefined} description
 * @param {boolean} escalate
 */
export function offerSignalData(description, escalate) {
  /** @type {{ type?: string, sdp?: string, escalate?: boolean }} */
  const data = {
    type: description?.type,
    sdp: description?.sdp,
  };
  if (escalate) data.escalate = true;
  return data;
}
