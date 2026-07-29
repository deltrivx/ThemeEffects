/**
 * UCWC mouse effects — soft glow / ring / light trail for Unraid WebUI.
 * Controlled via window.UcwcMouseFx.applyPrefs(prefs) and window.__UCWC_THEME__.
 * Canvas: #ucwc-mouse-fx (auto-created). Never captures pointer events.
 */
(function () {
  "use strict";

  function ensureCanvas() {
    var el = document.getElementById("ucwc-mouse-fx");
    if (el) return el;
    el = document.createElement("canvas");
    el.id = "ucwc-mouse-fx";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;display:none;";
    var parent = document.body || document.documentElement;
    parent.appendChild(el);
    return el;
  }

  var canvas = ensureCanvas();
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");

  var boot = window.__UCWC_THEME__ || {};
  var api = {
    enabled: !!boot.mouse_fx,
    style: boot.mouse_style || "glow",
    size: typeof boot.mouse_size === "number" ? boot.mouse_size : 80,
    intensity: typeof boot.mouse_intensity === "number" ? boot.mouse_intensity : 55,
    color: boot.mouse_color || "",
    clickRipple: boot.mouse_click_ripple !== false,
    reduceMotion: !!boot.reduce_motion,
    running: false,
  };

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, inside: false };
  var ripples = [];
  var trail = [];
  var animationId = 0;
  var dpr = 1;
  var resizeTimer = 0;
  var lastMove = 0;

  function cssSize() {
    return {
      w: Math.max(window.innerWidth || document.documentElement.clientWidth || 1, 1),
      h: Math.max(window.innerHeight || document.documentElement.clientHeight || 1, 1),
    };
  }

  function isMobile() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
    } catch (e0) {}
    return (window.innerWidth || 0) < 768;
  }

  function shouldRun() {
    if (!api.enabled || api.reduceMotion || document.hidden) return false;
    if (isMobile()) return false;
    return true;
  }

  function parseColor(raw) {
    var c = String(raw || "").trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) {
      if (c.length === 4) {
        return {
          r: parseInt(c[1] + c[1], 16),
          g: parseInt(c[2] + c[2], 16),
          b: parseInt(c[3] + c[3], 16),
        };
      }
      return {
        r: parseInt(c.slice(1, 3), 16),
        g: parseInt(c.slice(3, 5), 16),
        b: parseInt(c.slice(5, 7), 16),
      };
    }
    // auto: cyber cyan
    return { r: 0, g: 243, b: 255 };
  }

  function resizeCanvas() {
    var size = cssSize();
    var w = size.w;
    var h = size.h;
    var lowPerf = false;
    try {
      var rootEl = document.documentElement;
      lowPerf = !!(
        rootEl &&
        (rootEl.classList.contains("ucwc-perf-low") || rootEl.classList.contains("ucwc-no-gpu"))
      );
    } catch (e0) {}
    var cap = lowPerf ? 1 : 1.5;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function radiusBase() {
    var n = parseInt(api.size, 10);
    if (isNaN(n)) n = 80;
    n = Math.max(40, Math.min(160, n));
    return n;
  }

  function alphaBase() {
    var n = parseInt(api.intensity, 10);
    if (isNaN(n)) n = 55;
    n = Math.max(15, Math.min(100, n));
    return n / 100;
  }

  function drawGlow(x, y, r, a, rgb) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a * 0.55 + ")");
    g.addColorStop(0.35, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a * 0.22 + ")");
    g.addColorStop(0.7, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a * 0.06 + ")");
    g.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRing(x, y, r, a, rgb) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a * 0.7 + ")";
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    ctx.shadowColor = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a * 0.85 + ")";
    ctx.shadowBlur = r * 0.35;
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawGlow(x, y, r * 0.55, a * 0.55, rgb);
  }

  function pushTrail(x, y) {
    trail.push({ x: x, y: y, life: 1 });
    if (trail.length > 18) trail.shift();
  }

  function drawTrail(rgb, a) {
    for (var i = 0; i < trail.length; i++) {
      var p = trail[i];
      p.life *= 0.88;
      var t = p.life;
      if (t < 0.04) continue;
      var rr = radiusBase() * 0.22 * t;
      drawGlow(p.x, p.y, rr, a * t * 0.9, rgb);
    }
    while (trail.length && trail[0].life < 0.04) trail.shift();
  }

  function drawRipples(rgb) {
    var next = [];
    for (var i = 0; i < ripples.length; i++) {
      var rp = ripples[i];
      rp.t += 0.035;
      if (rp.t >= 1) continue;
      var ease = 1 - Math.pow(1 - rp.t, 2);
      var rr = rp.r0 + ease * rp.r1;
      var aa = (1 - rp.t) * rp.a;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + aa + ")";
      ctx.lineWidth = Math.max(1, 2.5 * (1 - rp.t));
      ctx.shadowColor = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + aa + ")";
      ctx.shadowBlur = 12;
      ctx.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      next.push(rp);
    }
    ripples = next;
  }

  function animate() {
    if (!api.running) return;
    var size = cssSize();
    ctx.clearRect(0, 0, size.w, size.h);

    // smooth follow
    if (mouse.inside) {
      mouse.x += (mouse.tx - mouse.x) * 0.28;
      mouse.y += (mouse.ty - mouse.y) * 0.28;
    }

    var rgb = parseColor(api.color);
    var a = alphaBase();
    var r = radiusBase();
    var style = String(api.style || "glow").toLowerCase();

    if (mouse.inside) {
      if (style === "ring") {
        drawRing(mouse.x, mouse.y, r, a, rgb);
      } else if (style === "trail") {
        pushTrail(mouse.x, mouse.y);
        drawTrail(rgb, a);
        drawGlow(mouse.x, mouse.y, r * 0.55, a * 0.75, rgb);
      } else {
        drawGlow(mouse.x, mouse.y, r, a, rgb);
      }
    } else if (style === "trail" && trail.length) {
      drawTrail(rgb, a);
    }

    if (ripples.length) drawRipples(rgb);

    if (!mouse.inside && !ripples.length && !(style === "trail" && trail.length)) {
      // idle clear — keep loop cheap when cursor left
    }

    animationId = requestAnimationFrame(animate);
  }

  function start() {
    if (!shouldRun()) {
      stop();
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";
    canvas.style.visibility = "visible";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2147483000";
    resizeCanvas();
    if (!api.running) {
      api.running = true;
      animate();
    }
  }

  function stop() {
    api.running = false;
    cancelAnimationFrame(animationId);
    trail = [];
    ripples = [];
    try {
      var size = cssSize();
      ctx.clearRect(0, 0, size.w, size.h);
    } catch (e) {}
    canvas.style.display = "none";
  }

  function onMove(e) {
    if (!api.enabled || api.reduceMotion) return;
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    if (!mouse.inside) {
      mouse.x = mouse.tx;
      mouse.y = mouse.ty;
    }
    mouse.inside = true;
    lastMove = Date.now();
  }

  function onLeave() {
    mouse.inside = false;
    trail = [];
  }

  function onDown(e) {
    if (!api.enabled || api.reduceMotion || !api.clickRipple) return;
    if (e.button != null && e.button !== 0) return;
    var r = radiusBase();
    ripples.push({
      x: e.clientX,
      y: e.clientY,
      t: 0,
      r0: Math.max(8, r * 0.12),
      r1: r * 0.95,
      a: alphaBase() * 0.85,
    });
    if (ripples.length > 6) ripples.shift();
    if (!api.running) start();
  }

  function onVis() {
    if (document.hidden) stop();
    else start();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (api.running) resizeCanvas();
    }, 80);
  }

  function applyPrefs(prefs) {
    if (!prefs || typeof prefs !== "object") {
      start();
      return;
    }
    if (typeof prefs.mouse_fx === "boolean") api.enabled = prefs.mouse_fx;
    else if (typeof prefs.mouseFx === "boolean") api.enabled = prefs.mouseFx;
    if (typeof prefs.mouse_style === "string") api.style = prefs.mouse_style;
    if (typeof prefs.mouse_size === "number") {
      api.size = Math.max(40, Math.min(160, prefs.mouse_size));
    }
    if (typeof prefs.mouse_intensity === "number") {
      api.intensity = Math.max(15, Math.min(100, prefs.mouse_intensity));
    }
    if (typeof prefs.mouse_color === "string") api.color = prefs.mouse_color;
    if (typeof prefs.mouse_click_ripple === "boolean") api.clickRipple = prefs.mouse_click_ripple;
    if (typeof prefs.reduce_motion === "boolean") api.reduceMotion = prefs.reduce_motion;

    // soft-cap on low perf class
    try {
      var root = document.documentElement;
      if (root && root.classList.contains("ucwc-perf-low") && api.enabled) {
        api.intensity = Math.min(api.intensity, 40);
        api.size = Math.min(api.size, 70);
      }
    } catch (e1) {}

    if (api.enabled && !api.reduceMotion) start();
    else stop();
  }

  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("mousedown", onDown, { passive: true });
  window.addEventListener("mouseleave", onLeave, { passive: true });
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget && !e.toElement) onLeave();
  });
  window.addEventListener("blur", onLeave, { passive: true });
  document.addEventListener("visibilitychange", onVis, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  window.UcwcMouseFx = {
    applyPrefs: applyPrefs,
    start: start,
    stop: stop,
    api: api,
  };

  // boot from Loader theme blob
  try {
    applyPrefs({
      mouse_fx: !!boot.mouse_fx,
      mouse_style: boot.mouse_style || "glow",
      mouse_size: typeof boot.mouse_size === "number" ? boot.mouse_size : 80,
      mouse_intensity: typeof boot.mouse_intensity === "number" ? boot.mouse_intensity : 55,
      mouse_color: boot.mouse_color || "",
      mouse_click_ripple: boot.mouse_click_ripple !== false,
      reduce_motion: !!boot.reduce_motion,
    });
  } catch (eBoot) {
    start();
  }
})();
