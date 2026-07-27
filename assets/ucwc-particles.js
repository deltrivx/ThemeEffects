/**
 * UCWC canvas particles — ported from DockerOps particles.js for Unraid WebUI.
 * Controlled via window.UcwcParticles.applyPrefs(prefs).
 * Canvas: #ucwc-particles (auto-created). Never captures pointer events.
 */
(function () {
  "use strict";

  function ensureCanvas() {
    var el = document.getElementById("ucwc-particles");
    if (el) return el;
    el = document.createElement("canvas");
    el.id = "ucwc-particles";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;display:none;";
    var parent = document.body || document.documentElement;
    if (parent.firstChild) parent.insertBefore(el, parent.firstChild);
    else parent.appendChild(el);
    return el;
  }

  var canvas = ensureCanvas();
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");

  var api = {
    enabled: false,
    count: 60,
    reduceMotion: false,
    running: false,
  };

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var particles = [];
  var mouse = { x: null, y: null };
  var animationId = 0;
  var dpr = 1;
  var resizeTimer = 0;

  function cssSize() {
    return {
      w: Math.max(window.innerWidth || document.documentElement.clientWidth || 1, 1),
      h: Math.max(window.innerHeight || document.documentElement.clientHeight || 1, 1),
    };
  }

  function isMobile() {
    return (window.innerWidth || 0) < 768;
  }

  function shouldRun() {
    return api.enabled && !api.reduceMotion && !document.hidden;
  }

  function resizeCanvas() {
    var size = cssSize();
    var w = size.w;
    var h = size.h;
    // Cap DPR for Windows ANGLE cost
    dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1 : 1.5);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function Particle() {
    this.reset(true);
  }

  Particle.prototype.reset = function (initial) {
    var size = cssSize();
    var w = size.w;
    var h = size.h;
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    if (!initial) {
      var edge = Math.floor(Math.random() * 4);
      if (edge === 0) {
        this.x = 0;
        this.y = Math.random() * h;
      } else if (edge === 1) {
        this.x = w;
        this.y = Math.random() * h;
      } else if (edge === 2) {
        this.x = Math.random() * w;
        this.y = 0;
      } else {
        this.x = Math.random() * w;
        this.y = h;
      }
    }
    this.size = Math.random() * 2.8 + 1.2;
    this.speedX = (Math.random() - 0.5) * 0.75;
    this.speedY = (Math.random() - 0.5) * 0.75;
    this.opacity = Math.random() * 0.4 + 0.4;
    this.hue = Math.random() > 0.5 ? "purple" : "cyan";
  };

  Particle.prototype.update = function () {
    var size = cssSize();
    var w = size.w;
    var h = size.h;
    this.x += this.speedX;
    this.y += this.speedY;
    if (mouse.x !== null) {
      var dx = mouse.x - this.x;
      var dy = mouse.y - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 140 && dist > 0.01) {
        var force = (140 - dist) / 140;
        this.x -= (dx / dist) * force * 2.0;
        this.y -= (dy / dist) * force * 2.0;
      }
    }
    if (this.x < -12 || this.x > w + 12 || this.y < -12 || this.y > h + 12) {
      this.reset(false);
    }
  };

  Particle.prototype.draw = function () {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    if (this.hue === "cyan") {
      ctx.fillStyle = "rgba(0, 243, 255, " + this.opacity + ")";
      ctx.shadowColor = "rgba(0, 243, 255, 0.65)";
    } else {
      ctx.fillStyle = "rgba(167, 139, 250, " + this.opacity + ")";
      ctx.shadowColor = "rgba(108, 92, 231, 0.7)";
    }
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  function targetCount() {
    var size = cssSize();
    var area = size.w * size.h;
    var auto = Math.floor(area / 9000);
    var n = api.count || 60;
    if (isMobile()) n = Math.round(n * 0.5);
    // Conservative caps vs DockerOps (max 120)
    return Math.max(20, Math.min(Math.max(n, Math.min(auto, 100)), 120));
  }

  function initParticles() {
    particles = [];
    var count = targetCount();
    for (var i = 0; i < count; i++) particles.push(new Particle());
  }

  function drawLinks() {
    var maxDist = 110;
    var len = particles.length;
    // Skip dense linking on mobile
    if (isMobile() || len > 100) {
      maxDist = 90;
    }
    for (var i = 0; i < len; i++) {
      for (var j = i + 1; j < len; j++) {
        var a = particles[i];
        var b = particles[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var d = dx * dx + dy * dy;
        if (d < maxDist * maxDist) {
          var dist = Math.sqrt(d);
          var alpha = (1 - dist / maxDist) * 0.24;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(140, 120, 255, " + alpha + ")";
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    if (!api.running) return;
    var size = cssSize();
    ctx.clearRect(0, 0, size.w, size.h);
    drawLinks();
    for (var i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
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
    canvas.style.pointerEvents = "none";
    resizeCanvas();
    initParticles();
    if (!api.running) {
      api.running = true;
      animate();
    }
  }

  function stop() {
    api.running = false;
    cancelAnimationFrame(animationId);
    try {
      var size = cssSize();
      ctx.clearRect(0, 0, size.w, size.h);
    } catch (e) {}
  }

  function applyPrefs(prefs) {
    if (!prefs || typeof prefs !== "object") {
      start();
      return;
    }
    if (typeof prefs.particles === "boolean") api.enabled = prefs.particles;
    if (typeof prefs.particles_count === "number") {
      api.count = Math.max(30, Math.min(120, prefs.particles_count));
    }
    if (typeof prefs.reduce_motion === "boolean") api.reduceMotion = prefs.reduce_motion;

    var root = document.documentElement;
    var body = document.body;
    if (body) {
      body.classList.toggle("ucwc-reduce-motion", !!api.reduceMotion);
      body.classList.toggle("ucwc-particles-on", !!api.enabled && !api.reduceMotion);
    }
    if (root) {
      root.classList.toggle("ucwc-reduce-motion", !!api.reduceMotion);
      root.style.setProperty(
        "--ucwc-particle-opacity",
        api.enabled && !api.reduceMotion ? "1" : "0"
      );
    }
    if (typeof prefs.hutao === "boolean" && root) {
      root.classList.toggle("ucwc-hutao-off", !prefs.hutao);
    }

    stop();
    start();
  }

  window.UcwcParticles = { applyPrefs: applyPrefs, start: start, stop: stop, api: api };

  // Boot from loader-injected prefs if present
  var boot = window.__UCWC_THEME__ || {};
  if (typeof boot.particles === "boolean") api.enabled = boot.particles;
  if (typeof boot.particles_count === "number") api.count = boot.particles_count;
  if (typeof boot.reduce_motion === "boolean") api.reduceMotion = boot.reduce_motion;
  if (typeof boot.hutao === "boolean" && document.documentElement) {
    document.documentElement.classList.toggle("ucwc-hutao-off", !boot.hutao);
  }

  resizeCanvas();
  start();

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!shouldRun()) return;
      resizeCanvas();
      initParticles();
      if (!api.running) start();
    }, 120);
  });
  document.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  document.addEventListener("mouseleave", function () {
    mouse.x = null;
    mouse.y = null;
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (shouldRun()) start();
  });
})();
