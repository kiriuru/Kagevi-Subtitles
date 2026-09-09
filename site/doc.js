(() => {
  const STRINGS = {
    en: {
      navGuide: "Guide",
      navWiki: "Wiki",
      navChangelog: "Changelog",
      navDownload: "Download",
      navLicenses: "Licenses",
      navHome: "Home",
      wikiEyebrow: "Documentation",
      wikiTitle: "Wiki",
      wikiLede:
        "Operational guide for the dashboard, recognition modes, translation, OBS, and modules.",
      changelogEyebrow: "Release notes",
      changelogTitle: "Changelog",
      changelogLede: "Notable changes across Kagevi Subtitles releases.",
      tocTitle: "On this page",
      footerTag: "Local-first live subtitles for streamers.",
      navMenu: "Menu",
    },
    ru: {
      navGuide: "Гид",
      navWiki: "Wiki",
      navChangelog: "Список изменений",
      navDownload: "Скачать",
      navLicenses: "Лицензии",
      navHome: "Главная",
      wikiEyebrow: "Документация",
      wikiTitle: "Wiki",
      wikiLede:
        "Практическое руководство по дашборду, режимам распознавания, переводу, OBS и модулям.",
      changelogEyebrow: "Релизы",
      changelogTitle: "Список изменений",
      changelogLede: "Заметные изменения в релизах Kagevi Subtitles.",
      tocTitle: "На этой странице",
      footerTag: "Локальные живые субтитры для стримеров.",
      navMenu: "Меню",
    },
    ja: {
      navGuide: "ガイド",
      navWiki: "Wiki",
      navChangelog: "変更履歴",
      navDownload: "ダウンロード",
      navLicenses: "ライセンス",
      navHome: "ホーム",
      wikiEyebrow: "ドキュメント",
      wikiTitle: "Wiki",
      wikiLede:
        "ダッシュボード、認識モード、翻訳、OBS、モジュールの運用ガイド。",
      changelogEyebrow: "リリースノート",
      changelogTitle: "変更履歴",
      changelogLede: "Kagevi Subtitles の主な変更点。",
      tocTitle: "このページ",
      footerTag: "配信者向けローカル・ライブ字幕。",
      navMenu: "メニュー",
    },
    zh: {
      navGuide: "指南",
      navWiki: "Wiki",
      navChangelog: "更新日志",
      navDownload: "下载",
      navLicenses: "许可",
      navHome: "首页",
      wikiEyebrow: "文档",
      wikiTitle: "Wiki",
      wikiLede: "仪表盘、识别模式、翻译、OBS 与模块的操作指南。",
      changelogEyebrow: "发行说明",
      changelogTitle: "更新日志",
      changelogLede: "Kagevi Subtitles 各版本的重要变更。",
      tocTitle: "本页目录",
      footerTag: "面向主播的本地实时字幕。",
      navMenu: "菜单",
    },
    ko: {
      navGuide: "가이드",
      navWiki: "Wiki",
      navChangelog: "변경 로그",
      navDownload: "다운로드",
      navLicenses: "라이선스",
      navHome: "홈",
      wikiEyebrow: "문서",
      wikiTitle: "Wiki",
      wikiLede: "대시보드, 인식 모드, 번역, OBS, 모듈 운영 가이드.",
      changelogEyebrow: "릴리스 노트",
      changelogTitle: "변경 로그",
      changelogLede: "Kagevi Subtitles 주요 변경 사항.",
      tocTitle: "이 페이지",
      footerTag: "스트리머를 위한 로컬 실시간 자막.",
      navMenu: "메뉴",
    },
  };

  const CHANGELOG_TITLES = {
    en: "Changelog · Kagevi Subtitles",
    ru: "Список изменений · Kagevi Subtitles",
    ja: "変更履歴 · Kagevi Subtitles",
    zh: "更新日志 · Kagevi Subtitles",
    ko: "변경 로그 · Kagevi Subtitles",
  };

  function detectSiteLang() {
    const saved = localStorage.getItem("kagevi-site-lang");
    if (saved && STRINGS[saved]) return saved;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("ko")) return "ko";
    return "en";
  }

  let lang = detectSiteLang();

  const tocEl = document.getElementById("doc-toc");
  const isWiki = document.body.getAttribute("data-doc") === "wiki";

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  /** Wiki body stays EN/RU only; other UI langs fall back to English content. */
  function contentLang() {
    const preferred = isWiki && lang !== "en" && lang !== "ru" ? "en" : lang;
    if (document.querySelector(`.doc-prose[data-lang-panel="${preferred}"]`)) {
      return preferred;
    }
    if (document.querySelector(`.doc-prose[data-lang-panel="en"]`)) return "en";
    const first = document.querySelector(".doc-prose[data-lang-panel]");
    return first?.getAttribute("data-lang-panel") || "en";
  }

  function applyChromeLang() {
    const dict = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key && dict[key] != null) el.setAttribute("aria-label", dict[key]);
    });
    document.querySelectorAll(".lang__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
    });
    const doc = document.body.getAttribute("data-doc");
    if (doc === "changelog") {
      document.title = CHANGELOG_TITLES[lang] || CHANGELOG_TITLES.en;
    }
  }

  function activePanel() {
    return document.querySelector(`.doc-prose[data-lang-panel="${contentLang()}"]`);
  }

  function showLangPanel() {
    const panelLang = contentLang();
    document.querySelectorAll(".doc-prose[data-lang-panel]").forEach((panel) => {
      const on = panel.getAttribute("data-lang-panel") === panelLang;
      panel.classList.toggle("is-active", on);
      if (on) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  }

  function ensureHeadingIds(panel) {
    const used = new Set();
    panel.querySelectorAll("h2, h3").forEach((heading) => {
      if (!heading.id) {
        let id = slugify(heading.textContent || "section");
        let n = 2;
        while (used.has(id) || document.getElementById(id)) {
          id = `${slugify(heading.textContent || "section")}-${n++}`;
        }
        heading.id = id;
      }
      used.add(heading.id);
    });
  }

  function buildToc() {
    if (!tocEl) return;
    const panel = activePanel();
    tocEl.innerHTML = "";
    if (!panel) return;
    ensureHeadingIds(panel);

    const list = document.createElement("ul");
    panel.querySelectorAll("h2, h3").forEach((heading) => {
      const li = document.createElement("li");
      li.className = heading.tagName === "H3" ? "is-h3" : "is-h2";
      const a = document.createElement("a");
      a.href = `#${heading.id}`;
      a.textContent = heading.textContent || "";
      li.appendChild(a);
      list.appendChild(li);
    });
    tocEl.appendChild(list);
  }

  function refresh() {
    applyChromeLang();
    showLangPanel();
    buildToc();
  }

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-lang") || "en";
      lang = STRINGS[next] ? next : "en";
      localStorage.setItem("kagevi-site-lang", lang);
      refresh();
    });
  });

  const topbar = document.querySelector(".topbar");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");

  function setNavOpen(open) {
    if (!topbar || !navToggle) return;
    topbar.classList.toggle("is-nav-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  navToggle?.addEventListener("click", () => {
    setNavOpen(!topbar?.classList.contains("is-nav-open"));
  });

  siteNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNavOpen(false);
  });

  window.matchMedia("(min-width: 720px)").addEventListener("change", (event) => {
    if (event.matches) setNavOpen(false);
  });

  refresh();
})();
