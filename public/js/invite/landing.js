/**
 * Landing states from the Double invite webapp, without Double-specific chrome.
 * @param {{ status?: string } | null | undefined} invite
 */
export function invitePhase(invite) {
  const status = invite && invite.status;
  if (status === "ended") return "ended";
  if (status === "not_started") return "soon";
  return "open";
}

/**
 * @param {unknown} iso
 * @param {string} [locale]
 */
export function formatInviteWhen(iso, locale = "pt-BR") {
  const ms = Date.parse(String(iso || ""));
  if (!Number.isFinite(ms)) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms));
  } catch {
    return String(iso);
  }
}

/**
 * @param {unknown} invite
 */
export function pluginspaceLogoUrl(invite) {
  const logo = invite && invite.pluginspace && invite.pluginspace.logo;
  if (!logo) return "";
  if (typeof logo === "string") return logo.trim();
  return String(logo.url || logo.path || "").trim();
}

/**
 * @param {unknown} invite
 */
export function pluginspacePrimaryColor(invite) {
  const theme = invite && invite.pluginspace && invite.pluginspace.theme;
  if (!theme || typeof theme !== "object") return "";
  const nested = theme.colors && theme.colors.primary;
  const primary = theme.primary || nested;
  return typeof primary === "string" ? primary.trim() : "";
}

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {unknown} invite
 */
export function applyInviteBranding(els, invite) {
  const logoUrl = pluginspaceLogoUrl(invite);
  if (els.inviteLogo) {
    els.inviteLogo.classList.toggle("hidden", !logoUrl);
    if (logoUrl) els.inviteLogo.src = logoUrl;
  }
  const color = pluginspacePrimaryColor(invite);
  if (els.inviteOverlay && color) {
    els.inviteOverlay.style.setProperty("--invite-primary", color);
  }
}

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {unknown} invite
 * @param {string} [locale]
 */
export function paintInviteWindow(els, invite, locale = "pt-BR") {
  if (!els.inviteWindow) return;
  const start = formatInviteWhen(invite && invite.start_date, locale);
  const end = formatInviteWhen(invite && invite.end_date, locale);
  const phase = invitePhase(invite);
  let text = "";
  if (phase === "soon") text = start;
  else if (phase === "open" && start && end) text = `${start} — ${end}`;
  els.inviteWindow.textContent = text;
  els.inviteWindow.classList.toggle("hidden", !text);
}
