/**
 * Fila de ICE trickle: candidatos que chegam antes do setRemoteDescription
 * são guardados e reaplicados depois. Padrão usado por LiveKit, Kinesis e MDN.
 */
export function createIceQueue() {
  /** @type {unknown[]} */
  let pending = [];
  let remoteReady = false;

  return {
    reset() {
      pending = [];
      remoteReady = false;
    },
    markRemoteDescriptionSet() {
      remoteReady = true;
    },
    isRemoteReady() {
      return remoteReady;
    },
    size() {
      return pending.length;
    },
    /**
     * @param {unknown} candidate
     * @returns {boolean} true se enfileirou (ainda não há remote description)
     */
    enqueueIfNeeded(candidate) {
      if (remoteReady) return false;
      if (candidate) pending.push(candidate);
      return true;
    },
    /**
     * @param {(candidate: unknown) => Promise<unknown> | unknown} apply
     */
    async flush(apply) {
      remoteReady = true;
      const batch = pending;
      pending = [];
      for (const candidate of batch) {
        try {
          await apply(candidate);
        } catch (err) {
          console.warn("ICE queued candidate dropped", err);
        }
      }
    },
  };
}
