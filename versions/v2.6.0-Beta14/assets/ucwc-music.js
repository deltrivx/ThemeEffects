/**
 * ThemeEffects music player — dashboard card + sitewide engine
 * Layout: left cover/meta + buttons; progress/controls under buttons (full width of btn row);
 *         right panel toggles 曲目 ⇄ 歌词 (default 曲目). Local LRC sidecar sync.
 * Cross-page: localStorage play session + first-gesture unlock + off-dash resume chip.
 * Best-effort auto-resume after full Unraid navigations (no popup host window).
 */
(function (global) {
  "use strict";

  var LS_KEY = "ucwc_music_v1";
  var PLAY_KEY = "ucwc_music_play_v1";
  var PLAY_TTL_MS = 6 * 60 * 60 * 1000; // 6h
  var apiBase = "/plugins/theme.effects/ucwc-music-api.php";
  var state = {
    tracks: [],
    index: 0,
    playing: false,
    shuffle: false,
    repeat: "off", // off | one | all
    volume: 0.7,
    collapsed: false,
    sideMode: "list", // list | lyrics
    loaded: false,
    error: "",
    lyrics: {
      id: "",
      lines: [],
      offsetMs: 0,
      active: -1,
      loading: false,
      empty: true,
      seq: 0,
    },
    cover: {
      id: "",
      url: "",
      loading: false,
      seq: 0,
    },
  };
  var audio = null;
  var root = null;
  var chip = null;
  var chipEls = {};
  var els = {};
  var seeking = false;
  var bootDone = false;
  var playPersistTimer = null;
  var resumePending = null;
  var gestureBound = false;
  var gestureResumeWanted = false;
  var lyricsSyncLast = 0;
  var resumeIntent = false; // user was playing; keep trying across navigations
  var lastNavSave = 0;
  var mountTimer = null;
  var resumeAttempted = false;
  var chipDrag = { on: false, moved: false, ox: 0, oy: 0, sx: 0, sy: 0 };
  var CHIP_POS_KEY = "ucwc_music_chip_pos_v1";
  var DASH_POS_KEY = "ucwc_music_dash_pos_v1";
  var audioGen = 0; // bump when reloading src to ignore stale play()
  var lastSrcId = "";
  var playRetryTimer = null;
  var playRetryCount = 0;
  var pendingResume = false;
  var uiPlayStableUntil = 0;

  function cfg() {
    var t = global.__UCWC_THEME__ || {};
    return t.music || {};
  }

  function enabled() {
    var c = cfg();
    // UI always card; ignore legacy float/statusbar
    return !!c.enable && (c.source || "local") === "local";
  }

  function isDashboard() {
    try {
      // Strict: only real Unraid dashboard shell, not title/path false positives
      // (Settings pages etc. must NOT count as dashboard or sitewide path breaks).
      if (document.querySelector("table.dashboard, table.share_status.dashboard")) return true;
      var p = (location.pathname || "").toLowerCase().replace(/\/+$/, "") || "/";
      if (p === "/" || p === "/dashboard" || p === "/dashboard.htm" || p === "/dashboard.php") return true;
      // Unraid sometimes uses Main as home without table yet
      if (p === "/main" || p === "/main.htm") {
        if (document.querySelector("#db-box, #db_box, #dashboard, .grid-stack")) return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * MUSIC_DASH_ONLY:
   *  true  → 仅仪表盘播放（离开仪表盘停播）
   *  false → 全站播放（非仪表盘不挂卡片，但可无 UI 续播）
   * 卡片 UI 永远只在仪表盘显示。
   */
  function isSitewidePlay() {
    var c = cfg();
    // accept boolean false or string "no"/"false"/"0" from mixed injectors
    var d = c.dash_only;
    if (d === false || d === 0 || d === "0" || d === "no" || d === "false" || d === "off") return true;
    if (d === true || d === 1 || d === "1" || d === "yes" || d === "true" || d === "on") return false;
    return false; // default: treat unknown as sitewide-off only if missing? cfg default is dash_only true
  }

  function shouldShowCard() {
    return enabled() && isDashboard() && !state.collapsed;
  }

  function shouldRunEngine() {
    if (!enabled()) return false;
    if (isDashboard()) return true;
    return isSitewidePlay();
  }

  function markPendingResume(on) {
    pendingResume = !!on;
    if (on) uiPlayStableUntil = Date.now() + 5000;
    else uiPlayStableUntil = 0;
  }

  function isUiPlaying() {
    if (audio && !audio.paused) return true;
    if (pendingResume && (Date.now() < uiPlayStableUntil || playRetryCount > 0 || gestureResumeWanted || resumeIntent)) {
      return true;
    }
    return !!state.playing;
  }


  function writePlaySession(obj) {
    try {
      var payload = JSON.stringify(obj);
      try {
        sessionStorage.setItem(PLAY_KEY, payload);
      } catch (e0) {}
      try {
        localStorage.setItem(PLAY_KEY, payload);
      } catch (e1) {}
    } catch (e) {}
  }

  function savePlaySession(forcePlaying) {
    try {
      var t = current();
      var livePlaying = !!(audio && !audio.paused);
      if (livePlaying) resumeIntent = true;
      // Default: only "live" counts as playing. Navigation uses force true via ForNav.
      var playing = typeof forcePlaying === "boolean" ? forcePlaying : livePlaying;
      var payload = {
        playing: !!playing,
        intent: !!(resumeIntent || playing),
        index: state.index,
        t: audio && isFinite(audio.currentTime) ? audio.currentTime : 0,
        id: t && t.id ? t.id : "",
        vol: state.volume,
        sitewide: isSitewidePlay(),
        ts: Date.now(),
      };
      writePlaySession(payload);
    } catch (e) {}
  }

  /** Navigation flush: keep playing intent even if audio already tearing down. */
  function savePlaySessionForNav() {
    try {
      var now = Date.now();
      if (now - lastNavSave < 40) return;
      lastNavSave = now;
      var live = !!(audio && !audio.paused);
      if (live) resumeIntent = true;
      if (resumeIntent || live || state.playing) {
        savePlaySession(true);
      } else {
        savePlaySession(false);
      }
    } catch (e) {}
  }

  function clearPlayRetries() {
    if (playRetryTimer) {
      try {
        clearTimeout(playRetryTimer);
      } catch (e0) {}
      playRetryTimer = null;
    }
    playRetryCount = 0;
  }

  /** Keep trying play() for a short window after navigation (best-effort vs autoplay policy). */
  function schedulePlayRetries(reason) {
    clearPlayRetries();
    playRetryCount = 0;
    markPendingResume(true);
    var delays = [120, 280, 500, 900, 1500, 2500, 4000];
    function tick() {
      if (!audio) return;
      if (!audio.paused) {
        clearPlayRetries();
        markPendingResume(false);
        gestureResumeWanted = false;
        state.playing = true;
        updatePlayBtn();
        syncSitewideChip();
        return;
      }
      if (!(resumeIntent || gestureResumeWanted || sessionWantsResume(loadPlaySession()))) {
        clearPlayRetries();
        markPendingResume(false);
        updatePlayBtn();
        return;
      }
      if (playRetryCount >= delays.length) {
        gestureResumeWanted = true;
        markPendingResume(true);
        bindGestureUnlock();
        updatePlayBtn();
        if (!isDashboard() && isSitewidePlay()) syncSitewideChip("点击播放以续播");
        return;
      }
      var wait = delays[playRetryCount++];
      playRetryTimer = setTimeout(function () {
        playRetryTimer = null;
        if (!audio || !audio.paused) {
          clearPlayRetries();
          return;
        }
        try {
          tryPlayUnlocked(audio, function () {
            tick();
          });
          // if still paused after microtask, continue chain
          setTimeout(function () {
            if (audio && audio.paused && playRetryCount > 0) {
              /* tick continues via onBlocked or next delay */
            }
          }, 40);
        } catch (e1) {
          tick();
        }
      }, wait);
    }
    tick();
  }

  function bindMediaSession() {
    try {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.setActionHandler("play", function () {
        resumeIntent = true;
        if (!tryResumeFromSession(true) && state.tracks.length) playAt(state.index, true);
      });
      navigator.mediaSession.setActionHandler("pause", function () {
        if (audio) audio.pause();
        resumeIntent = false;
        savePlaySession(false);
      });
      navigator.mediaSession.setActionHandler("previoustrack", function () {
        prev();
      });
      navigator.mediaSession.setActionHandler("nexttrack", function () {
        next(false);
      });
    } catch (e0) {}
  }

  function updateMediaSessionMeta() {
    try {
      if (!("mediaSession" in navigator)) return;
      var t = current();
      var meta = {
        title: (t && t.title) || "ThemeEffects 音乐",
        artist: (t && t.artist) || "",
        album: (t && t.album) || "ThemeEffects",
      };
      if (state.cover && state.cover.url && state.cover.id === (t && t.id)) {
        meta.artwork = [
          { src: state.cover.url, sizes: "300x300", type: "image/jpeg" },
          { src: state.cover.url, sizes: "96x96", type: "image/jpeg" },
        ];
      }
      navigator.mediaSession.metadata = new MediaMetadata(meta);
      navigator.mediaSession.playbackState = audio && !audio.paused ? "playing" : "paused";
    } catch (e0) {}
  }

  function bindNavFlush() {
    try {
      document.addEventListener(
        "click",
        function (ev) {
          if (!(resumeIntent || state.playing || (audio && !audio.paused))) return;
          var el = ev.target;
          var hops = 0;
          while (el && hops++ < 6) {
            if (el.tagName === "A" && el.getAttribute && el.getAttribute("href")) {
              var href = el.getAttribute("href") || "";
              if (href && href.charAt(0) !== "#" && href.indexOf("javascript:") !== 0) {
                savePlaySessionForNav();
              }
              break;
            }
            el = el.parentNode;
          }
        },
        true
      );
    } catch (e0) {}
  }

  function parsePlaySession(raw) {
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      if (typeof o.ts === "number" && Date.now() - o.ts > PLAY_TTL_MS) return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function loadPlaySession() {
    var a = null;
    var b = null;
    try {
      a = parsePlaySession(sessionStorage.getItem(PLAY_KEY));
    } catch (e0) {}
    try {
      b = parsePlaySession(localStorage.getItem(PLAY_KEY));
    } catch (e1) {}
    if (a && b) return (a.ts || 0) >= (b.ts || 0) ? a : b;
    return a || b;
  }

  function clearPlaySession() {
    try {
      sessionStorage.removeItem(PLAY_KEY);
    } catch (e0) {}
    try {
      localStorage.removeItem(PLAY_KEY);
    } catch (e1) {}
  }

  function schedulePlayPersist() {
    if (playPersistTimer) return;
    playPersistTimer = setTimeout(function () {
      playPersistTimer = null;
      savePlaySession();
    }, 600);
  }

  function stopEngine(clearSession) {
    markPendingResume(false);
    clearPlayRetries();
    if (audio) {
      try {
        audio.pause();
      } catch (e0) {}
    }
    state.playing = false;
    updatePlayBtn();
    hideResumeChip();
    if (clearSession) {
      resumeIntent = false;
      gestureResumeWanted = false;
      clearPlaySession();
    } else {
      savePlaySession(false);
    }
  }

  function hideCardUi() {
    if (root) {
      try {
        root.classList.add("ucwc-music-hidden");
        if (root.parentNode) root.parentNode.removeChild(root);
      } catch (e0) {}
    }
    var host = document.getElementById("ucwc-music-dash-host");
    if (host) {
      try {
        if (host.parentNode) host.parentNode.removeChild(host);
      } catch (e1) {}
    }
  }

  function hideResumeChip() {
    if (!chip) return;
    try {
      if (chip.parentNode) chip.parentNode.removeChild(chip);
    } catch (e0) {}
  }

  /** Dashboard hides chip; sitewide off-dash always shows chip when engine runs. */
  function syncSitewideChip(hint) {
    if (!enabled() || state.collapsed) {
      hideResumeChip();
      return;
    }
    if (isDashboard() || !isSitewidePlay()) {
      hideResumeChip();
      return;
    }
    showResumeChip(hint || "");
  }

  function loadChipPos() {
    try {
      var raw = localStorage.getItem(CHIP_POS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.x !== "number" || typeof o.y !== "number") return null;
      return o;
    } catch (e0) {
      return null;
    }
  }

  function saveChipPos(x, y) {
    try {
      localStorage.setItem(CHIP_POS_KEY, JSON.stringify({ x: x, y: y }));
    } catch (e0) {}
  }

  function setChipXY(x, y) {
    if (!chip) return;
    var w = chip.offsetWidth || 280;
    var h = chip.offsetHeight || 56;
    var maxX = Math.max(8, (window.innerWidth || 800) - w - 8);
    var maxY = Math.max(8, (window.innerHeight || 600) - h - 8);
    x = Math.min(maxX, Math.max(8, Number(x) || 8));
    y = Math.min(maxY, Math.max(8, Number(y) || 8));
    // Anchor top-left + transform so Unraid CSS cannot pin right/bottom
    try {
      chip.style.setProperty("left", "0px", "important");
      chip.style.setProperty("top", "0px", "important");
      chip.style.setProperty("right", "auto", "important");
      chip.style.setProperty("bottom", "auto", "important");
      chip.style.setProperty("transform", "translate3d(" + x + "px," + y + "px,0)", "important");
      chip.style.setProperty("will-change", "transform");
    } catch (e0) {
      chip.style.left = "0px";
      chip.style.top = "0px";
      chip.style.right = "auto";
      chip.style.bottom = "auto";
      chip.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    }
    chip.setAttribute("data-ucwc-x", String(Math.round(x)));
    chip.setAttribute("data-ucwc-y", String(Math.round(y)));
    return { x: x, y: y };
  }

  function clearChipXY() {
    if (!chip) return;
    try {
      chip.style.removeProperty("transform");
      chip.style.removeProperty("will-change");
      chip.style.removeProperty("left");
      chip.style.removeProperty("top");
      chip.style.setProperty("right", "18px", "important");
      chip.style.setProperty("bottom", "18px", "important");
    } catch (e0) {
      chip.style.transform = "";
      chip.style.left = "";
      chip.style.top = "";
      chip.style.right = "18px";
      chip.style.bottom = "18px";
    }
    chip.removeAttribute("data-ucwc-x");
    chip.removeAttribute("data-ucwc-y");
  }

  function applyChipPos() {
    if (!chip) return;
    var pos = loadChipPos();
    if (!pos) {
      // default: bottom-right via CSS; no transform
      clearChipXY();
      return;
    }
    setChipXY(pos.x, pos.y);
  }

  function bindChipDrag() {
    if (!chip || chip._ucwcDragBound) return;
    chip._ucwcDragBound = true;
    var onMove = function (ev) {
      if (!chipDrag.on || !chip) return;
      var pt = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      if (!pt || typeof pt.clientX !== "number") return;
      var dx = pt.clientX - chipDrag.sx;
      var dy = pt.clientY - chipDrag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 2) chipDrag.moved = true;
      setChipXY(chipDrag.ox + dx, chipDrag.oy + dy);
      try {
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
      } catch (eP) {}
    };
    var onUp = function (ev) {
      if (!chipDrag.on) return;
      chipDrag.on = false;
      if (chip) chip.classList.remove("ucwc-music-chip-dragging");
      try {
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        document.removeEventListener("pointercancel", onUp, true);
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("touchmove", onMove, true);
        document.removeEventListener("touchend", onUp, true);
      } catch (e0) {}
      if (chip && chipDrag.moved) {
        var x = parseFloat(chip.getAttribute("data-ucwc-x") || "");
        var y = parseFloat(chip.getAttribute("data-ucwc-y") || "");
        if (!isFinite(x) || !isFinite(y)) {
          var r = chip.getBoundingClientRect();
          x = r.left;
          y = r.top;
        }
        saveChipPos(x, y);
      }
      setTimeout(function () {
        chipDrag.moved = false;
      }, 60);
    };
    function startDrag(ev) {
      if (ev.button != null && ev.button !== 0) return;
      var t = ev.target;
      if (t && t.closest && t.closest("button, .ucwc-music-chip-btn, a, input")) return;
      chipDrag.on = true;
      chipDrag.moved = false;
      var pt = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      chipDrag.sx = pt.clientX;
      chipDrag.sy = pt.clientY;
      var ox = parseFloat(chip.getAttribute("data-ucwc-x") || "");
      var oy = parseFloat(chip.getAttribute("data-ucwc-y") || "");
      if (!isFinite(ox) || !isFinite(oy)) {
        var r = chip.getBoundingClientRect();
        ox = r.left;
        oy = r.top;
      }
      chipDrag.ox = ox;
      chipDrag.oy = oy;
      // lock current pos into transform space immediately
      setChipXY(ox, oy);
      chip.classList.add("ucwc-music-chip-dragging");
      try {
        if (ev.pointerId != null && chip.setPointerCapture) chip.setPointerCapture(ev.pointerId);
      } catch (eC) {}
      try {
        document.addEventListener("pointermove", onMove, true);
        document.addEventListener("pointerup", onUp, true);
        document.addEventListener("pointercancel", onUp, true);
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseup", onUp, true);
        document.addEventListener("touchmove", onMove, { capture: true, passive: false });
        document.addEventListener("touchend", onUp, true);
      } catch (e1) {}
      try {
        if (ev.cancelable && ev.type === "touchstart") ev.preventDefault();
      } catch (e2) {}
    }
    chip.addEventListener("pointerdown", startDrag, true);
    chip.addEventListener("mousedown", startDrag, true);
    chip.addEventListener("touchstart", startDrag, { capture: true, passive: false });
  }

  function activeLyricText() {
    var lines = state.lyrics && state.lyrics.lines;
    if (!lines || !lines.length) return "";
    var idx = state.lyrics.active;
    if (idx < 0 || idx >= lines.length) {
      if (audio && isFinite(audio.currentTime)) {
        idx = findLyricIndex(Math.floor(audio.currentTime * 1000) - (state.lyrics.offsetMs || 0));
      }
    }
    if (idx < 0 || idx >= lines.length) return "";
    return lines[idx].text || "";
  }

  function updateChipUi() {
    if (!chip) return;
    var t = current();
    var name = (t && t.title) || "音乐";
    var sess = loadPlaySession();
    if ((!t || !t.title) && sess && sess.id && state.tracks.length) {
      for (var i = 0; i < state.tracks.length; i++) {
        if (state.tracks[i] && state.tracks[i].id === sess.id) {
          name = state.tracks[i].title || name;
          break;
        }
      }
    }
    if (chipEls.title) chipEls.title.textContent = name;
    if (chipEls.lrc) {
      var line = activeLyricText();
      if (line) chipEls.lrc.textContent = line;
      else if (isUiPlaying() && audio && !audio.paused) chipEls.lrc.textContent = "♪ 播放中";
      else if (pendingResume || resumeIntent) chipEls.lrc.textContent = "续播中…";
      else chipEls.lrc.textContent = "点击播放续播";
    }
    if (chipEls.play) {
      var playingChip = isUiPlaying();
      chipEls.play.innerHTML = playingChip ? svgIcon("pause") : svgIcon("play");
      chipEls.play.title = playingChip ? "暂停" : "播放";
      chipEls.play.setAttribute("aria-label", chipEls.play.title);
    }
  }

  function showResumeChip(label) {
    if (!enabled() || !isSitewidePlay() || isDashboard() || state.collapsed) {
      if (chip && chip.parentNode) {
        try {
          chip.parentNode.removeChild(chip);
        } catch (eH) {}
      }
      return;
    }
    // Always keep chip on non-dashboard sitewide (playing or paused waiting resume)
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "ucwc-music-resume-chip";
      chip.className = "ucwc-music-resume-chip";
      chip.setAttribute("role", "region");
      chip.setAttribute("aria-label", "全站音乐控制");
      chip.innerHTML =
        '<div class="ucwc-music-chip-row">' +
        '  <span class="ucwc-music-chip-handle" title="拖动" aria-hidden="true">⋮⋮</span>' +
        '  <span class="ucwc-music-chip-ico" aria-hidden="true">♪</span>' +
        '  <div class="ucwc-music-chip-meta">' +
        '    <div class="ucwc-music-chip-title"></div>' +
        '    <div class="ucwc-music-chip-lrc"></div>' +
        "  </div>" +
        '  <div class="ucwc-music-chip-btns">' +
        '    <button type="button" class="ucwc-music-chip-btn prev" title="上一首" aria-label="上一首"></button>' +
        '    <button type="button" class="ucwc-music-chip-btn primary play" title="播放" aria-label="播放"></button>' +
        '    <button type="button" class="ucwc-music-chip-btn next" title="下一首" aria-label="下一首"></button>' +
        "  </div>" +
        "</div>";
      chipEls.title = chip.querySelector(".ucwc-music-chip-title");
      chipEls.lrc = chip.querySelector(".ucwc-music-chip-lrc");
      chipEls.prev = chip.querySelector(".ucwc-music-chip-btn.prev");
      chipEls.play = chip.querySelector(".ucwc-music-chip-btn.play");
      chipEls.next = chip.querySelector(".ucwc-music-chip-btn.next");
      if (chipEls.prev) {
        chipEls.prev.innerHTML = svgIcon("prev");
        chipEls.prev.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (chipDrag.moved) return;
          prev();
          updateChipUi();
        });
      }
      if (chipEls.next) {
        chipEls.next.innerHTML = svgIcon("next");
        chipEls.next.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (chipDrag.moved) return;
          next(false);
          updateChipUi();
        });
      }
      if (chipEls.play) {
        chipEls.play.innerHTML = svgIcon("play");
        chipEls.play.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (chipDrag.moved) return;
          gestureResumeWanted = true;
          resumeIntent = true;
          togglePlay();
          updateChipUi();
        });
      }
      bindChipDrag();
    }
    try {
      var host = document.body || document.documentElement;
      if (chip.parentNode !== host) host.appendChild(chip);
    } catch (e1) {
      return;
    }
    applyChipPos();
    updateChipUi();
    if (label && chipEls.lrc && !(audio && !audio.paused)) {
      // soft hint only when not already playing
      if (!activeLyricText()) chipEls.lrc.textContent = label;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindGestureUnlock() {
    if (gestureBound) return;
    gestureBound = true;
    var tryUnlock = function () {
      if (!gestureResumeWanted && !resumeIntent) return;
      if (!isSitewidePlay() && !isDashboard()) return;
      if (audio && !audio.paused) {
        gestureResumeWanted = false;
        return;
      }
      var sess = loadPlaySession();
      if (!(gestureResumeWanted || resumeIntent || (sess && (sess.playing || sess.intent)))) return;
      gestureResumeWanted = false;
      resumeIntent = true;
      if (!tryResumeFromSession(true) && state.tracks.length) {
        playAt(state.index, true);
      }
    };
    var opts = { capture: true, passive: true };
    try {
      document.addEventListener("pointerdown", tryUnlock, opts);
      document.addEventListener("click", tryUnlock, opts);
      document.addEventListener("keydown", tryUnlock, opts);
      document.addEventListener("touchstart", tryUnlock, opts);
    } catch (e0) {}
  }

  function svgIcon(name) {
    var common =
      ' xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    if (name === "play") {
      return '<svg' + common + '><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>';
    }
    if (name === "pause") {
      return (
        '<svg' +
        common +
        '><rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/>' +
        '<rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/></svg>'
      );
    }
    if (name === "prev") {
      return (
        '<svg' +
        common +
        '><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none"/>' +
        '<line x1="5" y1="4" x2="5" y2="20"/></svg>'
      );
    }
    if (name === "next") {
      return (
        '<svg' +
        common +
        '><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/>' +
        '<line x1="19" y1="4" x2="19" y2="20"/></svg>'
      );
    }
    if (name === "shuffle") {
      return (
        '<svg' +
        common +
        '><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>' +
        '<polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>' +
        '<line x1="4" y1="4" x2="9" y2="9"/></svg>'
      );
    }
    if (name === "repeat") {
      return (
        '<svg' +
        common +
        '><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>' +
        '<polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'
      );
    }
    if (name === "list") {
      return (
        '<svg' +
        common +
        '><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>' +
        '<line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>' +
        '<line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
      );
    }
    if (name === "lyrics") {
      return (
        '<svg' +
        common +
        '><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/>' +
        '<circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/></svg>'
      );
    }
    if (name === "vol") {
      return (
        '<svg' +
        common +
        ' class="ucwc-music-vol-ico"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>' +
        '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
      );
    }
    return "";
  }

  function loadLs() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (typeof o.index === "number") state.index = o.index;
      if (typeof o.volume === "number") state.volume = Math.max(0, Math.min(1, o.volume));
      if (typeof o.shuffle === "boolean") state.shuffle = o.shuffle;
      if (o.repeat === "off" || o.repeat === "one" || o.repeat === "all") state.repeat = o.repeat;
      if (o.sideMode === "list" || o.sideMode === "lyrics") state.sideMode = o.sideMode;
      else if (typeof o.listOpen === "boolean") state.sideMode = o.listOpen ? "list" : "list";
    } catch (e) {}
  }

  function saveLs() {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          index: state.index,
          volume: state.volume,
          shuffle: state.shuffle,
          repeat: state.repeat,
          sideMode: state.sideMode,
        })
      );
    } catch (e) {}
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function trackUrl(id) {
    return apiBase + "?action=stream&id=" + encodeURIComponent(id) + "&_ts=" + Date.now();
  }

  function current() {
    if (!state.tracks.length) return null;
    if (state.index < 0) state.index = 0;
    if (state.index >= state.tracks.length) state.index = 0;
    return state.tracks[state.index];
  }

  function setStatus(msg) {
    state.error = msg || "";
    if (els.status) els.status.textContent = msg || "";
  }

  function updateSidePanel() {
    if (!root) return;
    var isList = state.sideMode !== "lyrics";
    root.classList.toggle("ucwc-music-side-list", isList);
    root.classList.toggle("ucwc-music-side-lyrics", !isList);
    if (els.listBtn) {
      els.listBtn.classList.toggle("on", true);
      els.listBtn.innerHTML = isList ? svgIcon("lyrics") : svgIcon("list");
      els.listBtn.setAttribute("title", isList ? "切换到歌词" : "切换到曲目");
      els.listBtn.setAttribute("aria-label", isList ? "切换到歌词" : "切换到曲目");
    }
    if (els.sideLabel) {
      els.sideLabel.textContent = isList ? "曲目" : "歌词";
    }
  }

  function updateMeta() {
    var t = current();
    if (!els.title) {
      return;
    }
    if (!t) {
      els.title.textContent = state.loaded ? "曲库为空" : "加载中…";
      if (els.sub) els.sub.textContent = state.error || "本地音乐";
      clearLyricsView("—");
      return;
    }
    els.title.textContent = t.title || "未知曲目";
    var bits = [];
    if (t.artist) bits.push(t.artist);
    if (t.album) bits.push(t.album);
    if (els.sub) els.sub.textContent = bits.length ? bits.join(" · ") : t.ext || "本地";
    if (els.list) {
      var items = els.list.querySelectorAll(".ucwc-music-item");
      for (var i = 0; i < items.length; i++) {
        if (parseInt(items[i].getAttribute("data-i"), 10) === state.index) {
          items[i].classList.add("active");
        } else {
          items[i].classList.remove("active");
        }
      }
    }
  }

  function updatePlayBtn() {
    var playing = isUiPlaying();
    if (els.play) {
      els.play.innerHTML = playing ? svgIcon("pause") : svgIcon("play");
      els.play.setAttribute("title", playing ? "暂停" : "播放");
    }
    updateChipUi();
  }

  function updateModeBtns() {
    if (els.shuffle) els.shuffle.classList.toggle("on", !!state.shuffle);
    if (els.repeat) {
      els.repeat.classList.toggle("on", state.repeat !== "off");
      els.repeat.setAttribute(
        "title",
        state.repeat === "one" ? "单曲循环" : state.repeat === "all" ? "列表循环" : "循环：关"
      );
      if (!els.repeat.querySelector("svg")) els.repeat.innerHTML = svgIcon("repeat");
    }
  }

  function clearLyricsView(hint) {
    state.lyrics.lines = [];
    state.lyrics.active = -1;
    state.lyrics.empty = true;
    state.lyrics.loading = false;
    if (root) root.classList.remove("ucwc-music-has-lyrics");
    if (els.lyricsScroll) els.lyricsScroll.innerHTML = "";
    if (els.lyricsHint) {
      els.lyricsHint.style.display = "";
      els.lyricsHint.textContent = hint || "加载或自动匹配歌词…";
    }
    updateChipUi();
  }

  function renderLyricsLines() {
    if (!els.lyricsScroll) return;
    els.lyricsScroll.innerHTML = "";
    var lines = state.lyrics.lines || [];
    if (!lines.length) {
      if (root) root.classList.remove("ucwc-music-has-lyrics");
      if (els.lyricsHint) {
        els.lyricsHint.style.display = "";
        els.lyricsHint.textContent = state.lyrics.loading
          ? "加载/匹配歌词…"
          : "暂无歌词（将自动尝试下载）";
      }
      return;
    }
    if (root) root.classList.add("ucwc-music-has-lyrics");
    if (els.lyricsHint) els.lyricsHint.style.display = "none";
    for (var i = 0; i < lines.length; i++) {
      var row = document.createElement("div");
      row.className = "ucwc-music-lrc-line";
      row.setAttribute("data-i", String(i));
      row.textContent = lines[i].text || "";
      els.lyricsScroll.appendChild(row);
    }
    state.lyrics.active = -1;
    syncLyrics(true);
  }

  function findLyricIndex(tMs) {
    var lines = state.lyrics.lines;
    if (!lines || !lines.length) return -1;
    var lo = 0;
    var hi = lines.length - 1;
    var ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lines[mid].t <= tMs) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  function syncLyrics(force) {
    if (!audio) return;
    var now = Date.now();
    if (!force && now - lyricsSyncLast < 120) return;
    lyricsSyncLast = now;
    var hasLines = state.lyrics.lines && state.lyrics.lines.length;
    var tMs = Math.floor((audio.currentTime || 0) * 1000) - (state.lyrics.offsetMs || 0);
    var idx = hasLines ? findLyricIndex(tMs) : -1;
    var changed = idx !== state.lyrics.active;
    if (!changed && !force) {
      updateChipUi();
      return;
    }
    state.lyrics.active = idx;
    if (els.lyricsScroll && hasLines) {
      var nodes = els.lyricsScroll.querySelectorAll(".ucwc-music-lrc-line");
      for (var i = 0; i < nodes.length; i++) {
        if (i === idx) nodes[i].classList.add("active");
        else nodes[i].classList.remove("active");
      }
      if (idx >= 0 && nodes[idx]) {
        try {
          var reduce =
            document.documentElement.classList.contains("ucwc-reduce-motion") ||
            (document.body && document.body.classList.contains("ucwc-reduce-motion"));
          nodes[idx].scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: reduce ? "auto" : "smooth",
          });
        } catch (e0) {
          try {
            nodes[idx].scrollIntoView(true);
          } catch (e1) {}
        }
      }
    }
    updateChipUi();
  }

  function clearCoverView() {
    state.cover.url = "";
    if (!els.art) return;
    els.art.classList.remove("has-cover");
    var img = els.art.querySelector("img.ucwc-music-art-img");
    if (img) {
      try {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute("src");
      } catch (e0) {}
      if (img.parentNode) img.parentNode.removeChild(img);
    }
  }

  function setCoverUrl(url, trackId) {
    if (!els.art) return;
    if (!url) {
      clearCoverView();
      return;
    }
    var img = els.art.querySelector("img.ucwc-music-art-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "ucwc-music-art-img";
      img.alt = "";
      img.draggable = false;
      els.art.appendChild(img);
    }
    img.onload = function () {
      if (state.cover.id !== trackId) return;
      els.art.classList.add("has-cover");
      updateMediaSessionMeta();
    };
    img.onerror = function () {
      if (state.cover.id !== trackId) return;
      clearCoverView();
      updateMediaSessionMeta();
    };
    if (img.getAttribute("src") !== url) img.src = url;
    else els.art.classList.add("has-cover");
  }

  function loadCoverForCurrent() {
    var t = current();
    if (!t || !t.id) {
      state.cover.id = "";
      clearCoverView();
      return;
    }
    if (state.cover.id === t.id && state.cover.url && !state.cover.loading) {
      setCoverUrl(state.cover.url, t.id);
      return;
    }
    if (state.cover.id === t.id && state.cover.loading) return;
    var seq = ++state.cover.seq;
    state.cover.id = t.id;
    state.cover.loading = true;
    state.cover.url = "";
    clearCoverView();
    fetch(apiBase + "?action=cover&id=" + encodeURIComponent(t.id) + "&fetch=1&_ts=" + Date.now(), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (seq !== state.cover.seq) return;
        state.cover.loading = false;
        if (!j || !j.ok || j.empty || !j.url) {
          state.cover.url = "";
          clearCoverView();
          updateMediaSessionMeta();
          return;
        }
        state.cover.url = j.url;
        state.cover.id = t.id;
        if (t) t.has_cover = true;
        setCoverUrl(j.url, t.id);
        if (j.source && String(j.source).indexOf("downloaded") === 0) {
          setStatus("已自动下载封面");
          setTimeout(function () {
            if (state.error === "已自动下载封面") setStatus(state.tracks.length ? "共 " + state.tracks.length + " 首" : "");
          }, 2200);
        }
        updateMediaSessionMeta();
      })
      .catch(function () {
        if (seq !== state.cover.seq) return;
        state.cover.loading = false;
        clearCoverView();
      });
  }

  function loadLyricsForCurrent() {
    var t = current();
    if (!t || !t.id) {
      state.lyrics.id = "";
      clearLyricsView("—");
      return;
    }
    if (state.lyrics.id === t.id && (state.lyrics.lines.length || state.lyrics.empty) && !state.lyrics.loading) {
      // already loaded for this track
      if (state.lyrics.lines.length) syncLyrics(true);
      return;
    }
    var seq = ++state.lyrics.seq;
    state.lyrics.id = t.id;
    state.lyrics.loading = true;
    state.lyrics.empty = true;
    state.lyrics.lines = [];
    state.lyrics.active = -1;
    state.lyrics.offsetMs = 0;
    if (els.lyricsScroll) els.lyricsScroll.innerHTML = "";
    if (root) root.classList.remove("ucwc-music-has-lyrics");
    if (els.lyricsHint) {
      els.lyricsHint.style.display = "";
      els.lyricsHint.textContent = "加载/匹配歌词…";
    }
    fetch(apiBase + "?action=lyrics&id=" + encodeURIComponent(t.id) + "&fetch=1&_ts=" + Date.now(), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (seq !== state.lyrics.seq) return;
        state.lyrics.loading = false;
        if (!j || !j.ok) {
          clearLyricsView((j && j.error) || "歌词加载失败");
          return;
        }
        var lines = Array.isArray(j.lines) ? j.lines : [];
        var norm = [];
        for (var i = 0; i < lines.length; i++) {
          var L = lines[i];
          if (!L || typeof L.t !== "number") continue;
          var tx = typeof L.text === "string" ? L.text : "";
          if (!tx) continue;
          norm.push({ t: L.t, text: tx });
        }
        state.lyrics.offsetMs = typeof j.offset_ms === "number" ? j.offset_ms : 0;
        state.lyrics.lines = norm;
        state.lyrics.empty = norm.length === 0;
        state.lyrics.id = t.id;
        if (norm.length && t) t.has_lrc = true;
        renderLyricsLines();
        renderList();
        updateChipUi();
        if (j && j.source === "downloaded") {
          setStatus("已自动下载歌词");
          setTimeout(function () {
            if (state.error === "已自动下载歌词") setStatus(state.tracks.length ? "共 " + state.tracks.length + " 首" : "");
          }, 2200);
        }
      })
      .catch(function () {
        if (seq !== state.lyrics.seq) return;
        state.lyrics.loading = false;
        clearLyricsView("歌词请求失败");
      });
  }

  function renderList() {
    if (!els.list) return;
    els.list.innerHTML = "";
    for (var i = 0; i < state.tracks.length; i++) {
      var t = state.tracks[i];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ucwc-music-item" + (i === state.index ? " active" : "");
      b.setAttribute("data-i", String(i));
      var label = (t.artist ? t.artist + " — " : "") + (t.title || t.id);
      b.innerHTML = '<span class="ucwc-music-item-txt"></span>';
      b.querySelector(".ucwc-music-item-txt").textContent = label;
      if (t.has_lrc) {
        var badge = document.createElement("span");
        badge.className = "ucwc-music-item-lrc";
        badge.title = "有歌词";
        badge.textContent = "词";
        b.appendChild(badge);
      }
      b.addEventListener(
        "click",
        (function (idx) {
          return function () {
            playAt(idx, true);
          };
        })(i)
      );
      els.list.appendChild(b);
    }
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "auto";
    try {
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.playsInline = true;
    } catch (ePI) {}
    audio.volume = state.volume;
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", function () {
      state.playing = true;
      clearPlayRetries();
      markPendingResume(false);
      updateMediaSessionMeta();
      resumeIntent = true;
      updatePlayBtn();
      savePlaySession(true);
      gestureResumeWanted = false;
      // Off-dash: keep mini chip visible while playing
      syncSitewideChip();
      updateChipUi();
    });
    audio.addEventListener("pause", function () {
      if (pendingResume && resumeIntent) {
        if (resumeIntent && isSitewidePlay()) savePlaySession(true);
        updateChipUi();
        return;
      }
      state.playing = false;
      updatePlayBtn();
      if (resumeIntent && isSitewidePlay()) {
        savePlaySession(true);
      } else {
        savePlaySession(false);
      }
      syncSitewideChip();
      updateChipUi();
    });
    audio.addEventListener("error", function () {
      setStatus("播放失败（格式或路径）");
      state.playing = false;
      updatePlayBtn();
      savePlaySession(!!resumeIntent);
    });
    return audio;
  }

  function onTime() {
    if (!audio || seeking) return;
    var cur = audio.currentTime || 0;
    var dur = audio.duration || 0;
    if (els.cur) els.cur.textContent = fmt(cur);
    if (els.dur) els.dur.textContent = isFinite(dur) ? fmt(dur) : "0:00";
    if (els.seek && isFinite(dur) && dur > 0) {
      els.seek.value = String(Math.round((cur / dur) * 1000));
    }
    syncLyrics(false);
    schedulePlayPersist();
  }

  function onEnded() {
    if (state.repeat === "one") {
      playAt(state.index, true);
      return;
    }
    next(true);
  }

  /** Best-effort play against autoplay policy: try normal, then muted-then-unmute. */
  function tryPlayUnlocked(a, onBlocked) {
    if (!a) return;
    function ok() {
      try {
        if (a.muted) a.muted = false;
      } catch (e0) {}
      try {
        a.volume = state.volume;
      } catch (e1) {}
      clearPlayRetries();
      markPendingResume(false);
      gestureResumeWanted = false;
      state.playing = true;
      updatePlayBtn();
      savePlaySession(true);
      syncSitewideChip();
      updateChipUi();
      updateMediaSessionMeta();
    }
    function fail() {
      markPendingResume(true);
      if (typeof onBlocked === "function") onBlocked();
      else {
        gestureResumeWanted = true;
        bindGestureUnlock();
        schedulePlayRetries("blocked");
      }
      updatePlayBtn();
    }
    var p;
    try {
      a.muted = false;
      a.volume = state.volume;
      p = a.play();
    } catch (eP) {
      p = null;
    }
    if (p && typeof p.then === "function") {
      p.then(ok).catch(function () {
        // muted unlock path (Chrome sometimes allows muted autoplay after prior media engagement)
        try {
          a.muted = true;
          a.volume = 0;
        } catch (eM) {}
        var p2;
        try {
          p2 = a.play();
        } catch (e2) {
          p2 = null;
        }
        if (p2 && typeof p2.then === "function") {
          p2
            .then(function () {
              // ramp unmute shortly — may still require gesture on strict browsers
              setTimeout(function () {
                try {
                  a.muted = false;
                  a.volume = state.volume;
                } catch (eU) {}
                if (a.paused) fail();
                else ok();
              }, 30);
            })
            .catch(fail);
        } else {
          fail();
        }
      });
    } else if (a && !a.paused) {
      ok();
    } else {
      fail();
    }
  }

  function playAt(idx, autoPlay, startAt) {
    if (!state.tracks.length) return;
    state.index = ((idx % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var t = current();
    if (!t) return;
    var a = ensureAudio();
    var seekTo = typeof startAt === "number" && isFinite(startAt) && startAt > 0 ? startAt : 0;
    var gen = ++audioGen;
    var applied = false;
    var needLoad = lastSrcId !== t.id || !a.src;
    if (needLoad) {
      lastSrcId = t.id;
      try {
        a.pause();
      } catch (eP) {}
      a.src = trackUrl(t.id);
    }
    function onReady() {
      applySeekAndMaybePlay();
    }
    function applySeekAndMaybePlay() {
      if (gen !== audioGen || applied) return;
      applied = true;
      try {
        a.removeEventListener("loadedmetadata", onReady);
        a.removeEventListener("canplay", onReady);
      } catch (eR) {}
      if (seekTo > 0) {
        try {
          if (isFinite(a.duration) && a.duration > 0) {
            a.currentTime = Math.min(seekTo, Math.max(0, a.duration - 0.25));
          } else {
            a.currentTime = seekTo;
          }
        } catch (e0) {}
      }
      updateMeta();
      renderList();
      if (autoPlay) {
        resumeIntent = true;
        // avoid stacking play if already playing same position roughly
        if (!(a && !a.paused && lastSrcId === t.id && Math.abs((a.currentTime || 0) - seekTo) < 1.25 && seekTo > 0)) {
          tryPlayUnlocked(a, function () {
            if (gen !== audioGen) return;
            markPendingResume(true);
            resumeIntent = true;
            state.playing = true;
            updatePlayBtn();
            writePlaySession({
              playing: true,
              intent: true,
              index: state.index,
              t: (a && isFinite(a.currentTime) ? a.currentTime : seekTo) || 0,
              id: t.id || "",
              vol: state.volume,
              sitewide: isSitewidePlay(),
              ts: Date.now(),
            });
            gestureResumeWanted = true;
            bindGestureUnlock();
            schedulePlayRetries("autoplay-block");
            if (isDashboard()) {
              setStatus("正在尝试自动续播…（若无声请点 chip 播放）");
            } else {
              setStatus("");
              syncSitewideChip("续播中…点播放可解锁");
            }
            updateChipUi();
          });
        }
      }
      savePlaySession(!!autoPlay || !!(audio && !audio.paused));
      syncSitewideChip();
      updateChipUi();
      updateMediaSessionMeta();
      if (autoPlay && a && a.paused) schedulePlayRetries("playAt");
    }
    updateMeta();
    loadLyricsForCurrent();
    loadCoverForCurrent();
    saveLs();
    if (autoPlay) resumeIntent = true;
    savePlaySession(!!autoPlay);
    if (needLoad) {
      a.addEventListener("loadedmetadata", onReady);
      a.addEventListener("canplay", onReady);
      if (a.readyState >= 1) {
        setTimeout(function () {
          if (gen === audioGen) applySeekAndMaybePlay();
        }, 0);
      }
    } else {
      applySeekAndMaybePlay();
    }
  }

  function resolveSessionIndex(sess) {
    var idx = typeof sess.index === "number" ? sess.index : state.index;
    if (sess.id) {
      for (var i = 0; i < state.tracks.length; i++) {
        if (state.tracks[i] && state.tracks[i].id === sess.id) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0 || idx >= state.tracks.length) idx = 0;
    return idx;
  }

  function sessionWantsResume(sess) {
    if (!sess) return false;
    return !!(sess.playing || sess.intent);
  }

  function tryResumeFromSession(forcePlay) {
    if (!state.tracks.length) return false;
    if (!isDashboard() && !isSitewidePlay()) return false;
    var sess = resumePending || loadPlaySession();
    if (!sessionWantsResume(sess) && !resumeIntent) return false;
    if (!sess && resumeIntent) {
      // keep current position if same engine still has audio
      var curT = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
      playAt(state.index, true, curT);
      return true;
    }
    var idx = resolveSessionIndex(sess);
    var t = sess && typeof sess.t === "number" ? sess.t : 0;
    if ((!t || t < 0.5) && audio && lastSrcId && sess && sess.id === lastSrcId && isFinite(audio.currentTime)) {
      t = audio.currentTime;
    }
    resumeIntent = true;
    playAt(idx, forcePlay !== false, t);
    return true;
  }

  function togglePlay() {
    if (!state.tracks.length) {
      setStatus("无曲目，请检查本地目录");
      return;
    }
    var a = ensureAudio();
    if (!a.src) {
      playAt(state.index, true);
      return;
    }
    if (a.paused) {
      resumeIntent = true;
      markPendingResume(false);
      var p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          setStatus("无法播放");
          gestureResumeWanted = true;
          resumeIntent = true;
          markPendingResume(true);
          savePlaySession(true);
          bindGestureUnlock();
          updatePlayBtn();
          if (!isDashboard()) showResumeChip("继续播放");
        });
      }
    } else {
      resumeIntent = false;
      gestureResumeWanted = false;
      markPendingResume(false);
      clearPlayRetries();
      a.pause();
      state.playing = false;
      savePlaySession(false);
      updatePlayBtn();
    }
  }

  function next(fromEnded) {
    if (!state.tracks.length) return;
    var n;
    if (state.shuffle && state.tracks.length > 1) {
      n = state.index;
      var guard = 0;
      while (n === state.index && guard++ < 20) {
        n = Math.floor(Math.random() * state.tracks.length);
      }
    } else {
      n = state.index + 1;
      if (n >= state.tracks.length) {
        if (state.repeat === "all" || (fromEnded && state.repeat === "all")) n = 0;
        else if (fromEnded && state.repeat === "off") {
          state.playing = false;
          resumeIntent = false;
          updatePlayBtn();
          clearPlaySession();
          hideResumeChip();
          return;
        } else if (!fromEnded) n = 0;
        else {
          state.playing = false;
          resumeIntent = false;
          updatePlayBtn();
          clearPlaySession();
          hideResumeChip();
          return;
        }
      }
    }
    playAt(n, true);
  }

  function prev() {
    if (!state.tracks.length) return;
    var a = ensureAudio();
    if (a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    var n = state.index - 1;
    if (n < 0) n = state.tracks.length - 1;
    playAt(n, true);
  }

  /** Find a host inside dashboard content flow only. */
  function findDashHost() {
    var selectors = [
      "#db-box",
      "#db_box",
      "#db_box1",
      "#dashboard",
      ".grid-stack",
      "#wrapper .grid-stack",
      "div#content",
      "#template",
      "#wrapper",
    ];
    var i, el;
    for (i = 0; i < selectors.length; i++) {
      try {
        el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e0) {}
    }
    var table = document.querySelector("table.dashboard, table.share_status.dashboard");
    if (table && table.parentNode) return table.parentNode;
    return null;
  }

  function readDashPos() {
    try {
      var raw = localStorage.getItem(DASH_POS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (e0) {
      return null;
    }
  }

  function saveDashPos() {
    try {
      var wrap = document.getElementById("ucwc-music-dash-host");
      if (!wrap || !wrap.parentNode) return;
      var parent = wrap.parentNode;
      var kids = parent.children;
      var idx = -1;
      var i;
      for (i = 0; i < kids.length; i++) {
        if (kids[i] === wrap) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return;
      var prev = wrap.previousElementSibling;
      var next = wrap.nextElementSibling;
      localStorage.setItem(
        DASH_POS_KEY,
        JSON.stringify({
          index: idx,
          total: kids.length,
          prevId: prev && prev.id ? prev.id : "",
          prevTag: prev ? (prev.tagName || "").toLowerCase() : "",
          nextId: next && next.id ? next.id : "",
          nextTag: next ? (next.tagName || "").toLowerCase() : "",
          ts: Date.now(),
        })
      );
    } catch (e0) {}
  }

  function insertDashWrap(host, wrap) {
    var saved = readDashPos();
    var kids = host.children;
    var placed = false;
    // Prefer previous sibling anchor if still present under same host
    if (saved && saved.prevId) {
      try {
        var prevEl = document.getElementById(saved.prevId);
        if (prevEl && prevEl.parentNode === host) {
          if (prevEl.nextSibling) host.insertBefore(wrap, prevEl.nextSibling);
          else host.appendChild(wrap);
          placed = true;
        }
      } catch (e1) {}
    }
    if (!placed && saved && saved.nextId) {
      try {
        var nextEl = document.getElementById(saved.nextId);
        if (nextEl && nextEl.parentNode === host) {
          host.insertBefore(wrap, nextEl);
          placed = true;
        }
      } catch (e2) {}
    }
    if (!placed && saved && typeof saved.index === "number" && saved.index >= 0 && kids.length) {
      var at = Math.min(saved.index, kids.length);
      if (at >= kids.length) host.appendChild(wrap);
      else host.insertBefore(wrap, kids[at]);
      placed = true;
    }
    // Default: append at end — never force top-left / first slot after updates
    if (!placed) host.appendChild(wrap);
  }

  function placeInDashboard(card) {
    if (!card || !isDashboard()) return false;
    var host = findDashHost();
    if (!host) return false;
    var wrap = document.getElementById("ucwc-music-dash-host");
    if (wrap && wrap.parentNode && wrap.parentNode !== host) {
      // Stale host from another shell — reparent without forcing index 0
      try {
        wrap.parentNode.removeChild(wrap);
      } catch (eR) {}
      insertDashWrap(host, wrap);
    } else if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "ucwc-music-dash-host";
      insertDashWrap(host, wrap);
    }
    // If wrap already in host, leave its DOM position alone (user/layout stable across remounts)
    wrap.classList.remove("ucwc-music-sitewide");
    if (card.parentNode !== wrap) {
      wrap.appendChild(card);
    }
    saveDashPos();
    // Dashboard may finish rendering late; re-save index a few times without moving
    setTimeout(saveDashPos, 400);
    setTimeout(saveDashPos, 1500);
    setTimeout(saveDashPos, 4000);
    return true;
  }

  function buildUi() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "ucwc-music-card";
    root.className = "ucwc-dash-music-tile ucwc-music-side-list";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "仪表盘音乐");
    root.innerHTML =
      '<div class="ucwc-music-tile-bar">' +
      '  <span class="ucwc-music-tile-title">音乐</span>' +
      '  <span class="ucwc-music-tile-bar-actions">' +
      '    <button type="button" class="ucwc-music-close" title="本次隐藏（刷新后可再显示）" aria-label="隐藏">×</button>' +
      "  </span>" +
      "</div>" +
      '<div class="ucwc-music-body">' +
      '  <div class="ucwc-music-main">' +
      '    <div class="ucwc-music-left">' +
      '      <div class="ucwc-music-head">' +
      '        <div class="ucwc-music-art" aria-hidden="true"><span class="ucwc-music-art-fallback">♪</span></div>' +
      '        <div class="ucwc-music-meta">' +
      '          <div class="ucwc-music-title">…</div>' +
      '          <div class="ucwc-music-sub"></div>' +
      "        </div>" +
      "      </div>" +
      '      <div class="ucwc-music-transport">' +
      '        <div class="ucwc-music-btns">' +
      '          <button type="button" class="ucwc-music-btn shuffle" title="随机" aria-label="随机"></button>' +
      '          <button type="button" class="ucwc-music-btn prev" title="上一首" aria-label="上一首"></button>' +
      '          <button type="button" class="ucwc-music-btn primary play" title="播放" aria-label="播放"></button>' +
      '          <button type="button" class="ucwc-music-btn next" title="下一首" aria-label="下一首"></button>' +
      '          <button type="button" class="ucwc-music-btn repeat" title="循环：关" aria-label="循环"></button>' +
      '          <button type="button" class="ucwc-music-btn list" title="切换到歌词" aria-label="切换到歌词"></button>' +
      "        </div>" +
      '        <div class="ucwc-music-under">' +
      '          <div class="ucwc-music-progress-wrap">' +
      '            <span class="ucwc-music-time cur">0:00</span>' +
      '            <input type="range" class="ucwc-music-seek" min="0" max="1000" value="0" aria-label="进度">' +
      '            <span class="ucwc-music-time end">0:00</span>' +
      "          </div>" +
      '          <div class="ucwc-music-controls">' +
      '            <div class="ucwc-music-vol" title="音量">' +
      '              <span class="ucwc-music-vol-slot" aria-hidden="true"></span>' +
      '              <input type="range" min="0" max="100" value="70" aria-label="音量">' +
      "            </div>" +
      "          </div>" +
      '          <div class="ucwc-music-status" aria-live="polite"></div>' +
      "        </div>" +
      "      </div>" +
      "    </div>" +
      '    <div class="ucwc-music-right">' +
      '      <div class="ucwc-music-side-head"><span class="ucwc-music-side-label">曲目</span></div>' +
      '      <div class="ucwc-music-side-body">' +
      '        <div class="ucwc-music-list" role="listbox" aria-label="曲目列表"></div>' +
      '        <div class="ucwc-music-lyrics" aria-live="polite">' +
      '          <div class="ucwc-music-lyrics-scroll"></div>' +
      '          <div class="ucwc-music-lyrics-hint">加载或自动匹配歌词…</div>' +
      "        </div>" +
      "      </div>" +
      "    </div>" +
      "  </div>" +
      "</div>";

    els.art = root.querySelector(".ucwc-music-art");
    els.title = root.querySelector(".ucwc-music-title");
    els.sub = root.querySelector(".ucwc-music-sub");
    els.cur = root.querySelector(".ucwc-music-time.cur");
    els.dur = root.querySelector(".ucwc-music-time.end");
    els.seek = root.querySelector(".ucwc-music-seek");
    els.play = root.querySelector(".ucwc-music-btn.play");
    els.prev = root.querySelector(".ucwc-music-btn.prev");
    els.next = root.querySelector(".ucwc-music-btn.next");
    els.shuffle = root.querySelector(".ucwc-music-btn.shuffle");
    els.repeat = root.querySelector(".ucwc-music-btn.repeat");
    els.listBtn = root.querySelector(".ucwc-music-btn.list");
    els.vol = root.querySelector(".ucwc-music-vol input");
    els.status = root.querySelector(".ucwc-music-status");
    els.list = root.querySelector(".ucwc-music-list");
    els.close = root.querySelector(".ucwc-music-close");
    els.lyricsScroll = root.querySelector(".ucwc-music-lyrics-scroll");
    els.lyricsHint = root.querySelector(".ucwc-music-lyrics-hint");
    els.sideLabel = root.querySelector(".ucwc-music-side-label");

    if (els.shuffle) els.shuffle.innerHTML = svgIcon("shuffle");
    if (els.prev) els.prev.innerHTML = svgIcon("prev");
    if (els.play) els.play.innerHTML = svgIcon("play");
    if (els.next) els.next.innerHTML = svgIcon("next");
    if (els.repeat) els.repeat.innerHTML = svgIcon("repeat");
    var volSlot = root.querySelector(".ucwc-music-vol-slot");
    if (volSlot) volSlot.innerHTML = svgIcon("vol");
    updateSidePanel();

    els.play.addEventListener("click", togglePlay);
    els.prev.addEventListener("click", prev);
    els.next.addEventListener("click", function () {
      next(false);
    });
    els.shuffle.addEventListener("click", function () {
      state.shuffle = !state.shuffle;
      updateModeBtns();
      saveLs();
    });
    els.repeat.addEventListener("click", function () {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
      updateModeBtns();
      saveLs();
    });
    els.listBtn.addEventListener("click", function () {
      state.sideMode = state.sideMode === "lyrics" ? "list" : "lyrics";
      updateSidePanel();
      saveLs();
      if (state.sideMode === "lyrics") {
        loadLyricsForCurrent();
        syncLyrics(true);
      }
    });
    els.close.addEventListener("click", function () {
      state.collapsed = true;
      hideCardUi();
      hideResumeChip();
      stopEngine(true);
    });
    els.vol.addEventListener("input", function () {
      state.volume = Math.max(0, Math.min(1, parseInt(els.vol.value, 10) / 100));
      if (audio) audio.volume = state.volume;
      saveLs();
    });
    els.seek.addEventListener("mousedown", function () {
      seeking = true;
    });
    els.seek.addEventListener(
      "touchstart",
      function () {
        seeking = true;
      },
      { passive: true }
    );
    function commitSeek() {
      seeking = false;
      if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
      var r = parseInt(els.seek.value, 10) / 1000;
      audio.currentTime = Math.max(0, Math.min(audio.duration, r * audio.duration));
      syncLyrics(true);
      savePlaySession();
    }
    els.seek.addEventListener("mouseup", commitSeek);
    els.seek.addEventListener("touchend", commitSeek);
    els.seek.addEventListener("change", commitSeek);

    if (!placeInDashboard(root)) {
      root.classList.add("ucwc-music-hidden");
    }
    return root;
  }

  function fetchList() {
    setStatus("正在扫描本地曲库…");
    return fetch(apiBase + "?action=list&_ts=" + Date.now(), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { okHttp: r.ok, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j || {};
        state.loaded = true;
        if (!j.ok) {
          state.tracks = [];
          setStatus(j.error || "无法加载曲库");
          updateMeta();
          renderList();
          return;
        }
        state.tracks = j.tracks || [];
        if (state.index >= state.tracks.length) state.index = 0;
        setStatus(state.tracks.length ? "共 " + state.tracks.length + " 首" : "目录内无支持的音频");
        updateMeta();
        renderList();
        maybeResumeOrAutoplay();
      })
      .catch(function () {
        state.loaded = true;
        setStatus("曲库请求失败");
        updateMeta();
      });
  }

  function applyCfgDefaults() {
    var c = cfg();
    if (typeof c.volume === "number") {
      state.volume = Math.max(0, Math.min(1, c.volume / (c.volume > 1 ? 100 : 1)));
      if (c.volume > 1) state.volume = Math.max(0, Math.min(1, c.volume / 100));
    }
    if (typeof c.shuffle === "boolean") state.shuffle = c.shuffle;
    if (c.repeat === "off" || c.repeat === "one" || c.repeat === "all") state.repeat = c.repeat;
    loadLs();
  }

  function maybeResumeOrAutoplay() {
    if (!state.tracks.length) return;
    if (audio && !audio.paused) {
      syncSitewideChip();
      updateChipUi();
      return;
    }
    if (resumeAttempted) {
      if (!isDashboard() && isSitewidePlay()) {
        syncSitewideChip(pendingResume || resumeIntent ? "点击播放以续播" : "");
        updateChipUi();
      }
      return;
    }
    var sess = resumePending || loadPlaySession();
    resumePending = null;
    if (sessionWantsResume(sess) || resumeIntent) {
      if (isDashboard() || isSitewidePlay()) {
        resumeIntent = true;
        resumeAttempted = true;
        markPendingResume(true);
        state.playing = true;
        updatePlayBtn();
        var idx = sess ? resolveSessionIndex(sess) : state.index;
        var t = sess && typeof sess.t === "number" ? sess.t : 0;
        if ((!t || t < 0.5) && audio && lastSrcId && sess && sess.id === lastSrcId && isFinite(audio.currentTime)) {
          t = audio.currentTime;
        }
        playAt(idx, true, t);
        if (!isDashboard() && isSitewidePlay()) {
          gestureResumeWanted = true;
          bindGestureUnlock();
          syncSitewideChip(audio && !audio.paused ? "" : "续播中…");
        }
        schedulePlayRetries("resume");
        return;
      }
    }
    var c = cfg();
    // Autoplay only on dashboard, once per page
    if (c.autoplay && isDashboard() && state.tracks.length) {
      resumeAttempted = true;
      playAt(state.index, true);
    } else if (!isDashboard() && isSitewidePlay()) {
      syncSitewideChip();
    }
  }

  function mount() {
    if (!enabled()) {
      hideCardUi();
      hideResumeChip();
      stopEngine(true);
      return;
    }

    applyCfgDefaults();

    // 仅仪表盘播放：离开仪表盘时停播并清会话
    if (!isDashboard() && !isSitewidePlay()) {
      hideCardUi();
      hideResumeChip();
      stopEngine(true);
      return;
    }

    // 全站播放 / 仪表盘：引擎可跑；卡片仅仪表盘
    if (!shouldShowCard()) {
      hideCardUi();
    } else {
      hideResumeChip();
      buildUi();
      if (!placeInDashboard(root)) {
        root.classList.add("ucwc-music-hidden");
      } else {
        root.classList.remove("ucwc-music-hidden");
      }
      updateSidePanel();
      if (els.vol) els.vol.value = String(Math.round(state.volume * 100));
      updateModeBtns();
      updatePlayBtn();
      updateMeta();
      if (state.tracks.length) {
        loadLyricsForCurrent();
        loadCoverForCurrent();
      }
    }

    if (!shouldRunEngine()) return;

    ensureAudio().volume = state.volume;
    bindGestureUnlock();

    var earlySess = loadPlaySession();
    if (sessionWantsResume(earlySess)) {
      resumeIntent = true;
      if (!isDashboard()) gestureResumeWanted = true;
    }

    // Off-dash sitewide: chip always present
    if (!isDashboard() && isSitewidePlay()) {
      syncSitewideChip();
    }

    if (!state.loaded) {
      resumePending = earlySess || loadPlaySession();
      fetchList();
    } else if (isSitewidePlay() || isDashboard()) {
      var sess = earlySess || loadPlaySession();
      if (audio && !audio.paused) {
        syncSitewideChip();
        updateChipUi();
      } else if (sessionWantsResume(sess) || resumeIntent) {
        maybeResumeOrAutoplay();
      } else if (!isDashboard() && isSitewidePlay()) {
        syncSitewideChip();
      }
    }
  }

  function destroy() {
    stopEngine(true);
    if (audio) {
      try {
        audio.removeAttribute("src");
        audio.load();
      } catch (e) {}
    }
    hideCardUi();
    hideResumeChip();
    root = null;
    els = {};
    chipEls = {};
    state.loaded = false;
    lastSrcId = "";
    resumeAttempted = false;
  }

  function boot() {
    if (bootDone) {
      // Soft remount only — do not re-trigger resume stack
      mount();
      return;
    }
    bootDone = true;
    try {
      bindMediaSession();
      bindNavFlush();
      window.addEventListener("pagehide", function () {
        savePlaySessionForNav();
      });
      window.addEventListener("beforeunload", function () {
        savePlaySessionForNav();
      });
      window.addEventListener("freeze", function () {
        savePlaySessionForNav();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") savePlaySessionForNav();
      });
      window.addEventListener(
        "resize",
        function () {
          if (chip && chip.parentNode) applyChipPos();
        },
        { passive: true }
      );
    } catch (e0) {}
    mount();
    // Delayed remounts only place UI (dashboard host may appear late); resume gated by resumeAttempted
    var n = 0;
    if (mountTimer) clearInterval(mountTimer);
    mountTimer = setInterval(function () {
      mount();
      if (++n >= 12) {
        clearInterval(mountTimer);
        mountTimer = null;
      }
    }, 700);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        mount();
        if (resumeIntent || sessionWantsResume(loadPlaySession())) {
          if (audio && audio.paused) schedulePlayRetries("visible");
        }
      }
    });
    try {
      window.addEventListener("pageshow", function (ev) {
        if (ev && ev.persisted) {
          resumeAttempted = false;
          mount();
        }
        if (resumeIntent || sessionWantsResume(loadPlaySession())) {
          if (!audio || audio.paused) schedulePlayRetries("pageshow");
        }
      });
    } catch (ePS) {}
  }

  global.UcwcMusic = {
    boot: boot,
    mount: mount,
    destroy: destroy,
    reload: function () {
      state.loaded = false;
      fetchList();
    },
  };

  function start() {
    try {
      if (global.__UCWC_MUSIC_BOOTED__ && global.UcwcMusic) {
        try {
          global.UcwcMusic.mount();
        } catch (eM) {}
        return;
      }
      global.__UCWC_MUSIC_BOOTED__ = true;
      boot();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
