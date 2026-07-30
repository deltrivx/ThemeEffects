/**
 * ThemeEffects music player — dashboard card + sitewide engine
 * Layout: left cover/meta + buttons; progress/controls under buttons (full width of btn row);
 *         right panel toggles 曲目 ⇄ 歌词 (default 曲目). Local LRC sidecar sync.
 * Cross-page: in-page floating chip (embedded overlay, never window.open/new tab).
 * Sitewide: chip always visible on Unraid pages; card ↔ chip bi-directional sync.
 * Clicks only control playback — no navigation. Full reload uses session resume.
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
      blobUrl: "",
      loading: false,
      seq: 0,
      paintGen: 0,
      paintedId: "", // track id currently shown in <img>
      missId: "", // confirmed no-cover for this track (stop empty clear/retry loop)
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
  var DASH_POS_KEY = "ucwc_music_dash_pos_v2";
  var audioGen = 0; // bump when reloading src to ignore stale play()
  var lastSrcId = "";
  var playRetryTimer = null;
  var playRetryCount = 0;
  var pendingResume = false;
  var uiPlayStableUntil = 0;
  var pendingSeekTo = 0;
  var resumeLockId = "";
  var listFetchSeq = 0;
  /** After one successful play() in this document, later programmatic plays are freer on mobile. */
  var mediaUnlocked = false;
  var unlockCtx = null;
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
    // Strict: only real in-page audio. Never open popup/new tab.
    return !!(audio && !audio.paused);
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
      var playing = typeof forcePlaying === "boolean" ? forcePlaying : livePlaying;
      var id = t && t.id ? t.id : "";
      var curT = 0;
      if (pendingSeekTo > 0.5 && id) curT = pendingSeekTo;
      if (audio && isFinite(audio.currentTime) && audio.currentTime > 0.25) {
        // live wins unless this is a failed seek-to-0 flash while we still have a target
        if (!(pendingSeekTo > 1 && audio.currentTime < 0.35 && pendingSeekTo - audio.currentTime > 2)) {
          curT = audio.currentTime;
        }
      }
      var prev = null;
      try { prev = loadPlaySession(); } catch (ePrev) {}
      // Never clobber a good saved progress with 0 for the same track (src reload race)
      if (curT < 0.5 && prev && prev.id && id && prev.id === id && typeof prev.t === "number" && prev.t > 0.5) {
        curT = prev.t;
      }
      if (curT < 0.5 && prev && !id && typeof prev.t === "number" && prev.t > 0.5) {
        curT = prev.t;
        if (prev.id) id = prev.id;
      }
      var idx = state.index;
      if ((!state.tracks.length || idx < 0) && prev && typeof prev.index === "number") idx = prev.index;
      var payload = {
        playing: !!playing,
        intent: !!(resumeIntent || playing),
        index: idx,
        t: curT,
        id: id,
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
        // Stop claiming in-progress resume for UI; audio is paused → play icon
        markPendingResume(false);
        clearPlayRetries();
        state.playing = false;
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
          if (pendingSeekTo > 0.5 && audio && isFinite(audio.duration) && audio.duration > 0) {
            try {
              if (Math.abs((audio.currentTime || 0) - pendingSeekTo) > 1.25) {
                audio.currentTime = Math.min(pendingSeekTo, Math.max(0, audio.duration - 0.25));
              }
            } catch (eSeek) {}
          }
          tryPlayUnlocked(audio, function () {
            tick();
          });
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
        updatePlayBtn();
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
    // Sitewide keeps chip; only hide when fully stopping sitewide session
    if (clearSession || !isSitewidePlay()) hideResumeChip();
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

  /** Sitewide: chip always visible (dashboard + other pages); card and chip stay in sync. */
  function syncSitewideChip(hint) {
    if (!enabled() || state.collapsed || !isSitewidePlay()) {
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
      else if (isUiPlaying()) chipEls.lrc.textContent = "♪ 播放中";
      else if (pendingResume && playRetryCount > 0) chipEls.lrc.textContent = "尝试续播…";
      else if (resumeIntent || gestureResumeWanted) chipEls.lrc.textContent = "已暂停 · 点击播放";
      else chipEls.lrc.textContent = "点击播放续播";
    }
    if (chipEls.play) {
      var playingChip = isUiPlaying();
      chipEls.play.innerHTML = playingChip ? svgIcon("pause") : svgIcon("play");
      chipEls.play.title = playingChip ? "暂停" : "播放";
      chipEls.play.setAttribute("aria-label", chipEls.play.title);
      chipEls.play.classList.toggle("is-playing", playingChip);
      chipEls.play.classList.toggle("is-paused", !playingChip);
    }
  }

  function showResumeChip(label) {
    // Sitewide: chip always visible (dashboard + other pages). Card and chip stay in sync.
    if (!enabled() || !isSitewidePlay() || state.collapsed) {
      if (chip && chip.parentNode) {
        try {
          chip.parentNode.removeChild(chip);
        } catch (eH) {}
      }
      return;
    }
    // Always keep chip when sitewide engine runs
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
      // Bubble only: stop Unraid nav AFTER chip button handlers run.
      // Capture-phase stopPropagation would swallow play/prev/next clicks.
      chip.addEventListener("click", function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch (eNav) {}
      });
      chip.setAttribute("data-ucwc-chip-no-nav", "1");
    }
    try {
      var hostEl = document.body || document.documentElement;
      if (chip.parentNode !== hostEl) hostEl.appendChild(chip);
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

  function isCoarsePointer() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia && window.matchMedia("(hover: none)").matches) return true;
    } catch (e0) {}
    try {
      return (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
    } catch (e1) {
      return false;
    }
  }

  /** Best-effort WebAudio + HTMLAudio unlock while still inside a user gesture. */
  function unlockMediaPipeline() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!unlockCtx) unlockCtx = new AC();
        if (unlockCtx.state === "suspended") unlockCtx.resume();
        // tiny silent buffer kick — establishes media engagement on some WebViews
        var buf = unlockCtx.createBuffer(1, 1, 22050);
        var src = unlockCtx.createBufferSource();
        src.buffer = buf;
        src.connect(unlockCtx.destination);
        if (typeof src.start === "function") src.start(0);
        else if (typeof src.noteOn === "function") src.noteOn(0);
      }
    } catch (eAc) {}
    try {
      var a = ensureAudio();
      // Synchronous play() inside gesture is what mobile actually honors.
      if (a && a.paused && a.src) {
        var p = a.play();
        if (p && typeof p.then === "function") {
          p.then(function () {
            mediaUnlocked = true;
            try {
              if (a.muted) a.muted = false;
              a.volume = state.volume;
            } catch (e0) {}
          }).catch(function () {});
        } else if (a && !a.paused) {
          mediaUnlocked = true;
        }
      }
    } catch (eHtml) {}
  }

  /**
   * Prepare audio element for a track WITHOUT requiring play success.
   * Used so the next user gesture can call play() synchronously (mobile policy).
   */
  function primeAudioTrack(idx, startAt) {
    if (!state.tracks.length) return null;
    state.index = ((idx % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var t = current();
    if (!t) return null;
    var a = ensureAudio();
    var seekTo = typeof startAt === "number" && isFinite(startAt) && startAt > 0 ? startAt : 0;
    if (seekTo > 0.5) pendingSeekTo = seekTo;
    if (lastSrcId !== t.id || !a.src) {
      lastSrcId = t.id;
      try {
        a.src = trackUrl(t.id);
        a.load();
      } catch (eL) {}
    }
    function applySeek() {
      var target = pendingSeekTo > 0.5 ? pendingSeekTo : seekTo;
      if (!(target > 0.25)) return;
      try {
        if (isFinite(a.duration) && a.duration > 0) {
          a.currentTime = Math.min(target, Math.max(0, a.duration - 0.25));
        } else {
          a.currentTime = target;
        }
      } catch (eS) {}
    }
    try {
      a.addEventListener("loadedmetadata", applySeek, { once: true });
      a.addEventListener("canplay", applySeek, { once: true });
    } catch (eE) {
      setTimeout(applySeek, 80);
    }
    updateMeta();
    return a;
  }

  /** Mobile Safari/Chrome: any user gesture can unlock autoplay after a blocked play().
   * Critical: call HTMLMediaElement.play() SYNCHRONOUSLY in the gesture handler.
   * Waiting for canplay (async) loses the user-activation token on real mobile. */
  function bindGestureUnlock() {
    if (gestureBound) return;
    gestureBound = true;
    var unlocking = false;
    var tryUnlock = function (ev) {
      try {
        if (!enabled() || !shouldRunEngine()) return;
        if (!isSitewidePlay() && !isDashboard()) return;
        if (audio && !audio.paused) {
          gestureResumeWanted = false;
          mediaUnlocked = true;
          return;
        }
        var sess = loadPlaySession();
        var want =
          gestureResumeWanted ||
          resumeIntent ||
          pendingResume ||
          sessionWantsResume(sess) ||
          !!(cfg().autoplay && isDashboard());
        if (!want) return;
        // Ignore pure scroll / drag chrome; accept real taps
        if (ev && ev.type === "touchmove") return;
        if (ev && ev.type === "pointermove") return;
        if (unlocking) return;
        unlocking = true;
        gestureResumeWanted = false;
        resumeIntent = true;
        markPendingResume(true);

        // 1) Unlock audio pipeline while still in the gesture stack
        unlockMediaPipeline();

        var a = ensureAudio();
        var idx = state.index;
        var tSeek = pendingSeekTo > 0.5 ? pendingSeekTo : 0;
        if (sess) {
          idx = resolveSessionIndex(sess);
          if (typeof sess.t === "number" && sess.t > 0.5) tSeek = sess.t;
        }
        // 2) Ensure src is set BEFORE play() so the gesture-tied play() has a resource
        if (!a.src || lastSrcId !== (state.tracks[idx] && state.tracks[idx].id)) {
          primeAudioTrack(idx, tSeek);
          a = ensureAudio();
        } else if (tSeek > 0.5) {
          try {
            if (isFinite(a.duration) && a.duration > 0 && Math.abs((a.currentTime || 0) - tSeek) > 1) {
              a.currentTime = Math.min(tSeek, a.duration - 0.25);
            }
          } catch (eSeek) {}
        }

        // 3) SYNCHRONOUS play() — do not defer to canplay
        var played = false;
        try {
          a.muted = false;
          a.volume = state.volume;
          var p0 = a.play();
          if (p0 && typeof p0.then === "function") {
            p0
              .then(function () {
                mediaUnlocked = true;
                played = true;
                clearPlayRetries();
                markPendingResume(false);
                gestureResumeWanted = false;
                state.playing = true;
                state.index = idx;
                updatePlayBtn();
                savePlaySession(true);
                syncSitewideChip();
                updateChipUi();
              })
              .catch(function () {
                // muted kick then unmute (still chained from gesture in most engines)
                try {
                  a.muted = true;
                  var p1 = a.play();
                  if (p1 && typeof p1.then === "function") {
                    p1
                      .then(function () {
                        try {
                          a.muted = false;
                          a.volume = state.volume;
                        } catch (eU) {}
                        mediaUnlocked = true;
                        markPendingResume(false);
                        state.playing = true;
                        updatePlayBtn();
                        savePlaySession(true);
                        syncSitewideChip();
                      })
                      .catch(function () {
                        gestureResumeWanted = true;
                        schedulePlayRetries("gesture-block");
                      });
                  }
                } catch (eM) {
                  gestureResumeWanted = true;
                  schedulePlayRetries("gesture-block");
                }
              });
          } else if (a && !a.paused) {
            mediaUnlocked = true;
            played = true;
            markPendingResume(false);
            state.playing = true;
            updatePlayBtn();
            savePlaySession(true);
          }
        } catch (ePlay) {
          played = false;
        }

        // 4) Also run full resume path (seek/meta) — play may already be running
        try {
          if (!played) tryResumeFromSession(true);
        } catch (eR) {}

        setTimeout(function () {
          unlocking = false;
          if (audio && audio.paused && (resumeIntent || sessionWantsResume(loadPlaySession()))) {
            gestureResumeWanted = true;
            schedulePlayRetries("gesture");
            if (isCoarsePointer()) {
              if (isDashboard()) setStatus("点一下屏幕任意处开始播放");
              else syncSitewideChip("点播放或点屏幕续播");
            }
          }
        }, 120);
      } catch (eU) {
        unlocking = false;
      }
    };
    var opts = { capture: true, passive: true };
    try {
      document.addEventListener("pointerdown", tryUnlock, opts);
      document.addEventListener("touchstart", tryUnlock, opts);
      document.addEventListener("touchend", tryUnlock, opts);
      document.addEventListener("click", tryUnlock, opts);
      document.addEventListener("keydown", tryUnlock, opts);
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
    // Stable URL per track — Date.now() bust caused full reload + seek-to-0 races
    var v = 1;
    try { v = encodeURIComponent(String(id || "")).length || 1; } catch (e0) { v = 1; }
    return apiBase + "?action=stream&id=" + encodeURIComponent(id) + "&_v=" + v;
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
    scheduleMarqueeRefresh();
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
      clearCoverView();
      state.cover.id = "";
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
    if (
      els.art &&
      t.id &&
      state.cover.missId !== t.id &&
      (state.cover.id !== t.id || (!state.cover.url && !state.cover.loading && state.cover.paintedId !== t.id))
    ) {
      loadCoverForCurrent();
    }
  }

  function updatePlayBtn() {
    var playing = isUiPlaying(); // real audio only
    if (els.play) {
      els.play.innerHTML = playing ? svgIcon("pause") : svgIcon("play");
      els.play.setAttribute("title", playing ? "暂停" : "播放");
      els.play.setAttribute("aria-label", playing ? "暂停" : "播放");
      els.play.classList.toggle("is-playing", playing);
      els.play.classList.toggle("is-paused", !playing);
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


  function preferReduceMotion() {
    try {
      if (document.documentElement.classList.contains("ucwc-reduce-motion")) return true;
      if (document.body && document.body.classList.contains("ucwc-reduce-motion")) return true;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch (e0) {}
    return false;
  }

  /** Build marquee DOM into host for long single-line text. */
  function fillMarquee(host, text) {
    if (!host) return;
    var t = text == null ? "" : String(text);
    host.classList.add("ucwc-music-marquee");
    host.classList.remove("is-overflow");
    host.removeAttribute("title");
    host.innerHTML = "";
    var track = document.createElement("span");
    track.className = "ucwc-music-marquee-track";
    var seg1 = document.createElement("span");
    seg1.className = "ucwc-music-marquee-seg";
    seg1.textContent = t;
    track.appendChild(seg1);
    var seg2 = document.createElement("span");
    seg2.className = "ucwc-music-marquee-seg";
    seg2.setAttribute("aria-hidden", "true");
    seg2.textContent = t;
    track.appendChild(seg2);
    host.appendChild(track);
    if (t) host.setAttribute("title", t);
  }

  function measureMarquee(host) {
    if (!host) return;
    var track = host.querySelector(".ucwc-music-marquee-track");
    var seg = host.querySelector(".ucwc-music-marquee-seg");
    if (!track || !seg) return;
    host.classList.remove("is-overflow");
    track.style.animationDuration = "";
    var need = false;
    try {
      var sw = seg.scrollWidth || seg.offsetWidth || 0;
      var cw = host.clientWidth || 0;
      need = sw > cw + 2;
    } catch (e0) {
      need = false;
    }
    if (preferReduceMotion()) {
      host.classList.toggle("is-overflow", false);
      return;
    }
    var parent = host.closest(".ucwc-music-lrc-line, .ucwc-music-item");
    if (need) {
      host.classList.add("is-overflow");
      if (parent) parent.classList.add("is-long");
      var dur = 12;
      try {
        var sw2 = seg.scrollWidth || 0;
        if (sw2 > 0) dur = Math.max(8, Math.min(28, sw2 / 28));
        else {
          var chars = (seg.textContent || "").length;
          dur = Math.max(8, Math.min(28, chars * 0.32));
        }
      } catch (e1) {}
      host.style.setProperty("--ucwc-marquee-dur", dur.toFixed(2) + "s");
      track.style.animationDuration = dur.toFixed(2) + "s";
    } else {
      host.classList.remove("is-overflow");
      if (parent) parent.classList.remove("is-long");
      host.style.removeProperty("--ucwc-marquee-dur");
    }
  }

  function refreshMarquees(scope) {
    var rootEl = scope || root || document.getElementById("ucwc-music-card");
    if (!rootEl) return;
    var nodes = rootEl.querySelectorAll(".ucwc-music-marquee");
    for (var i = 0; i < nodes.length; i++) measureMarquee(nodes[i]);
  }

  var marqueeRefreshTimer = 0;
  function scheduleMarqueeRefresh() {
    if (marqueeRefreshTimer) {
      try { clearTimeout(marqueeRefreshTimer); } catch (e0) {}
    }
    marqueeRefreshTimer = setTimeout(function () {
      marqueeRefreshTimer = 0;
      refreshMarquees();
    }, 40);
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
      var mq = document.createElement("span");
      fillMarquee(mq, lines[i].text || "");
      row.appendChild(mq);
      els.lyricsScroll.appendChild(row);
    }
    state.lyrics.active = -1;
    syncLyrics(true);
    scheduleMarqueeRefresh();
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

  function revokeCoverBlob() {
    try {
      if (state.cover && state.cover.blobUrl) {
        var dying = state.cover.blobUrl;
        state.cover.blobUrl = "";
        // Defer revoke so in-flight <img> decode / paint is not aborted mid-frame
        setTimeout(function () {
          try {
            URL.revokeObjectURL(dying);
          } catch (e1) {}
        }, 0);
      }
    } catch (e0) {}
  }

  /** Revoke a specific object URL only after it is no longer the visible img src. */
  function releaseCoverBlobLater(blobUrl) {
    if (!blobUrl || blobUrl.indexOf("blob:") !== 0) return;
    setTimeout(function () {
      try {
        if (state.cover && state.cover.blobUrl === blobUrl) return;
        if (els.art) {
          var img = els.art.querySelector("img.ucwc-music-art-img");
          if (img && img.getAttribute("src") === blobUrl) return;
        }
        URL.revokeObjectURL(blobUrl);
      } catch (e0) {}
    }, 1200);
  }

  function clearCoverDom() {
    if (!els.art) return;
    els.art.classList.remove("has-cover");
    state.cover.paintedId = "";
    var img = els.art.querySelector("img.ucwc-music-art-img");
    if (img) {
      try {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute("src");
      } catch (e0) {}
      if (img.parentNode) img.parentNode.removeChild(img);
    }
    ensureDefaultArtFallback();
  }

  function clearCoverView() {
    revokeCoverBlob();
    state.cover.url = "";
    state.cover.paintedId = "";
    clearCoverDom();
  }

  function absPluginUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url) || url.indexOf("blob:") === 0 || url.indexOf("data:") === 0) return url;
    if (url.charAt(0) === "/") {
      try {
        return (location.origin || "") + url;
      } catch (e0) {
        return url;
      }
    }
    return url;
  }

  /**
   * Paint cover into .ucwc-music-art.
   * - <img> stays hidden until decode succeeds (no browser broken-image / document icon).
   * - Failure → remove img, restore default ♪ fallback art.
   * - optional onReady(ok) after load/error for this assignment.
   */
  function setCoverUrl(url, trackId, onReady) {
    if (!els.art) {
      if (typeof onReady === "function") onReady(false);
      return;
    }
    if (!url) {
      if (typeof onReady === "function") onReady(false);
      return;
    }
    var finalUrl = absPluginUrl(url);
    var prevGood =
      state.cover.paintedId &&
      state.cover.paintedId !== "" &&
      els.art.classList.contains("has-cover") &&
      !!els.art.querySelector("img.ucwc-music-art-img");
    var img = els.art.querySelector("img.ucwc-music-art-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "ucwc-music-art-img";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      // Hidden until markOk — CSS also gates on .has-cover
      try {
        img.style.opacity = "0";
        img.style.visibility = "hidden";
      } catch (eSt) {}
      els.art.insertBefore(img, els.art.firstChild);
    }
    var done = false;
    if (typeof state.cover.paintGen !== "number") state.cover.paintGen = 0;
    var assignGen = ++state.cover.paintGen;
    function markOk() {
      if (done) return;
      done = true;
      if (state.cover.paintGen !== assignGen) return;
      if (state.cover.id !== trackId && state.cover.paintedId && state.cover.paintedId !== trackId) {
        if (typeof onReady === "function") onReady(false);
        return;
      }
      // Reject zero-size / broken decodes (some browsers fire load on placeholder)
      if (!img.naturalWidth || img.naturalWidth < 2) {
        dropBrokenToDefault();
        if (typeof onReady === "function") onReady(false);
        return;
      }
      state.cover.paintedId = trackId;
      els.art.classList.add("has-cover");
      try {
        img.style.opacity = "1";
        img.style.visibility = "visible";
      } catch (e1) {}
      updateMediaSessionMeta();
      if (typeof onReady === "function") onReady(true);
    }
    function dropBrokenToDefault() {
      // No match / bad image → original default art (♪ + gradient), never broken icon
      try {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute("src");
        if (img.parentNode) img.parentNode.removeChild(img);
      } catch (e2) {}
      els.art.classList.remove("has-cover");
      if (state.cover.paintedId === trackId) state.cover.paintedId = "";
      if (state.cover.id === trackId) {
        state.cover.url = "";
        var orphan = state.cover.blobUrl;
        state.cover.blobUrl = "";
        releaseCoverBlobLater(orphan);
        state.cover.missId = trackId;
      }
      ensureDefaultArtFallback();
      updateMediaSessionMeta();
    }
    img.onload = markOk;
    img.onerror = function () {
      if (done) return;
      done = true;
      if (state.cover.paintGen !== assignGen) return;
      var curSrc = "";
      try {
        curSrc = img.getAttribute("src") || "";
      } catch (e3) {}
      if (curSrc && curSrc !== finalUrl) {
        if (typeof onReady === "function") onReady(false);
        return;
      }
      // Keep a still-valid previous track cover if user already moved on
      if (prevGood && state.cover.paintedId && state.cover.paintedId !== trackId) {
        if (typeof onReady === "function") onReady(false);
        return;
      }
      if (state.cover.id === trackId || !prevGood) {
        dropBrokenToDefault();
      }
      if (typeof onReady === "function") onReady(false);
    };
    if (img.getAttribute("src") === finalUrl && img.complete && img.naturalWidth > 1) {
      markOk();
      return;
    }
    // Assign new src while keeping old has-cover pixels if any; new img stays hidden until ok
    if (!prevGood) {
      els.art.classList.remove("has-cover");
      try {
        img.style.opacity = "0";
        img.style.visibility = "hidden";
      } catch (e4) {}
    }
    img.src = finalUrl;
    if (img.complete && img.naturalWidth > 1) markOk();
  }

  /** Ensure default ♪ node exists after stripping a broken cover img. */
  function ensureDefaultArtFallback() {
    if (!els.art) return;
    var fb = els.art.querySelector(".ucwc-music-art-fallback");
    if (!fb) {
      fb = document.createElement("span");
      fb.className = "ucwc-music-art-fallback";
      fb.setAttribute("aria-hidden", "true");
      fb.textContent = "♪";
      els.art.appendChild(fb);
    } else {
      try {
        fb.style.display = "";
        fb.style.visibility = "visible";
        fb.style.opacity = "1";
      } catch (e0) {}
    }
  }

  function applyCoverBlob(blob, trackId, metaUrl) {
    if (!blob || state.cover.id !== trackId) return false;
    try {
      var prevBlob = state.cover.blobUrl || "";
      var obj = URL.createObjectURL(blob);
      state.cover.blobUrl = obj;
      state.cover.url = metaUrl || obj;
      setCoverUrl(obj, trackId, function () {
        // Release previous blob only after new paint attempt settled
        if (prevBlob && prevBlob !== obj) releaseCoverBlobLater(prevBlob);
      });
      return true;
    } catch (e0) {
      return false;
    }
  }

  function loadCoverForCurrent() {
    var t = current();
    if (!els.art) return;
    if (!t || !t.id) {
      state.cover.id = "";
      state.cover.loading = false;
      state.cover.missId = "";
      clearCoverView();
      return;
    }
    if (state.cover.missId === t.id && state.cover.id === t.id && !state.cover.url && !state.cover.loading) {
      return; // known miss — do not clear/retry loop
    }
    if (state.cover.id === t.id && state.cover.url && !state.cover.loading) {
      setCoverUrl(state.cover.blobUrl || state.cover.url, t.id);
      return;
    }
    if (state.cover.id === t.id && state.cover.loading) return;
    var seq = ++state.cover.seq;
    var trackId = t.id;
    state.cover.id = trackId;
    state.cover.loading = true;
    if (state.cover.missId && state.cover.missId !== trackId) state.cover.missId = "";
    // Keep previous art visible until the new cover is ready (or confirmed empty).
    var reqUrl = apiBase + "?action=cover&id=" + encodeURIComponent(trackId) + "&fetch=1&_ts=" + Date.now();
    fetch(reqUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (r) {
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (j) {
        if (seq !== state.cover.seq) return;
        if (!j || !j.ok || j.empty || !j.url) {
          state.cover.loading = false;
          // Flaky/empty response must NOT wipe a cover we already painted for this track.
          if (state.cover.paintedId === trackId && (state.cover.blobUrl || state.cover.url)) {
            if (!state.cover.url && state.cover.blobUrl) state.cover.url = state.cover.blobUrl;
            updateMediaSessionMeta();
            return;
          }
          // Confirmed no cover for this track — mark miss so updateMeta won't re-loop clear.
          state.cover.missId = trackId;
          state.cover.url = "";
          var orphan = state.cover.blobUrl;
          state.cover.blobUrl = "";
          clearCoverDom();
          releaseCoverBlobLater(orphan);
          updateMediaSessionMeta();
          return;
        }
        state.cover.id = trackId;
        state.cover.missId = "";
        if (t && t.id === trackId) t.has_cover = true;
        var imageUrl = absPluginUrl(j.url);
        // Prefer blob fetch so cookies/auth apply and broken HTML isn't shown as image
        return fetch(imageUrl, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "image/*,*/*;q=0.8" },
        })
          .then(function (ir) {
            if (!ir || !ir.ok) throw new Error("img http");
            var ct = (ir.headers && ir.headers.get && ir.headers.get("content-type")) || "";
            if (ct && ct.indexOf("image/") !== 0 && ct.indexOf("octet-stream") === -1) {
              throw new Error("not image " + ct);
            }
            return ir.blob();
          })
          .then(function (blob) {
            if (seq !== state.cover.seq) return;
            state.cover.loading = false;
            if (!blob || blob.size < 32) throw new Error("empty blob");
            if (!applyCoverBlob(blob, trackId, imageUrl)) {
              state.cover.url = imageUrl;
              setCoverUrl(imageUrl, trackId);
            }
            if (j.source && (String(j.source).indexOf("downloaded") === 0 || String(j.source).indexOf("remote") === 0 || String(j.source) === "embedded")) {
              var tip =
                String(j.source).indexOf("downloaded") === 0
                  ? "已自动下载封面"
                  : String(j.source) === "embedded"
                    ? "已读取内嵌封面"
                    : "";
              if (tip) {
                setStatus(tip);
                setTimeout(function () {
                  if (state.error === tip) setStatus(state.tracks.length ? "共 " + state.tracks.length + " 首" : "");
                }, 2200);
              }
            }
            updateMediaSessionMeta();
          })
          .catch(function () {
            if (seq !== state.cover.seq) return;
            state.cover.loading = false;
            // Direct URL fallback — still keep prior art until this assignment errors
            state.cover.url = imageUrl;
            setCoverUrl(imageUrl, trackId);
            updateMediaSessionMeta();
          });
      })
      .catch(function () {
        if (seq !== state.cover.seq) return;
        state.cover.loading = false;
        // Network error: keep whatever art is on screen (prior track or cached)
        if (state.cover.paintedId === trackId && state.cover.blobUrl && !state.cover.url) {
          state.cover.url = state.cover.blobUrl;
        }
        updateMediaSessionMeta();
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
      var txt = document.createElement("span");
      txt.className = "ucwc-music-item-txt";
      fillMarquee(txt, label);
      b.appendChild(txt);
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
          return function (ev) {
            try {
              if (ev) {
                ev.preventDefault();
                ev.stopPropagation();
              }
            } catch (e0) {}
            playAt(idx, true);
          };
        })(i)
      );
      els.list.appendChild(b);
    }
    scheduleMarqueeRefresh();
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "auto";
    try {
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("x-webkit-airplay", "allow");
      audio.playsInline = true;
      // Help mobile: keep element in DOM (some WebViews treat detached Audio stricter)
      audio.setAttribute("controls", "false");
      audio.controls = false;
      audio.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-99px;top:-99px;";
      if (!audio.parentNode && document.body) document.body.appendChild(audio);
    } catch (ePI) {}
    audio.volume = state.volume;
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", function () {
      state.playing = true;
      mediaUnlocked = true;
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
      state.playing = false;
      // Always refresh button from real audio (paused → show play).
      // Keep session intent only while autoplay-retry is still in progress.
      if (pendingResume && resumeIntent) {
        if (isSitewidePlay()) savePlaySession(true);
        updatePlayBtn();
        syncSitewideChip();
        updateChipUi();
        return;
      }
      updatePlayBtn();
      if (resumeIntent && isSitewidePlay() && !audio.paused) {
        savePlaySession(true);
      } else if (resumeIntent && isSitewidePlay()) {
        // Paused but may still want gesture resume — store intent without claiming live play
        savePlaySession(false);
        try {
          var sess = loadPlaySession() || {};
          writePlaySession({
            playing: false,
            intent: true,
            index: typeof sess.index === "number" ? sess.index : state.index,
            t: audio && isFinite(audio.currentTime) ? audio.currentTime : sess.t || 0,
            id: (current() && current().id) || sess.id || "",
            vol: state.volume,
            sitewide: isSitewidePlay(),
            ts: Date.now(),
          });
        } catch (eS) {}
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
      // Re-assert seek if autoplay started at 0 despite pendingSeekTo
      try {
        if (pendingSeekTo > 1 && a && isFinite(a.duration) && a.duration > 0 && (a.currentTime || 0) < 0.75) {
          a.currentTime = Math.min(pendingSeekTo, Math.max(0, a.duration - 0.25));
        } else if (pendingSeekTo > 0 && a && Math.abs((a.currentTime || 0) - pendingSeekTo) < 2.5) {
          pendingSeekTo = a.currentTime;
        }
      } catch (eSeek2) {}
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
    if (seekTo > 0.5) pendingSeekTo = seekTo;
    else if (lastSrcId === t.id && pendingSeekTo > 0.5) seekTo = pendingSeekTo;

    // Collapse duplicate resume calls (stops title/list cycling flash)
    if (
      resumeLockId &&
      resumeLockId === t.id &&
      lastSrcId === t.id &&
      a.src &&
      Math.abs((pendingSeekTo || 0) - (seekTo || 0)) < 1.5
    ) {
      if (autoPlay && a.paused) {
        resumeIntent = true;
        tryPlayUnlocked(a);
      }
      return;
    }
    if (autoPlay || seekTo > 0.5) resumeLockId = t.id;

    var gen = ++audioGen;
    var applied = false;
    var needLoad = lastSrcId !== t.id || !a.src;
    if (needLoad) {
      lastSrcId = t.id;
      try { a.pause(); } catch (eP) {}
      a.src = trackUrl(t.id);
      try { a.load(); } catch (eL) {}
    }

    function applySeekOnly() {
      var target = pendingSeekTo > 0.5 ? pendingSeekTo : seekTo;
      if (!(target > 0.25)) return true;
      try {
        if (isFinite(a.duration) && a.duration > 0) {
          var capped = Math.min(target, Math.max(0, a.duration - 0.25));
          if (Math.abs((a.currentTime || 0) - capped) > 0.75) a.currentTime = capped;
          return Math.abs((a.currentTime || 0) - capped) < 1.5 || a.readyState >= 2;
        }
        a.currentTime = target;
        return false;
      } catch (e0) {
        return false;
      }
    }

    function onReady() {
      applySeekAndMaybePlay();
    }

    function onSeekedGate() {
      if (gen !== audioGen) return;
      try { a.removeEventListener("seeked", onSeekedGate); } catch (eS) {}
      if (!applied) applySeekAndMaybePlay();
    }

    function finishAfterSeek() {
      if (gen !== audioGen) return;
      applied = true;
      try {
        a.removeEventListener("loadedmetadata", onReady);
        a.removeEventListener("canplay", onReady);
        a.removeEventListener("seeked", onSeekedGate);
      } catch (eR) {}
      updateMeta();
      renderList();
      if (autoPlay) {
        resumeIntent = true;
        var targetPos = pendingSeekTo > 0.5 ? pendingSeekTo : seekTo;
        if (!(a && !a.paused && lastSrcId === t.id && Math.abs((a.currentTime || 0) - (targetPos || 0)) < 1.5 && targetPos > 0)) {
          tryPlayUnlocked(a, function () {
            if (gen !== audioGen) return;
            markPendingResume(true);
            resumeIntent = true;
            state.playing = true;
            updatePlayBtn();
            var tt = targetPos;
            if (a && isFinite(a.currentTime) && a.currentTime > 0.5) tt = a.currentTime;
            if (!(tt > 0.5) && pendingSeekTo > 0.5) tt = pendingSeekTo;
            writePlaySession({
              playing: true,
              intent: true,
              index: state.index,
              t: tt || 0,
              id: t.id || "",
              vol: state.volume,
              sitewide: isSitewidePlay(),
              ts: Date.now(),
            });
            gestureResumeWanted = true;
            bindGestureUnlock();
            schedulePlayRetries("autoplay-block");
            if (isDashboard()) setStatus("正在尝试自动续播…");
            else {
              setStatus("");
              syncSitewideChip("续播中…点播放可解锁");
            }
            updateChipUi();
          });
        }
      }
      // Save AFTER seek — never early-write t=0
      savePlaySession(!!autoPlay || !!(audio && !audio.paused));
      syncSitewideChip();
      updateChipUi();
      updateMediaSessionMeta();
      if (autoPlay && a && a.paused) schedulePlayRetries("playAt");
    }

    function applySeekAndMaybePlay() {
      if (gen !== audioGen || applied) return;
      var needSeek = pendingSeekTo > 0.5 || seekTo > 0.5;
      if (needSeek && !(isFinite(a.duration) && a.duration > 0) && a.readyState < 1) return;
      var seekOk = applySeekOnly();
      if (needSeek && !seekOk) {
        try {
          a.addEventListener("seeked", onSeekedGate);
          a.addEventListener("canplay", onReady);
        } catch (e2) {}
        setTimeout(function () {
          if (gen !== audioGen || applied) return;
          applySeekOnly();
          finishAfterSeek();
        }, 140);
        return;
      }
      finishAfterSeek();
    }

    updateMeta();
    loadLyricsForCurrent();
    loadCoverForCurrent();
    saveLs();
    if (autoPlay) resumeIntent = true;
    // IMPORTANT: do not savePlaySession here (would write t=0 and break cross-page resume)

    if (needLoad) {
      a.addEventListener("loadedmetadata", onReady);
      a.addEventListener("canplay", onReady);
      setTimeout(function () {
        if (gen !== audioGen || applied) return;
        if (a.readyState >= 1 && isFinite(a.duration) && a.duration > 0) applySeekAndMaybePlay();
      }, 30);
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
      // User clicked play — still in gesture; prime + play sync path
      unlockMediaPipeline();
      primeAudioTrack(state.index, pendingSeekTo > 0.5 ? pendingSeekTo : 0);
      playAt(state.index, true);
      return;
    }
    if (a.paused) {
      resumeIntent = true;
      markPendingResume(false);
      unlockMediaPipeline();
      // Prefer direct play in this click gesture (mobile)
      tryPlayUnlocked(a, function () {
        setStatus("无法播放");
        gestureResumeWanted = true;
        resumeIntent = true;
        markPendingResume(true);
        savePlaySession(true);
        bindGestureUnlock();
        updatePlayBtn();
        if (isSitewidePlay()) {
          showResumeChip("继续播放");
        }
      });
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
    pendingSeekTo = 0;
    resumeLockId = "";
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
          // Sitewide: keep in-page chip visible (paused), never tear down overlay
          if (isSitewidePlay()) syncSitewideChip();
          else hideResumeChip();
          return;
        } else if (!fromEnded) n = 0;
        else {
          state.playing = false;
          resumeIntent = false;
          updatePlayBtn();
          clearPlaySession();
          if (isSitewidePlay()) syncSitewideChip();
          else hideResumeChip();
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
      pendingSeekTo = 0;
      return;
    }
    pendingSeekTo = 0;
    resumeLockId = "";
    var n = state.index - 1;
    if (n < 0) n = state.tracks.length - 1;
    playAt(n, true);
  }

  /** Prefer a real dashboard column so the card floats with other tiles, not a full-width banner. */
  function findDashHost() {
    var saved = readDashPos();
    // 1) Restore into the same parent column if still present
    if (saved && saved.parentId) {
      try {
        var pref = document.getElementById(saved.parentId);
        if (pref && pref.isConnected) return pref;
      } catch (e0) {}
    }
    if (saved && saved.prevId) {
      try {
        var prevEl = document.getElementById(saved.prevId);
        if (prevEl && prevEl.parentNode && prevEl.parentNode.isConnected) return prevEl.parentNode;
      } catch (e1) {}
    }
    if (saved && saved.nextId) {
      try {
        var nextEl = document.getElementById(saved.nextId);
        if (nextEl && nextEl.parentNode && nextEl.parentNode.isConnected) return nextEl.parentNode;
      } catch (e2) {}
    }
    // 2) Unraid multi-column boxes (never prefer bare #db-box outer first)
    var colSelectors = [
      "#db-box1",
      "#db_box1",
      "#db-box2",
      "#db_box2",
      "#db-box3",
      "#db_box3",
      "#db-box4",
      "#db_box4",
      "div.grid > div.tile",
      ".grid-stack",
      "#wrapper .grid-stack",
    ];
    var i, el;
    for (i = 0; i < colSelectors.length; i++) {
      try {
        el = document.querySelector(colSelectors[i]);
        if (el) return el;
      } catch (e3) {}
    }
    // 3) Parent of first dashboard table (column-ish)
    try {
      var table = document.querySelector("table.dashboard, table.share_status.dashboard");
      if (table && table.parentNode) return table.parentNode;
    } catch (e4) {}
    // 4) Last resort outer hosts
    var fallbacks = ["#db-box", "#db_box", "#dashboard", "div#content", "#template", "#wrapper"];
    for (i = 0; i < fallbacks.length; i++) {
      try {
        el = document.querySelector(fallbacks[i]);
        if (el) return el;
      } catch (e5) {}
    }
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
      // Ignore transient detached / hidden states
      if (!parent.isConnected) return;
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
      // Do not overwrite a good mid-list save with accidental index 0 from early mount
      // unless user really is at 0 with anchors.
      var prev = wrap.previousElementSibling;
      var next = wrap.nextElementSibling;
      var payload = {
        index: idx,
        total: kids.length,
        parentId: parent.id || "",
        parentTag: (parent.tagName || "").toLowerCase(),
        prevId: prev && prev.id ? prev.id : "",
        prevTag: prev ? (prev.tagName || "").toLowerCase() : "",
        nextId: next && next.id ? next.id : "",
        nextTag: next ? (next.tagName || "").toLowerCase() : "",
        ts: Date.now(),
      };
      var old = readDashPos();
      if (old && typeof old.index === "number" && old.index > 0 && idx === 0 && !prev && kids.length > 1) {
        // Likely a remount race that re-inserted at top — keep previous memory
        return;
      }
      localStorage.setItem(DASH_POS_KEY, JSON.stringify(payload));
    } catch (e0) {}
  }

  function insertDashWrap(host, wrap) {
    if (!host || !wrap) return;
    // Already correctly parented — never move (this was forcing first slot on remount)
    if (wrap.parentNode === host) return;
    var saved = readDashPos();
    var kids = host.children;
    var placed = false;
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
      // Avoid always choosing 0 when we have no anchors and many siblings
      var at = Math.min(Math.max(0, saved.index), kids.length);
      if (at >= kids.length) host.appendChild(wrap);
      else host.insertBefore(wrap, kids[at]);
      placed = true;
    }
    // Default: append at end — never force top-left / first slot after updates
    if (!placed) host.appendChild(wrap);
  }

  var dashMo = null;
  var dashMoTimer = 0;
  function watchDashReorder(wrap) {
    try {
      if (dashMo) {
        try { dashMo.disconnect(); } catch (e0) {}
        dashMo = null;
      }
      if (!wrap || !wrap.parentNode || !window.MutationObserver) return;
      var parent = wrap.parentNode;
      dashMo = new MutationObserver(function () {
        if (dashMoTimer) clearTimeout(dashMoTimer);
        dashMoTimer = setTimeout(function () {
          dashMoTimer = 0;
          // User / Unraid reordered DOM — remember new place, never snap back
          saveDashPos();
        }, 200);
      });
      dashMo.observe(parent, { childList: true });
    } catch (e1) {}
  }

  function placeInDashboard(card) {
    if (!card || !isDashboard()) return false;
    var host = findDashHost();
    if (!host) return false;
    var wrap = document.getElementById("ucwc-music-dash-host");
    if (wrap && wrap.parentNode && wrap.parentNode !== host) {
      // Only reparent when the old parent is gone / not connected
      var oldParent = wrap.parentNode;
      var shouldMove = !oldParent.isConnected;
      if (!shouldMove) {
        // Keep stable parent; just ensure card is inside wrap
        if (card.parentNode !== wrap) wrap.appendChild(card);
        wrap.classList.remove("ucwc-music-sitewide");
        watchDashReorder(wrap);
        saveDashPos();
        return true;
      }
      try {
        oldParent.removeChild(wrap);
      } catch (eR) {}
      insertDashWrap(host, wrap);
    } else if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "ucwc-music-dash-host";
      insertDashWrap(host, wrap);
    } else if (wrap.parentNode !== host) {
      insertDashWrap(host, wrap);
    }
    // If wrap already in a connected host, leave DOM position alone
    wrap.classList.remove("ucwc-music-sitewide");
    if (card.parentNode !== wrap) {
      wrap.appendChild(card);
    }
    watchDashReorder(wrap);
    // Delay first save so early mount doesn't lock index 0 before layout settles
    setTimeout(saveDashPos, 600);
    setTimeout(saveDashPos, 1800);
    setTimeout(saveDashPos, 4500);
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

    function btnOnly(fn) {
      return function (ev) {
        try {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
        } catch (e0) {}
        return fn(ev);
      };
    }
    els.play.addEventListener("click", btnOnly(function () { togglePlay(); }));
    els.prev.addEventListener("click", btnOnly(function () { prev(); }));
    els.next.addEventListener(
      "click",
      btnOnly(function () {
        next(false);
      })
    );
    els.shuffle.addEventListener(
      "click",
      btnOnly(function () {
        state.shuffle = !state.shuffle;
        updateModeBtns();
        saveLs();
      })
    );
    els.repeat.addEventListener(
      "click",
      btnOnly(function () {
        state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
        updateModeBtns();
        saveLs();
      })
    );
    els.listBtn.addEventListener(
      "click",
      btnOnly(function () {
        state.sideMode = state.sideMode === "lyrics" ? "list" : "lyrics";
        updateSidePanel();
        saveLs();
        if (state.sideMode === "lyrics") {
          loadLyricsForCurrent();
          syncLyrics(true);
        }
      })
    );
    els.close.addEventListener(
      "click",
      btnOnly(function () {
        state.collapsed = true;
        hideCardUi();
        hideResumeChip();
        stopEngine(true);
      })
    );
    // Card shell: bubble-phase only so control handlers still receive the click.
    // Never capture-stop on the card root (that blocked play/prev/next entirely).
    root.addEventListener("click", function (ev) {
      try {
        ev.stopPropagation();
      } catch (e1) {}
    });
    root.addEventListener("auxclick", function (ev) {
      try {
        ev.stopPropagation();
      } catch (e2) {}
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
    var seq = ++listFetchSeq;
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
        if (seq !== listFetchSeq) return;
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
        // Pin session track before first paint — stops title cycling through library
        var sess = resumePending || loadPlaySession();
        if (sess && state.tracks.length) {
          state.index = resolveSessionIndex(sess);
          if (typeof sess.t === "number" && sess.t > 0.5) pendingSeekTo = sess.t;
        } else if (state.index >= state.tracks.length) {
          state.index = 0;
        }
        setStatus(state.tracks.length ? "共 " + state.tracks.length + " 首" : "目录内无支持的音频");
        updateMeta();
        renderList();
        if (state.tracks.length) {
          loadLyricsForCurrent();
          loadCoverForCurrent();
        } else {
          clearCoverView();
        }
        maybeResumeOrAutoplay();
      })
      .catch(function () {
        if (seq !== listFetchSeq) return;
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
    // Always arm gesture unlock on mobile / when we may need a tap to unlock autoplay policy
    bindGestureUnlock();
    if (audio && !audio.paused) {
      mediaUnlocked = true;
      syncSitewideChip();
      updateChipUi();
      if (isSitewidePlay()) showResumeChip();
      return;
    }
    if (resumeAttempted) {
      // Keep trying on mobile even after first attempt — policy often needs a later gesture
      if (resumeIntent || gestureResumeWanted || sessionWantsResume(loadPlaySession())) {
        gestureResumeWanted = true;
        bindGestureUnlock();
        // Preload so the next tap can play() synchronously
        try {
          var sKeep = loadPlaySession();
          var iKeep = sKeep ? resolveSessionIndex(sKeep) : state.index;
          var tKeep = sKeep && typeof sKeep.t === "number" ? sKeep.t : pendingSeekTo;
          primeAudioTrack(iKeep, tKeep);
        } catch (ePrime) {}
        if (isSitewidePlay()) {
          syncSitewideChip(pendingResume || resumeIntent ? "点一下任意处续播" : "");
          updateChipUi();
          showResumeChip();
        } else if (isDashboard() && isCoarsePointer()) {
          setStatus("点一下任意处可续播");
        }
      }
      return;
    }
    var sess = resumePending || loadPlaySession();
    resumePending = null;
    if (sessionWantsResume(sess) || resumeIntent) {
      if (isDashboard() || isSitewidePlay()) {
        resumeAttempted = true;
        resumeIntent = true;
        var idx = sess ? resolveSessionIndex(sess) : state.index;
        var t = sess && typeof sess.t === "number" ? sess.t : 0;
        if ((!t || t < 0.5) && pendingSeekTo > 0.5) t = pendingSeekTo;
        if ((!t || t < 0.5) && audio && lastSrcId && sess && sess.id === lastSrcId && isFinite(audio.currentTime)) {
          t = audio.currentTime;
        }
        if (t > 0.5) pendingSeekTo = t;
        state.index = idx;
        state.playing = false;
        updatePlayBtn();
        updateMeta();
        renderList();
        // Prime src first so gesture path can play() sync; then try programmatic play.
        gestureResumeWanted = true;
        bindGestureUnlock();
        primeAudioTrack(idx, t);
        playAt(idx, true, t);
        if (isSitewidePlay()) {
          showResumeChip(audio && !audio.paused ? "" : "点一下任意处续播");
          syncSitewideChip(audio && !audio.paused ? "" : "点一下任意处续播");
        }
        setTimeout(function () {
          if (audio && audio.paused && (resumeIntent || sessionWantsResume(loadPlaySession()))) {
            if (pendingSeekTo > 0.5) {
              try {
                if (isFinite(audio.duration) && audio.duration > 0 && Math.abs(audio.currentTime - pendingSeekTo) > 1.25) {
                  audio.currentTime = Math.min(pendingSeekTo, audio.duration - 0.25);
                }
              } catch (e0) {}
            }
            gestureResumeWanted = true;
            markPendingResume(true);
            schedulePlayRetries("resume");
            if (isDashboard() && isCoarsePointer()) setStatus("点一下任意处可续播");
            else if (isSitewidePlay()) syncSitewideChip("点一下任意处续播");
          }
        }, 220);
        return;
      }
    }
    if (sess && sess.id && typeof sess.t === "number" && sess.t > 0.5) {
      resumeAttempted = true;
      var idx2 = resolveSessionIndex(sess);
      state.index = idx2;
      pendingSeekTo = sess.t;
      // Still try auto-play on mobile if session had been playing; gesture unlock backs it up
      var forcePlay = !!(sess.playing || sess.intent || resumeIntent);
      if (forcePlay) {
        gestureResumeWanted = true;
        bindGestureUnlock();
        primeAudioTrack(idx2, sess.t);
      }
      playAt(idx2, forcePlay, sess.t);
      updatePlayBtn();
      if (isSitewidePlay()) showResumeChip();
      return;
    }
    var c = cfg();
    if (c.autoplay && isDashboard() && state.tracks.length) {
      resumeAttempted = true;
      resumeIntent = true;
      gestureResumeWanted = true;
      bindGestureUnlock();
      primeAudioTrack(state.index, 0);
      playAt(state.index, true);
      setTimeout(function () {
        if (audio && audio.paused) {
          gestureResumeWanted = true;
          schedulePlayRetries("autoplay");
          if (isCoarsePointer()) setStatus("点一下任意处开始播放");
        }
      }, 300);
    } else if (isSitewidePlay()) {
      syncSitewideChip();
      showResumeChip();
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

    // 全站播放 / 仪表盘：引擎可跑；卡片仅仪表盘；sitewide 时 chip 常显
    if (!shouldShowCard()) {
      hideCardUi();
    } else {
      buildUi();
      // Soft place: never detach card from a connected host (prevents layout jump/flash)
      if (!placeInDashboard(root)) {
        root.classList.add("ucwc-music-hidden");
      } else {
        root.classList.remove("ucwc-music-hidden");
      }
      updateSidePanel();
      if (els.vol) els.vol.value = String(Math.round(state.volume * 100));
      updateModeBtns();
      // Sync button to live audio after cross-page mount
      if (audio && audio.paused) state.playing = false;
      updatePlayBtn();
      updateMeta();
      if (state.tracks.length) {
        loadLyricsForCurrent();
        loadCoverForCurrent();
      }
    }

    if (!shouldRunEngine()) return;

    ensureAudio().volume = state.volume;
    // Mobile / autoplay-policy: bind unlock early so first tap after nav works
    bindGestureUnlock();
    if (isSitewidePlay()) showResumeChip();

    var earlySess = loadPlaySession();
    if (sessionWantsResume(earlySess) || !!(cfg().autoplay && isDashboard())) {
      resumeIntent = true;
      gestureResumeWanted = true;
      bindGestureUnlock();
    }

    // Sitewide: chip always present (dashboard included)
    if (isSitewidePlay()) {
      syncSitewideChip();
      showResumeChip();
    }

    if (!state.loaded) {
      resumePending = earlySess || loadPlaySession();
      // Prefill index from session so first paint isn't track 0
      if (resumePending && typeof resumePending.index === "number") {
        state.index = resumePending.index;
        if (typeof resumePending.t === "number" && resumePending.t > 0.5) pendingSeekTo = resumePending.t;
      } else if (resumePending && resumePending.id) {
        // id resolve after list
      }
      fetchList();
    } else if (isSitewidePlay() || isDashboard()) {
      var sess = earlySess || loadPlaySession();
      if (audio && !audio.paused) {
        syncSitewideChip();
        updateChipUi();
        updateMeta();
        if (isSitewidePlay()) showResumeChip();
      } else if (!resumeAttempted && (sessionWantsResume(sess) || resumeIntent)) {
        maybeResumeOrAutoplay();
      } else if (isSitewidePlay()) {
        syncSitewideChip();
        showResumeChip();
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
      window.addEventListener(
        "resize",
        function () {
          scheduleMarqueeRefresh();
        },
        { passive: true }
      ); // ucwc-music-marquee-resize
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
      // Only re-place if host missing; avoid thrashing DOM (flash + snap-to-first)
      var need =
        shouldShowCard() &&
        (!document.getElementById("ucwc-music-dash-host") ||
          !document.getElementById("ucwc-music-card") ||
          (document.getElementById("ucwc-music-dash-host") &&
            !document.getElementById("ucwc-music-dash-host").parentNode));
      if (need || n < 2) mount();
      else if (shouldShowCard() && root) placeInDashboard(root);
      if (++n >= 10) {
        clearInterval(mountTimer);
        mountTimer = null;
      }
    }, 900);
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
