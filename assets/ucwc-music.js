/**
 * ThemeEffects music player V1 — dashboard card + local source
 * Reads window.__UCWC_THEME__.music ; streams via /plugins/theme.effects/ucwc-music-api.php
 */
(function (global) {
  "use strict";

  var LS_KEY = "ucwc_music_v1";
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

  function shouldShow() {
    if (!enabled()) return false;
    var c = cfg();
    if (c.dash_only === false) return true;
    return isDashboard();
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
    els.play.innerHTML = state.playing ? "❚❚" : "▶";
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
      els.repeat.textContent = state.repeat === "one" ? "①" : "↻";
    }
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
    });
    audio.addEventListener("pause", function () {
      state.playing = false;
      updatePlayBtn();
    });
    audio.addEventListener("error", function () {
      setStatus("播放失败（格式或路径）");
      state.playing = false;
      updatePlayBtn();
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
  }

  function onEnded() {
    if (state.repeat === "one") {
      playAt(state.index, true);
      return;
    }
    next(true);
  }

  function playAt(idx, autoPlay) {
    if (!state.tracks.length) return;
    state.index = ((idx % state.tracks.length) + state.tracks.length) % state.tracks.length;
    var t = current();
    if (!t) return;
    var a = ensureAudio();
    a.src = trackUrl(t.id);
    updateMeta();
    saveLs();
    if (autoPlay) {
      var p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          setStatus("浏览器阻止自动播放，请点播放");
          state.playing = false;
          updatePlayBtn();
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

  function buildUi() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "ucwc-music-card";
    root.innerHTML =
      '<div class="ucwc-music-head">' +
      '  <div class="ucwc-music-art" aria-hidden="true">♪</div>' +
      '  <div class="ucwc-music-meta">' +
      '    <div class="ucwc-music-title">…</div>' +
      '    <div class="ucwc-music-sub"></div>' +
      "  </div>" +
      '  <button type="button" class="ucwc-music-close" title="隐藏本次（刷新后仍可显示）" aria-label="隐藏">×</button>' +
      "</div>" +
      '<div class="ucwc-music-progress-wrap">' +
      '  <span class="ucwc-music-time cur">0:00</span>' +
      '  <input type="range" class="ucwc-music-seek" min="0" max="1000" value="0" aria-label="进度">' +
      '  <span class="ucwc-music-time end">0:00</span>' +
      "</div>" +
      '<div class="ucwc-music-controls">' +
      '  <div class="ucwc-music-btns">' +
      '    <button type="button" class="ucwc-music-btn shuffle" title="随机">🔀</button>' +
      '    <button type="button" class="ucwc-music-btn prev" title="上一首">⏮</button>' +
      '    <button type="button" class="ucwc-music-btn primary play" title="播放">▶</button>' +
      '    <button type="button" class="ucwc-music-btn next" title="下一首">⏭</button>' +
      '    <button type="button" class="ucwc-music-btn repeat" title="循环：关">↻</button>' +
      '    <button type="button" class="ucwc-music-btn list" title="曲目列表">☰</button>' +
      "  </div>" +
      '  <div class="ucwc-music-vol" title="音量">' +
      '    <span aria-hidden="true">🔊</span>' +
      '    <input type="range" min="0" max="100" value="70" aria-label="音量">' +
      "  </div>" +
      "</div>" +
      '<div class="ucwc-music-status"></div>' +
      '<div class="ucwc-music-list" role="listbox" aria-label="曲目列表"></div>';

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
      root.classList.add("ucwc-music-hidden");
      if (audio && !audio.paused) audio.pause();
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

    (document.body || document.documentElement).appendChild(root);
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
        var c = cfg();
        if (c.autoplay && state.tracks.length) {
          playAt(state.index, true);
        } else if (state.tracks.length) {
          // preload metadata of current only when user hits play
          updateMeta();
        }
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

  function mount() {
    if (!shouldShow()) {
      if (root) root.classList.add("ucwc-music-hidden");
      return;
    }
    applyCfgDefaults();
    buildUi();
    root.classList.remove("ucwc-music-hidden");
    root.classList.toggle("ucwc-music-list-open", !!state.listOpen);
    if (els.vol) els.vol.value = String(Math.round(state.volume * 100));
    ensureAudio().volume = state.volume;
    updateModeBtns();
    updatePlayBtn();
    updateMeta();
    if (!state.loaded) fetchList();
  }

  function destroy() {
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch (e) {}
    }
    if (root && root.parentNode) root.parentNode.removeChild(root);
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
    // CSS may already be linked by Loader; ensure once
    if (!document.getElementById("ucwc-music-css")) {
      // optional — Loader usually injects link
    }
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
