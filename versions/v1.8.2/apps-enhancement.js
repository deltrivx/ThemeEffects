/*! apps-enhancement.js
 * unraid-custom-webui-css v1.7.1-dash-perf
 * - body.ucwc-<route> class sync (Apps isolation / page-scoped CSS)
 * - Apps mobile/desktop menu show/close patch
 * - CA Awesomplete search suggestions: body mount + rAF position
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

  function bootTabVisibility() {
    function syncHidden() {
      try {
        document.body.classList.toggle("ucwc-tab-hidden", !!document.hidden);
      } catch (e) {}
    }
    document.addEventListener("visibilitychange", syncHidden);
    syncHidden();
  }

  function boot() {
    bootClassSync();
    bootMenus();
    bootSuggestionsRetry();
    bootSuggestionObserver();
    bootTabVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
