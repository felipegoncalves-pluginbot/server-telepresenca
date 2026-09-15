const FLAG_BY_LOCALE = {
  "pt-BR": "assets/flags/br.png",
  en: "assets/flags/us.png",
  es: "assets/flags/es.png",
  fr: "assets/flags/fr.png",
};

/**
 * @param {object} els
 * @param {{ locale: string, t: Function, setLocale: Function }} i18n
 */
export function bindLangSwitch(els, i18n) {
  function updateLangFlag() {
    const locale = i18n.locale;
    const src = FLAG_BY_LOCALE[locale] || FLAG_BY_LOCALE["pt-BR"];
    if (els.langCurrentFlag) els.langCurrentFlag.src = src;
    if (els.langToggle) {
      els.langToggle.setAttribute("aria-label", i18n.t("lang.group"));
      els.langToggle.title = i18n.t(`lang.${locale}`);
    }
  }

  function setLangMenuOpen(open) {
    if (!els.langMenu || !els.langToggle) return;
    els.langMenu.classList.toggle("hidden", !open);
    els.langToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (els.langToggle) {
    els.langToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setLangMenuOpen(els.langMenu.classList.contains("hidden"));
    });
  }

  document.addEventListener("click", (event) => {
    const root = document.getElementById("langSwitch");
    if (!root || root.contains(event.target)) return;
    setLangMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLangMenuOpen(false);
  });

  document.querySelectorAll("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      i18n.setLocale(btn.getAttribute("data-locale"));
      setLangMenuOpen(false);
    });
  });

  return { updateLangFlag, setLangMenuOpen };
}
