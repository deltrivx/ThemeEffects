/*! apps-enhancement.js
 * ThemeEffects v2.0.0-beta2
 * - body.ucwc-<route> class sync (Apps isolation / page-scoped CSS)
 * - Apps mobile/desktop menu show/close patch
 * - CA Awesomplete search suggestions: body mount + rAF position
 * - Dashboard/Docker missing-icon flicker guard (one-shot onerror)
 * - Allow /mnt/user/... custom VM/Docker icons (do not pre-replace)
 * Targets Community Applications 2026.07.x (Awesomplete, not jQuery UI)
 * Single init guard; no 2s polling.
 */
(function () {
  "use strict";

  if (window.__themeEffectsAppsEnhancement) return;
  window.__themeEffectsAppsEnhancement = true;

  var PATCHED = false;
  var suggestRafId = 0;
  var pendingRoute = false;

  var ROUTES = {
    "/Apps": "ucwc-apps",
    "/Main": "ucwc-main",
    "/Shares": "ucwc-shares",
    "/Docker": "ucwc-docker",
    "/Plugins": "ucwc-plugins",
    "/VMs": "ucwc-vms",
    "/Settings": "ucwc-settings",
    "/Tools": "ucwc-tools",
    "/Dashboard": "ucwc-dashboard",
    "/Users": "ucwc-users"
  };
  var ALL_CLASSES = Object.keys(ROUTES).map(function (k) {
    return ROUTES[k];
  });

  function activeRouteClass() {
    try {
      var path = (window.location && window.location.pathname) || "";
      if (path.indexOf("/Apps") === 0) return "ucwc-apps";
      for (var k in ROUTES) {
        if (Object.prototype.hasOwnProperty.call(ROUTES, k)) {
          if (path === k || path.indexOf(k + "/") === 0) return ROUTES[k];
        }
      }
      var active = document.querySelector("#menu .nav-item.active a[href]");
      if (!active) return null;
      var href = active.getAttribute("href") || "";
      for (k in ROUTES) {
        if (Object.prototype.hasOwnProperty.call(ROUTES, k)) {
          if (href === k || href.indexOf(k + "/") === 0) return ROUTES[k];
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function syncRouteClass() {
    try {
      var wanted = activeRouteClass();
      var cl = document.body.classList;
      for (var i = 0; i < ALL_CLASSES.length; i++) {
        var c = ALL_CLASSES[i];
        if (c !== wanted && cl.contains(c)) cl.remove(c);
      }
      if (wanted && !cl.contains(wanted)) cl.add(wanted);
      if (wanted === "ucwc-apps") {
        window.setTimeout(function () {
          bootSuggestions();
          ensureDesktopMenuVisible();
          reparentCaCardBadges(document);
        }, 0);
      }
      return wanted;
    } catch (e) {
      return null;
    }
  }

  function isAppsPage() {
    return activeRouteClass() === "ucwc-apps";
  }

  function isMobileAppsViewport() {
    try {
      return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
    } catch (e) {
      return window.innerWidth <= 767;
    }
  }

  function scheduleSync() {
    if (pendingRoute) return;
    pendingRoute = true;
    var run = function () {
      pendingRoute = false;
      syncRouteClass();
    };
    if (window.requestIdleCallback) {
      requestIdleCallback(run, { timeout: 200 });
    } else {
      setTimeout(run, 0);
    }
  }

  function hideMasks() {
    try {
      var sels = [".mobileOverlay", ".menuOverlay", ".ca_overlay", ".sidebarOverlay", ".menu_overlay"];
      for (var i = 0; i < sels.length; i++) {
        var nodes = document.querySelectorAll(sels[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (el.classList && el.classList.contains("swal-overlay")) continue;
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("pointer-events", "none", "important");
          el.style.setProperty("opacity", "0", "important");
        }
      }
    } catch (e) {}
  }

  function unlockPage() {
    try {
      document.documentElement.style.setProperty("--mainAreaHeight", "unset");
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.classList.remove("body_sidebarScroll");
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.top = "";
      hideMasks();
    } catch (e) {}
  }

  function ensureDesktopMenuVisible() {
    if (!isAppsPage() || isMobileAppsViewport()) return;
    try {
      if (window.jQuery) {
        window.jQuery(".mobileMenu, #mobileMenu").show().css({
          display: "block",
          visibility: "visible",
          opacity: "1",
          width: "",
          height: "",
          overflow: ""
        });
        window.jQuery(".mobileMenu .menuItems, #mobileMenu .menuItems, .menuItems").show().css({
          display: "block",
          visibility: "visible",
          opacity: "1"
        });
      }
      document.body.classList.remove("menuHidden");
      document.body.classList.add("menuShowing");
    } catch (e) {}
    unlockPage();
  }

  function showMenuNoJump() {
    if (!isAppsPage()) {
      if (typeof window.__ca_showMenu_orig === "function") {
        return window.__ca_showMenu_orig.apply(this, arguments);
      }
      return;
    }
    if (!isMobileAppsViewport()) {
      ensureDesktopMenuVisible();
      return;
    }
    try {
      if (window.jQuery) {
        window.jQuery(".menuAdjust,.hideWithMenu").addClass("menuShowing").removeClass("menuHidden");
        var $menu = window.jQuery(".mobileMenu, #mobileMenu");
        $menu.stop(true, true);
        $menu.removeClass("menuHidden").addClass("menuShowing").show();
        $menu.css({ left: "", top: "", width: "", height: "", overflow: "", display: "block" });
        window.jQuery(".mobileMenu .menuItems, #mobileMenu .menuItems").css({
          maxHeight: "none",
          height: "auto",
          overflow: "visible"
        });
      } else {
        document.querySelectorAll(".menuAdjust,.hideWithMenu").forEach(function (el) {
          el.classList.add("menuShowing");
          el.classList.remove("menuHidden");
        });
        document.querySelectorAll(".mobileMenu, #mobileMenu").forEach(function (el) {
          el.classList.remove("menuHidden");
          el.classList.add("menuShowing");
          el.style.display = "block";
          el.style.maxHeight = "none";
          el.style.overflow = "visible";
        });
      }
      document.body.classList.add("menuShowing");
      document.body.classList.remove("menuHidden");
    } catch (e) {}
    unlockPage();
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () {
        unlockPage();
      });
    }
  }

  function closeMenuNoJump() {
    if (!isAppsPage()) {
      if (typeof window.__ca_closeMenu_orig === "function") {
        return window.__ca_closeMenu_orig.apply(this, arguments);
      }
      return;
    }
    if (!isMobileAppsViewport()) {
      ensureDesktopMenuVisible();
      return;
    }
    try {
      if (window.jQuery) {
        window.jQuery(".menuAdjust,.hideWithMenu").addClass("menuHidden").removeClass("menuShowing");
        var $menu = window.jQuery(".mobileMenu, #mobileMenu");
        $menu.stop(true, true);
        $menu.removeClass("menuShowing").addClass("menuHidden").hide();
      } else {
        document.querySelectorAll(".menuAdjust,.hideWithMenu").forEach(function (el) {
          el.classList.add("menuHidden");
          el.classList.remove("menuShowing");
        });
        document.querySelectorAll(".mobileMenu, #mobileMenu").forEach(function (el) {
          el.classList.remove("menuShowing");
          el.classList.add("menuHidden");
          el.style.display = "none";
        });
      }
      document.body.classList.remove("menuShowing");
      document.body.classList.add("menuHidden");
    } catch (e) {}
    unlockPage();
  }

  function patchMenus() {
    if (PATCHED) return true;
    if (typeof window.showMenu !== "function" || typeof window.closeMenu !== "function") {
      return false;
    }
    if (window.showMenu.__appsSidebarFix) return true;
    window.__ca_showMenu_orig = window.showMenu;
    window.__ca_closeMenu_orig = window.closeMenu;
    window.showMenu = showMenuNoJump;
    window.closeMenu = closeMenuNoJump;
    window.showMenu.__appsSidebarFix = true;
    window.closeMenu.__appsSidebarFix = true;
    PATCHED = true;
    return true;
  }

  function bootMenus() {
    if (patchMenus()) {
      ensureDesktopMenuVisible();
      return;
    }
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      if (patchMenus() || n > 40) {
        clearInterval(timer);
        ensureDesktopMenuVisible();
      }
    }, 300);
  }

  function bootClassSync() {
    syncRouteClass();
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest("#menu, .nav-item, a[href^=\"/\"]")) {
          scheduleSync();
        }
      },
      true
    );
    window.addEventListener("popstate", scheduleSync);
    window.addEventListener("hashchange", scheduleSync);
    try {
      var menu = document.getElementById("menu") || document.querySelector("#menu");
      if (menu && window.MutationObserver) {
        var mo = new MutationObserver(scheduleSync);
        mo.observe(menu, { attributes: true, attributeFilter: ["class"], childList: true, subtree: false });
        var items = menu.querySelectorAll(".nav-item");
        for (var i = 0; i < items.length; i++) {
          mo.observe(items[i], { attributes: true, attributeFilter: ["class"] });
        }
      }
    } catch (e) {}
  }

  function searchBox() {
    return document.getElementById("searchBox");
  }

  function suggestionList() {
    var box = searchBox();
    if (!box) return null;
    var listId = box.getAttribute("aria-owns");
    var list = listId ? document.getElementById(listId) : null;
    if (list) return list;
    var wrap = box.closest ? box.closest(".awesomplete") : null;
    if (wrap) {
      list = wrap.querySelector("ul[role='listbox'], ul");
      if (list) return list;
    }
    list = document.querySelector("ul.caSearchSuggestions");
    return list || null;
  }

  function mountSuggestions() {
    var list = suggestionList();
    if (!list) return null;
    list.classList.add("caSearchSuggestions");
    if (list.parentNode !== document.body) {
      document.body.appendChild(list);
    }
    list.style.setProperty("box-sizing", "border-box", "important");
    list.style.setProperty("position", "fixed", "important");
    list.style.setProperty("margin", "0", "important");
    list.style.setProperty("z-index", "20060", "important");
    list.style.setProperty("transform", "none", "important");
    list.style.setProperty("left", "var(--ca-suggest-left, 0px)", "important");
    list.style.setProperty("top", "var(--ca-suggest-top, 0px)", "important");
    return list;
  }

  function positionSuggestions() {
    if (!isAppsPage()) return;
    var box = searchBox();
    var list = mountSuggestions();
    if (!box || !list) return;
    var rect = box.getBoundingClientRect();
    var edge = 10;
    var width = Math.max(180, Math.min(rect.width || 300, window.innerWidth - edge * 2));
    var viewportLeft = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge));
    var left = viewportLeft + "px";
    var top = rect.bottom + 3 + "px";
    var root = document.documentElement;
    root.style.setProperty("--ca-suggest-left", left);
    root.style.setProperty("--ca-suggest-top", top);
    root.style.setProperty("--ca-suggest-width", width + "px");
    list.style.setProperty("left", left, "important");
    list.style.setProperty("top", top, "important");
    list.style.setProperty("width", width + "px", "important");
    list.style.setProperty("min-width", width + "px", "important");
    list.style.setProperty("max-width", width + "px", "important");
    list.style.setProperty("position", "fixed", "important");
  }

  function schedulePositionSuggestions() {
    if (suggestRafId) return;
    suggestRafId = window.requestAnimationFrame(function () {
      suggestRafId = 0;
      positionSuggestions();
    });
  }

  function bindSuggestionEvents(box) {
    if (!box || box.__ucwcSuggestBound) return;
    box.__ucwcSuggestBound = true;
    box.addEventListener("awesomplete-open", schedulePositionSuggestions);
    box.addEventListener("awesomplete-close", schedulePositionSuggestions);
    box.addEventListener("input", schedulePositionSuggestions);
    box.addEventListener("focus", schedulePositionSuggestions);
    var searchArea = document.querySelector(".searchAreaHolder") || document.querySelector(".searchArea");
    if (searchArea) searchArea.addEventListener("scroll", schedulePositionSuggestions, { passive: true });
    window.addEventListener("resize", schedulePositionSuggestions, { passive: true });
    window.addEventListener("scroll", schedulePositionSuggestions, { passive: true, capture: true });
  }

  function bootSuggestions() {
    if (!isAppsPage()) return false;
    var box = searchBox();
    if (!box) return false;
    bindSuggestionEvents(box);
    mountSuggestions();
    schedulePositionSuggestions();
    return true;
  }

  function bootSuggestionsRetry() {
    if (bootSuggestions()) return;
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (bootSuggestions() || attempts >= 100) window.clearInterval(timer);
    }, 100);
  }

  var suggestDomObs = null;

  function bootSuggestionObserver() {
    if (!window.MutationObserver) return;
    function ensureObs() {
      if (!isAppsPage()) {
        if (suggestDomObs) {
          try { suggestDomObs.disconnect(); } catch (e) {}
          suggestDomObs = null;
        }
        return;
      }
      if (suggestDomObs) return;
      try {
        suggestDomObs = new MutationObserver(function () {
          if (!isAppsPage()) return;
          if (searchBox() && !searchBox().__ucwcSuggestBound) bootSuggestions();
          if (suggestionList()) schedulePositionSuggestions();
        });
        /* Only watch Apps shell, not the entire document tree */
        var root =
          document.querySelector(".searchAreaHolder") ||
          document.querySelector(".ca_display_area") ||
          document.getElementById("template") ||
          document.body;
        suggestDomObs.observe(root, { childList: true, subtree: true });
      } catch (e) {}
    }
    ensureObs();
    /* re-evaluate when route class changes */
    var prev = syncRouteClass;
    /* hook after route sync via short interval only until first apps visit is expensive -
       instead re-check on scheduleSync path: patch syncRouteClass callers already call bootSuggestions.
       Also re-run ensureObs on popstate/click via existing scheduleSync after sync. */
    var _origSync = syncRouteClass;
    syncRouteClass = function () {
      var r = _origSync.apply(this, arguments);
      ensureObs();
      return r;
    };
  }

  
  function reparentCaCardBadges(root) {
    /* Modern CA (2024.12+) already places fav/pin inline in .ca_bottomLine and
       puts official/spotlight flags in .cardFlagStack. Lifting fav/pin to the
       card root fights the LIMETECH ribbon and is no longer needed. No-op. */
    return;
  }

  function bootCaCardBadges() {
    reparentCaCardBadges(document);
    if (bootCaCardBadges._obs) return;
    try {
      var host =
        document.getElementById("templates_content") ||
        document.querySelector(".mainArea") ||
        document.body;
      if (!host || !window.MutationObserver) return;
      var t = 0;
      var obs = new MutationObserver(function () {
        if (t) return;
        t = window.setTimeout(function () {
          t = 0;
          reparentCaCardBadges(host);
        }, 50);
      });
      obs.observe(host, { childList: true, subtree: true });
      bootCaCardBadges._obs = obs;
    } catch (e2) {}
    // CA redraws often after AJAX
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      reparentCaCardBadges(document);
      if (n > 60) clearInterval(timer);
    }, 500);
  }

  function bootTabVisibility() {
    function syncHidden() {
      try {
        document.body.classList.toggle("ucwc-tab-hidden", !!document.hidden);
      } catch (e) {}
    }
    document.addEventListener("visibilitychange", syncHidden);
    syncHidden();
  }

  /* Dashboard / Docker / VM icons: Unraid bare onerror can loop on some browsers.
   * One-shot fallback only after a real load failure.
   * IMPORTANT: /mnt/user/icons/*.png is a valid Unraid WebGUI path (docroot
   * exposes /usr/local/emhttp/mnt → /mnt). Custom VM icons (iStoreOS, FnOS)
   * live there — never pre-replace them. */
  var UCWC_Q_ICON = "/plugins/dynamix.docker.manager/images/question.png";
  var UCWC_VM_ICON = "/plugins/dynamix.vm.manager/templates/images/linux.png";
  var UCWC_Q_DATA =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="6" fill="%23333"/>' +
        '<text x="16" y="22" text-anchor="middle" font-size="18" fill="%23aaa" font-family="sans-serif">?</text>' +
        "</svg>"
    );

  function isDashTileIcon(img) {
    if (!img || img.tagName !== "IMG") return false;
    try {
      if (img.id === "mycase") return false;
      if (img.classList && img.classList.contains("img")) {
        if (
          img.closest &&
          (img.closest("#docker_view") ||
            img.closest("#docker_containers") ||
            img.closest("#vm_view") ||
            img.closest("#vm_container") ||
            img.closest("span.outer.apps") ||
            img.closest("span.outer.vms") ||
            img.closest("table.dashboard") ||
            img.closest(".docker"))
        ) {
          return true;
        }
      }
      var s = img.getAttribute("src") || "";
      if (
        s.indexOf("/state/plugins/dynamix.docker.manager/images/") >= 0 ||
        s.indexOf("/plugins/dynamix.docker.manager/images/") >= 0 ||
        s.indexOf("/plugins/dynamix.vm.manager/") >= 0 ||
        s.indexOf("/mnt/user/icons/") === 0 ||
        s.indexOf("/mnt/user0/icons/") === 0
      ) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isVmTileIcon(img) {
    try {
      if (
        img.closest &&
        (img.closest("#vm_view") ||
          img.closest("#vm_container") ||
          img.closest("span.outer.vms"))
      ) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isAllowedIconSrc(src) {
    if (!src) return false;
    if (src.indexOf("data:image") === 0) return true;
    if (src.indexOf("blob:") === 0) return true;
    if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) return true;
    // Unraid docroot paths (including custom icons under /mnt/user via emhttp)
    if (src.indexOf("/plugins/") === 0) return true;
    if (src.indexOf("/state/") === 0) return true;
    if (src.indexOf("/webGui/") === 0) return true;
    if (src.indexOf("/mnt/user/") === 0) return true;
    if (src.indexOf("/mnt/user0/") === 0) return true;
    if (src.indexOf("/mnt/disk") === 0) return true;
    if (src.indexOf("/boot/config/plugins/") === 0) return true;
    return false;
  }

  function lockIconFallback(img, useData) {
    try {
      img.onerror = null;
      img.removeAttribute("onerror");
      if (img.dataset) img.dataset.ucwcIconLocked = "1";
      if (img.classList) img.classList.add("ucwc-icon-fallback");
      var stock = isVmTileIcon(img) ? UCWC_VM_ICON : UCWC_Q_ICON;
      var next = useData ? UCWC_Q_DATA : stock;
      var cur = img.getAttribute("src") || "";
      if (cur === next || (useData && cur.indexOf("data:image") === 0)) return;
      img.src = next;
    } catch (e) {}
  }

  function stabilizeIcon(img) {
    if (!isDashTileIcon(img)) return;
    if (img.dataset && img.dataset.ucwcIconLocked === "1") return;
    try {
      var src = img.getAttribute("src") || "";
      if (
        src.indexOf("question.png") >= 0 ||
        src.indexOf("/templates/images/linux.png") >= 0 ||
        src.indexOf("/templates/images/default.png") >= 0
      ) {
        if (img.classList) img.classList.add("ucwc-icon-fallback");
      }
      // Only reject paths that can never be served by the WebGUI (e.g. file:)
      if (src.indexOf("file:") === 0 || (src && !isAllowedIconSrc(src) && src.indexOf("/") === 0)) {
        lockIconFallback(img, false);
        return;
      }
      // One-shot onerror — do not pre-empt valid /mnt/user/icons custom art
      img.onerror = function () {
        var cur = img.getAttribute("src") || "";
        var already =
          cur.indexOf("question.png") >= 0 ||
          cur.indexOf("/templates/images/") >= 0 ||
          (img.dataset && img.dataset.ucwcTriedQ === "1") ||
          cur.indexOf("data:image") === 0;
        if (img.dataset) img.dataset.ucwcTriedQ = "1";
        lockIconFallback(img, !!already);
      };
      // Decode-failed / 0×0 after "load" (only if truly broken)
      if (
        img.complete &&
        img.naturalWidth === 0 &&
        src &&
        src.indexOf("data:") !== 0 &&
        // Give /mnt custom icons a moment; complete+0 can race before paint
        src.indexOf("/mnt/") !== 0
      ) {
        var already2 =
          src.indexOf("question.png") >= 0 ||
          src.indexOf("/templates/images/") >= 0 ||
          (img.dataset && img.dataset.ucwcTriedQ === "1");
        if (img.dataset) img.dataset.ucwcTriedQ = "1";
        lockIconFallback(img, !!already2);
      }
    } catch (e2) {}
  }

  function scanDockerIcons(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var list = scope.querySelectorAll
        ? scope.querySelectorAll(
            "#docker_view img.img, #docker_containers img.img, #vm_view img.img, #vm_container img.img, table.dashboard span.outer img.img, span.outer.apps img, span.outer.vms img, .docker img.img"
          )
        : [];
      for (var i = 0; i < list.length; i++) stabilizeIcon(list[i]);
    } catch (e) {}
  }

  function bootDockerIconGuard() {
    if (bootDockerIconGuard._on) return;
    bootDockerIconGuard._on = true;
    try {
      // Capture phase: catch error before Unraid inline onerror can loop
      document.addEventListener(
        "error",
        function (ev) {
          var t = ev && ev.target;
          if (!isDashTileIcon(t)) return;
          if (t.dataset && t.dataset.ucwcIconLocked === "1") {
            try {
              ev.stopImmediatePropagation();
            } catch (e0) {}
            return;
          }
          var src = t.getAttribute("src") || "";
          var alreadyQ =
            src.indexOf("question.png") >= 0 ||
            src.indexOf("/templates/images/") >= 0 ||
            (t.dataset && t.dataset.ucwcTriedQ === "1") ||
            src.indexOf("data:image") === 0;
          if (t.dataset) t.dataset.ucwcTriedQ = "1";
          lockIconFallback(t, !!alreadyQ);
          try {
            ev.stopImmediatePropagation();
          } catch (e1) {}
        },
        true
      );
    } catch (e2) {}

    scanDockerIcons(document);

    try {
      if (window.MutationObserver) {
        var t = 0;
        var obs = new MutationObserver(function (muts) {
          if (t) return;
          t = window.setTimeout(function () {
            t = 0;
            var roots = [];
            for (var i = 0; i < muts.length; i++) {
              var m = muts[i];
              if (m.type === "childList") {
                for (var j = 0; j < m.addedNodes.length; j++) {
                  var n = m.addedNodes[j];
                  if (n && n.nodeType === 1) roots.push(n);
                }
              }
            }
            if (!roots.length) return;
            for (var k = 0; k < roots.length; k++) scanDockerIcons(roots[k]);
          }, 30);
        });
        var host =
          document.getElementById("docker_view") ||
          document.getElementById("docker_containers") ||
          document.body;
        if (host) obs.observe(host, { childList: true, subtree: true });
        // Also watch body for late dashboard inject
        if (host !== document.body && document.body) {
          obs.observe(document.body, { childList: true, subtree: true });
        }
        bootDockerIconGuard._obs = obs;
      }
    } catch (e3) {}

    // loadlist / Docker page redraw a few times after open
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      scanDockerIcons(document);
      if (n > 40) clearInterval(timer);
    }, 500);
  }

  function isDashboardPage() {
    return activeRouteClass() === "ucwc-dashboard";
  }

  function restoreNativeDashboardSelect(select) {
    if (!select || !select.__ucwcDashboardSelect) return;
    var state = select.__ucwcDashboardSelect;
    if (state.menu) state.menu.remove();
    if (state.wrapper && state.wrapper.parentNode) state.wrapper.parentNode.insertBefore(select, state.wrapper);
    if (state.wrapper) state.wrapper.remove();
    select.classList.remove("ucwc-dashboard-select-native");
    delete select.__ucwcDashboardSelect;
  }

  function restoreNativeDashboardSelects() {
    if (!isDashboardPage()) return;
    var selects = document.querySelectorAll("table.dashboard .tile-header select");
    for (var i = 0; i < selects.length; i++) restoreNativeDashboardSelect(selects[i]);
  }

  function wrapDashboardTextSummaries() {
    if (!isDashboardPage()) return;
    var sections = document.querySelectorAll("table.dashboard .tile-header-left > .section");
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!section.querySelector(":scope > h3.tile-header-main")) continue;
      var nodes = Array.prototype.slice.call(section.childNodes);
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        if (node.nodeType !== 3 || !node.textContent.trim()) continue;
        var summary = document.createElement("span");
        summary.className = "ucwc-dashboard-summary-text";
        section.insertBefore(summary, node);
        summary.appendChild(node);
      }
    }
  }

  function bootDashboardSelectMenus() {
    restoreNativeDashboardSelects();
    wrapDashboardTextSummaries();
    var attempts = 0;
    var timer = window.setInterval(function () {
      restoreNativeDashboardSelects();
      wrapDashboardTextSummaries();
      if (++attempts >= 20) window.clearInterval(timer);
    }, 100);
  }

  var THEME_INFO = {
    version: "v2.8.9",
    releasedAt: "2026-08-08",
    issuesUrl: "https://github.com/deltrivx/ThemeEffects/issues",
    changelogUrl: "https://github.com/deltrivx/ThemeEffects/blob/main/CHANGELOG.md"
  };

  var themeChangelogOrigin = null;
  var themeChangelogPreviousOverflow = "";
  var themeInfoUpdate = null;
  var themeUpdateBusy = false;
  var themeUpdatePollTimer = 0;

  function renderThemeMarkdown(target, markdown) {
    target.textContent = "";
    var list = null;
    markdown.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) { list = null; return; }
      var isList = /^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
      if (isList && !list) { list = document.createElement("ul"); target.appendChild(list); }
      if (!isList) list = null;
      var item = document.createElement(isList ? "li" : (/^#{1,6}\s+/.test(line) ? "h3" : "p"));
      var text = line.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "");
      text.split(/(\*\*[^*]+\*\*)/g).forEach(function (part) {
        if (!part) return;
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          var strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          item.appendChild(strong);
        } else item.appendChild(document.createTextNode(part));
      });
      (list || target).appendChild(item);
    });
  }

  function onThemeChangelogKeydown(event) {
    var dialog = document.getElementById("ucwc-theme-changelog-dialog");
    if (!dialog) return;
    if (event.key === "Escape") { event.preventDefault(); closeThemeChangelog(); return; }
    if (event.key !== "Tab") return;
    var items = dialog.querySelectorAll("button, a[href], [tabindex]:not([tabindex=\"-1\"])");
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
  }

  function closeThemeChangelog() {
    var dialog = document.getElementById("ucwc-theme-changelog-dialog");
    if (dialog) dialog.remove();
    document.removeEventListener("keydown", onThemeChangelogKeydown, true);
    document.body.style.overflow = themeChangelogPreviousOverflow;
    if (themeChangelogOrigin && typeof themeChangelogOrigin.focus === "function") themeChangelogOrigin.focus();
    themeChangelogOrigin = null;
  }

  function showThemeChangelog() {
    if (document.getElementById("ucwc-theme-changelog-dialog")) return;
    themeChangelogOrigin = document.activeElement;
    themeChangelogPreviousOverflow = document.body.style.overflow;
    var dialog = document.createElement("div");
    dialog.id = "ucwc-theme-changelog-dialog";
    dialog.className = "ucwc-theme-changelog-backdrop";
    dialog.innerHTML =
      '<section class="ucwc-theme-changelog-panel" role="dialog" aria-modal="true" aria-labelledby="ucwc-theme-changelog-title">' +
      '<header class="ucwc-theme-changelog-title"><h2 id="ucwc-theme-changelog-title">ThemeEffects ' + THEME_INFO.version + ' 更新日志</h2><button class="ucwc-theme-changelog-close" type="button" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>' +
      '<div class="ucwc-theme-changelog-content" aria-live="polite">正在读取当前版本更新日志…</div>' +
      '<footer class="ucwc-theme-changelog-footer"><a href="' + THEME_INFO.changelogUrl + '" target="_blank" rel="noopener noreferrer">在 GitHub 查看完整更新日志</a></footer>' +
      '</section>';
    dialog.addEventListener("click", function (event) { if (event.target === dialog) closeThemeChangelog(); });
    dialog.querySelector(".ucwc-theme-changelog-close").addEventListener("click", closeThemeChangelog);
    document.body.appendChild(dialog);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onThemeChangelogKeydown, true);
    dialog.querySelector(".ucwc-theme-changelog-close").focus();
    window.fetch(THEME_INFO.changelogUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/"))
      .then(function (response) { return response.ok ? response.text() : Promise.reject(new Error("HTTP " + response.status)); })
      .then(function (markdown) {
        var escapedVersion = THEME_INFO.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var heading = new RegExp("^##\\s+" + escapedVersion + "(?:\\s|$).*", "mi");
        var match = heading.exec(markdown);
        var section = match ? markdown.slice(match.index + match[0].length) : "";
        var nextVersion = section.search(/\n##\s+v/i);
        var content = section ? section.slice(0, nextVersion === -1 ? section.length : nextVersion).trim() : "未找到当前版本的独立日志条目。";
        var target = dialog.querySelector(".ucwc-theme-changelog-content");
        if (target) renderThemeMarkdown(target, content || "暂无当前版本更新日志。");
      })
      .catch(function () {
        var target = dialog.querySelector(".ucwc-theme-changelog-content");
        if (target) { target.textContent = "无法读取远程更新日志。"; var link = document.createElement("a"); link.href = THEME_INFO.changelogUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "在仓库中查看"; target.appendChild(link); }
      });
  }


  function closeThemeUpdate() {
    if (themeUpdateBusy) return;
    if (themeUpdatePollTimer) {
      window.clearTimeout(themeUpdatePollTimer);
      themeUpdatePollTimer = 0;
    }
    var dialog = document.getElementById("ucwc-theme-update-dialog");
    if (dialog) dialog.remove();
  }

  function themeCsrfToken() {
    if (typeof window.csrf_token === "string" && window.csrf_token) return window.csrf_token;
    try {
      if (window.top && typeof window.top.csrf_token === "string" && window.top.csrf_token) return window.top.csrf_token;
    } catch (e) {}
    var token = document.querySelector('input[name="csrf_token"]');
    if (token && token.value) return token.value;
    try {
      var match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    } catch (e2) {}
    return "";
  }

  function showThemeUpdate(data) {
    if (document.getElementById("ucwc-theme-update-dialog")) return;
    var latest = (data.latest && data.latest.id) || data.latest_version || "";
    if (!latest) return;
    var hasUpdate = !!data.update_available;
    var dialogTitle = hasUpdate ? "ThemeEffects 更新" : "版本信息";
    var otaLabel = hasUpdate ? "OTA 升级" : "OTA 重装当前版本";
    var fullLabel = hasUpdate ? "全量升级" : "全量重装当前版本";
    var dialog = document.createElement("div");
    dialog.id = "ucwc-theme-update-dialog";
    dialog.className = "ucwc-theme-changelog-backdrop";
    dialog.innerHTML =
      '<section class="ucwc-theme-changelog-panel" role="dialog" aria-modal="true" aria-labelledby="ucwc-theme-update-title">' +
      '<header class="ucwc-theme-changelog-title"><h2 id="ucwc-theme-update-title">' + dialogTitle + '</h2><button class="ucwc-theme-changelog-close" type="button" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>' +
      '<div class="ucwc-theme-changelog-content"><p>当前版本：<strong>' + THEME_INFO.version + '</strong></p><p>远程版本：<strong>' + latest + '</strong></p><p>' + (hasUpdate ? '发现新版本，可选择 OTA 或全量升级。' : '当前已是最新版，可选择 OTA 或全量重装以修复本地文件。') + '</p><p>OTA 仅下载变更或缺失文件；全量会重新下载完整版本包。</p><p id="ucwc-theme-update-result" aria-live="polite"></p></div>' +
      '<footer class="ucwc-theme-changelog-footer"><button class="ucwc-theme-info-link" type="button" data-mode="ota">' + otaLabel + '</button><button class="ucwc-theme-info-link" type="button" data-mode="full">' + fullLabel + '</button></footer>' +
      '</section>';
    dialog.addEventListener("click", function (event) { if (event.target === dialog) closeThemeUpdate(); });
    dialog.querySelector(".ucwc-theme-changelog-close").addEventListener("click", closeThemeUpdate);
    dialog.querySelectorAll("[data-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        startThemeUpdate(dialog, latest, button.getAttribute("data-mode"));
      });
    });
    document.body.appendChild(dialog);
    dialog.querySelector(".ucwc-theme-changelog-close").focus();
  }

  function themeUpdateSetProgress(dialog, job, append) {
    var result = dialog && dialog.querySelector("#ucwc-theme-update-result");
    if (!result) return;
    var pct = Math.max(0, Math.min(100, parseInt(job && job.pct, 10) || 0));
    var stage = (job && (job.message || job.stage)) || "执行中…";
    var bar = dialog.querySelector("#ucwc-theme-update-progress-bar");
    var pctEl = dialog.querySelector("#ucwc-theme-update-progress-pct");
    var stageEl = dialog.querySelector("#ucwc-theme-update-progress-stage");
    var log = dialog.querySelector("#ucwc-theme-update-log");
    if (bar) bar.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct + "%";
    if (stageEl) stageEl.textContent = stage;
    result.textContent = stage;
    if (log && append) {
      log.textContent += append;
      log.scrollTop = log.scrollHeight;
    }
  }

  function finishThemeUpdate(dialog, job) {
    themeUpdateBusy = false;
    var buttons = dialog.querySelectorAll("[data-mode]");
    buttons.forEach(function (node) { node.disabled = true; });
    var close = dialog.querySelector(".ucwc-theme-changelog-close");
    if (close) close.disabled = false;
    var ok = !!(job && job.ok);
    themeUpdateSetProgress(dialog, { pct: ok ? 100 : 100, stage: ok ? "完成" : "失败", message: job && job.message }, "\n==== " + (ok ? "完成" : "失败") + " ====\n" + ((job && job.message) || (ok ? "更新完成" : "更新失败")) + "\n");
    var footer = dialog.querySelector(".ucwc-theme-changelog-footer");
    if (!footer) return;
    footer.innerHTML = "";
    if (ok) {
      var refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "ucwc-theme-info-link";
      refresh.textContent = "刷新页面查看新版本";
      refresh.addEventListener("click", function () { window.location.reload(); });
      footer.appendChild(refresh);
    }
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ucwc-theme-info-link";
    closeBtn.textContent = "关闭";
    closeBtn.addEventListener("click", closeThemeUpdate);
    footer.appendChild(closeBtn);
  }

  function pollThemeUpdate(dialog, jobId, offset, failCount) {
    var params = new URLSearchParams();
    params.set("UCWC_ACTION", "job_status");
    params.set("job_id", jobId);
    params.set("offset", String(offset || 0));
    window.fetch("/plugins/theme.effects/ucwc-update.php?" + params.toString() + "&_ts=" + Date.now(), { credentials: "same-origin", cache: "no-store" })
      .then(function (response) { return response.json(); })
      .then(function (reply) {
        if (!reply.ok) throw new Error(reply.error || reply.message || "进度查询失败");
        var job = reply.job || {};
        themeUpdateSetProgress(dialog, job, reply.log || "");
        if (job.done) { finishThemeUpdate(dialog, job); return; }
        themeUpdatePollTimer = window.setTimeout(function () { pollThemeUpdate(dialog, jobId, reply.next_offset || offset || 0, 0); }, 700);
      })
      .catch(function (error) {
        if ((failCount || 0) < 8) {
          themeUpdateSetProgress(dialog, { pct: 0, stage: "重试中", message: "进度查询暂时失败，正在重试…" }, "[重试 " + ((failCount || 0) + 1) + "/8] " + (error.message || error) + "\n");
          themeUpdatePollTimer = window.setTimeout(function () { pollThemeUpdate(dialog, jobId, offset || 0, (failCount || 0) + 1); }, 1200);
          return;
        }
        finishThemeUpdate(dialog, { ok: false, message: "进度查询失败：" + (error.message || error) });
      });
  }

  function startThemeUpdate(dialog, latest, mode) {
    if (themeUpdateBusy) return;
    themeUpdateBusy = true;
    var result = dialog.querySelector("#ucwc-theme-update-result");
    var buttons = dialog.querySelectorAll("[data-mode]");
    buttons.forEach(function (node) { node.disabled = true; });
    var close = dialog.querySelector(".ucwc-theme-changelog-close");
    if (close) close.disabled = true;
    var content = dialog.querySelector(".ucwc-theme-changelog-content");
    if (content) {
      content.insertAdjacentHTML("beforeend", '<div class="ucwc-theme-update-progress"><div class="ucwc-theme-update-progress-track"><div id="ucwc-theme-update-progress-bar" class="ucwc-theme-update-progress-bar" style="width:3%"></div></div><strong id="ucwc-theme-update-progress-pct">3%</strong><span id="ucwc-theme-update-progress-stage">正在启动任务…</span><pre id="ucwc-theme-update-log" class="ucwc-theme-update-log" aria-live="polite"></pre></div>');
    }
    if (result) result.textContent = "正在启动任务…";
    var params = new URLSearchParams();
    params.set("UCWC_ACTION", "install_version");
    params.set("version", latest);
    params.set("install_mode", mode);
    params.set("async", "1");
    var csrf = themeCsrfToken();
    if (csrf) params.set("csrf_token", csrf);
    window.fetch("/plugins/theme.effects/ucwc-update.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body: params.toString()
    })
      .then(function (response) { return response.json(); })
      .then(function (reply) {
        if (!reply.ok || !reply.job_id) throw new Error(reply.error || reply.message || "无法启动更新任务。");
        themeUpdateSetProgress(dialog, { pct: 6, stage: "任务已启动", message: reply.message || "正在拉取进度…" }, "job_id=" + reply.job_id + "\n");
        pollThemeUpdate(dialog, reply.job_id, 0, 0);
      })
      .catch(function (error) {
        finishThemeUpdate(dialog, { ok: false, message: error.message || "无法启动更新任务。" });
      });
  }

  function openThemeInfoStatus() {
    if (!themeInfoUpdate) return;
    closeThemeInfo();
    showThemeUpdate(themeInfoUpdate);
  }

  function checkThemeUpdate() {
    var status = document.getElementById("ucwc-theme-update-status");
    if (!status) return;
    status.textContent = "检查中…";
    status.disabled = true;
    window.fetch("/plugins/theme.effects/ucwc-update.php?UCWC_ACTION=check_update&_ts=" + Date.now(), { credentials: "same-origin", cache: "no-store" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || "无法检查远程版本");
        themeInfoUpdate = data;
        if (data.local && data.local.version) THEME_INFO.version = data.local.version;
        var remote = (data.latest && data.latest.id) || data.latest_version || "未知";
        status.textContent = data.update_available ? "远程版本：" + remote : "已是最新版";
        status.disabled = false;
        status.title = data.update_available ? "打开更新操作" : "查看当前更新日志";
      })
      .catch(function () {
        themeInfoUpdate = null;
        status.textContent = "无法检查远程版本";
        status.disabled = false;
      });
  }

  function closeThemeInfo() {
    var menu = document.getElementById("ucwc-theme-info-menu");
    var trigger = document.getElementById("ucwc-theme-version");
    if (menu) menu.remove();
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("data-state", "closed");
    }
    document.removeEventListener("pointerdown", onThemeInfoOutside, true);
    document.removeEventListener("keydown", onThemeInfoKeydown, true);
  }

  function onThemeInfoKeydown(event) {
    var menu = document.getElementById("ucwc-theme-info-menu");
    if (event.key === "Escape") { closeThemeInfo(); var trigger = document.getElementById("ucwc-theme-version"); if (trigger) trigger.focus(); return; }
    if (!menu || !/^(ArrowDown|ArrowUp|Home|End)$/.test(event.key)) return;
    var items = menu.querySelectorAll('[role="menuitem"]');
    if (!items.length) return;
    event.preventDefault();
    var index = Array.prototype.indexOf.call(items, document.activeElement);
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = items.length - 1;
    else index = event.key === "ArrowDown" ? (index + 1 + items.length) % items.length : (index - 1 + items.length) % items.length;
    items[index].focus();
  }

  function onThemeInfoOutside(event) {
    var menu = document.getElementById("ucwc-theme-info-menu");
    var trigger = document.getElementById("ucwc-theme-version");
    if (menu && trigger && !menu.contains(event.target) && !trigger.contains(event.target)) closeThemeInfo();
  }

  function positionThemeInfoMenu() {
    var trigger = document.getElementById("ucwc-theme-version");
    var menu = document.getElementById("ucwc-theme-info-menu");
    if (!trigger || !menu) return;
    var rect = trigger.getBoundingClientRect();
    var width = menu.getBoundingClientRect().width;
    var left = Math.max(4, Math.min(rect.left, window.innerWidth - width - 4));
    menu.style.left = left + "px";
    menu.style.top = (rect.bottom + 4) + "px";
  }

  function showThemeInfo() {
    if (document.getElementById("ucwc-theme-info-menu")) {
      closeThemeInfo();
      return;
    }
    var menu = document.createElement("div");
    menu.id = "ucwc-theme-info-menu";
    menu.className = "ucwc-theme-info-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "ThemeEffects " + THEME_INFO.version);
    menu.innerHTML =
      '<div class="ucwc-theme-info-heading">ThemeEffects</div>' +
      '<button class="ucwc-theme-info-item ucwc-theme-info-link" type="button" role="menuitem" data-action="status"><span>版本信息</span><strong id="ucwc-theme-update-status">检查中…</strong></button>' +
      '<div class="ucwc-theme-info-separator" role="separator"></div>' +
      '<a class="ucwc-theme-info-link" role="menuitem" href="' + THEME_INFO.issuesUrl + '" target="_blank" rel="noopener noreferrer"><span class="ucwc-theme-info-link-label">提交问题反馈</span><span class="ucwc-theme-info-external">›</span></a>' +
      '<a class="ucwc-theme-info-link" role="menuitem" href="/Settings/ThemeEffects"><span class="ucwc-theme-info-link-label">打开主题设置</span><span class="ucwc-theme-info-external">›</span></a>';
    menu.querySelector('[data-action="status"]').addEventListener("click", openThemeInfoStatus);
    document.body.appendChild(menu);
    positionThemeInfoMenu();
    checkThemeUpdate();
    var trigger = document.getElementById("ucwc-theme-version");
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("data-state", "open");
    document.addEventListener("pointerdown", onThemeInfoOutside, true);
    document.addEventListener("keydown", onThemeInfoKeydown, true);
  }

  function ensureThemeVersionButton() {
    var nativeVersion = document.querySelector("span.text-header-text-secondary[id^=\"reka-menu-trigger-\"]");
    if (!nativeVersion || document.getElementById("ucwc-theme-version")) return false;
    var button = document.createElement("span");
    button.id = "ucwc-theme-version";
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-label", "ThemeEffects " + THEME_INFO.version + " version information");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("data-state", "closed");
    button.setAttribute("title", "版本信息");
    button.className = nativeVersion.className;
    button.innerHTML = nativeVersion.querySelector("svg").outerHTML + " " + THEME_INFO.version;
    button.addEventListener("click", showThemeInfo);
    button.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showThemeInfo();
      }
    });
    nativeVersion.insertAdjacentElement("afterend", button);
    return true;
  }

  function bootThemeVersionButton() {
    if (ensureThemeVersionButton()) return;
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (ensureThemeVersionButton() || attempts >= 80) window.clearInterval(timer);
    }, 100);
  }

  function localizeComposeStacks(root) {
    root = root || document;
    var view = root.id === "compose_stacks_view" ? root : root.querySelector("#compose_stacks_view");
    if (!view) return;
    var replaceText = function (node) {
      if (!node || !node.childNodes) return;
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          var original = child.nodeValue;
          var translated = original
            .replace(/Compose Stacks/g, "Compose 堆栈")
            .replace(/All Stacks/g, "全部堆栈")
            .replace(/Started only/g, "仅显示已启动")
            .replace(/No compose stacks defined/g, "尚未定义 Compose 堆栈")
            .replace(/Stacks\s*--\s*Started:\s*(\d+),\s*Stopped:\s*(\d+)(?:,\s*Partial:\s*(\d+))?/g, function (_, started, stopped, partial) {
              return "堆栈：已启动 " + started + "，已停止 " + stopped + (partial ? "，部分启动 " + partial : "");
            });
          if (translated !== original) child.nodeValue = translated;
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") replaceText(child);
      }
    };
    replaceText(view);
  }

  function bootComposeLocalization() {
    var observer = new MutationObserver(function () { localizeComposeStacks(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    localizeComposeStacks();
  }

  function boot() {
    bootClassSync();
    bootMenus();
    bootSuggestionsRetry();
    bootSuggestionObserver();
    bootDashboardSelectMenus();
    bootThemeVersionButton();
    bootComposeLocalization();
    bootTabVisibility();
    bootCaCardBadges();
    bootDockerIconGuard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
