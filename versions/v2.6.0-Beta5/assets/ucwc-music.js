/**
 * ThemeEffects music player V1 — dashboard card + local source
 * Reads window.__UCWC_THEME__.music ; streams via /plugins/theme.effects/ucwc-music-api.php
 */
(function (global) {
  "use strict";

  var LS_KEY = "ucwc_music_v1";
  var PLAY_KEY = "ucwc_music_play_v1";
  var apiBase = "/plugins/theme.effects/ucwc-music-api.php";
  var state = {
    tracks: [],
    index: 0,
    playing: false,
    shuffle: false,
    repeat: "off", // off | one | all
    volume: 0.7,
    collapsed: false,
    listOpen: false,
    loaded: false,
    error: "",
  };
  var audio = null;
  var root = null;
  var els = {};
  var seeking = false;
  var bootDone = false;
  var playPersistTimer = null;
  var resumePending = null;

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
      // Unraid often uses /Dashboard
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
      sessionStorage.setItem(
        PLAY_KEY,
        JSON.stringify({
          playing: playing,
          index: state.index,
          t: audio && isFinite(audio.currentTime) ? audio.currentTime : 0,
          id: t && t.id ? t.id : "",
          ts: Date.now(),
        })
      );
    } catch (e) {}
  }

  function loadPlaySession() {
    try {
      var raw = sessionStorage.getItem(PLAY_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function clearPlaySession() {
    try {
      sessionStorage.removeItem(PLAY_KEY);
    } catch (e) {}
  }

  function schedulePlayPersist() {
    if (playPersistTimer) return;
    playPersistTimer = setTimeout(function () {
      playPersistTimer = null;
      savePlaySession();
    }, 800);
  }

  function stopEngine(clearSession) {
    if (audio) {
      try {
        audio.pause();
      } catch (e0) {}
    }
    state.playing = false;
    updatePlayBtn();
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
      if (typeof o.listOpen === "boolean") state.listOpen = o.listOpen;
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
          listOpen: state.listOpen,
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

  function updateMeta() {
    var t = current();
    if (!els.title) return;
    if (!t) {
      els.title.textContent = state.loaded ? "曲库为空" : "加载中…";
      els.sub.textContent = state.error || "本地音乐";
      return;
    }
    els.title.textContent = t.title || "未知曲目";
    var bits = [];
    if (t.artist) bits.push(t.artist);
    if (t.album) bits.push(t.album);
    els.sub.textContent = bits.length ? bits.join(" · ") : t.ext || "本地";
    updateLyricsPlaceholder();
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
      // keep SVG; optional one-badge via title only in V1
      if (!els.repeat.querySelector("svg")) els.repeat.innerHTML = svgIcon("repeat");
    }
  }

  function updateLyricsPlaceholder() {
    if (!els.lyricsLine) return;
    var t = current();
    if (!t) {
      els.lyricsLine.textContent = "—";
      return;
    }
    // V1: no LRC yet — show soft placeholder using title as center line
    els.lyricsLine.textContent = t.title || "暂无歌词";
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
      b.textContent = (t.artist ? t.artist + " — " : "") + (t.title || t.id);
      b.addEventListener("click", (function (idx) {
        return function () {
          playAt(idx, true);
        };
      })(i));
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
    saveLs();
    savePlaySession();
    if (autoPlay) {
      var p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          setStatus(isDashboard() ? "浏览器阻止自动播放，请点播放" : "页面切换后续播被浏览器拦截，请回仪表盘点播放");
          state.playing = false;
          updatePlayBtn();
          savePlaySession();
        });
      }
    }
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
      if (p && typeof p.catch === "function") p.catch(function () {
        setStatus("无法播放");
      });
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
        if (state.repeat === "all" || fromEnded && state.repeat === "all") n = 0;
        else if (fromEnded && state.repeat === "off") {
          state.playing = false;
          updatePlayBtn();
          return;
        } else if (!fromEnded) n = 0;
        else {
          state.playing = false;
          updatePlayBtn();
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
    root.className = "ucwc-dash-music-tile";
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
      '  <div class="ucwc-music-head">' +
      '    <div class="ucwc-music-art" aria-hidden="true">♪</div>' +
      '    <div class="ucwc-music-meta">' +
      '      <div class="ucwc-music-title">…</div>' +
      '      <div class="ucwc-music-sub"></div>' +
      "    </div>" +
      "  </div>" +
      '  <div class="ucwc-music-progress-wrap">' +
      '    <span class="ucwc-music-time cur">0:00</span>' +
      '    <input type="range" class="ucwc-music-seek" min="0" max="1000" value="0" aria-label="进度">' +
      '    <span class="ucwc-music-time end">0:00</span>' +
      "  </div>" +
      '  <div class="ucwc-music-controls">' +
      '    <div class="ucwc-music-btns">' +
      '      <button type="button" class="ucwc-music-btn shuffle" title="随机" aria-label="随机"></button>' +
      '      <button type="button" class="ucwc-music-btn prev" title="上一首" aria-label="上一首"></button>' +
      '      <button type="button" class="ucwc-music-btn primary play" title="播放" aria-label="播放"></button>' +
      '      <button type="button" class="ucwc-music-btn next" title="下一首" aria-label="下一首"></button>' +
      '      <button type="button" class="ucwc-music-btn repeat" title="循环：关" aria-label="循环"></button>' +
      '      <button type="button" class="ucwc-music-btn list" title="曲目列表" aria-label="曲目列表"></button>' +
      "    </div>" +
      '    <div class="ucwc-music-vol" title="音量">' +
      '      <span class="ucwc-music-vol-slot" aria-hidden="true"></span>' +
      '      <input type="range" min="0" max="100" value="70" aria-label="音量">' +
      "    </div>" +
      "  </div>" +
      '  <div class="ucwc-music-lyrics" aria-live="polite">' +
      '    <div class="ucwc-music-lyrics-line">—</div>' +
      '    <div class="ucwc-music-lyrics-hint">歌词区域（后续版本支持 LRC）</div>' +
      "  </div>" +
      '  <div class="ucwc-music-status"></div>' +
      '  <div class="ucwc-music-list" role="listbox" aria-label="曲目列表"></div>' +
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
    els.lyricsLine = root.querySelector(".ucwc-music-lyrics-line");
    // Seed SVG icons (stable geometry vs emoji)
    if (els.shuffle) els.shuffle.innerHTML = svgIcon("shuffle");
    if (els.prev) els.prev.innerHTML = svgIcon("prev");
    if (els.play) els.play.innerHTML = svgIcon("play");
    if (els.next) els.next.innerHTML = svgIcon("next");
    if (els.repeat) els.repeat.innerHTML = svgIcon("repeat");
    if (els.listBtn) els.listBtn.innerHTML = svgIcon("list");
    var volSlot = root.querySelector(".ucwc-music-vol-slot");
    if (volSlot) volSlot.innerHTML = svgIcon("vol");

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
      state.listOpen = !state.listOpen;
      root.classList.toggle("ucwc-music-list-open", state.listOpen);
      saveLs();
    });
    els.close.addEventListener("click", function () {
      state.collapsed = true;
      // 本次会话隐藏卡片并停止播放（避免无 UI 后台偷播）
      hideCardUi();
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
    els.seek.addEventListener("touchstart", function () {
      seeking = true;
    }, { passive: true });
    function commitSeek() {
      seeking = false;
      if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
      var r = parseInt(els.seek.value, 10) / 1000;
      audio.currentTime = Math.max(0, Math.min(audio.duration, r * audio.duration));
    }
    els.seek.addEventListener("mouseup", commitSeek);
    els.seek.addEventListener("touchend", commitSeek);
    els.seek.addEventListener("change", commitSeek);

    // Only mount on dashboard; mount() retries when dash DOM is late
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
      .catch(function (e) {
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
    // localStorage overrides cfg for UX continuity
    loadLs();
  }

  function maybeResumeOrAutoplay() {
    if (!state.tracks.length) return;
    var sess = resumePending || loadPlaySession();
    resumePending = null;
    if (sess && sess.playing) {
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
      var t = typeof sess.t === "number" ? sess.t : 0;
      // 全站：非仪表盘页静默续播；仅仪表盘：只有在仪表盘才播
      if (isDashboard() || isSitewidePlay()) {
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
      stopEngine(true);
      return;
    }

    applyCfgDefaults();

    // 仅仪表盘播放：离开仪表盘时停播并清会话
    if (!isDashboard() && !isSitewidePlay()) {
      hideCardUi();
      stopEngine(true);
      return;
    }

    // 全站播放 / 仪表盘：引擎可跑；卡片仅仪表盘
    if (!shouldShowCard()) {
      hideCardUi();
    } else {
      buildUi();
      if (!placeInDashboard(root)) {
        root.classList.add("ucwc-music-hidden");
      } else {
        root.classList.remove("ucwc-music-hidden");
      }
      root.classList.toggle("ucwc-music-list-open", !!state.listOpen);
      if (els.vol) els.vol.value = String(Math.round(state.volume * 100));
      updateModeBtns();
      updatePlayBtn();
      updateMeta();
    }

    if (!shouldRunEngine()) return;

    ensureAudio().volume = state.volume;
    if (!state.loaded) {
      // 若有未过期播放会话，优先按会话续播
      resumePending = loadPlaySession();
      fetchList();
    } else if (isSitewidePlay() || isDashboard()) {
      // 已加载曲库时，若会话要求播放但当前暂停，尝试续
      var sess = loadPlaySession();
      if (sess && sess.playing && audio && audio.paused) {
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
    // 跨页续播：离开页面前写入 sessionStorage（Unraid 多为整页跳转）
    try {
      window.addEventListener("pagehide", function () {
        savePlaySession();
      });
      window.addEventListener("beforeunload", function () {
        savePlaySession();
      });
    } catch (e0) {}
    mount();
    // dashboard tiles may load late
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
