/**
 * Theme Effects page UI — markdown form row toggle + AJAX save + version management.
 * Layout matches GitHub v1.8.3 (Unraid markdown Label: / : field / buttons-spaced).
 * Apply reliability: AJAX to ucwc-theme-fx-save.php (urlencoded unless wallpaper upload).
 *
 * Apply button notes (Unraid BodyInlineJS):
 *  - On ready it disables input[value=应用|Apply]
 *  - It re-enables only on select/text/number/checkbox/radio/file/textarea change
 *  - input[type=range] is NOT watched, so we enable ourselves
 *  - Our script loads in page body BEFORE BodyInlineJS, so enable must run late
 *  - .lock class is exempt from BodyInlineJS disable in many builds
 */
(function () {
  "use strict";

  function hideRow(el, hide) {
    if (!el) return;
    var i, n, dd, dt, next, tr, dl;

    function mark(node, on) {
      if (!node) return;
      if (on) {
        node.classList.add("ucwc-row-hidden");
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("line-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("gap", "0", "important");
      } else {
        node.classList.remove("ucwc-row-hidden");
        [
          "display",
          "height",
          "margin",
          "padding",
          "border",
          "visibility",
          "max-height",
          "line-height",
          "overflow",
          "min-height",
          "gap",
        ].forEach(function (p) {
          node.style.removeProperty(p);
        });
      }
    }

    function isHelpish(node) {
      if (!node || node.nodeType !== 1) return false;
      if (node.tagName === "BLOCKQUOTE" || node.tagName === "P") return true;
      if (
        node.classList &&
        (node.classList.contains("help") || node.classList.contains("inline_help"))
      )
        return true;
      if (node.querySelector && node.querySelector("select,input,textarea,button")) return false;
      var t = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!t) return true;
      return !node.querySelector || !node.querySelector("select,input,textarea,button,a[href]");
    }

    function hideFollowingHelp(from, on) {
      var cur = from ? from.nextElementSibling : null;
      while (cur) {
        if (cur.tagName === "DL" || cur.tagName === "TABLE" || cur.tagName === "FORM") break;
        if (cur.tagName === "TR" && cur.querySelector && cur.querySelector("select,input,textarea,button"))
          break;
        if (
          isHelpish(cur) ||
          cur.tagName === "BLOCKQUOTE" ||
          (cur.classList && cur.classList.contains("inline_help"))
        ) {
          mark(cur, on);
          cur = cur.nextElementSibling;
          continue;
        }
        if (!(cur.textContent || "").replace(/\s+/g, "").length) {
          mark(cur, on);
          cur = cur.nextElementSibling;
          continue;
        }
        break;
      }
    }

    // Prefer whole DL: Unraid markdown makes one <dl> per field + following help
    n = el;
    for (i = 0; i < 14 && n; i++) {
      if (n.tagName === "DL") {
        dl = n;
        var controls = dl.querySelectorAll("select,input,textarea,button");
        if (controls.length > 1) {
          dd = null;
          var p = el;
          for (var j = 0; j < 10 && p && p !== dl; j++) {
            if (p.tagName === "DD") {
              dd = p;
              break;
            }
            p = p.parentNode;
          }
          if (dd) {
            mark(dd, hide);
            dt = dd.previousElementSibling;
            while (dt && dt.tagName !== "DT" && dt.tagName !== "DD") dt = dt.previousElementSibling;
            if (dt && dt.tagName === "DT") mark(dt, hide);
            return;
          }
        }
        mark(dl, hide);
        hideFollowingHelp(dl, hide);
        return;
      }
      if (n.tagName === "TR") {
        tr = n;
        mark(tr, hide);
        next = tr.nextElementSibling;
        while (next && next.tagName === "TR") {
          if (next.querySelector && next.querySelector("select,input,textarea,button")) break;
          mark(next, hide);
          next = next.nextElementSibling;
        }
        hideFollowingHelp(tr, hide);
        return;
      }
      // pure-HTML grid fallback (legacy)
      if (n.classList && n.classList.contains("ucwc-fx-field")) {
        mark(n, hide);
        var prev = n.previousElementSibling;
        if (prev && prev.classList && prev.classList.contains("ucwc-fx-label")) mark(prev, hide);
        var nx = n.nextElementSibling;
        if (nx && nx.classList && nx.classList.contains("ucwc-fx-help")) mark(nx, hide);
        return;
      }
      if (n.tagName === "FORM" || n.tagName === "TABLE") break;
      n = n.parentNode;
    }

    // fallback: DD/DT
    dd = null;
    n = el;
    for (i = 0; i < 12 && n; i++) {
      if (n.tagName === "DD") {
        dd = n;
        break;
      }
      if (n.tagName === "DL" || n.tagName === "FORM") break;
      n = n.parentNode;
    }
    if (!dd) {
      mark(el, hide);
      return;
    }
    mark(dd, hide);
    dt = dd.previousElementSibling;
    while (dt && dt.tagName !== "DT" && dt.tagName !== "DD") dt = dt.previousElementSibling;
    if (dt && dt.tagName === "DT") mark(dt, hide);
    hideFollowingHelp(dd, hide);
  }

  function findForm() {
    var f = document.getElementById("ucwc-fx-form");
    if (f) return f;
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector('select[name="BG_MODE"]')) return forms[i];
    }
    return null;
  }

  function applyButtons(form) {
    if (!form) return [];
    var list = [];
    var save = form.querySelector("#ucwc-btn-save");
    if (save) list.push(save);
    var all = form.querySelectorAll('input[type="submit"], button[type="submit"]');
    for (var i = 0; i < all.length; i++) {
      var v = (all[i].value || all[i].textContent || "").trim();
      if (
        v === "应用" ||
        v === "Apply" ||
        v === "应用中…" ||
        v === "Applying…" ||
        all[i].id === "ucwc-btn-save" ||
        all[i].name === "SAVE_THEME_FX"
      ) {
        if (list.indexOf(all[i]) < 0) list.push(all[i]);
      }
    }
    return list;
  }

  function setApplyLabel(btn, text) {
    if (!btn) return;
    if (btn.tagName === "BUTTON") btn.textContent = text;
    else btn.value = text;
  }

  /** Unlock Apply — BodyInlineJS disables input[value=应用|Apply] after our first run */
  function enableApply(form, switchDone) {
    form = form || findForm();
    if (!form) return;
    try {
      var btns = applyButtons(form);
      for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = false;
        btns[i].removeAttribute("disabled");
        btns[i].classList.add("lock");
      }
      if (switchDone) {
        var done = form.querySelectorAll(
          '#ucwc-btn-done, input[type="button"][value="完成"], input[type="button"][value="Done"], input[value="重置"], input[value="Reset"]'
        );
        for (var j = 0; j < done.length; j++) {
          var dv = (done[j].value || "").trim();
          if (dv === "完成" || dv === "Done") {
            done[j].value = dv === "Done" ? "Reset" : "重置";
            done[j].onclick = null;
            done[j].removeAttribute("onclick");
            (function (btn) {
              btn.addEventListener(
                "click",
                function (e) {
                  e.preventDefault();
                  try {
                    if (typeof refresh === "function") refresh(0);
                    else window.location.reload();
                  } catch (err) {
                    window.location.reload();
                  }
                },
                { once: true }
              );
            })(done[j]);
          }
        }
      }
    } catch (e) {}
  }

  function syncUi() {
    try {
      var form = findForm();
      var root = form || document;
      var mode = root.querySelector('select[name="BG_MODE"]');
      var slot = root.querySelector('select[name="BG_LOCAL_SLOT"]');
      var gal = root.querySelector('select[name="BG_GALLERY"]');
      var upload = root.querySelector('input[name="BG_UPLOAD"]');
      var apiEl = root.querySelector('input[name="BG_CUSTOM_API"]');
      var hutao = root.querySelector('select[name="HUTAO"]');
      var hutaoType = root.querySelector('select[name="HUTAO_TYPE"]');
      var hutaoUpload = root.querySelector('input[name="HUTAO_UPLOAD"]');
      var hutaoSize = root.querySelector('select[name="HUTAO_SIZE"]');
      var hutaoPos = root.querySelector('select[name="HUTAO_POS"]');
      var hutaoBlur = root.querySelector('select[name="HUTAO_BLUR"]');
      var particles = root.querySelector('select[name="PARTICLES"]');
      var pCount = root.querySelector('input[name="PARTICLES_COUNT"]');
      var reduce = root.querySelector('select[name="REDUCE_MOTION"]');
      var isLocal = !mode || mode.value === "local";
      var hutaoOn = !!(hutao && hutao.value === "yes");
      var hutaoCustom = !!(hutaoOn && hutaoType && hutaoType.value === "custom");
      var particlesOn = !!(particles && particles.value === "yes");

      hideRow(slot, !isLocal);
      hideRow(upload, !(isLocal && slot && slot.value === "custom"));
      hideRow(gal, isLocal);
      hideRow(apiEl, !(!isLocal && gal && gal.value === "custom"));
      hideRow(hutaoType, !hutaoOn);
      hideRow(hutaoUpload, !hutaoCustom);
      hideRow(hutaoSize, !hutaoOn);
      hideRow(hutaoPos, !hutaoOn);
      hideRow(hutaoBlur, !hutaoOn);
      hideRow(pCount, !particlesOn);
      hideRow(reduce, !particlesOn);

      var countVal = document.getElementById("ucwc-count-val");
      if (pCount && countVal) countVal.textContent = String(pCount.value);
    } catch (e) {}
  }

  function bindFormUi() {
    try {
      var form = findForm();
      if (!form) return;

      try {
        // Default urlencoded: multipart without a file hangs nginx/php-fpm on Tower.
        form.setAttribute("enctype", "application/x-www-form-urlencoded");
        form.enctype = "application/x-www-form-urlencoded";
        form.method = "POST";
        form.setAttribute("method", "POST");
        form.setAttribute("action", "/Settings/ThemeEffects");
      } catch (e) {}

      try {
        if (!form.querySelector('input[name="csrf_token"]')) {
          var tok0 =
            (typeof window.csrf_token === "string" && window.csrf_token) ||
            (typeof csrf_token === "string" && csrf_token) ||
            "";
          if (tok0) {
            var ci = document.createElement("input");
            ci.type = "hidden";
            ci.name = "csrf_token";
            ci.value = tok0;
            form.appendChild(ci);
          }
        }
      } catch (e) {}

      function hasUploadFile() {
        var bg = form.querySelector('input[name="BG_UPLOAD"]');
        var mascot = form.querySelector('input[name="HUTAO_UPLOAD"]');
        return !!(
          (bg && bg.files && bg.files.length > 0) ||
          (mascot && mascot.files && mascot.files.length > 0)
        );
      }

      function prepareSubmit() {
        try {
          if (hasUploadFile()) {
            form.setAttribute("enctype", "multipart/form-data");
            form.enctype = "multipart/form-data";
          } else {
            form.setAttribute("enctype", "application/x-www-form-urlencoded");
            form.enctype = "application/x-www-form-urlencoded";
          }
        } catch (e) {}

        enableApply(form, false);

        var range = form.querySelector('input[name="PARTICLES_COUNT"]');
        if (range) {
          var n = parseInt(range.value, 10);
          if (isNaN(n)) n = 60;
          if (n < 30) n = 30;
          if (n > 120) n = 120;
          range.value = String(n);
          range.setAttribute("value", String(n));
        }

        // Ensure SAVE_THEME_FX is present for AJAX (native submit also has name on input)
        var flag = form.querySelector('input[name="SAVE_THEME_FX"]');
        if (!flag) {
          flag = document.createElement("input");
          flag.type = "hidden";
          flag.name = "SAVE_THEME_FX";
          flag.id = "ucwc-save-flag";
          flag.value = "1";
          form.appendChild(flag);
        } else {
          flag.disabled = false;
          flag.removeAttribute("disabled");
          if (flag.type === "hidden" || flag.type === "submit") {
            if (flag.type === "hidden") flag.value = "1";
          }
        }

        try {
          var csrfEl = form.querySelector('input[name="csrf_token"]');
          var tok =
            (typeof window.csrf_token === "string" && window.csrf_token) ||
            (typeof csrf_token === "string" && csrf_token) ||
            "";
          if (tok) {
            if (!csrfEl) {
              csrfEl = document.createElement("input");
              csrfEl.type = "hidden";
              csrfEl.name = "csrf_token";
              form.appendChild(csrfEl);
            }
            csrfEl.disabled = false;
            csrfEl.value = tok;
          }
        } catch (e) {}
      }

      var saveInFlight = false;

      form.addEventListener("submit", function (ev) {
        prepareSubmit();

        var file = form.querySelector('input[name="BG_UPLOAD"]');
        var slot = form.querySelector('select[name="BG_LOCAL_SLOT"]');
        var mode = form.querySelector('select[name="BG_MODE"]');
        var uploading =
          mode &&
          mode.value === "local" &&
          slot &&
          slot.value === "custom" &&
          hasUploadFile();

        if (uploading) {
          var f = file.files[0];
          if (f && f.size > 12 * 1024 * 1024) {
            ev.preventDefault();
            alert(
              "自定义壁纸过大（" +
                (f.size / 1024 / 1024).toFixed(1) +
                "MB）。请压缩到 12MB 以内再上传。"
            );
            return false;
          }
        }

        ev.preventDefault();
        if (saveInFlight) return false;

        var save = document.getElementById("ucwc-btn-save") || applyButtons(form)[0];
        if (save) {
          save.disabled = false;
          save.removeAttribute("disabled");
          setApplyLabel(save, "应用中…");
        }

        saveInFlight = true;
        var tok =
          (typeof window.csrf_token === "string" && window.csrf_token) ||
          (typeof csrf_token === "string" && csrf_token) ||
          "";
        var headers = { "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/html;q=0.8" };
        if (tok) headers["X-CSRF-TOKEN"] = tok;

        var body;
        if (uploading) {
          try {
            form.enctype = "multipart/form-data";
            form.setAttribute("enctype", "multipart/form-data");
          } catch (e0) {}
          body = new FormData(form);
          body.set("SAVE_THEME_FX", "1");
          if (tok) body.set("csrf_token", tok);
        } else {
          try {
            form.enctype = "application/x-www-form-urlencoded";
            form.setAttribute("enctype", "application/x-www-form-urlencoded");
          } catch (e1) {}
          var params = new URLSearchParams();
          var els = form.querySelectorAll("input, select, textarea");
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (!el.name || el.disabled) continue;
            if (el.type === "file") continue;
            if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
            if (el.type === "submit" || el.type === "button") continue;
            params.append(el.name, el.value == null ? "" : String(el.value));
          }
          // submit named SAVE_THEME_FX may be skipped above (type=submit) — always set
          params.set("SAVE_THEME_FX", "1");
          if (tok) params.set("csrf_token", tok);
          body = params.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }

        fetch("/plugins/custom.css/ucwc-theme-fx-save.php", {
          method: "POST",
          body: body,
          credentials: "same-origin",
          headers: headers,
          redirect: "follow",
        })
          .then(function (r) {
            return r.text().then(function (t) {
              return { ok: r.ok, status: r.status, url: r.url || "", text: t || "" };
            });
          })
          .then(function (res) {
            saveInFlight = false;
            var text = res.text || "";
            var json = null;
            try {
              json = JSON.parse(text);
            } catch (e0) {
              var i = text.indexOf("{");
              var k = text.lastIndexOf("}");
              if (i >= 0 && k > i) {
                try {
                  json = JSON.parse(text.slice(i, k + 1));
                } catch (e1) {}
              }
            }

            function goApplied(path) {
              var u = path || "/Settings/ThemeEffects?applied=1";
              if (u.indexOf("_ts=") < 0) {
                u += (u.indexOf("?") >= 0 ? "&" : "?") + "_ts=" + Date.now();
              }
              try {
                window.location.replace(u);
              } catch (e) {
                window.location.href = u;
              }
            }

            function looksLikeLoginPage(html, finalUrl) {
              if (finalUrl && /\/login(\.php)?(\?|$)/i.test(finalUrl)) return true;
              if (!html) return false;
              if (/name=["']BG_MODE["']/i.test(html) && /ThemeEffects/i.test(html)) return false;
              if (/id=["']ucwc-fx-form["']/i.test(html)) return false;
              if (/ucwc-btn-save/i.test(html) && /ThemeEffects/i.test(html)) return false;
              return (
                /name=["']username["']/i.test(html) &&
                /name=["']password["']/i.test(html) &&
                (/action=["'][^"']*login/i.test(html) ||
                  /id=["']login/i.test(html) ||
                  /<title>[^<]*login/i.test(html))
              );
            }

            if (json && typeof json === "object") {
              if (json.ok) {
                goApplied(json.redirect || "/Settings/ThemeEffects?applied=1");
                return;
              }
              alert(json.message || json.error || "保存失败。");
              if (save) setApplyLabel(save, "应用");
              enableApply(form, false);
              if (json.saved) {
                setTimeout(function () {
                  goApplied(json.redirect || "/Settings/ThemeEffects?applied=1");
                }, 600);
              }
              return;
            }

            if (res.status === 401 || res.status === 403 || looksLikeLoginPage(text, res.url)) {
              alert("未登录或会话已过期，请重新登录 Unraid。");
              if (save) setApplyLabel(save, "应用");
              enableApply(form, false);
              return;
            }
            if (!res.ok && res.status >= 500) {
              alert("保存失败（HTTP " + res.status + "）。请稍后重试。");
              if (save) setApplyLabel(save, "应用");
              enableApply(form, false);
              return;
            }
            goApplied("/Settings/ThemeEffects?applied=1");
          })
          .catch(function (err) {
            saveInFlight = false;
            alert("保存失败：" + (err && err.message ? err.message : err));
            if (save) setApplyLabel(save, "应用");
            enableApply(form, false);
          });

        return false;
      });

      var saveBtn = document.getElementById("ucwc-btn-save") || applyButtons(form)[0];
      if (saveBtn) {
        saveBtn.classList.add("lock");
        saveBtn.addEventListener("click", function () {
          prepareSubmit();
          saveBtn.disabled = false;
          saveBtn.removeAttribute("disabled");
        });
      }

      function onDirty() {
        syncUi();
        enableApply(form, true);
      }

      [
        "BG_MODE",
        "BG_LOCAL_SLOT",
        "BG_GALLERY",
        "HUTAO",
        "HUTAO_TYPE",
        "PARTICLES",
        "HUTAO_SIZE",
        "HUTAO_POS",
        "HUTAO_BLUR",
        "REDUCE_MOTION",
        "BG_BLUR",
      ].forEach(function (name) {
        var el = form.querySelector('select[name="' + name + '"]');
        if (el) {
          el.addEventListener("change", onDirty);
          el.addEventListener("input", onDirty);
        }
      });

      var range = form.querySelector('input[name="PARTICLES_COUNT"]');
      if (range) {
        range.addEventListener("input", onDirty);
        range.addEventListener("change", onDirty);
        range.addEventListener("pointerup", onDirty);
        range.addEventListener("touchend", onDirty);
      }

      var fileInput = form.querySelector('input[name="BG_UPLOAD"]');
      if (fileInput) fileInput.addEventListener("change", onDirty);
      var mascotInput = form.querySelector('input[name="HUTAO_UPLOAD"]');
      if (mascotInput) mascotInput.addEventListener("change", onDirty);

      var apiEl = form.querySelector('input[name="BG_CUSTOM_API"]');
      if (apiEl) {
        apiEl.addEventListener("input", onDirty);
        apiEl.addEventListener("change", onDirty);
      }

      form.addEventListener("input", onDirty);
      form.addEventListener("change", onDirty);

      syncUi();

      function lateUnlock() {
        enableApply(form, false);
        syncUi();
      }
      lateUnlock();
      setTimeout(lateUnlock, 0);
      setTimeout(lateUnlock, 50);
      setTimeout(lateUnlock, 200);
      setTimeout(lateUnlock, 600);
      setTimeout(lateUnlock, 1200);

      try {
        if (window.jQuery) {
          window.jQuery(function () {
            setTimeout(lateUnlock, 0);
            setTimeout(lateUnlock, 200);
          });
        }
      } catch (e) {}

      try {
        if (saveBtn && window.MutationObserver) {
          var moTimer = 0;
          var mo = new MutationObserver(function () {
            if (!saveBtn.disabled) return;
            if (moTimer) return;
            moTimer = setTimeout(function () {
              moTimer = 0;
              saveBtn.disabled = false;
              saveBtn.removeAttribute("disabled");
            }, 0);
          });
          mo.observe(saveBtn, { attributes: true, attributeFilter: ["disabled"] });
        }
      } catch (e) {}
    } catch (e) {}
  }

  /* ---------- version management ---------- */
  var API = "/plugins/custom.css/ucwc-update.php";
  var boot = window.__UCWC_FX_BOOT__ || {};
  var LOCAL_VERSION = boot.version || "";
  var panel, mask, body, actions, title;
  var busy = false;
  var cache = { versions: null, latest: "", selected: "" };
  var READ_ACTIONS = {
    status: 1,
    check_update: 1,
    changelog: 1,
    list_versions: 1,
    job_status: 1,
  };

  function csrfToken() {
    var nodes = document.querySelectorAll('input[name="csrf_token"]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].value) return nodes[i].value;
    }
    if (typeof csrf_token === "string" && csrf_token) return csrf_token;
    if (typeof window.csrf_token === "string" && window.csrf_token) return window.csrf_token;
    try {
      if (window.top && typeof window.top.csrf_token === "string" && window.top.csrf_token) {
        return window.top.csrf_token;
      }
    } catch (e0) {}
    try {
      var m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return "";
  }

  function setBusy(on, text) {
    busy = !!on;
    if (panel) panel.classList.toggle("busy", busy);
    if (on && text) {
      var p = document.getElementById("ucwc-busy-msg");
      if (p) p.textContent = text;
    }
  }

  function openPanel(t) {
    if (!panel || !mask) return;
    title.textContent = t || "版本管理";
    panel.style.display = "block";
    mask.style.display = "block";
  }
  function closePanel() {
    if (busy) return;
    if (panel) panel.style.display = "none";
    if (mask) mask.style.display = "none";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function chips(v) {
    if (!v) return "";
    var c = [];
    if (v.channel === "latest") c.push("最新");
    if (v.id && v.id === LOCAL_VERSION) c.push("当前");
    if (v.theme_effects) c.push("主题特效");
    if (v.apps_enhancement) c.push("应用增强");
    if (v.particles) c.push("粒子");
    if (v.hutao) c.push("胡桃");
    return c
      .map(function (x) {
        return '<span class="ucwc-chip">' + esc(x) + "</span>";
      })
      .join("");
  }

  function parseJsonResponse(t) {
    var j = null;
    try {
      j = JSON.parse(t);
    } catch (e) {}
    if (!j) {
      var i = t.indexOf("{");
      var k = t.lastIndexOf("}");
      if (i >= 0 && k > i) {
        try {
          j = JSON.parse(t.slice(i, k + 1));
        } catch (e2) {}
      }
    }
    return j;
  }

  function api(action, extra, timeoutMs) {
    var isRead = !!READ_ACTIONS[action];
    var opts = {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
      cache: "no-store",
    };
    var url = API + "?UCWC_ACTION=" + encodeURIComponent(action) + "&_ts=" + Date.now();
    var ctrl = null;
    var timer = 0;
    // Install must return job_id quickly; long work is background. Soft timeout avoids eternal 3%.
    // Reads (check_update) may hit GitHub via proxy — keep generous but not multi-minute.
    var ms = timeoutMs != null ? timeoutMs : isRead ? 20000 : 12000;
    if (typeof AbortController !== "undefined" && ms > 0) {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () {
        try {
          ctrl.abort();
        } catch (e0) {}
      }, ms);
    }

    if (isRead) {
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          if (extra[k] != null) url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
        });
      }
      opts.method = "GET";
    } else {
      var fd = new FormData();
      fd.append("UCWC_ACTION", action);
      var token = csrfToken();
      if (token) {
        fd.append("csrf_token", token);
        opts.headers["X-CSRF-TOKEN"] = token;
      }
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          if (extra[k] != null) fd.append(k, extra[k]);
        });
      }
      opts.method = "POST";
      opts.body = fd;
      url = API + "?UCWC_ACTION=" + encodeURIComponent(action);
    }

    return fetch(url, opts)
      .then(function (r) {
      return r.text().then(function (t) {
        if (r.status === 302 || (/<html/i.test(t) && /login/i.test(t))) {
          throw new Error("未登录或会话已过期，请重新登录 Unraid。");
        }
        if (!t || !String(t).trim()) {
          throw new Error(
            isRead
              ? "接口空响应（可能被重定向或 PHP 错误）。"
              : "接口空响应：写操作需要有效 CSRF。请刷新页面后重试。"
          );
        }
        var j = parseJsonResponse(t);
        if (!j) throw new Error("接口返回非 JSON：" + String(t).slice(0, 120));
        if (!r.ok && !j.ok) throw new Error(j.error || j.message || "HTTP " + r.status);
        return j;
      });
    })
      .catch(function (e) {
        if (e && (e.name === "AbortError" || /aborted/i.test(String(e.message || e)))) {
          throw new Error(
            "请求超时（>" +
              Math.round(ms / 1000) +
              "s）。若卡在启动，请刷新后重试；安装已改为后台任务，通常应在数秒内返回 job_id。"
          );
        }
        throw e;
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function updateBar(data) {
    var cur = document.getElementById("ucwc-bar-current");
    var latest = document.getElementById("ucwc-bar-latest");
    var extra = document.getElementById("ucwc-bar-extra");
    if (!data) return;
    if (data.local) {
      LOCAL_VERSION = data.local.version || LOCAL_VERSION;
      if (cur) {
        cur.textContent = data.local.installed
          ? data.local.version || "已安装（版本未知）"
          : "未安装";
      }
      if (extra) {
        extra.textContent = data.local.updated_at ? " · 安装于 " + data.local.updated_at : "";
      }
    }
    if (latest && data.latest_version) {
      var tip = " · 远程最新 " + data.latest_version;
      if (data.update_available) tip += "（有可用更新）";
      else if (data.local && data.local.installed && data.local.version === data.latest_version)
        tip += "（已是最新）";
      latest.textContent = tip;
    }
  }

  function showCheck(data) {
    openPanel("检测更新");
    updateBar(data);
    var local = data.local || {};
    var latestMeta = data.latest || {};
    var html = "";
    html += "<p>当前：" + esc(local.installed ? local.version || "未知" : "未安装");
    if (local.updated_at) html += "（" + esc(local.updated_at) + "）";
    html += "</p>";
    html += "<p>远程最新：<strong>" + esc(data.latest_version || "-") + "</strong>";
    if (latestMeta.label) html += " — " + esc(latestMeta.label);
    if (latestMeta.released_at) html += "（" + esc(latestMeta.released_at) + "）";
    html += "<br>" + chips(latestMeta || {}) + "</p>";
    if (data.update_available) {
      html +=
        '<p class="ucwc-ok">发现新版本，可升级到最新版（完整安装，等同脚本菜单 1）。</p>';
    } else if (local.installed) {
      html += '<p class="ucwc-ok">已是最新版。仍可重新安装最新包以修复文件。</p>';
    } else {
      html += '<p class="ucwc-warn">本地未检测到主题安装，可一键安装最新版。</p>';
    }
    // 进度/日志由 ensureProgressUi 统一创建在进度条下方，避免重复 id 导致日志写到隐藏节点
    body.innerHTML = html;
    actions.innerHTML = "";
    var btn = document.createElement("input");
    btn.type = "button";
    btn.value = data.update_available ? "升级到最新版" : "重新安装最新版";
    btn.addEventListener("click", function () {
      runInstall("install_latest", "");
    });
    actions.appendChild(btn);
    var btn2 = document.createElement("input");
    btn2.type = "button";
    btn2.value = "关闭";
    btn2.addEventListener("click", closePanel);
    actions.appendChild(btn2);
  }

  function showChangelog(data, preselect) {
    openPanel("更新日志");
    cache.versions = data.versions || [];
    cache.latest = data.latest_version || "";
    var sel =
      preselect ||
      (data.selected && data.selected.id) ||
      cache.latest ||
      (cache.versions[0] && cache.versions[0].id) ||
      "";
    cache.selected = sel;
    renderChangelog();
  }

  function renderChangelog() {
    var versions = cache.versions || [];
    var sel = cache.selected;
    var cur = null;
    var list = versions
      .map(function (v) {
        if (v.id === sel) cur = v;
        var cls = "ucwc-ver-item" + (v.id === sel ? " active" : "");
        return (
          '<button type="button" class="' +
          cls +
          '" data-id="' +
          esc(v.id) +
          '"><strong>' +
          esc(v.id) +
          "</strong> · " +
          esc(v.released_at || "") +
          "<br>" +
          esc(v.label || "") +
          "<br>" +
          chips(v) +
          "</button>"
        );
      })
      .join("");
    var log = (cur && (cur.changelog || cur.label)) || "暂无该版本说明。";
    body.innerHTML =
      '<div style="display:grid;grid-template-columns:minmax(200px,42%) 1fr;gap:12px">' +
      '<div style="max-height:360px;overflow:auto">' +
      list +
      "</div>" +
      '<div><div class="ucwc-log">' +
      esc(log) +
      "</div></div></div>";
    Array.prototype.forEach.call(body.querySelectorAll(".ucwc-ver-item"), function (el) {
      el.addEventListener("click", function () {
        cache.selected = el.getAttribute("data-id");
        renderChangelog();
      });
    });
    actions.innerHTML = "";
    var go = document.createElement("input");
    go.type = "button";
    go.value = "安装此版本";
    go.addEventListener("click", function () {
      var id = cache.selected || "";
      if (!id) return;
      var meta = null;
      for (var i = 0; i < (cache.versions || []).length; i++) {
        if (cache.versions[i].id === id) {
          meta = cache.versions[i];
          break;
        }
      }
      var tip = "确定安装 " + id + " ？将覆盖当前主题文件。";
      if (meta && !meta.theme_effects) tip += "\n\n该版本无主题特效页，安装后本页可能消失。";
      if (!window.confirm(tip)) return;
      runInstall("install_version", id);
    });
    actions.appendChild(go);

    var un = document.createElement("input");
    un.type = "button";
    un.value = "一键卸载主题";
    un.addEventListener("click", function () {
      if (
        !window.confirm(
          "确定卸载主题？\n将删除主题文件、恢复 Dynamix 显示设置，本「主题特效」页也会消失。"
        )
      )
        return;
      if (!window.confirm("再次确认：卸载后需用终端一键脚本才能重装。继续？")) return;
      runInstall("uninstall", "");
    });
    actions.appendChild(un);

    var c = document.createElement("input");
    c.type = "button";
    c.value = "关闭";
    c.addEventListener("click", closePanel);
    actions.appendChild(c);
  }

  function ensureProgressUi(resetLog) {
    // Drop stray duplicates so log always sits under the progress bar
    if (body) {
      Array.prototype.slice
        .call(body.querySelectorAll("#ucwc-busy-msg, #ucwc-out, #ucwc-progress-wrap"))
        .forEach(function (n) {
          if (n && n.id !== "ucwc-progress-wrap") {
            // keep only nodes that will be recreated inside wrap
            if (n.id === "ucwc-busy-msg" || n.id === "ucwc-out") {
              if (!n.closest || !n.closest("#ucwc-progress-wrap")) n.remove();
            }
          }
        });
    }
    var wrap = document.getElementById("ucwc-progress-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "ucwc-progress-wrap";
      wrap.innerHTML =
        '<p id="ucwc-busy-msg" class="ucwc-muted">准备中…</p>' +
        '<div class="ucwc-progress" aria-hidden="false">' +
        '<div class="ucwc-progress-bar" id="ucwc-progress-bar" style="width:2%"></div>' +
        "</div>" +
        '<div class="ucwc-progress-meta"><span id="ucwc-progress-pct">0%</span> · <span id="ucwc-progress-stage">启动</span></div>' +
        '<pre class="ucwc-log" id="ucwc-out" aria-live="polite"></pre>';
      if (body) body.appendChild(wrap);
    } else if (!wrap.querySelector("#ucwc-out")) {
      var pre = document.createElement("pre");
      pre.className = "ucwc-log";
      pre.id = "ucwc-out";
      pre.setAttribute("aria-live", "polite");
      wrap.appendChild(pre);
    }
    var out = document.getElementById("ucwc-out");
    if (out) {
      out.style.display = "block";
      if (resetLog) out.textContent = "";
    }
    return wrap;
  }

  function setProgress(pct, stage, line) {
    ensureProgressUi(false);
    var bar = document.getElementById("ucwc-progress-bar");
    var pctEl = document.getElementById("ucwc-progress-pct");
    var stageEl = document.getElementById("ucwc-progress-stage");
    var msg = document.getElementById("ucwc-busy-msg");
    if (pct != null && pct !== "") {
      var n = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
      if (bar) bar.style.width = n + "%";
      if (pctEl) pctEl.textContent = n + "%";
    }
    if (stageEl && stage) stageEl.textContent = stage;
    if (msg && line) msg.textContent = line;
  }

  function appendJobLog(chunk) {
    ensureProgressUi(false);
    var out = document.getElementById("ucwc-out");
    if (!out || chunk == null || chunk === "") return;
    out.style.display = "block";
    out.textContent += chunk;
    out.scrollTop = out.scrollHeight;
  }

  function showInstallResultActions(ok, pageMayVanish) {
    if (!actions) return;
    actions.innerHTML = "";
    if (ok && !pageMayVanish) {
      var ref = document.createElement("input");
      ref.type = "button";
      ref.value = "刷新页面";
      ref.addEventListener("click", function () {
        try {
          window.location.replace("/Settings/ThemeEffects?updated=1&_ts=" + Date.now());
        } catch (e) {
          window.location.href = "/Settings/ThemeEffects?updated=1";
        }
      });
      actions.appendChild(ref);
    }
    if (pageMayVanish) {
      var dash = document.createElement("input");
      dash.type = "button";
      dash.value = "返回仪表盘";
      dash.addEventListener("click", function () {
        try {
          window.location.replace("/Dashboard");
        } catch (e2) {
          window.location.href = "/Dashboard";
        }
      });
      actions.appendChild(dash);
    }
    var c = document.createElement("input");
    c.type = "button";
    c.value = "关闭";
    c.addEventListener("click", closePanel);
    actions.appendChild(c);
  }

  function finishInstall(j) {
    setBusy(false);
    var ok = !(j && j.ok === false);
    var msg = (j && (j.message || j.stage)) || (ok ? "完成" : "失败");
    setProgress(100, ok ? "完成" : "失败", msg);
    if (j && j.local) updateBar({ local: j.local, latest_version: j.version });
    else if (j) updateBar(j);
    appendJobLog("\n==== " + (ok ? "完成" : "失败") + " ====\n" + msg + "\n");
    if (ok) {
      appendJobLog("请强制刷新 WebGUI（Ctrl+F5），或点「刷新页面」。\n");
    } else {
      appendJobLog("安装未成功。完整日志见上方，可关闭后重试。\n");
    }
    var vanish = !!(j && j.page_may_vanish);
    if (vanish) {
      appendJobLog("主题特效页可能已移除，可返回仪表盘。\n");
    }
    showInstallResultActions(ok, vanish);
    // 成功且可能丢页：稍等让用户看见日志再跳
    if (ok && vanish) {
      setTimeout(function () {
        try {
          window.location.replace("/Dashboard");
        } catch (e3) {
          window.location.href = "/Dashboard";
        }
      }, 2500);
    }
  }

  function pollJob(jobId, offset, vanishHint, failStreak) {
    var fails = failStreak || 0;
    api("job_status", { job_id: jobId, offset: offset || 0 }, 15000)
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && (j.error || j.message)) || "进度查询失败");
        var job = j.job || {};
        if (j.log) appendJobLog(j.log);
        setProgress(
          job.pct != null ? job.pct : 0,
          job.stage || "",
          job.message || job.stage || "执行中…"
        );
        if (job.done) {
          var payload = {
            ok: !!job.ok,
            message: job.message || (job.ok ? "完成" : "失败"),
            local: job.local,
            page_may_vanish: job.page_may_vanish != null ? job.page_may_vanish : vanishHint,
            version: job.version,
          };
          finishInstall(payload);
          return;
        }
        setTimeout(function () {
          pollJob(jobId, j.next_offset || offset || 0, vanishHint, 0);
        }, 700);
      })
      .catch(function (e) {
        // Transient network/auth blips: retry a few times instead of hard-fail mid-install
        if (fails < 8) {
          appendJobLog("\n[重试 " + (fails + 1) + "/8] " + String(e.message || e) + "\n");
          setProgress(null, "重试中", "进度查询暂时失败，正在重试…");
          setTimeout(function () {
            pollJob(jobId, offset || 0, vanishHint, fails + 1);
          }, 1200);
          return;
        }
        setBusy(false);
        appendJobLog("\n==== 失败 ====\n进度查询失败：" + String(e.message || e) + "\n");
        setProgress(100, "失败", "进度查询失败");
        showInstallResultActions(false, false);
      });
  }

  function runInstall(action, version, attempt) {
    if (busy && !attempt) return;
    var tryN = attempt || 1;
    var maxTry = 4;
    setBusy(true, "正在启动任务…");
    // 安装过程只保留进度+日志，避免与检测结果区的重复节点抢 id
    if (body && tryN === 1) {
      body.innerHTML = "";
    }
    ensureProgressUi(tryN === 1);
    setProgress(3, "启动任务", tryN > 1 ? "重试提交安装请求（" + tryN + "/" + maxTry + "）…" : "正在提交安装请求…");
    appendJobLog(
      "[" +
        new Date().toLocaleTimeString() +
        "] 提交 " +
        action +
        (version ? " " + version : "") +
        (tryN > 1 ? "（重试 " + tryN + "/" + maxTry + "）" : "") +
        "…\n"
    );
    var extra = { async: "1" };
    if (version) extra.version = version;
    // 8s: server only enqueues job. Short timeout so we can retry if auth-request/fpm stalls.
    api(action, extra, 8000)
      .then(function (j) {
        if (!j || !j.ok) {
          setBusy(false);
          var err = (j && (j.message || j.error)) || "操作失败";
          appendJobLog("==== 失败 ====\n" + err + "\n");
          setProgress(100, "失败", err);
          showInstallResultActions(false, false);
          return;
        }
        // Async path (preferred): stream progress like Docker update
        if (j.async && j.job_id) {
          setProgress(6, "任务已启动", j.message || "任务已启动，正在拉取进度…");
          appendJobLog(
            "job_id=" +
              j.job_id +
              (j.enqueue_ms != null ? "（入队 " + j.enqueue_ms + "ms）" : "") +
              "\n"
          );
          pollJob(j.job_id, 0, !!j.page_may_vanish);
          return;
        }
        // Sync fallback
        if (j.output) appendJobLog(String(j.output).slice(0, 8000) + "\n");
        else if (j.message) appendJobLog(String(j.message) + "\n");
        finishInstall(j);
      })
      .catch(function (e) {
        var err = String(e && e.message ? e.message : e);
        var retryable =
          /超时|timeout|aborted|空响应|非 JSON|504|502|401|未登录|会话|网络|Failed to fetch|NetworkError/i.test(
            err
          );
        if (retryable && tryN < maxTry) {
          appendJobLog("[提示] " + err + " — 将自动重试…\n");
          setProgress(3, "等待重试", "Web 鉴权/进程繁忙，稍后重试…");
          setTimeout(function () {
            // allow re-entry
            busy = false;
            runInstall(action, version, tryN + 1);
          }, 1500 * tryN);
          return;
        }
        setBusy(false);
        appendJobLog("==== 失败 ====\n" + err + "\n");
        if (/超时|504|鉴权|auth/i.test(err)) {
          appendJobLog(
            "说明：Unraid 对每个请求先跑 auth-request（php-fpm）。若 Web 进程被占满会 504，安装请求到不了后端。\n" +
              "请关闭其它繁忙页面后点下方关闭再重试；或 SSH 执行安装脚本。\n"
          );
        }
        setProgress(100, "失败", err);
        showInstallResultActions(false, false);
      });
  }

  function wire(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  function bindVersionUi() {
    panel = document.getElementById("ucwc-panel");
    mask = document.getElementById("ucwc-panel-mask");
    body = document.getElementById("ucwc-panel-body");
    actions = document.getElementById("ucwc-panel-actions");
    title = document.getElementById("ucwc-panel-title");
    var closer = document.getElementById("ucwc-panel-close");
    if (closer) closer.addEventListener("click", closePanel);
    if (mask) mask.addEventListener("click", closePanel);

    wire("ucwc-btn-check", function () {
      openPanel("检测更新");
      body.innerHTML = "<p>正在检查更新…</p>";
      actions.innerHTML = "";
      api("check_update")
        .then(showCheck)
        .catch(function (e) {
          body.innerHTML = '<p class="ucwc-err">' + esc(e.message || e) + "</p>";
        });
    });
    wire("ucwc-btn-log", function () {
      openPanel("更新日志");
      body.innerHTML = "<p>正在加载更新日志…</p>";
      actions.innerHTML = "";
      api("changelog")
        .then(function (d) {
          showChangelog(d);
        })
        .catch(function (e) {
          body.innerHTML = '<p class="ucwc-err">' + esc(e.message || e) + "</p>";
        });
    });
    // Do NOT auto-call check_update on page load (busy php-fpm / auth 504).
  }

  function bootAll() {
    bindFormUi();
    bindVersionUi();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAll);
  else bootAll();
})();
