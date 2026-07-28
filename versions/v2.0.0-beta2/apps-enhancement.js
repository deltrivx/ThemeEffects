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

  if (window.__unraidCustomWebuiCssAppsEnhancement) return;
  window.__unraidCustomWebuiCssAppsEnhancement = true;

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
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var cards = scope.querySelectorAll
        ? scope.querySelectorAll(".ca_holder, .dockerHubHolder")
        : [];
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card || !card.querySelector) continue;
        var nodes = card.querySelectorAll(".favCardBackground, .pinnedCard");
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (!el || el.parentNode === card) continue;
          // only lift out of bottomLine / nested wrappers
          try {
            card.appendChild(el);
          } catch (eMove) {}
        }
      }
    } catch (e) {}
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

  function boot() {
    bootClassSync();
    bootMenus();
    bootSuggestionsRetry();
    bootSuggestionObserver();
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
