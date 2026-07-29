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
    var ids = [
      "#ucwc-btn-save",
      "#ucwc-btn-save-bg",
      "#ucwc-btn-save-particles",
      "#ucwc-btn-save-mouse",
      "#ucwc-btn-save-music",
      "#ucwc-btn-save-mascot",
    ];
    for (var k = 0; k < ids.length; k++) {
      var el = form.querySelector(ids[k]);
      if (el && list.indexOf(el) < 0) list.push(el);
    }
    var all = form.querySelectorAll(
      'input[type="submit"], button[type="submit"], input[name="SAVE_THEME_FX"]'
    );
    for (var i = 0; i < all.length; i++) {
      var v = (all[i].value || all[i].textContent || "").trim();
      if (
        v === "应用" ||
        v === "Apply" ||
        v === "应用中…" ||
        v === "Applying…" ||
        v === "上传中…" ||
        all[i].id === "ucwc-btn-save" ||
        (all[i].id && all[i].id.indexOf("ucwc-btn-save-") === 0) ||
        all[i].name === "SAVE_THEME_FX"
      ) {
        if (list.indexOf(all[i]) < 0) list.push(all[i]);
      }
    }
    return list;
  }

  function sectionOfButton(btn) {
    if (!btn) return "all";
    var s =
      (btn.getAttribute && btn.getAttribute("data-ucwc-section")) ||
      (btn.dataset && btn.dataset.ucwcSection) ||
      "";
    // Parent span.ucwc-section-actions may carry the section
    if (!s && btn.closest) {
      try {
        var wrap = btn.closest("[data-ucwc-section]");
        if (wrap) s = wrap.getAttribute("data-ucwc-section") || "";
      } catch (e0) {}
    }
    if (!s && btn.id) {
      if (btn.id.indexOf("-bg") >= 0) s = "bg";
      else if (btn.id.indexOf("-particles") >= 0) s = "particles";
      else if (btn.id.indexOf("-mouse") >= 0) s = "mouse";
      else if (btn.id.indexOf("-music") >= 0) s = "music";
      else if (btn.id.indexOf("-mascot") >= 0) s = "mascot";
      else if (btn.id.indexOf("-font") >= 0) s = "font";
      else if (btn.id.indexOf("-perf") >= 0) s = "perf";
      else if (btn.id.indexOf("-service") >= 0) s = "service";
    }
    s = String(s || "all").toLowerCase();
    if (s === "background" || s === "wallpaper") s = "bg";
    if (s === "hutao") s = "mascot";
    if (s === "player" || s === "audio") s = "music";
    if (s === "performance" || s === "gpu" || s === "client") s = "perf";
    if (s === "typo" || s === "fonts" || s === "color" || s === "colors") s = "font";
    // BUGFIX: previously only bg/particles/mascot/all — perf/font fell back to "all"
    // so 性能档位「应用」never rewrote effect knobs.
    if (["bg", "particles", "mouse", "music", "mascot", "font", "perf", "service", "all"].indexOf(s) < 0) {
      s = "all";
    }
    return s;
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
          '#ucwc-btn-done, #ucwc-btn-done-bg, #ucwc-btn-done-particles, #ucwc-btn-done-mouse, #ucwc-btn-done-mascot, input[type="button"][value="完成"], input[type="button"][value="Done"], input[value="重置"], input[value="Reset"]'
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
      var hutaoBlurLevel = root.querySelector('select[name="HUTAO_BLUR_LEVEL"]');
      var bgBlur = root.querySelector('select[name="BG_BLUR"]');
      var bgBlurLevel = root.querySelector('select[name="BG_BLUR_LEVEL"]');
      var bgLocalPath = root.querySelector('input[name="BG_LOCAL_PATH"]');
      var hutaoLocalPath = root.querySelector('input[name="HUTAO_LOCAL_PATH"]');
      var particles = root.querySelector('select[name="PARTICLES"]');
      var pCount = root.querySelector('input[name="PARTICLES_COUNT"]');
      var reduce = root.querySelector('select[name="REDUCE_MOTION"]');
      var isLocal = !mode || mode.value === "local";
      var hutaoOn = !!(hutao && hutao.value === "yes");
      var hutaoCustom = !!(hutaoOn && hutaoType && hutaoType.value === "custom");
      var particlesOn = !!(particles && particles.value === "yes");

      hideRow(slot, !isLocal);
      hideRow(upload, !(isLocal && slot && slot.value === "custom"));
      hideRow(bgLocalPath, !(isLocal && slot && slot.value === "custom"));
      hideRow(gal, isLocal);
      hideRow(apiEl, !(!isLocal && gal && gal.value === "custom"));
      hideRow(hutaoType, !hutaoOn);
      hideRow(hutaoUpload, !hutaoCustom);
      hideRow(hutaoLocalPath, !hutaoCustom);
      hideRow(hutaoSize, !hutaoOn);
      hideRow(hutaoPos, !hutaoOn);
      hideRow(hutaoBlur, !hutaoOn);
      var hutaoBlurOn = !!(hutaoOn && hutaoBlur && hutaoBlur.value === "yes");
      hideRow(hutaoBlurLevel, !hutaoBlurOn);
      var bgBlurOn = !!(bgBlur && bgBlur.value === "yes");
      hideRow(bgBlurLevel, !bgBlurOn);
      hideRow(pCount, !particlesOn);
      hideRow(reduce, !particlesOn);

      var countVal = document.getElementById("ucwc-count-val");
      if (pCount && countVal) countVal.textContent = String(pCount.value);

      // Color rows: only meaningful in custom preset (still always visible; dim via class)
      var preset = root.querySelector('select[name="COLOR_PRESET"]');
      var isCustomColor = !!(preset && preset.value === "custom");
      var colorRows = root.querySelectorAll(".ucwc-color-row");
      for (var cr = 0; cr < colorRows.length; cr++) {
        if (isCustomColor) colorRows[cr].classList.remove("ucwc-color-disabled");
        else colorRows[cr].classList.add("ucwc-color-disabled");
      }

      // Font custom name / local upload rows
      var fontBody = root.querySelector('select[name="FONT_BODY"]');
      var fontTitle = root.querySelector('select[name="FONT_TITLE"]');
      var customBody = root.querySelector('input[name="FONT_CUSTOM_BODY"]');
      var customTitle = root.querySelector('input[name="FONT_CUSTOM_TITLE"]');
      var bodyUpload = root.querySelector('input[name="FONT_BODY_UPLOAD"]');
      var titleUpload = root.querySelector('input[name="FONT_TITLE_UPLOAD"]');
      hideRow(customBody, !(fontBody && fontBody.value === "custom"));
      hideRow(customTitle, !(fontTitle && fontTitle.value === "custom"));
      hideRow(bodyUpload, !(fontBody && fontBody.value === "local"));
      hideRow(titleUpload, !(fontTitle && fontTitle.value === "local"));

      // Live preview on settings page
      try {
        updateFontPreview(root);
      } catch (ePrev) {}
    } catch (e) {}
  }

  var COLOR_PRESETS = {
    cyber: { text: "#eeeeee", title: "#ffffff", label: "#fb7299" },
    ice: { text: "#e8f1ff", title: "#ffffff", label: "#5eb3ff" },
    gold: { text: "#f5efd8", title: "#ffe9a8", label: "#d4a017" },
    mint: { text: "#e8fff6", title: "#ffffff", label: "#3dd6c6" },
    violet: { text: "#f0e9ff", title: "#ffffff", label: "#a78bfa" },
    sunset: { text: "#ffe8e0", title: "#fff5f0", label: "#fb923c" },
  };

  var FONT_STACKS = {
    system: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    rajdhani: '"Rajdhani", "Microsoft YaHei", system-ui, sans-serif',
    inter: '"Inter", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    rubik: '"Rubik", "Microsoft YaHei", system-ui, sans-serif',
    noto_sc: '"Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif',
    source_han:
      '"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
    yahei: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    orbitron: '"Orbitron", "Rajdhani", sans-serif',
    exo2: '"Exo 2", "Orbitron", "Rajdhani", sans-serif',
    local: '"UCWC Local Body", "Microsoft YaHei", system-ui, sans-serif',
  };

  var TITLE_SIZE_MAP = {
    default: "",
    sm: "1.05em",
    md: "1.2em",
    lg: "1.35em",
    xl: "1.55em",
  };

  function normHex(v, fallback) {
    v = String(v || "").trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
    return fallback || "#eeeeee";
  }

  function updateFontPreview(root) {
    root = root || document;
    var prev = document.getElementById("ucwc-font-preview");
    if (!prev) return;
    var bodySel = root.querySelector('select[name="FONT_BODY"]');
    var titleSel = root.querySelector('select[name="FONT_TITLE"]');
    var upperSel = root.querySelector('select[name="FONT_TITLE_UPPER"]');
    var sizeSel = root.querySelector('select[name="FONT_SIZE"]');
    var titleSizeSel = root.querySelector('select[name="FONT_TITLE_SIZE"]');
    var presetSel = root.querySelector('select[name="COLOR_PRESET"]');
    var textEl = root.querySelector('input[name="COLOR_TEXT"]');
    var titleEl = root.querySelector('input[name="COLOR_TITLE"]');
    var labelEl = root.querySelector('input[name="COLOR_LABEL"]');
    var bodyKey = bodySel ? bodySel.value : "rajdhani";
    var titleKey = titleSel ? titleSel.value : "orbitron";
    var customBodyEl = root.querySelector('input[name="FONT_CUSTOM_BODY"]');
    var customTitleEl = root.querySelector('input[name="FONT_CUSTOM_TITLE"]');
    var customBody = customBodyEl ? String(customBodyEl.value || "").trim() : "";
    var customTitle = customTitleEl ? String(customTitleEl.value || "").trim() : "";
    var bodyStack = FONT_STACKS[bodyKey] || FONT_STACKS.rajdhani;
    if (bodyKey === "custom" && customBody) {
      bodyStack = '"' + customBody.replace(/["';<>\\]/g, "") + '", "Microsoft YaHei", system-ui, sans-serif';
    } else if (bodyKey === "local") {
      bodyStack = FONT_STACKS.local;
    }
    var titleStack =
      titleKey === "match_body" ? bodyStack : FONT_STACKS[titleKey] || FONT_STACKS.orbitron;
    if (titleKey === "custom") {
      var tn = customTitle || customBody;
      if (tn) titleStack = '"' + tn.replace(/["';<>\\]/g, "") + '", "Microsoft YaHei", system-ui, sans-serif';
    } else if (titleKey === "local") {
      titleStack = '"UCWC Local Title", "Microsoft YaHei", system-ui, sans-serif';
    }
    var preset = presetSel ? presetSel.value : "cyber";
    var pal = COLOR_PRESETS[preset] || COLOR_PRESETS.cyber;
    var cText = preset === "custom" ? normHex(textEl && textEl.value, pal.text) : pal.text;
    var cTitle = preset === "custom" ? normHex(titleEl && titleEl.value, pal.title) : pal.title;
    var cLabel = preset === "custom" ? normHex(labelEl && labelEl.value, pal.label) : pal.label;
    var size = sizeSel ? sizeSel.value : "14";
    var upper = upperSel && upperSel.value === "yes" ? "uppercase" : "none";
    var tSizeKey = titleSizeSel ? titleSizeSel.value : "default";
    var tSize = TITLE_SIZE_MAP[tSizeKey] || "";
    prev.style.fontFamily = bodyStack;
    prev.style.fontSize = size + "px";
    prev.style.color = cText;
    prev.style.setProperty("--ucwc-preview-title-font", titleStack);
    prev.style.setProperty("--ucwc-preview-title-color", cTitle);
    prev.style.setProperty("--ucwc-preview-label-color", cLabel);
    prev.style.setProperty("--ucwc-preview-transform", upper);
    prev.style.setProperty("--ucwc-preview-title-size", tSize || "1.15em");
    var titleNode = prev.querySelector(".ucwc-font-preview-title");
    var bodyNode = prev.querySelector(".ucwc-font-preview-body");
    var labelNode = prev.querySelector(".ucwc-font-preview-label");
    if (titleNode) {
      titleNode.style.fontFamily = titleStack;
      titleNode.style.color = cTitle;
      titleNode.style.textTransform = upper;
      titleNode.style.fontSize = tSize || "1.15em";
      titleNode.style.letterSpacing = upper === "uppercase" ? "1px" : "0.3px";
    }
    if (bodyNode) {
      bodyNode.style.fontFamily = bodyStack;
      bodyNode.style.color = cText;
      bodyNode.style.fontSize = size + "px";
    }
    if (labelNode) {
      labelNode.style.color = cLabel;
      labelNode.style.fontFamily = bodyStack;
    }
  }

  function wireColorPair(pickerId, inputName, form, onChange) {
    var picker = document.getElementById(pickerId);
    var input = form.querySelector('input[name="' + inputName + '"]');
    if (!picker || !input) return;
    picker.addEventListener("input", function () {
      input.value = picker.value;
      var preset = form.querySelector('select[name="COLOR_PRESET"]');
      if (preset && preset.value !== "custom") {
        preset.value = "custom";
      }
      if (typeof onChange === "function") onChange();
    });
    input.addEventListener("input", function () {
      var v = normHex(input.value, "");
      if (v) picker.value = v.length === 4
        ? "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
        : v;
      if (typeof onChange === "function") onChange();
    });
    input.addEventListener("change", function () {
      if (typeof onChange === "function") onChange();
    });
  }

  function applyPresetToInputs(form) {
    var preset = form.querySelector('select[name="COLOR_PRESET"]');
    if (!preset) return;
    var pal = COLOR_PRESETS[preset.value];
    if (!pal) return; // custom: leave fields
    var pairs = [
      ["COLOR_TEXT", "ucwc-color-text-picker", pal.text],
      ["COLOR_TITLE", "ucwc-color-title-picker", pal.title],
      ["COLOR_LABEL", "ucwc-color-label-picker", pal.label],
    ];
    for (var i = 0; i < pairs.length; i++) {
      var inp = form.querySelector('input[name="' + pairs[i][0] + '"]');
      var pk = document.getElementById(pairs[i][1]);
      if (inp) inp.value = ""; // empty = use preset on server
      if (pk) pk.value = pairs[i][2];
    }
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

      var lastSection = "all";

      function hasUploadFile(section) {
        section = section || "all";
        var bg = form.querySelector('input[name="BG_UPLOAD"]');
        var mascot = form.querySelector('input[name="HUTAO_UPLOAD"]');
        var fontBody = form.querySelector('input[name="FONT_BODY_UPLOAD"]');
        var fontTitle = form.querySelector('input[name="FONT_TITLE_UPLOAD"]');
        var hasBg = !!(bg && bg.files && bg.files.length > 0);
        var hasM = !!(mascot && mascot.files && mascot.files.length > 0);
        var hasFB = !!(fontBody && fontBody.files && fontBody.files.length > 0);
        var hasFT = !!(fontTitle && fontTitle.files && fontTitle.files.length > 0);
        if (section === "bg") return hasBg;
        if (section === "mascot") return hasM;
        if (section === "font") return hasFB || hasFT;
        if (section === "particles") return false;
        return hasBg || hasM || hasFB || hasFT;
      }

      function prepareSubmit(section) {
        section = section || lastSection || "all";
        lastSection = section;
        try {
          if (hasUploadFile(section)) {
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
        var flag = form.querySelector('input[name="SAVE_THEME_FX"][type="hidden"]');
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
          flag.value = "1";
        }

        var secEl = form.querySelector('input[name="UCWC_SECTION"]');
        if (!secEl) {
          secEl = document.createElement("input");
          secEl.type = "hidden";
          secEl.name = "UCWC_SECTION";
          secEl.id = "ucwc-section-flag";
          form.appendChild(secEl);
        }
        secEl.disabled = false;
        secEl.value = section;

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

      // Track which section Apply was clicked (submitter may be missing on old browsers)
      var sectionBtns = applyButtons(form);
      for (var sb = 0; sb < sectionBtns.length; sb++) {
        (function (btn) {
          btn.classList.add("lock");
          btn.addEventListener("click", function () {
            lastSection = sectionOfButton(btn);
            prepareSubmit(lastSection);
            btn.disabled = false;
            btn.removeAttribute("disabled");
          });
        })(sectionBtns[sb]);
      }

      form.addEventListener("submit", function (ev) {
        var submitter =
          ev.submitter ||
          document.activeElement ||
          null;
        var section = sectionOfButton(submitter);
        if (section === "all" && lastSection) section = lastSection;
        prepareSubmit(section);

        var file = form.querySelector('input[name="BG_UPLOAD"]');
        var mascotFile = form.querySelector('input[name="HUTAO_UPLOAD"]');
        var fontBodyFile = form.querySelector('input[name="FONT_BODY_UPLOAD"]');
        var fontTitleFile = form.querySelector('input[name="FONT_TITLE_UPLOAD"]');
        // Section-aware uploads: only the active section's file is sent.
        var hasMascotUpload =
          (section === "all" || section === "mascot") &&
          !!(mascotFile && mascotFile.files && mascotFile.files.length > 0);
        var hasBgUpload =
          (section === "all" || section === "bg") &&
          !!(file && file.files && file.files.length > 0);
        var hasFontBodyUpload =
          (section === "all" || section === "font") &&
          !!(fontBodyFile && fontBodyFile.files && fontBodyFile.files.length > 0);
        var hasFontTitleUpload =
          (section === "all" || section === "font") &&
          !!(fontTitleFile && fontTitleFile.files && fontTitleFile.files.length > 0);
        var uploading = hasUploadFile(section);

        if (hasBgUpload) {
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
        if (hasMascotUpload) {
          var mf = mascotFile.files[0];
          if (mf) {
            var mname = (mf.name || "").toLowerCase();
            var mtype = (mf.type || "").toLowerCase();
            if (mtype && mtype.indexOf("gif") < 0 && !/\.gif$/i.test(mname)) {
              ev.preventDefault();
              alert("自定义吉祥物仅支持 GIF 文件。");
              return false;
            }
            if (mf.size > 8 * 1024 * 1024) {
              ev.preventDefault();
              alert(
                "自定义吉祥物过大（" +
                  (mf.size / 1024 / 1024).toFixed(1) +
                  "MB）。请压缩到 8MB 以内再上传。"
              );
              return false;
            }
          }
        }
        function checkFontFile(ff, label) {
          if (!ff) return true;
          var n = (ff.name || "").toLowerCase();
          if (!/\.(woff2|woff|ttf|otf)$/i.test(n)) {
            alert(label + "仅支持 woff2 / woff / ttf / otf。");
            return false;
          }
          if (ff.size > 4 * 1024 * 1024) {
            alert(
              label +
                "过大（" +
                (ff.size / 1024 / 1024).toFixed(1) +
                "MB）。请压缩到 4MB 以内再上传。"
            );
            return false;
          }
          return true;
        }
        if (hasFontBodyUpload && !checkFontFile(fontBodyFile.files[0], "本地正文字体")) {
          ev.preventDefault();
          return false;
        }
        if (hasFontTitleUpload && !checkFontFile(fontTitleFile.files[0], "本地标题字体")) {
          ev.preventDefault();
          return false;
        }

        ev.preventDefault();
        if (saveInFlight) return false;

        var save =
          (submitter && submitter.type === "submit" ? submitter : null) ||
          form.querySelector("#ucwc-btn-save-" + section) ||
          form.querySelector("#ucwc-btn-save") ||
          applyButtons(form)[0];
        if (save) {
          save.disabled = false;
          save.removeAttribute("disabled");
          setApplyLabel(save, uploading ? "上传中…" : "应用中…");
        }

        saveInFlight = true;
        var tok =
          (typeof window.csrf_token === "string" && window.csrf_token) ||
          (typeof csrf_token === "string" && csrf_token) ||
          "";
        var headers = { "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/html;q=0.8" };
        if (tok) headers["X-CSRF-TOKEN"] = tok;

        // Field sets per section (partial apply — other sections kept server-side)
        var fieldSets = {
          bg: ["BG_MODE", "BG_LOCAL_SLOT", "BG_GALLERY", "BG_CUSTOM_API", "BG_BLUR", "BG_BLUR_LEVEL", "BG_UPLOAD", "BG_LOCAL_PATH"],
          particles: ["PARTICLES", "PARTICLES_COUNT", "PARTICLES_COUNT_COMMIT", "REDUCE_MOTION"],
          mouse: ["MOUSE_FX", "MOUSE_STYLE", "MOUSE_SIZE", "MOUSE_SIZE_COMMIT", "MOUSE_INTENSITY", "MOUSE_INTENSITY_COMMIT", "MOUSE_COLOR", "MOUSE_COLOR_MODE", "MOUSE_CLICK_RIPPLE", "MOUSE_CURSOR"],
          music: ["MUSIC_ENABLE", "MUSIC_UI", "MUSIC_SOURCE", "MUSIC_LOCAL_DIR", "MUSIC_VOLUME", "MUSIC_VOLUME_COMMIT", "MUSIC_AUTOPLAY", "MUSIC_SHUFFLE", "MUSIC_REPEAT", "MUSIC_DASH_ONLY"],
          mascot: ["HUTAO", "HUTAO_TYPE", "HUTAO_SIZE", "HUTAO_POS", "HUTAO_BLUR", "HUTAO_BLUR_LEVEL", "HUTAO_UPLOAD", "HUTAO_LOCAL_PATH"],
          font: [
            "FONT_BODY",
            "FONT_TITLE",
            "FONT_TITLE_UPPER",
            "FONT_SIZE",
            "FONT_TITLE_SIZE",
            "FONT_CUSTOM_BODY",
            "FONT_CUSTOM_TITLE",
            "FONT_BODY_UPLOAD",
            "FONT_TITLE_UPLOAD",
            "COLOR_PRESET",
            "COLOR_TEXT",
            "COLOR_TITLE",
            "COLOR_LABEL",
          ],
          perf: ["PERF_PROFILE", "CLIENT_OPTIMIZED", "APPLY_PERF_PRESET", "PARTICLES", "PARTICLES_COUNT", "PARTICLES_COUNT_COMMIT", "REDUCE_MOTION", "BG_BLUR", "BG_BLUR_LEVEL", "HUTAO_BLUR", "HUTAO_BLUR_LEVEL"],
          all: null,
        };
        var allow = fieldSets[section] || null;
        // Perf apply: rewrite related form fields client-side to match server preset
        // (UI + any expanded fieldSets POST stay consistent with cfg rewrite).
        if (section === "perf") {
          try {
            var pSelPre = form.querySelector('select[name="PERF_PROFILE"]');
            var pvPre = pSelPre ? String(pSelPre.value || "auto") : "auto";
            if (pvPre && pvPre !== "auto") {
              applyPerfSuggestion(pvPre, { setProfileSelect: true });
            }
            var flag = form.querySelector('input[name="APPLY_PERF_PRESET"]');
            if (!flag) {
              flag = document.createElement("input");
              flag.type = "hidden";
              flag.name = "APPLY_PERF_PRESET";
              form.appendChild(flag);
            }
            flag.value = pvPre && pvPre !== "auto" ? "1" : "0";
          } catch (ePerfMap) {}
        }

        function includeName(name) {
          if (!name) return false;
          if (name === "SAVE_THEME_FX" || name === "csrf_token" || name === "UCWC_SECTION") return true;
          if (!allow) return true;
          return allow.indexOf(name) >= 0;
        }

        var body;
        if (uploading) {
          try {
            form.enctype = "multipart/form-data";
            form.setAttribute("enctype", "multipart/form-data");
          } catch (e0) {}
          body = new FormData();
          body.set("SAVE_THEME_FX", "1");
          body.set("UCWC_SECTION", section);
          if (tok) body.set("csrf_token", tok);
          var elsF = form.querySelectorAll("input, select, textarea");
          for (var fi = 0; fi < elsF.length; fi++) {
            var fel = elsF[fi];
            if (!fel.name || fel.disabled) continue;
            if (!includeName(fel.name)) continue;
            if (fel.type === "file") {
              if (fel.files && fel.files.length > 0) body.append(fel.name, fel.files[0], fel.files[0].name);
              continue;
            }
            if ((fel.type === "checkbox" || fel.type === "radio") && !fel.checked) continue;
            if (fel.type === "submit" || fel.type === "button") continue;
            body.append(fel.name, fel.value == null ? "" : String(fel.value));
          }
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
            if (!includeName(el.name)) continue;
            if (el.type === "file") continue;
            if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
            if (el.type === "submit" || el.type === "button") continue;
            params.append(el.name, el.value == null ? "" : String(el.value));
          }
          params.set("SAVE_THEME_FX", "1");
          params.set("UCWC_SECTION", section);
          if (tok) params.set("csrf_token", tok);
          body = params.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }

        // Abort so "应用中…" cannot hang forever (upload auth/nginx stalls have been seen).
        var ac = null;
        var abortTimer = null;
        var fetchOpts = {
          method: "POST",
          body: body,
          credentials: "same-origin",
          headers: headers,
          redirect: "follow",
        };
        try {
          if (typeof AbortController !== "undefined") {
            ac = new AbortController();
            fetchOpts.signal = ac.signal;
            // urlencoded: 45s; multipart upload: 120s
            var limitMs = uploading ? 120000 : 45000;
            abortTimer = setTimeout(function () {
              try {
                ac.abort();
              } catch (eA) {}
            }, limitMs);
          }
        } catch (eAc) {}

        function clearAbort() {
          if (abortTimer) {
            try {
              clearTimeout(abortTimer);
            } catch (eC) {}
            abortTimer = null;
          }
        }

        function resetApplyUi(msg) {
          saveInFlight = false;
          clearAbort();
          if (msg) {
            try {
              alert(msg);
            } catch (eM) {}
          }
          if (save) setApplyLabel(save, "应用");
          enableApply(form, true);
        }

        fetch("/plugins/theme.effects/ucwc-theme-fx-save.php", fetchOpts)
          .then(function (r) {
            return r.text().then(function (t) {
              return { ok: r.ok, status: r.status, url: r.url || "", text: t || "" };
            });
          })
          .then(function (res) {
            clearAbort();
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
              var u = path || "";
              if (!u) {
                u =
                  "/Settings/ThemeEffects?applied=1&section=" +
                  encodeURIComponent(section || "all");
              } else if (u.indexOf("section=") < 0 && section) {
                u += (u.indexOf("?") >= 0 ? "&" : "?") + "section=" + encodeURIComponent(section);
              }
              if (u.indexOf("applied=") < 0) {
                u += (u.indexOf("?") >= 0 ? "&" : "?") + "applied=1";
              }
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
                goApplied(json.redirect || "");
                return;
              }
              alert(json.message || json.error || "保存失败。");
              if (save) setApplyLabel(save, "应用");
              enableApply(form, true);
              if (json.saved) {
                setTimeout(function () {
                  goApplied(json.redirect || "");
                }, 600);
              }
              return;
            }

            if (res.status === 401 || res.status === 403 || looksLikeLoginPage(text, res.url)) {
              resetApplyUi("未登录或会话已过期，请重新登录 Unraid。");
              return;
            }
            if (res.status === 413) {
              resetApplyUi("上传失败：文件过大（HTTP 413）。请压缩到 8MB 以内再试。");
              return;
            }
            if (res.status === 504 || res.status === 502) {
              resetApplyUi(
                "保存超时（HTTP " +
                  res.status +
                  "）。大 GIF/壁纸上传时网关可能卡住，请缩小文件后重试，或先不选文件仅改选项再应用。"
              );
              return;
            }
            if (!res.ok && res.status >= 500) {
              resetApplyUi("保存失败（HTTP " + res.status + "）。请稍后重试。");
              return;
            }
            // Non-JSON but 2xx: treat as applied (legacy page POST fallback)
            goApplied();
          })
          .catch(function (err) {
            var name = (err && err.name) || "";
            var msg = err && err.message ? err.message : String(err || "");
            if (name === "AbortError" || /aborted|abort/i.test(msg)) {
              resetApplyUi(
                uploading
                  ? "上传超时（约 120 秒）。请将 GIF/壁纸压缩后再试，或分两次：先只改选项应用，再单独上传文件。"
                  : "应用超时（约 45 秒）。请刷新页面后重试。"
              );
              return;
            }
            resetApplyUi("保存失败：" + msg);
          });

        return false;
      });

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
        "HUTAO_BLUR_LEVEL",
        "REDUCE_MOTION",
        "BG_BLUR",
        "BG_BLUR_LEVEL",
        "FONT_BODY",
        "FONT_TITLE",
        "FONT_TITLE_UPPER",
        "FONT_SIZE",
        "FONT_TITLE_SIZE",
        "COLOR_PRESET",
        "PERF_PROFILE",
      ].forEach(function (name) {
        var el = form.querySelector('select[name="' + name + '"]');
        if (el) {
          el.addEventListener("change", function () {
            if (name === "COLOR_PRESET") applyPresetToInputs(form);
            onDirty();
          });
          el.addEventListener("input", onDirty);
        }
      });

      wireColorPair("ucwc-color-text-picker", "COLOR_TEXT", form, onDirty);
      wireColorPair("ucwc-color-title-picker", "COLOR_TITLE", form, onDirty);
      wireColorPair("ucwc-color-label-picker", "COLOR_LABEL", form, onDirty);

      var range = form.querySelector('input[name="PARTICLES_COUNT"]');
      if (range) {
        range.addEventListener("input", onDirty);
        range.addEventListener("change", onDirty);
        range.addEventListener("pointerup", onDirty);
        range.addEventListener("touchend", onDirty);
      }

      var fileInput = form.querySelector('input[name="BG_UPLOAD"]');
      if (fileInput) fileInput.addEventListener("change", onDirty);
      var bgPathInput = form.querySelector('input[name="BG_LOCAL_PATH"]');
      if (bgPathInput) {
        bgPathInput.addEventListener("input", onDirty);
        bgPathInput.addEventListener("change", onDirty);
      }
      var mascotPathInput = form.querySelector('input[name="HUTAO_LOCAL_PATH"]');
      if (mascotPathInput) {
        mascotPathInput.addEventListener("input", onDirty);
        mascotPathInput.addEventListener("change", onDirty);
      }
      var mascotInput = form.querySelector('input[name="HUTAO_UPLOAD"]');
      if (mascotInput) mascotInput.addEventListener("change", onDirty);
      var fontBodyInput = form.querySelector('input[name="FONT_BODY_UPLOAD"]');
      if (fontBodyInput) fontBodyInput.addEventListener("change", onDirty);
      var fontTitleInput = form.querySelector('input[name="FONT_TITLE_UPLOAD"]');
      if (fontTitleInput) fontTitleInput.addEventListener("change", onDirty);
      var fontCustomBody = form.querySelector('input[name="FONT_CUSTOM_BODY"]');
      if (fontCustomBody) {
        fontCustomBody.addEventListener("input", onDirty);
        fontCustomBody.addEventListener("change", onDirty);
      }
      var fontCustomTitle = form.querySelector('input[name="FONT_CUSTOM_TITLE"]');
      if (fontCustomTitle) {
        fontCustomTitle.addEventListener("input", onDirty);
        fontCustomTitle.addEventListener("change", onDirty);
      }

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
  var API = "/plugins/theme.effects/ucwc-update.php";
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
    if (v.channel === "beta" || (v.id && /beta/i.test(String(v.id)))) c.push("Beta");
    if (v.id && v.id === LOCAL_VERSION) c.push("当前");
    // 完整安装：不再展示粒子/胡桃等历史分项能力标签
    return c
      .map(function (x) {
        return '<span class="ucwc-chip">' + esc(x) + "</span>";
      })
      .join("");
  }

  function isBetaVersionId(id) {
    return !!(id && /beta/i.test(String(id)));
  }

  /**
   * Compare theme version ids like v2.4.0, v2.1.2-beta, v2.0.0-beta3.
   * Returns negative if a < b, 0 if equal core+pre, positive if a > b.
   * Pre-release (beta) is always lower than the same X.Y.Z stable.
   */
  function parseVersionParts(id) {
    var s = String(id || "").trim().replace(/^v/i, "");
    if (!s) return null;
    var m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-_.]?(beta|alpha|rc|b)(\d*))?/i);
    if (!m) return null;
    var preKind = (m[4] || "").toLowerCase();
    var preNum = m[5] ? parseInt(m[5], 10) || 0 : preKind ? 0 : -1;
    // preRank: stable (-1 sort as higher) > rc > beta > alpha; encode as number for cmp
    var preRank = -1; // stable
    if (preKind === "rc") preRank = 3;
    else if (preKind === "beta" || preKind === "b") preRank = 2;
    else if (preKind === "alpha") preRank = 1;
    else if (preKind) preRank = 0;
    return {
      major: parseInt(m[1], 10) || 0,
      minor: parseInt(m[2], 10) || 0,
      patch: parseInt(m[3], 10) || 0,
      preRank: preRank,
      preNum: preRank < 0 ? 0 : preNum,
      raw: s,
    };
  }

  function compareVersions(a, b) {
    var pa = parseVersionParts(a);
    var pb = parseVersionParts(b);
    if (!pa && !pb) return 0;
    if (!pa) return -1;
    if (!pb) return 1;
    if (pa.major !== pb.major) return pa.major - pb.major;
    if (pa.minor !== pb.minor) return pa.minor - pb.minor;
    if (pa.patch !== pb.patch) return pa.patch - pb.patch;
    // stable (preRank -1) > any pre-release
    var ra = pa.preRank < 0 ? 100 : pa.preRank;
    var rb = pb.preRank < 0 ? 100 : pb.preRank;
    if (ra !== rb) return ra - rb;
    if (pa.preRank < 0 && pb.preRank < 0) return 0;
    return pa.preNum - pb.preNum;
  }

  function isVersionNewer(a, b) {
    return compareVersions(a, b) > 0;
  }

  /** Stable channel for check_update: prefer non-beta "latest", else first non-beta, else latest_version. */
  function pickStableLatest(data) {
    var versions = (data && data.versions) || [];
    var i, v;
    for (i = 0; i < versions.length; i++) {
      v = versions[i];
      if (v && v.channel === "latest" && !isBetaVersionId(v.id)) return v;
    }
    for (i = 0; i < versions.length; i++) {
      v = versions[i];
      if (v && v.channel !== "beta" && !isBetaVersionId(v.id)) return v;
    }
    if (data && data.latest && !isBetaVersionId(data.latest.id || data.latest_version)) {
      return data.latest;
    }
    return data && data.latest ? data.latest : null;
  }

  /** Absolute newest beta in catalog (no floor). */
  function pickBestBeta(data) {
    var versions = (data && data.versions) || [];
    var best = null;
    var i, v;
    for (i = 0; i < versions.length; i++) {
      v = versions[i];
      if (!v || !v.id) continue;
      if (!(v.channel === "beta" || isBetaVersionId(v.id))) continue;
      if (!best || isVersionNewer(v.id, best.id)) best = v;
    }
    return best;
  }

  /**
   * Forward beta candidate: strictly newer than current stable
   * (and local *stable* if ahead of listed stable). Does NOT floor on local beta —
   * equal local/best is handled in showCheck as「已安装最新 Beta，可重装」.
   * If every beta is ≤ formal stable, return null →「无最新 Beta 版」.
   */
  function pickBetaLatest(data, opts) {
    opts = opts || {};
    var versions = (data && data.versions) || [];
    var stable = pickStableLatest(data);
    var stableId = (stable && stable.id) || data.latest_version || "";
    var localId = opts.localVersion || "";
    var floorId = stableId;
    // Only raise floor for a local *stable* that is ahead of listed stable
    if (localId && !isBetaVersionId(localId) && isVersionNewer(localId, floorId || "0")) {
      floorId = localId;
    }
    var best = null;
    var i, v;
    for (i = 0; i < versions.length; i++) {
      v = versions[i];
      if (!v || !v.id) continue;
      if (!(v.channel === "beta" || isBetaVersionId(v.id))) continue;
      // Must be strictly newer than formal stable floor (same X.Y.Z-Beta is lower → excluded)
      if (floorId && !isVersionNewer(v.id, floorId)) continue;
      if (!best || isVersionNewer(v.id, best.id)) best = v;
    }
    return best;
  }

  function sameVersionId(a, b) {
    if (!a || !b) return false;
    if (String(a) === String(b)) return true;
    return compareVersions(a, b) === 0;
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

  function api(action, extra, timeoutMs, forceGet) {
    var isRead = !!READ_ACTIONS[action];
    var useGet = isRead || !!forceGet;
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

    var token = csrfToken();
    if (useGet) {
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          if (extra[k] != null) url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
        });
      }
      if (!isRead && token) {
        url += "&csrf_token=" + encodeURIComponent(token);
      }
      opts.method = "GET";
    } else {
      // urlencoded body is lighter than FormData and often more reliable through auth-request
      var params = new URLSearchParams();
      params.set("UCWC_ACTION", action);
      if (token) {
        params.set("csrf_token", token);
        opts.headers["X-CSRF-TOKEN"] = token;
      }
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          if (extra[k] != null) params.set(k, String(extra[k]));
        });
      }
      opts.method = "POST";
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      opts.body = params.toString();
      url = API + "?UCWC_ACTION=" + encodeURIComponent(action) + "&_ts=" + Date.now();
    }

    return fetch(url, opts)
      .then(function (r) {
      return r.text().then(function (t) {
        if (r.status === 302 || (/<html/i.test(t) && /login/i.test(t))) {
          throw new Error("未登录或会话已过期，请重新登录 Unraid。");
        }
        if (!t || !String(t).trim()) {
          throw new Error(
            useGet
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
      // 不再展示「安装于 …」
      if (extra) {
        extra.textContent = "";
        extra.hidden = true;
      }
    }
    if (latest && data.latest_version) {
      var tip = "";
      if (data.update_available) tip = "有更新";
      else if (data.local && data.local.installed && data.local.version === data.latest_version)
        tip = "";
      latest.textContent = tip ? " · " + tip : "";
      latest.hidden = !tip;
    }
  }


  /** Title master switch: enable/disable whole Theme Effects runtime. */
  function wireServiceToggle() {
    var tog = document.getElementById("ucwc-service-toggle");
    if (!tog || tog.getAttribute("data-ucwc-wired") === "1") return;
    tog.setAttribute("data-ucwc-wired", "1");
    var stateEl = document.getElementById("ucwc-service-state");
    var label = tog.closest(".ucwc-service-switch");

    function setUi(on, busy) {
      tog.checked = !!on;
      tog.setAttribute("aria-checked", on ? "true" : "false");
      if (stateEl) stateEl.textContent = on ? "开" : "关";
      if (label) {
        if (busy) label.classList.add("is-busy");
        else label.classList.remove("is-busy");
      }
    }

    tog.addEventListener("change", function () {
      var wantOn = !!tog.checked;
      setUi(wantOn, true);
      var tok =
        (typeof window.csrf_token === "string" && window.csrf_token) ||
        (typeof csrf_token === "string" && csrf_token) ||
        "";
      try {
        var inp = document.querySelector('input[name="csrf_token"]');
        if (inp && inp.value) tok = inp.value;
      } catch (e0) {}
      var body =
        "SAVE_THEME_FX=1&UCWC_SECTION=service&SERVICE=" +
        encodeURIComponent(wantOn ? "enabled" : "disabled");
      if (tok) body += "&csrf_token=" + encodeURIComponent(tok);
      var headers = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
      if (tok) headers["X-CSRF-TOKEN"] = tok;
      fetch("/plugins/theme.effects/ucwc-theme-fx-save.php", {
        method: "POST",
        headers: headers,
        body: body,
        credentials: "same-origin",
        redirect: "follow",
      })
        .then(function (r) {
          return r.text().then(function (t) {
            var data = null;
            try {
              data = JSON.parse(t);
            } catch (e1) {
              data = null;
            }
            return { okHttp: r.ok, data: data, raw: t };
          });
        })
        .then(function (res) {
          var data = res.data || {};
          if (!res.okHttp || !data.ok) {
            setUi(!wantOn, false);
            var msg = (data && data.message) || "切换失败，请重试";
            try {
              if (window.swal) swal({ title: "主题特效", text: msg, type: "error" });
              else alert(msg);
            } catch (e2) {
              alert(msg);
            }
            return;
          }
          setUi((data.service || "") === "enabled", true);
          setTimeout(function () {
            try {
              window.location.reload();
            } catch (e3) {
              location.href = location.href;
            }
          }, 280);
        })
        .catch(function () {
          setUi(!wantOn, false);
          try {
            if (window.swal) swal({ title: "主题特效", text: "网络错误，开关未保存", type: "error" });
            else alert("网络错误，开关未保存");
          } catch (e4) {
            alert("网络错误，开关未保存");
          }
        });
    });
  }

  /** Mount: 特效 switch after left title text; version + actions stay on right. */
  function mountVersionInPageTitle() {
    try {
      var existing = document.getElementById("ucwc-title-ver");
      var existingLeft = document.getElementById("ucwc-title-switch");
      if (existing && existing.querySelector("#ucwc-btn-check") &&
          (existingLeft && existingLeft.querySelector("#ucwc-service-toggle") ||
           existing.querySelector("#ucwc-service-toggle"))) {
        var ex = document.getElementById("ucwc-bar-extra");
        if (ex) {
          ex.textContent = "";
          ex.hidden = true;
        }
        // If switch still in right wrap, move it left once
        if (existing.querySelector("#ucwc-service-toggle") && !existingLeft) {
          /* fall through to re-home */
        } else {
          return;
        }
      }
      var src = document.getElementById("ucwc-ver-bar");
      if (!src && !existing) return;
      var titles = document.querySelectorAll("div.title");
      var host = null;
      for (var i = 0; i < titles.length; i++) {
        var t = titles[i];
        if (t.classList && t.classList.contains("ucwc-fx-sec-title")) continue;
        if (t.closest && t.closest("#ucwc-fx-form")) continue;
        var leftProbe = t.querySelector("span.left") || t;
        var txt = (leftProbe.textContent || "").replace(/\s+/g, " ").trim();
        if (txt.indexOf("主题特效") >= 0) {
          host = t;
          break;
        }
      }
      if (!host) {
        for (var j = 0; j < titles.length; j++) {
          if (titles[j].classList && titles[j].classList.contains("ucwc-fx-sec-title")) continue;
          if (titles[j].closest && titles[j].closest("#ucwc-fx-form")) continue;
          host = titles[j];
          break;
        }
      }
      if (!host) host = document.querySelector("#displaybox .content > .title, .content > .title");
      if (!host) return;

      var left = host.querySelector("span.left");
      if (!left) {
        left = document.createElement("span");
        left.className = "left";
        host.insertBefore(left, host.firstChild);
      }
      var right = host.querySelector("span.right");
      if (!right) {
        right = document.createElement("span");
        right.className = "right inline-flex flex-row items-center gap-1";
        host.appendChild(right);
      }

      var wrap = existing;
      if (!wrap) {
        wrap = document.createElement("span");
        wrap.id = "ucwc-title-ver";
        wrap.className = "ucwc-title-ver";
      }

      // Pull children from source bar if still present
      if (src) {
        while (src.firstChild) wrap.appendChild(src.firstChild);
        src.setAttribute("hidden", "");
        src.setAttribute("aria-hidden", "true");
      }

      // Split: service switch → left (after 主题特效); version/actions → right
      var sw = wrap.querySelector(".ucwc-service-switch");
      if (!sw) {
        var togEl = document.getElementById("ucwc-service-toggle");
        if (togEl) sw = togEl.closest(".ucwc-service-switch");
      }
      var leftSlot = existingLeft;
      if (!leftSlot) {
        leftSlot = document.createElement("span");
        leftSlot.id = "ucwc-title-switch";
        leftSlot.className = "ucwc-title-switch";
      }
      if (sw && sw.parentNode !== leftSlot) {
        leftSlot.appendChild(sw);
      }
      // Place leftSlot immediately after title text inside span.left
      if (leftSlot.parentNode !== left) {
        left.appendChild(leftSlot);
      }
      // Ensure visual order: title text nodes first, then switch
      // (appendChild already puts switch at end of left — desired)

      if (wrap.parentNode !== right) {
        right.appendChild(wrap);
      }

      var extra = document.getElementById("ucwc-bar-extra");
      if (extra) {
        extra.textContent = "";
        extra.hidden = true;
      }
    } catch (e) {}
  }

  function showCheck(data, opts) {
    opts = opts || {};
    var betaMode = !!opts.beta;
    openPanel(betaMode ? "检查 Beta 更新" : "检查更新");
    updateBar(data);
    var local = data.local || {};
    var localVerRaw = local.installed ? local.version || "" : "";
    var localVer = local.installed ? local.version || "未知" : "";
    var stableMeta = pickStableLatest(data) || data.latest || null;
    var stableId = (stableMeta && stableMeta.id) || data.latest_version || "";
    var bestBeta = betaMode ? pickBestBeta(data) : null;
    // Forward beta = strictly newer than formal stable (same X.Y.Z-Beta is not forward of that stable)
    var forwardBeta = betaMode
      ? pickBetaLatest(data, { localVersion: localVerRaw })
      : null;
    var latestMeta = betaMode ? null : stableMeta || {};
    var betaState = ""; // none | no_forward | reinstall | update | install
    var updateAvail = false;
    var remoteId = "-";
    var installTarget = null;

    if (betaMode) {
      if (!bestBeta || !bestBeta.id) {
        betaState = "none";
        latestMeta = null;
      } else if (!forwardBeta || !forwardBeta.id) {
        // Best beta exists but not ahead of formal → 无最新 Beta
        betaState = "no_forward";
        latestMeta = null;
      } else {
        latestMeta = forwardBeta;
        installTarget = forwardBeta;
        remoteId = forwardBeta.id;
        if (!local.installed || !localVerRaw) {
          betaState = "install";
          updateAvail = true;
        } else if (sameVersionId(localVerRaw, forwardBeta.id)) {
          betaState = "reinstall";
          updateAvail = false;
        } else if (isVersionNewer(forwardBeta.id, localVerRaw)) {
          betaState = "update";
          updateAvail = true;
        } else {
          // Local beta newer than catalog forward (rare) → still allow reinstall of catalog best
          betaState = "reinstall";
          updateAvail = false;
        }
      }
    } else {
      latestMeta = stableMeta || {};
      remoteId =
        (latestMeta && latestMeta.id) || data.latest_version || "-";
      installTarget = latestMeta;
      if (latestMeta && latestMeta.id) {
        updateAvail = !!(local.installed && localVerRaw && isVersionNewer(latestMeta.id, localVerRaw));
        if (!updateAvail && local.installed && localVerRaw && latestMeta.id !== localVerRaw) {
          updateAvail = isVersionNewer(latestMeta.id, localVerRaw);
        }
      } else {
        updateAvail = !!data.update_available;
      }
    }

    var html = "";
    html += "<p>当前：" + esc(local.installed ? local.version || "未知" : "未安装");
    if (local.updated_at) html += "（" + esc(local.updated_at) + "）";
    html += "</p>";

    if (betaMode && (betaState === "none" || betaState === "no_forward")) {
      html += '<p class="ucwc-ok">无最新 Beta 版。</p>';
      if (betaState === "none") {
        html += '<p class="ucwc-muted">远程暂无 Beta 包。</p>';
      } else {
        html +=
          '<p class="ucwc-muted">列表中的 Beta 均不高于当前正式版' +
          (stableId ? "（" + esc(stableId) + "）" : "") +
          "，无需降级安装旧 Beta。</p>";
        if (bestBeta && bestBeta.id) {
          html +=
            '<p class="ucwc-muted">目录最新 Beta 为 ' +
            esc(bestBeta.id) +
            "，已由正式版覆盖，不再提供安装。</p>";
        }
      }
    } else {
      if (betaMode) {
        remoteId = (latestMeta && latestMeta.id) || remoteId;
      }
      html +=
        "<p>" +
        (betaMode ? "远程 Beta：" : "远程最新：") +
        "<strong>" +
        esc(remoteId) +
        "</strong>";
      if (latestMeta && latestMeta.label) html += " — " + esc(latestMeta.label);
      if (latestMeta && latestMeta.released_at) html += "（" + esc(latestMeta.released_at) + "）";
      html += "<br>" + chips(latestMeta || {}) + "</p>";
      if (betaMode) {
        if (betaState === "update") {
          html += '<p class="ucwc-ok">发现新的 Beta 版本，可更新体验。</p>';
        } else if (betaState === "reinstall") {
          html +=
            '<p class="ucwc-ok">已安装最新 Beta，可重装。</p>' +
            '<p class="ucwc-muted">当前与远程一致，重新安装可修复本地文件。</p>';
        } else if (betaState === "install") {
          html += '<p class="ucwc-warn">本地未检测到主题安装，可一键安装 Beta 版。</p>';
        } else {
          html += '<p class="ucwc-ok">发现可用 Beta 版本。</p>';
        }
      } else if (updateAvail) {
        html += '<p class="ucwc-ok">发现新版本，可升级到最新版。</p>';
      } else if (local.installed) {
        html +=
          '<p class="ucwc-ok">已是最新正式版。仍可重新安装最新包以修复文件。</p>';
      } else {
        html +=
          '<p class="ucwc-warn">本地未检测到主题安装，可一键安装最新版。</p>';
      }
    }
    if (!betaMode || (latestMeta && latestMeta.id)) {
      html +=
        '<p class="ucwc-muted">安装方式：<strong>OTA</strong> 仅下载变更/缺失文件；<strong>全量</strong> 重新下载全部包文件。</p>';
    }
    // 进度/日志由 ensureProgressUi 统一创建在进度条下方，避免重复 id 导致日志写到隐藏节点
    body.innerHTML = html;
    actions.innerHTML = "";
    // 正式 / Beta：OTA（增量）与全量；Beta 无 forward 时不提供旧 Beta 安装
    if (!betaMode || (latestMeta && latestMeta.id)) {
      var targetId = "";
      var useLatestAction = false;
      if (betaMode) {
        targetId = (installTarget && installTarget.id) || (latestMeta && latestMeta.id) || "";
      } else if (latestMeta && latestMeta.id && !isBetaVersionId(latestMeta.id)) {
        targetId = latestMeta.id;
      } else {
        useLatestAction = true;
      }
      var otaLabel;
      var fullLabel;
      if (betaMode) {
        if (betaState === "update" || betaState === "install") {
          otaLabel = "OTA 安装此 Beta";
          fullLabel = "全量安装此 Beta";
        } else {
          otaLabel = "OTA 重装此 Beta";
          fullLabel = "全量重装此 Beta";
        }
      } else if (updateAvail) {
        otaLabel = "OTA 升级到最新版";
        fullLabel = "全量升级到最新版";
      } else if (local.installed) {
        otaLabel = "OTA 重装最新版";
        fullLabel = "全量重装最新版";
      } else {
        otaLabel = "OTA 安装最新版";
        fullLabel = "全量安装最新版";
      }
      function doInstall(mode) {
        if (useLatestAction) runInstall("install_latest", "", 0, mode);
        else runInstall("install_version", targetId, 0, mode);
      }
      var btnOta = document.createElement("input");
      btnOta.type = "button";
      btnOta.value = otaLabel;
      btnOta.title = "仅下载与服务器不一致或缺失的文件（推荐）";
      btnOta.addEventListener("click", function () {
        doInstall("ota");
      });
      actions.appendChild(btnOta);
      var btnFull = document.createElement("input");
      btnFull.type = "button";
      btnFull.value = fullLabel;
      btnFull.title = "重新下载安装包内全部文件（修复损坏时用）";
      btnFull.addEventListener("click", function () {
        doInstall("full");
      });
      actions.appendChild(btnFull);
    }
    // 正式 ↔ Beta 检查面板可来回切换
    function switchCheckMode(toBeta) {
      openPanel(toBeta ? "检查 Beta 更新" : "检查更新");
      body.innerHTML = "<p>正在检查" + (toBeta ? " Beta 版" : "正式版") + "更新…</p>";
      actions.innerHTML = "";
      api("check_update")
        .then(function (d) {
          showCheck(d, { beta: !!toBeta });
        })
        .catch(function (e) {
          body.innerHTML = '<p class="ucwc-err">' + esc(e.message || e) + "</p>";
          actions.innerHTML = "";
          var c0 = document.createElement("input");
          c0.type = "button";
          c0.value = "关闭";
          c0.addEventListener("click", closePanel);
          actions.appendChild(c0);
        });
    }
    if (!betaMode) {
      var btnBeta = document.createElement("input");
      btnBeta.type = "button";
      btnBeta.value = "检查 Beta 版更新";
      btnBeta.addEventListener("click", function () {
        switchCheckMode(true);
      });
      actions.appendChild(btnBeta);
    } else {
      var btnStable = document.createElement("input");
      btnStable.type = "button";
      btnStable.value = "检查正式版更新";
      btnStable.addEventListener("click", function () {
        switchCheckMode(false);
      });
      actions.appendChild(btnStable);
    }
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
    go.value = "OTA 安装此版本";
    go.title = "仅下载变更/缺失文件";
    go.addEventListener("click", function () {
      var id = cache.selected || "";
      if (!id) return;
      if (!window.confirm("OTA 安装 " + id + " ？仅下载变更文件，已一致的会跳过。")) return;
      runInstall("install_version", id, 0, "ota");
    });
    actions.appendChild(go);
    var goFull = document.createElement("input");
    goFull.type = "button";
    goFull.value = "全量安装此版本";
    goFull.title = "重新下载全部包文件";
    goFull.addEventListener("click", function () {
      var id = cache.selected || "";
      if (!id) return;
      if (!window.confirm("全量安装 " + id + " ？将重新下载全部主题文件。")) return;
      runInstall("install_version", id, 0, "full");
    });
    actions.appendChild(goFull);

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
        '<div class="ucwc-progress-meta"><strong id="ucwc-progress-pct" class="ucwc-progress-pct">0%</strong> · <span id="ucwc-progress-stage">启动</span></div>' +
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

  var _ucwcLastPct = 0;
  var _ucwcLastStage = "";
  var _ucwcProgressStartedAt = 0;
  var _ucwcHeartTimer = 0;

  function clearProgressHeartbeat() {
    if (_ucwcHeartTimer) {
      try { clearInterval(_ucwcHeartTimer); } catch (eH) {}
      _ucwcHeartTimer = 0;
    }
  }

  function startProgressHeartbeat() {
    clearProgressHeartbeat();
    _ucwcProgressStartedAt = Date.now();
    _ucwcHeartTimer = setInterval(function () {
      // Soft visual crawl while a long silent download runs (never past 90 until real updates)
      if (_ucwcLastPct > 0 && _ucwcLastPct < 90) {
        var soft = Math.min(90, _ucwcLastPct + 1);
        var el = document.getElementById("ucwc-progress-pct");
        var age = Date.now() - (_ucwcProgressStartedAt || Date.now());
        if (age > 2500 && soft > _ucwcLastPct && soft - _ucwcLastPct <= 8) {
          var bar = document.getElementById("ucwc-progress-bar");
          if (bar) bar.style.width = soft + "%";
          if (el) el.textContent = soft + "%";
          var msg = document.getElementById("ucwc-busy-msg");
          if (msg && _ucwcLastStage) {
            var sec = Math.floor(age / 1000);
            msg.textContent =
              _ucwcLastStage +
              "中… " +
              soft +
              "%（已用时 " +
              sec +
              "s，大文件下载属正常）";
          }
        }
      }
    }, 1200);
  }

  function setProgress(pct, stage, line) {
    ensureProgressUi(false);
    var bar = document.getElementById("ucwc-progress-bar");
    var pctEl = document.getElementById("ucwc-progress-pct");
    var stageEl = document.getElementById("ucwc-progress-stage");
    var msg = document.getElementById("ucwc-busy-msg");
    var n = _ucwcLastPct;
    if (pct != null && pct !== "") {
      n = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
      // never go backwards (except reset on new job)
      if (n < _ucwcLastPct && n > 5) n = _ucwcLastPct;
      _ucwcLastPct = n;
      _ucwcProgressStartedAt = Date.now();
      if (bar) bar.style.width = n + "%";
      if (pctEl) pctEl.textContent = n + "%";
    } else if (pctEl && _ucwcLastPct >= 0) {
      pctEl.textContent = _ucwcLastPct + "%";
      n = _ucwcLastPct;
    }
    if (stage) {
      _ucwcLastStage = stage;
      if (stageEl) stageEl.textContent = stage + " · " + n + "%";
    } else if (stageEl) {
      stageEl.textContent = (_ucwcLastStage || "进行中") + " · " + n + "%";
    }
    if (msg) {
      var base = line || stage || _ucwcLastStage || "执行中…";
      // Always surface percentage in the main status line
      if (!/\d+%/.test(String(base))) {
        msg.textContent = String(base).replace(/[…\.]*$/, "") + "… " + n + "%";
      } else {
        msg.textContent = base;
      }
    }
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
    clearProgressHeartbeat();
    setBusy(false);
    var ok = !(j && j.ok === false);
    var msg = (j && (j.message || j.stage)) || (ok ? "完成" : "失败");
    _ucwcLastPct = 100;
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
        clearProgressHeartbeat();
        setBusy(false);
        appendJobLog("\n==== 失败 ====\n进度查询失败：" + String(e.message || e) + "\n");
        setProgress(100, "失败", "进度查询失败");
        showInstallResultActions(false, false);
      });
  }

  function runInstall(action, version, attempt, installMode) {
    if (busy && !attempt) return;
    var tryN = attempt || 1;
    var maxTry = 4;
    var mode = installMode === "full" ? "full" : action === "uninstall" ? "" : "ota";
    setBusy(true, "正在启动任务…");
    // 安装过程只保留进度+日志，避免与检测结果区的重复节点抢 id
    if (body && tryN === 1) {
      body.innerHTML = "";
    }
    ensureProgressUi(tryN === 1);
    _ucwcLastPct = 0;
    _ucwcLastStage = "启动任务";
    clearProgressHeartbeat();
    setProgress(3, "启动任务", tryN > 1 ? "重试提交安装请求（" + tryN + "/" + maxTry + "）…" : "正在提交安装请求…");
    appendJobLog(
      "[" +
        new Date().toLocaleTimeString() +
        "] 提交 " +
        action +
        (version ? " " + version : "") +
        (mode ? " [" + (mode === "full" ? "全量" : "OTA") + "]" : "") +
        (tryN > 1 ? "（重试 " + tryN + "/" + maxTry + "）" : "") +
        "…\n"
    );
    var extra = { async: "1" };
    if (version) extra.version = version;
    if (mode) extra.install_mode = mode;
    // Odd tries: GET+csrf (same path as check_update, more reliable on busy fpm).
    // Even tries: POST urlencoded. Alternate to survive auth-request stalls on one method.
    var forceGet = tryN % 2 === 1;
    appendJobLog("传输方式：" + (forceGet ? "GET+csrf" : "POST") + "\n");
    // 10s: server only enqueues job.
    api(action, extra, 10000, forceGet)
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
          _ucwcLastPct = 6;
          startProgressHeartbeat();
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
          /超时|timeout|aborted|空响应|非 JSON|504|502|401|未登录|会话|网络|Failed to fetch|NetworkError|CSRF/i.test(
            err
          );
        if (retryable && tryN < maxTry) {
          appendJobLog("[提示] " + err + " — 将自动重试（切换传输方式）…\n");
          setProgress(3, "等待重试", "Web 鉴权/进程繁忙，稍后重试…");
          setTimeout(function () {
            // allow re-entry
            busy = false;
            runInstall(action, version, tryN + 1, mode || installMode);
          }, 1200 * tryN);
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

    mountVersionInPageTitle();
    wireServiceToggle();

    wire("ucwc-btn-check", function () {
      openPanel("检查更新");
      body.innerHTML = "<p>正在检查更新…</p>";
      actions.innerHTML = "";
      api("check_update")
        .then(function (d) {
          showCheck(d, { beta: false });
        })
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
  }


  /**
   * Align path fields to neighboring content-sized <select>s.
   * Measures natural select width (does not force selects wider) and applies
   * the same pixel width to every .ucwc-path-field.
   */
  function alignPathFieldWidths(root) {
    try {
      root = root || document;
      var form =
        root.querySelector("#ucwc-fx-form") ||
        root.querySelector('form[action*="ThemeEffects"]') ||
        document.querySelector("#ucwc-fx-form") ||
        document.querySelector('form[action*="ThemeEffects"]');
      if (!form) return;

      // Temporarily clear path override so we only read select geometry
      // Prefer music-row selects (same block as the path field in the screenshot)
      var names = [
        "MUSIC_UI",
        "MUSIC_SOURCE",
        "MUSIC_ENABLE",
        "MUSIC_AUTOPLAY",
        "MOUSE_FX",
        "BG_MODE",
      ];
      var probes = [];
      var i, el, n;
      for (i = 0; i < names.length; i++) {
        el = form.querySelector('select[name="' + names[i] + '"]');
        if (el) probes.push(el);
      }
      if (!probes.length) {
        var all = form.querySelectorAll("dd > select, select");
        for (i = 0; i < all.length && probes.length < 6; i++) probes.push(all[i]);
      }
      if (!probes.length) return;

      // Use the max width among nearby selects so path isn't shorter than the widest label row
      // (界面形态「仪表盘卡片」usually longest in that block).
      var w = 0;
      for (i = 0; i < probes.length; i++) {
        try {
          // Ensure select is content-sized for measurement (undo any leftover inline width)
          if (probes[i].style && probes[i].style.width) probes[i].style.width = "";
          var r = probes[i].getBoundingClientRect();
          n = r && r.width ? r.width : probes[i].offsetWidth || 0;
          if (n > w) w = n;
        } catch (e0) {}
      }
      if (!(w > 40)) return;
      // Match border-box outer width of select; path-field uses same box-sizing
      w = Math.round(w);
      if (w < 100) w = 100;
      if (w > 420) w = 420;
      var px = w + "px";
      form.style.setProperty("--ucwc-ctrl-w", px);
      try {
        document.documentElement.style.setProperty("--ucwc-ctrl-w", px);
      } catch (e2) {}
      var fields = form.querySelectorAll(".ucwc-path-field");
      for (i = 0; i < fields.length; i++) {
        fields[i].style.setProperty("width", px, "important");
        fields[i].style.setProperty("max-width", "100%", "important");
        fields[i].style.setProperty("box-sizing", "border-box", "important");
        // inner input fills the field
        var inp = fields[i].querySelector(".ucwc-local-path");
        if (inp) {
          inp.style.setProperty("width", "100%", "important");
          inp.style.setProperty("max-width", "none", "important");
          inp.style.setProperty("box-sizing", "border-box", "important");
        }
      }
    } catch (eAlign) {}
  }

  /** Unraid-style path picker (jquery.fileTree) on local path inputs. */
  function wireFileTreePickers() {
    try {
      if (typeof window.jQuery === "undefined" || !jQuery.fn || !jQuery.fn.fileTreeAttach) {
        return false;
      }
      var $ = jQuery;
      var $els = $(".ucwc-local-path");
      if (!$els.length) {
        // legacy ids
        $els = $("#ucwc-bg-local-path, #ucwc-hutao-local-path, #ucwc-music-local-dir");
      }
      $els.each(function () {
        var $el = $(this);
        if (!$el.length) return;
        if ($el.data("ucwcFileTree")) return;
        $el.attr("autocomplete", "off");
        $el.attr("spellcheck", "false");
        if (!$el.attr("data-pickroot")) {
          var pr =
            (window.__UCWC_FX_BOOT__ && window.__UCWC_FX_BOOT__.pickroot) ||
            "/mnt/user";
          $el.attr("data-pickroot", pr);
          $el.attr("data-picktop", pr);
        }
        // Folder-only fields (music dir etc.): data-pickfolders must be present for
        // Unraid fileTreeAttach to write path on folder click.
        var isFolder =
          $el.is("[data-pickfolders]") ||
          $el.attr("data-pickfolders") === "true" ||
          $el.attr("data-pickfolders") === "" ||
          $el.attr("id") === "ucwc-music-local-dir" ||
          $el.hasClass("ucwc-path-dir");
        if (isFolder) {
          $el.attr("data-pickfolders", "true");
          // Keep tree open while browsing folders; only close when leaving
          if (!$el.attr("data-pickcloseonfile")) $el.attr("data-pickcloseonfile", "false");
        } else if (!$el.attr("data-pickcloseonfile")) {
          $el.attr("data-pickcloseonfile", "true");
        }
        $el.fileTreeAttach();
        $el.data("ucwcFileTree", 1);
        $el.on("change.ucwc input.ucwc", function () {
          try {
            var form = findForm();
            if (form) enableApply(form, true);
            syncUi();
          } catch (e0) {}
        });
      });
      // Browse button → focus/click the path input so fileTree opens (native Unraid affordance)
      $(document)
        .off("click.ucwcPathBrowse", ".ucwc-path-browse")
        .on("click.ucwcPathBrowse", ".ucwc-path-browse", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var $btn = $(this);
          var $wrap = $btn.closest(".ucwc-path-field");
          var $inp = $wrap.find(".ucwc-local-path").first();
          if (!$inp.length) $inp = $btn.siblings(".ucwc-local-path").first();
          if (!$inp.length) return;
          try {
            $inp.trigger("click");
            $inp.trigger("focus");
          } catch (e1) {}
        });
      return true;
    } catch (e) {
      return false;
    }
  }

  function probeClientTier() {
    var mem = 0;
    try {
      mem = navigator.deviceMemory || 0;
    } catch (e) {}
    var cores = 0;
    try {
      cores = navigator.hardwareConcurrency || 0;
    } catch (e2) {}
    var dpr = 1;
    try {
      dpr = window.devicePixelRatio || 1;
    } catch (e3) {}
    var w = window.innerWidth || 0;
    var mobile = w > 0 && w < 768;
    var saveData = false;
    try {
      saveData = !!(navigator.connection && navigator.connection.saveData);
    } catch (e4) {}
    var low =
      saveData ||
      (mem > 0 && mem <= 4) ||
      (cores > 0 && cores <= 4) ||
      (mobile && dpr >= 2.5) ||
      (mem > 0 && mem <= 8 && cores > 0 && cores <= 4 && mobile);
    var high = !low && ((mem >= 8 && cores >= 6) || (!mobile && mem >= 8));
    var tier = low ? "low" : high ? "high" : "balanced";
    return {
      tier: tier,
      mem: mem,
      cores: cores,
      dpr: dpr,
      mobile: mobile,
      saveData: saveData,
    };
  }

  function applyPerfSuggestion(tier, opts) {
    opts = opts || {};
    var form = findForm();
    if (!form) return;
    var profileSel = form.querySelector('select[name="PERF_PROFILE"]');
    var particles = form.querySelector('select[name="PARTICLES"]');
    var pCount = form.querySelector('input[name="PARTICLES_COUNT"]');
    var reduce = form.querySelector('select[name="REDUCE_MOTION"]');
    var bgBlur = form.querySelector('select[name="BG_BLUR"]');
    var bgBlurLv = form.querySelector('select[name="BG_BLUR_LEVEL"]');
    var hutaoBlur = form.querySelector('select[name="HUTAO_BLUR"]');
    var hutaoBlurLv = form.querySelector('select[name="HUTAO_BLUR_LEVEL"]');
    var clientOpt =
      form.querySelector('input[name="CLIENT_OPTIMIZED"]') ||
      document.getElementById("ucwc-client-optimized");

    if (tier === "low") {
      if (particles) particles.value = "no";
      if (reduce) reduce.value = "yes";
      if (pCount) pCount.value = "40";
      if (bgBlurLv) bgBlurLv.value = "sm";
      if (hutaoBlur) hutaoBlur.value = "no";
      if (hutaoBlurLv) hutaoBlurLv.value = "sm";
      if (profileSel && opts.setProfileSelect) profileSel.value = "low";
    } else if (tier === "balanced") {
      if (reduce) reduce.value = "no";
      if (pCount) {
        var nB = parseInt(pCount.value, 10) || 60;
        if (nB > 80) pCount.value = "80";
        else if (nB < 40) pCount.value = "60";
      }
      if (bgBlurLv && bgBlurLv.value === "lg") bgBlurLv.value = "md";
      if (hutaoBlurLv && hutaoBlurLv.value === "lg") hutaoBlurLv.value = "md";
      if (profileSel && opts.setProfileSelect) profileSel.value = "balanced";
    } else if (tier === "high") {
      if (particles) particles.value = "yes";
      if (reduce) reduce.value = "no";
      if (pCount) {
        var nH = parseInt(pCount.value, 10) || 80;
        if (nH < 80) pCount.value = "80";
      }
      if (bgBlurLv && bgBlurLv.value === "sm") bgBlurLv.value = "md";
      if (profileSel && opts.setProfileSelect) profileSel.value = "high";
    } else {
      if (profileSel && opts.setProfileSelect) profileSel.value = tier || "auto";
    }
    if (clientOpt) clientOpt.value = "yes";
    try {
      syncUi();
    } catch (e1) {}
    enableApply(form, true);
  }

  
  // Mouse FX settings helpers (range labels + color mode)
  
  function livePreviewMouseFx(root) {
    root = root || document;
    if (!window.UcwcMouseFx || typeof window.UcwcMouseFx.applyFromForm !== "function") return;
    try {
      window.UcwcMouseFx.applyFromForm(root.querySelector("#ucwc-fx-form") || root);
    } catch (eLP) {}
  }

  function bindMouseFxLivePreview(root) {
    root = root || document;
    var form = root.querySelector("#ucwc-fx-form") || root;
    var names = [
      "MOUSE_FX",
      "MOUSE_STYLE",
      "MOUSE_SIZE",
      "MOUSE_INTENSITY",
      "MOUSE_COLOR",
      "MOUSE_CLICK_RIPPLE",
      "MOUSE_CURSOR",
      "REDUCE_MOTION",
    ];
    function onAny() {
      livePreviewMouseFx(form);
    }
    for (var i = 0; i < names.length; i++) {
      var nodes = form.querySelectorAll('[name="' + names[i] + '"]');
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].addEventListener("input", onAny);
        nodes[j].addEventListener("change", onAny);
      }
    }
    var picker = form.querySelector("#ucwc-mouse-color-picker");
    var mode = form.querySelector("#ucwc-mouse-color-mode");
    if (picker) {
      picker.addEventListener("input", onAny);
      picker.addEventListener("change", onAny);
    }
    if (mode) mode.addEventListener("change", onAny);
    // initial sync so opening settings with MOUSE_FX=yes shows effect immediately
    setTimeout(onAny, 60);
  }

  function bindMouseFxControls(root) {
    root = root || document;
    function bindRange(inputName, valId) {
      var el = root.querySelector('input[name="' + inputName + '"]');
      var lab = root.querySelector("#" + valId);
      if (!el) return;
      function sync() {
        if (lab) lab.textContent = String(el.value || "");
        try { livePreviewMouseFx(root); } catch (eS) {}
      }
      el.addEventListener("input", sync);
      el.addEventListener("change", sync);
      sync();
    }
    bindRange("MOUSE_SIZE", "ucwc-mouse-size-val");
    bindRange("MOUSE_INTENSITY", "ucwc-mouse-intensity-val");
    // Music volume label (settings page); no live player preview needed here
    (function bindMusicVolume() {
      var el = root.querySelector('input[name="MUSIC_VOLUME"]') || root.querySelector("#ucwc-music-volume");
      var lab = root.querySelector("#ucwc-music-volume-val");
      if (!el) return;
      function sync() {
        if (lab) lab.textContent = String(el.value || "");
      }
      el.addEventListener("input", sync);
      el.addEventListener("change", sync);
      sync();
    })();

    var mode = root.querySelector("#ucwc-mouse-color-mode");
    var picker = root.querySelector("#ucwc-mouse-color-picker");
    var text = root.querySelector("#ucwc-mouse-color") || root.querySelector('input[name="MOUSE_COLOR"]');
    if (mode && text) {
      function syncColorUi() {
        var m = String(mode.value || "auto");
        var auto = m === "auto";
        if (auto) {
          // keep last custom hex in picker for quick switch-back; clear saved value
          if (!String(text.value || "").trim()) {
            /* already empty */
          }
        }
        if (picker) {
          picker.style.opacity = auto ? "0.45" : "1";
          picker.title = auto ? "自动色：切换到「自定义」后再选色" : "自定义颜色";
        }
        text.placeholder = auto ? "自动（主题青）" : "#00f3ff";
      }
      mode.addEventListener("change", function () {
        var m = String(mode.value || "auto");
        if (m === "auto") text.value = "";
        else if (!text.value && picker) text.value = picker.value || "#00f3ff";
        syncColorUi();
      });
      if (picker) {
        picker.addEventListener("input", function () {
          if (mode.value !== "custom") mode.value = "custom";
          text.value = picker.value;
          syncColorUi();
        });
        picker.addEventListener("click", function () {
          if (mode.value === "auto") {
            mode.value = "custom";
            if (!text.value) text.value = picker.value || "#00f3ff";
            syncColorUi();
          }
        });
      }
      text.addEventListener("input", function () {
        var v = String(text.value || "").trim();
        if (v) {
          if (mode.value !== "custom") mode.value = "custom";
          if (picker && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
            picker.value =
              v.length === 4
                ? "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
                : v;
          }
        } else if (mode.value !== "auto") {
          mode.value = "auto";
        }
        syncColorUi();
      });
      // Initial: empty color → auto; non-empty → custom + picker sync
      var init = String(text.value || "").trim();
      if (!init) mode.value = "auto";
      else {
        mode.value = "custom";
        if (picker && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(init)) {
          picker.value =
            init.length === 4
              ? "#" + init[1] + init[1] + init[2] + init[2] + init[3] + init[3]
              : init;
        }
      }
      syncColorUi();
    }
  }

  try { bindMouseFxControls(document); } catch (eMouseBind) {}
  try { bindMouseFxLivePreview(document); } catch (eMouseLive) {}
  // Path field width ↔ select width (pixel align; re-run after layout / fonts)
  try {
    alignPathFieldWidths(document);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        alignPathFieldWidths(document);
      }).catch(function () {});
    }
    window.addEventListener(
      "resize",
      function () {
        alignPathFieldWidths(document);
      },
      { passive: true }
    );
    setTimeout(function () {
      alignPathFieldWidths(document);
    }, 120);
    setTimeout(function () {
      alignPathFieldWidths(document);
    }, 480);
  } catch (eAlignBoot) {}

  /** One-shot success tip under the section Apply button after ?applied=1&section=… */
  function showAppliedTipOnce() {
    try {
      var q = {};
      try {
        var sp = new URLSearchParams(window.location.search || "");
        sp.forEach(function (v, k) {
          q[k] = v;
        });
      } catch (e0) {
        var m = String(window.location.search || "").match(/[?&]applied=([^&]*)/);
        if (m) q.applied = decodeURIComponent(m[1]);
        var m2 = String(window.location.search || "").match(/[?&]section=([^&]*)/);
        if (m2) q.section = decodeURIComponent(m2[1]);
      }
      if (String(q.applied || "") !== "1") return;
      var sec = String(q.section || "all").toLowerCase();
      var labels = {
        bg: "背景",
        particles: "粒子",
        mouse: "鼠标特效",
        music: "音乐",
        mascot: "吉祥物",
        font: "字体",
        perf: "性能",
        service: "特效开关",
        all: "主题特效",
      };
      var form = findForm();
      var wrap =
        (form && form.querySelector('.ucwc-section-actions[data-ucwc-section="' + sec + '"]')) ||
        document.querySelector('.ucwc-section-actions[data-ucwc-section="' + sec + '"]') ||
        null;
      if (!wrap && form) {
        var btn = form.querySelector("#ucwc-btn-save-" + sec);
        if (btn) wrap = btn.parentElement;
      }
      if (!wrap) {
        wrap =
          (form && form.querySelector(".ucwc-section-actions")) ||
          document.querySelector(".ucwc-section-actions");
      }
      if (!wrap) return;
      var old = document.getElementById("ucwc-applied-tip");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var tip = document.createElement("span");
      tip.id = "ucwc-applied-tip";
      tip.className = "ucwc-applied-tip";
      tip.setAttribute("role", "status");
      tip.textContent = (labels[sec] || "主题特效") + "已应用并生效";
      if (wrap.parentNode) {
        if (wrap.nextSibling) wrap.parentNode.insertBefore(tip, wrap.nextSibling);
        else wrap.parentNode.appendChild(tip);
      } else {
        wrap.appendChild(tip);
      }
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete("applied");
        u.searchParams.delete("section");
        u.searchParams.delete("_ts");
        var clean =
          u.pathname +
          (u.searchParams.toString() ? "?" + u.searchParams.toString() : "") +
          (u.hash || "");
        window.history.replaceState(null, "", clean);
      } catch (eHist) {
        try {
          window.history.replaceState(null, "", "/Settings/ThemeEffects");
        } catch (e2) {}
      }
    } catch (eTip) {}
  }
  try {
    showAppliedTipOnce();
  } catch (eTipBoot) {}

  function quietSavePerf(opts) {
    opts = opts || {};
    var form = findForm();
    if (!form) return Promise.resolve();
    // Default perf-only: never wipe other sections with a partial "all" payload.
    var section = opts.section || "perf";
    var tok =
      (typeof window.csrf_token === "string" && window.csrf_token) ||
      (typeof csrf_token === "string" && csrf_token) ||
      "";
    var params = new URLSearchParams();
    params.set("SAVE_THEME_FX", "1");
    params.set("UCWC_SECTION", section);
    if (tok) params.set("csrf_token", tok);

    function putName(nm) {
      var node = form.querySelector('[name="' + nm + '"]');
      if (node && node.type !== "file") params.set(nm, node.value);
    }

    // Always include first-run sticky + profile.
    ["PERF_PROFILE", "CLIENT_OPTIMIZED"].forEach(putName);

    // Apply-suggestion: also push fields applyPerfSuggestion may change.
    if (opts.applySuggestion) {
      [
        "PARTICLES",
        "PARTICLES_COUNT",
        "REDUCE_MOTION",
        "BG_BLUR",
        "BG_BLUR_LEVEL",
        "HUTAO_BLUR",
        "HUTAO_BLUR_LEVEL",
      ].forEach(putName);
      // section=all so server applies particles/bg/mascot/perf together;
      // missing keys are preserved by isset guards server-side.
      params.set("UCWC_SECTION", "all");
    } else if (section === "all") {
      var fields = form.querySelectorAll("select[name], input[name]");
      var count = 0;
      for (var i = 0; i < fields.length; i++) {
        var el = fields[i];
        var n = el.name;
        if (!n || n === "SAVE_THEME_FX" || n === "csrf_token" || n === "UCWC_SECTION") continue;
        if (el.type === "file") continue;
        if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
        params.set(n, el.value);
        count++;
      }
      if (count < 8) {
        // Incomplete form — fall back to perf-only to avoid wiping cfg.
        params.set("UCWC_SECTION", "perf");
      }
    }
    var headers = {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    };
    if (tok) headers["X-CSRF-TOKEN"] = tok;
    return fetch("/plugins/theme.effects/ucwc-theme-fx-save.php", {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: params.toString(),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .catch(function () {
        return {};
      });
  }

  function showPerfToast(probe) {
    try {
      if (document.getElementById("ucwc-perf-toast")) return;
      var tier = probe.tier;
      var label =
        tier === "low" ? "低配（省资源）" : tier === "high" ? "高配（全特效）" : "均衡";
      var detail = [];
      if (probe.mem) detail.push("内存约 " + probe.mem + "GB");
      if (probe.cores) detail.push("逻辑核心 " + probe.cores);
      if (probe.mobile) detail.push("移动端");
      if (probe.saveData) detail.push("省流模式");
      var boot = window.__UCWC_FX_BOOT__ || {};
      var el = document.createElement("div");
      el.id = "ucwc-perf-toast";
      el.className = "ucwc-perf-toast";
      el.setAttribute("role", "status");
      el.innerHTML =
        "<div><strong>首次使用 · 性能建议</strong></div>" +
        '<div style="margin-top:6px">检测到客户端倾向：<strong>' +
        label +
        "</strong>" +
        (detail.length ? "（" + detail.join("，") + "）" : "") +
        "。<br>可一键应用建议（性能档位 / 模糊 / 粒子），避免低配设备卡顿；也可稍后在「性能」段自行调整。</div>" +
        '<div class="ucwc-perf-toast-actions">' +
        '<button type="button" class="ucwc-perf-primary" id="ucwc-perf-apply">应用建议并保存</button>' +
        '<button type="button" id="ucwc-perf-dismiss">稍后</button>' +
        "</div>";
      document.body.appendChild(el);
      document.getElementById("ucwc-perf-dismiss").onclick = function () {
        var form = findForm();
        var clientOpt =
          (form && form.querySelector('input[name="CLIENT_OPTIMIZED"]')) ||
          document.getElementById("ucwc-client-optimized");
        if (clientOpt) clientOpt.value = "yes";
        try {
          if (!window.__UCWC_FX_BOOT__) window.__UCWC_FX_BOOT__ = {};
          window.__UCWC_FX_BOOT__.client_optimized = "yes";
        } catch (eBoot) {}
        quietSavePerf({ section: "perf" }).finally(function () {
          el.remove();
        });
      };
      document.getElementById("ucwc-perf-apply").onclick = function () {
        applyPerfSuggestion(tier, { setProfileSelect: true, forceProfile: true });
        quietSavePerf({ section: "all", applySuggestion: true }).finally(function () {
          el.remove();
          try {
            window.location.reload();
          } catch (e) {}
        });
      };
    } catch (e) {}
  }

  function maybeFirstRunOptimize() {
    try {
      var boot = window.__UCWC_FX_BOOT__ || {};
      if (String(boot.client_optimized || "") === "yes") return;
      var form = findForm();
      if (!form) return;
      var hidden = form.querySelector('input[name="CLIENT_OPTIMIZED"]');
      if (hidden && hidden.value === "yes") return;
      if (!document.getElementById("ucwc-fx-form")) return;
      var probe = probeClientTier();
      showPerfToast(probe);
    } catch (e) {}
  }


  function bootAll() {
    mountVersionInPageTitle();
    wireServiceToggle();
    bindFormUi();
    bindVersionUi();
    wireFileTreePickers();
    setTimeout(wireFileTreePickers, 100);
    setTimeout(wireFileTreePickers, 400);
    setTimeout(maybeFirstRunOptimize, 600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAll);
  else bootAll();
  // Unraid may reflow title after our script; remount once more shortly
  setTimeout(function () { mountVersionInPageTitle(); wireServiceToggle(); wireFileTreePickers(); }, 0);
  setTimeout(function () { mountVersionInPageTitle(); wireServiceToggle(); wireFileTreePickers(); }, 200);
})();
