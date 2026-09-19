/**
 * @param {string} [search]
 */
export function inviteIdFromSearch(search = "") {
  const raw = String(search || "");
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  try {
    return new URLSearchParams(query).get("invite")?.trim() || "";
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
} = {}) {
  const inviteId = inviteIdFromSearch(search);
  if (!inviteId) return null;
  const joined = await joinInvite(inviteId, "", fetchImpl);
  if (!joined.ok) return false;
  const session = sessionFromJoin(joined.body);
  return session.roomId ? session : false;
}

/**
 * Skip the first connect (gate already joined) and re-join on later reconnects.
 * @param {object | null | false} session
 */
export function createInviteRejoin(session) {
  if (!session) return null;
  let first = true;
  return async function beforeConnect() {
    if (first) {
      first = false;
      return true;
    }
    const next = await ensureInviteSession();
    return Boolean(next && next.roomId);
  };
}
