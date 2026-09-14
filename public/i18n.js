(() => {
  const STORAGE_KEY = "telepresenca.locale";
  const FALLBACK = "pt-BR";
  const SUPPORTED = ["pt-BR", "en", "es", "fr"];

  function interpolate(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) =>
      vars[key] != null ? String(vars[key]) : `{{${key}}}`,
    );
  }

  function normalize(tag) {
    if (!tag || typeof tag !== "string") return FALLBACK;
    const value = tag.trim().replace(/_/g, "-");
    const exact = SUPPORTED.find(
      (locale) => locale.toLowerCase() === value.toLowerCase(),
    );
    if (exact) return exact;
    const prefix = value.split("-")[0].toLowerCase();
    const mapped = {
      pt: "pt-BR",
      en: "en",
      es: "es",
      fr: "fr",
    };
    return mapped[prefix] || FALLBACK;
  }

  function detect() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("lang") || params.get("locale");
      if (fromUrl) return normalize(fromUrl);
    } catch (_) {
      /* ignore */
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return normalize(stored);
    } catch (_) {
      /* ignore */
    }
    const languages =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (const language of languages) {
      const normalized = normalize(language);
      const prefix = String(language || "")
        .split("-")[0]
        .toLowerCase();
      if (prefix && prefix !== "en") return normalized;
      if (prefix === "en") return "en";
    }
    return FALLBACK;
  }

  async function loadLocale(locale) {
    if (i18n.messages[locale]) return i18n.messages[locale];
    const response = await fetch(`locales/${encodeURIComponent(locale)}.json`);
    if (!response.ok) {
      throw new Error(`locale ${locale} HTTP ${response.status}`);
    }
    const table = await response.json();
    i18n.messages[locale] = table;
    return table;
  }

  function persist(locale) {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch (_) {
      /* ignore quota / private mode */
    }
  }

  const i18n = {
    locale: FALLBACK,
    fallback: FALLBACK,
    supported: SUPPORTED.slice(),
    messages: {},

    t(key, vars) {
      const table = this.messages[this.locale] || {};
      const fallback = this.messages[FALLBACK] || {};
      const raw = table[key] || fallback[key];
      if (raw == null) return key;
      return interpolate(raw, vars);
    },

    apply(root = document) {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = this.t(el.getAttribute("data-i18n"));
      });
      root.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = this.t(el.getAttribute("data-i18n-title"));
      });
      root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        el.setAttribute(
          "aria-label",
          this.t(el.getAttribute("data-i18n-aria")),
        );
      });
      root.querySelectorAll("[data-i18n-alt]").forEach((el) => {
        el.alt = this.t(el.getAttribute("data-i18n-alt"));
      });
      document.documentElement.lang = this.locale;
      document.title = this.t("app.title");
      document.querySelectorAll("[data-locale]").forEach((btn) => {
        const active = btn.getAttribute("data-locale") === this.locale;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    },

    async setLocale(locale) {
      const next = normalize(locale);
      try {
        await loadLocale(next);
        this.locale = next;
      } catch (err) {
        console.warn("i18n: failed to switch locale", next, err);
        await loadLocale(FALLBACK);
        this.locale = FALLBACK;
      }
      persist(this.locale);
      this.apply();
      document.dispatchEvent(
        new CustomEvent("localechange", { detail: { locale: this.locale } }),
      );
    },

    async init() {
      this.locale = detect();
      await loadLocale(FALLBACK);
      if (this.locale !== FALLBACK) {
        try {
          await loadLocale(this.locale);
        } catch (err) {
          console.warn("i18n: falling back to", FALLBACK, err);
          this.locale = FALLBACK;
        }
      }
      persist(this.locale);
      SUPPORTED.forEach((locale) => {
        if (!this.messages[locale]) {
          loadLocale(locale).catch(() => {});
        }
      });
      return this.locale;
    },
  };

  window.TeleI18n = i18n;
})();
