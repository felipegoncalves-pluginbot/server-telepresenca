/**
 * Lê o par ICE escolhido e os candidatos locais.
 * O navegador sempre consulta STUN/TURN na coleta; só `relay` carrega a mídia.
 */

/**
 * @typedef {{ host: number, srflx: number, prflx: number, relay: number }} GatheredCounts
 * @typedef {{ localType: string, remoteType: string, protocol: string, usingRelay: boolean }} SelectedPair
 * @typedef {{ level: "info" | "warn", message: string }} IceLog
 */

const CANDIDATE_TYPES = ["host", "srflx", "prflx", "relay"];

/**
 * @param {Iterable<{ type?: string, candidateType?: string }>} reports
 * @returns {GatheredCounts}
 */
export function summarizeGathered(reports) {
  /** @type {GatheredCounts} */
  const counts = { host: 0, srflx: 0, prflx: 0, relay: 0 };
  for (const report of reports) {
    if (report?.type !== "local-candidate") continue;
    const kind = report.candidateType;
    if (kind && Object.prototype.hasOwnProperty.call(counts, kind)) {
      counts[kind] += 1;
    }
  }
  return counts;
}

/**
 * @param {Array<{ type?: string, selectedCandidatePairId?: string, nominated?: boolean, selected?: boolean, state?: string }>} reports
 * @param {{ get: (id: string) => unknown }} stats
 */
function findSelectedPairReport(reports, stats) {
  const transport = reports.find(
    (report) => report.type === "transport" && report.selectedCandidatePairId,
  );
  if (transport?.selectedCandidatePairId) {
    const selected = stats.get(transport.selectedCandidatePairId);
    if (selected) return selected;
  }
  return (
    reports.find(
      (report) =>
        report.type === "candidate-pair" &&
        report.nominated &&
        report.state === "succeeded",
    ) ||
    reports.find(
      (report) =>
        report.type === "candidate-pair" && (report.selected || report.nominated),
    ) ||
    null
  );
}

/**
 * @param {{ values: () => Iterable<{ type?: string, selectedCandidatePairId?: string, nominated?: boolean, selected?: boolean, state?: string, localCandidateId?: string, remoteCandidateId?: string }>, get: (id: string) => { candidateType?: string, protocol?: string, relayProtocol?: string, localCandidateId?: string, remoteCandidateId?: string } | undefined }} stats
 * @returns {SelectedPair | null}
 */
export function readSelectedPair(stats) {
  const pair = findSelectedPairReport([...stats.values()], stats);
  if (!pair?.localCandidateId) return null;

  const local = stats.get(pair.localCandidateId);
  const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : null;
  const localType = local?.candidateType || "unknown";
  const remoteType = remote?.candidateType || "unknown";
  return {
    localType,
    remoteType,
    protocol: local?.relayProtocol || local?.protocol || remote?.protocol || "unknown",
    usingRelay: localType === "relay" || remoteType === "relay",
  };
}

/**
 * @param {GatheredCounts} counts
 * @returns {string | null}
 */
export function formatGatheredMessage(counts) {
  const parts = CANDIDATE_TYPES.filter((kind) => counts[kind] > 0).map(
    (kind) => `${counts[kind]} ${kind}`,
  );
  if (!parts.length) return null;
  const reserve = counts.relay
    ? " O TURN entrou só como reserva; isso já aparece no Metered mesmo com a mídia em caminho direto."
    : "";
  return `ICE recolheu candidatos locais: ${parts.join(", ")}.${reserve}`;
}

/**
 * Caminho da mídia: UDP direto (host ou srflx) ou TURN.
 * @param {SelectedPair | null} pair
 * @returns {"udp" | "turn" | null}
 */
export function mediaPathKind(pair) {
  if (!pair) return null;
  return pair.usingRelay ? "turn" : "udp";
}

/**
 * @param {"udp" | "turn" | null} kind
 * @returns {string}
 */
export function liveStatusKey(kind) {
  if (kind === "turn") return "status.liveTurn";
  if (kind === "udp") return "status.liveUdp";
  return "status.live";
}

/**
 * @param {"udp" | "turn" | null} kind
 * @returns {string}
 */
export function liveStatusMode(kind) {
  if (kind === "turn") return "live live-turn";
  return "live";
}

/**
 * @param {SelectedPair | null} pair
 * @returns {IceLog | null}
 */
export function formatIcePathMessage(pair) {
  if (!pair) return null;
  if (pair.usingRelay) {
    return {
      level: "warn",
      message: `WebRTC usando TURN (relay ${pair.protocol}). Par local=${pair.localType} remoto=${pair.remoteType}. O caminho direto não conectou; a mídia está passando pelo servidor Metered.`,
    };
  }
  return {
    level: "info",
    message: `WebRTC em caminho direto (${pair.localType} → ${pair.remoteType}, ${pair.protocol}). TURN não está carregando a mídia.`,
  };
}

/**
 * @param {RTCPeerConnection} pc
 */
export async function reportGatheredIce(pc) {
  const message = formatGatheredMessage(
    summarizeGathered((await pc.getStats()).values()),
  );
  if (message) console.info(message);
}

/**
 * @param {RTCPeerConnection} pc
 */
/**
 * @param {RTCPeerConnection} pc
 * @returns {Promise<"udp" | "turn" | null>}
 */
export async function reportSelectedIcePath(pc) {
  const pair = readSelectedPair(await pc.getStats());
  const entry = formatIcePathMessage(pair);
  if (!entry) {
    console.info(
      "WebRTC conectou, mas o par ICE selecionado ainda não apareceu nas stats.",
    );
    return null;
  }
  if (entry.level === "warn") console.warn(entry.message);
  else console.info(entry.message);
  return mediaPathKind(pair);
}
