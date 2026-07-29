/**
 * ThemeEffects music player — dashboard card + sitewide engine
 * Layout: left cover/meta + buttons; progress/controls under buttons (full width of btn row);
 *         right panel toggles 曲目 ⇄ 歌词 (default 曲目). Local LRC sidecar sync.
 * Cross-page: localStorage play session + first-gesture unlock + off-dash resume chip.
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
  };
  var audio = null;
  var root = null;
  var chip = null;
  var els = {};
  var seeking = false;
  var bootDone = false;
  var playPersistTimer = null;
  var resumePending = null;
  var gestureBound = false;
  var gestureResumeWanted = false;
  var lyricsSyncLast = 0;

  function cfg() {
    var t = global.__UCWC_THEME__ || {};
    return t.music || {};
  }

  function enabled() {
    var c = cfg();
    return !!c.enable && (c.source || "local") === "local" && (c.ui || "card") === "card";
  }

  function isDashboard() {
    try {
      if (document.querySelector("table.dashboard")) return true;
      var p = (location.pathname || "").toLowerCase();
      if (p === "/" || p === "/dashboard" || p.indexOf("/dashboard") >= 0) return true;
      if (p.indexOf("dashboard") >= 0) return true;
      var title = (document.title || "").toLowerCase();
      if (title.indexOf("dashboard") >= 0 || title.indexOf("仪表盘") >= 0) return true;
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
    return cfg().dash_only === false;
  }

  function shouldShowCard() {
    return enabled() && isDashboard() && !state.collapsed;
  }

  function shouldRunEngine() {
    if (!enabled()) return false;
    if (isDashboard()) return true;
    return isSitewidePlay();
  }

  function savePlaySession() {
    try {
      var t = current();
      var playing = !!(audio && !audio.paused);
      var payload = JSON.stringify({
        playing: playing,
        index: state.index,
        t: audio && isFinite(audio.currentTime) ? audio.currentTime : 0,
        id: t && t.id ? t.id : "",
        vol: state.volume,
        ts: Date.now(),
      });
      // sessionStorage: same-tab nav; localStorage: survives some Unraid full reloads better
      try {
        sessionStorage.setItem(PLAY_KEY, payload);
      } catch (e0) {}
      try {
        localStorage.setItem(PLAY_KEY, payload);
      } catch (e1) {}
    } catch (e) {}
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
    if (audio) {
      try {
        audio.pause();
      } catch (e0) {}
    }
    state.playing = false;
    updatePlayBtn();
    hideResumeChip();
    if (clearSession) clearPlaySession();
    else savePlaySession();
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
    chip = null;
  }

  function showResumeChip(label) {
    if (!isSitewidePlay() || isDashboard() || state.collapsed) {
      hideResumeChip();
      return;
    }
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.id = "ucwc-music-resume-chip";
      chip.className = "ucwc-music-resume-chip";
      chip.setAttribute("aria-label", "继续播放音乐");
      chip.addEventListener("click", function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch (e0) {}
        gestureResumeWanted = true;
        tryResumeFromSession(true);
      });
      try {
        document.body.appendChild(chip);
      } catch (e1) {
        chip = null;
        return;
      }
    }
    var t = current();
    var name = (t && t.title) || "音乐";
    chip.innerHTML =
      '<span class="ucwc-music-chip-ico" aria-hidden="true">♪</span>' +
      '<span class="ucwc-music-chip-txt">' +
      (label || "继续播放") +
      " · " +
      escapeHtml(name) +
      "</span>";
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
    var once = function () {
      if (!gestureResumeWanted) return;
      gestureResumeWanted = false;
      tryResumeFromSession(true);
    };
    var opts = { capture: true, passive: true };
    try {
      document.addEventListener(
        "pointerdown",
        function () {
          once();
        },
        opts
      );
      document.addEventListener(
        "keydown",
        function () {
          once();
        },
        opts
      );
      document.addEventListener(
        "touchstart",
        function () {
          once();
        },
        opts
      );
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
    if (!els.play) return;
    els.play.innerHTML = state.playing ? svgIcon("pause") : svgIcon("play");
    els.play.setAttribute("title", state.playing ? "暂停" : "播放");
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
      els.lyricsHint.textContent = hint || "将同名 .lrc 放在音频旁即可显示歌词";
    }
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
          ? "加载歌词…"
          : "暂无歌词（同名 .lrc 与音频放同目录）";
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
    if (!els.lyricsScroll || !state.lyrics.lines || !state.lyrics.lines.length) return;
    if (!audio) return;
    var now = Date.now();
    if (!force && now - lyricsSyncLast < 120) return;
    lyricsSyncLast = now;
    var tMs = Math.floor((audio.currentTime || 0) * 1000) - (state.lyrics.offsetMs || 0);
    var idx = findLyricIndex(tMs);
    if (idx === state.lyrics.active && !force) return;
    var prev = state.lyrics.active;
    state.lyrics.active = idx;
    var nodes = els.lyricsScroll.querySelectorAll(".ucwc-music-lrc-line");
    if (prev >= 0 && nodes[prev]) nodes[prev].classList.remove("active");
    if (idx >= 0 && nodes[idx]) {
      nodes[idx].classList.add("active");
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
      els.lyricsHint.textContent = "加载歌词…";
    }
    fetch(apiBase + "?action=lyrics&id=" + encodeURIComponent(t.id) + "&_ts=" + Date.now(), {
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
        renderLyricsLines();
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
      if (t.has_lrc) {
        b.innerHTML =
          '<span class="ucwc-music-item-txt"></span><span class="ucwc-music-item-lrc" title="有歌词">词</span>';
        b.querySelector(".ucwc-music-item-txt").textContent = label;
      } else {
        b.textContent = label;
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
    audio.preload = "metadata";
    audio.volume = state.volume;
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", function () {
      state.playing = true;
      updatePlayBtn();
      savePlaySession();
      hideResumeChip();
      gestureResumeWanted = false;
    });
    audio.addEventListener("pause", function () {
      state.playing = false;
      updatePlayBtn();
      savePlaySession();
    });
    audio.addEventListener("error", function () {
      setStatus("播放失败（格式或路径）");
      state.playing = false;
      updatePlayBtn();
      savePlaySession();
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

  function playAt(idx, autoPlay, startAt) {
    if (!state.tracks.length) return;
    state.index = ((idx % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var t = current();
    if (!t) return;
    var a = ensureAudio();
    a.src = trackUrl(t.id);
    var seekTo = typeof startAt === "number" && isFinite(startAt) && startAt > 0 ? startAt : 0;
    if (seekTo > 0) {
      var applySeek = function () {
        try {
          if (isFinite(a.duration) && a.duration > 0) {
            a.currentTime = Math.min(seekTo, Math.max(0, a.duration - 0.25));
          } else {
            a.currentTime = seekTo;
          }
        } catch (e0) {}
        a.removeEventListener("loadedmetadata", applySeek);
      };
      a.addEventListener("loadedmetadata", applySeek);
    }
    updateMeta();
    loadLyricsForCurrent();
    saveLs();
    savePlaySession();
    if (autoPlay) {
      var p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          state.playing = false;
          updatePlayBtn();
          // Keep playing intent so next user gesture can unlock
          try {
            var sess = loadPlaySession() || {};
            sess.playing = true;
            sess.index = state.index;
            sess.t = seekTo;
            sess.id = t.id || "";
            sess.ts = Date.now();
            var raw = JSON.stringify(sess);
            try {
              sessionStorage.setItem(PLAY_KEY, raw);
            } catch (eS) {}
            try {
              localStorage.setItem(PLAY_KEY, raw);
            } catch (eL) {}
          } catch (e2) {}
          gestureResumeWanted = true;
          bindGestureUnlock();
          if (isDashboard()) {
            setStatus("浏览器阻止自动播放，请点播放或任意处点击以续播");
          } else {
            setStatus("");
            showResumeChip("继续播放");
          }
        });
      }
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

  function tryResumeFromSession(forcePlay) {
    if (!state.tracks.length) return false;
    if (!isDashboard() && !isSitewidePlay()) return false;
    var sess = resumePending || loadPlaySession();
    if (!sess || !sess.playing) return false;
    var idx = resolveSessionIndex(sess);
    var t = typeof sess.t === "number" ? sess.t : 0;
    playAt(idx, !!forcePlay || true, t);
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
      var p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          setStatus("无法播放");
          gestureResumeWanted = true;
          bindGestureUnlock();
          if (!isDashboard()) showResumeChip("继续播放");
        });
      }
    } else {
      a.pause();
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
          updatePlayBtn();
          clearPlaySession();
          return;
        } else if (!fromEnded) n = 0;
        else {
          state.playing = false;
          updatePlayBtn();
          clearPlaySession();
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

  function placeInDashboard(card) {
    if (!card || !isDashboard()) return false;
    var host = findDashHost();
    if (!host) return false;
    var wrap = document.getElementById("ucwc-music-dash-host");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "ucwc-music-dash-host";
      var firstTile =
        host.querySelector(
          "table.dashboard, table.share_status.dashboard, .grid-stack-item, .tile, table.unraid, .title"
        ) || host.firstChild;
      if (firstTile && firstTile.parentNode === host) {
        host.insertBefore(wrap, firstTile);
      } else if (host.firstChild) {
        host.insertBefore(wrap, host.firstChild);
      } else {
        host.appendChild(wrap);
      }
    }
    wrap.classList.remove("ucwc-music-sitewide");
    if (card.parentNode !== wrap) {
      wrap.appendChild(card);
    }
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
      '        <div class="ucwc-music-art" aria-hidden="true">♪</div>' +
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
      '            <div class="ucwc-music-status"></div>' +
      "          </div>" +
      "        </div>" +
      "      </div>" +
      "    </div>" +
      '    <div class="ucwc-music-right">' +
      '      <div class="ucwc-music-side-head"><span class="ucwc-music-side-label">曲目</span></div>' +
      '      <div class="ucwc-music-side-body">' +
      '        <div class="ucwc-music-list" role="listbox" aria-label="曲目列表"></div>' +
      '        <div class="ucwc-music-lyrics" aria-live="polite">' +
      '          <div class="ucwc-music-lyrics-scroll"></div>' +
      '          <div class="ucwc-music-lyrics-hint">将同名 .lrc 放在音频旁即可显示歌词</div>' +
      "        </div>" +
      "      </div>" +
      "    </div>" +
      "  </div>" +
      "</div>";

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
    var sess = resumePending || loadPlaySession();
    resumePending = null;
    if (sess && sess.playing) {
      if (isDashboard() || isSitewidePlay()) {
        var idx = resolveSessionIndex(sess);
        var t = typeof sess.t === "number" ? sess.t : 0;
        playAt(idx, true, t);
        return;
      }
    }
    var c = cfg();
    if (c.autoplay && isDashboard() && state.tracks.length) {
      playAt(state.index, true);
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
      if (state.tracks.length) loadLyricsForCurrent();
    }

    if (!shouldRunEngine()) return;

    ensureAudio().volume = state.volume;
    bindGestureUnlock();

    if (!state.loaded) {
      resumePending = loadPlaySession();
      fetchList();
    } else if (isSitewidePlay() || isDashboard()) {
      var sess = loadPlaySession();
      if (sess && sess.playing && (!audio || audio.paused)) {
        maybeResumeOrAutoplay();
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
    state.loaded = false;
  }

  function boot() {
    if (bootDone) {
      mount();
      return;
    }
    bootDone = true;
    // 跨页：整页跳转前把进度写入 localStorage + sessionStorage
    try {
      window.addEventListener("pagehide", function () {
        savePlaySession();
      });
      window.addEventListener("beforeunload", function () {
        savePlaySession();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") savePlaySession();
      });
    } catch (e0) {}
    mount();
    var n = 0;
    var t = setInterval(function () {
      mount();
      if (++n >= 20) clearInterval(t);
    }, 500);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") mount();
    });
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
      boot();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
