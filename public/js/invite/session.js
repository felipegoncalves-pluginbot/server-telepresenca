/**
 * @param {string} [search]
 */
function searchParams(search = "") {
  const raw = String(search || "");
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  try {
    return new URLSearchParams(query);
  } catch {
    return new URLSearchParams();
  }
}

export function inviteIdFromSearch(search = "") {
  return searchParams(search).get("invite")?.trim() || "";
}

export function roomIdFromSearch(search = "") {
  return searchParams(search).get("room")?.trim() || "";
}

function identificationStorageKey(inviteId) {
  return `telepresenca.invite.identification.${inviteId}`;
}

function defaultStorage() {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

/**
 * @param {string} inviteId
 * @param {string} identification
 * @param {Storage | null} [storage]
 */
export function rememberIdentification(
  inviteId,
  identification,
  storage = defaultStorage(),
) {
  if (!inviteId || !identification || !storage) return;
  try {
    storage.setItem(identificationStorageKey(inviteId), identification);
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} inviteId
 * @param {Storage | null} [storage]
 */
export function recalledIdentification(inviteId, storage = defaultStorage()) {
  if (!inviteId || !storage) return "";
  try {
    return storage.getItem(identificationStorageKey(inviteId)) || "";
  } catch {
    return "";
  }
}

/**
 * Same-origin proxy on the telepresence server.
 * @param {string} inviteId
 * @param {string} [suffix]
 */
export function inviteApiUrl(inviteId, suffix = "") {
  return `/invite-session/${encodeURIComponent(inviteId)}${suffix}`;
}

/**
 * @param {number} status
 * @param {{ code?: string }} [body]
 */
export function overlayKeyForInvite(status, body = {}) {
  const code = body.code || "";
  if (code === "invite_not_started" || status === 425) return "invite.notStarted";
  if (code === "invite_ended" || status === 410) return "invite.expired";
  if (code === "invite_superseded" || status === 409) return "invite.superseded";
  if (code === "invite_not_found" || status === 404) return "invite.notFound";
  if (code === "invite_missing_api" || status === 503) return "invite.missingApi";
  return "invite.unavailable";
}

/**
 * @param {unknown} invite
 */
export function identificationRequired(invite) {
  return Boolean(invite && invite.identification && invite.identification.required);
}

/**
 * @param {{ join?: { url?: string }, session?: { room?: string, expires_at?: string } }} body
 */
export function sessionFromJoin(body) {
  const session = body?.session || {};
  let room = typeof session.room === "string" ? session.room.trim() : "";
  if (!room && body?.join?.url) {
    try {
      room = new URL(body.join.url, "http://local").searchParams.get("room") || "";
    } catch {
      room = "";
    }
  }
  return {
    roomId: room,
    expiresAt: session.expires_at || null,
  };
}

/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchJson(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { ok: response.ok, status: response.status, body };
}

/**
 * @param {string} inviteId
 * @param {typeof fetch} [fetchImpl]
 */
export function fetchInvite(inviteId, fetchImpl = fetch) {
  return fetchJson(inviteApiUrl(inviteId), { method: "GET" }, fetchImpl);
}

/**
 * @param {string} inviteId
 * @param {string} [identification]
 * @param {typeof fetch} [fetchImpl]
 */
export function joinInvite(inviteId, identification = "", fetchImpl = fetch) {
  return fetchJson(
    inviteApiUrl(inviteId, "/join"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identification }),
    },
    fetchImpl,
  );
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.search]
 */
export async function ensureInviteSession({
  fetchImpl = fetch,
  search = typeof window !== "undefined" ? window.location.search : "",
  identification,
} = {}) {
  const inviteId = inviteIdFromSearch(search);
  if (!inviteId) return { ok: true, skipped: true };
  const ident = identification || recalledIdentification(inviteId);
  const joined = await joinInvite(inviteId, ident, fetchImpl);
  if (!joined.ok) {
    return {
      ok: false,
      overlayKey: overlayKeyForInvite(joined.status, joined.body),
    };
  }
  const session = sessionFromJoin(joined.body);
  if (!session.roomId) {
    return { ok: false, overlayKey: "invite.unavailable" };
  }
  return { ok: true, session };
}

/**
 * Skip the first connect (gate already joined) and re-join on later reconnects.
 * @param {object | null | false} session
 * @param {{ onDenied?: (key: string) => void, fetchImpl?: typeof fetch }} [options]
 */
export function createInviteRejoin(session, options = {}) {
  if (!session) return null;
  const { onDenied, fetchImpl, search } = options;
  let first = true;
  return async function beforeConnect() {
    if (first) {
      first = false;
      return true;
    }
    const next = await ensureInviteSession({ fetchImpl, search });
    if (next.ok) return true;
    if (typeof onDenied === "function") {
      onDenied(next.overlayKey || "invite.unavailable");
    }
    return false;
  };
}
