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
    if (!s && btn.id) {
      if (btn.id.indexOf("-bg") >= 0) s = "bg";
      else if (btn.id.indexOf("-particles") >= 0) s = "particles";
      else if (btn.id.indexOf("-mascot") >= 0) s = "mascot";
    }
    s = String(s || "all").toLowerCase();
    if (s === "background" || s === "wallpaper") s = "bg";
    if (s === "hutao") s = "mascot";
    if (["bg", "particles", "mascot", "all"].indexOf(s) < 0) s = "all";
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
          '#ucwc-btn-done, #ucwc-btn-done-bg, #ucwc-btn-done-particles, #ucwc-btn-done-mascot, input[type="button"][value="完成"], input[type="button"][value="Done"], input[value="重置"], input[value="Reset"]'
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
          bg: ["BG_MODE", "BG_LOCAL_SLOT", "BG_GALLERY", "BG_CUSTOM_API", "BG_BLUR", "BG_UPLOAD"],
          particles: ["PARTICLES", "PARTICLES_COUNT", "PARTICLES_COUNT_COMMIT", "REDUCE_MOTION"],
          mascot: ["HUTAO", "HUTAO_TYPE", "HUTAO_SIZE", "HUTAO_POS", "HUTAO_BLUR", "HUTAO_UPLOAD"],
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
          all: null,
        };
        var allow = fieldSets[section] || null;

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
              enableApply(form, true);
              if (json.saved) {
                setTimeout(function () {
                  goApplied(json.redirect || "/Settings/ThemeEffects?applied=1");
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
            goApplied("/Settings/ThemeEffects?applied=1");
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
        "REDUCE_MOTION",
        "BG_BLUR",
        "FONT_BODY",
        "FONT_TITLE",
        "FONT_TITLE_UPPER",
        "FONT_SIZE",
        "FONT_TITLE_SIZE",
        "COLOR_PRESET",
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

  /** Newest beta entry from versions list (by list order; index puts newest first). */
  function pickBetaLatest(data) {
    var versions = (data && data.versions) || [];
    var i, v;
    for (i = 0; i < versions.length; i++) {
      v = versions[i];
      if (!v) continue;
      if (v.channel === "beta" || isBetaVersionId(v.id)) return v;
    }
    return null;
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

  /** Move version + action buttons into page title row (主题特效) right side. */
  function mountVersionInPageTitle() {
    try {
      var existing = document.getElementById("ucwc-title-ver");
      if (existing && existing.querySelector("#ucwc-btn-check")) {
        // already mounted
        var ex = document.getElementById("ucwc-bar-extra");
        if (ex) {
          ex.textContent = "";
          ex.hidden = true;
        }
        return;
      }
      var src = document.getElementById("ucwc-ver-bar");
      if (!src) return;
      var titles = document.querySelectorAll("div.title");
      var host = null;
      for (var i = 0; i < titles.length; i++) {
        var t = titles[i];
        // Skip in-form section titles
        if (t.classList && t.classList.contains("ucwc-fx-sec-title")) continue;
        if (t.closest && t.closest("#ucwc-fx-form")) continue;
        var left = t.querySelector("span.left") || t;
        var txt = (left.textContent || "").replace(/\s+/g, " ").trim();
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
      // Move nodes (preserve button ids for wire)
      while (src.firstChild) wrap.appendChild(src.firstChild);
      right.appendChild(wrap);
      src.setAttribute("hidden", "");
      src.setAttribute("aria-hidden", "true");
      // Ensure no install-date leftover
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
    var latestMeta = betaMode ? pickBetaLatest(data) : pickStableLatest(data) || data.latest || {};
    var remoteId =
      (latestMeta && latestMeta.id) ||
      (!betaMode ? data.latest_version : "") ||
      "-";
    var localVer = local.installed ? local.version || "未知" : "";
    var updateAvail = false;
    if (betaMode) {
      updateAvail = !!(latestMeta && latestMeta.id && localVer && latestMeta.id !== localVer);
    } else if (latestMeta && latestMeta.id) {
      updateAvail = !!(local.installed && localVer && latestMeta.id !== localVer);
    } else {
      updateAvail = !!data.update_available;
    }
    var html = "";
    html += "<p>当前：" + esc(local.installed ? local.version || "未知" : "未安装");
    if (local.updated_at) html += "（" + esc(local.updated_at) + "）";
    html += "</p>";
    if (betaMode && (!latestMeta || !latestMeta.id)) {
      html += '<p class="ucwc-warn">未找到可用的 Beta 版本。</p>';
    } else {
      html +=
        "<p>" +
        (betaMode ? "远程 Beta：" : "远程最新：") +
        "<strong>" +
        esc(remoteId) +
        "</strong>";
      if (latestMeta && latestMeta.label) html += " — " + esc(latestMeta.label);
      if (latestMeta && latestMeta.released_at) html += "（" + esc(latestMeta.released_at) + "）";
      html += "<br>" + chips(latestMeta || {}) + "</p>";
      if (updateAvail) {
        html +=
          '<p class="ucwc-ok">' +
          (betaMode ? "发现新的 Beta 版本，可安装体验。" : "发现新版本，可升级到最新版。") +
          "</p>";
      } else if (local.installed) {
        html +=
          '<p class="ucwc-ok">' +
          (betaMode
            ? "已是当前列表中的 Beta（或同版本）。仍可重新安装该 Beta 包。"
            : "已是最新正式版。仍可重新安装最新包以修复文件。") +
          "</p>";
      } else {
        html +=
          '<p class="ucwc-warn">本地未检测到主题安装，可一键安装' +
          (betaMode ? " Beta 版。" : "最新版。") +
          "</p>";
      }
    }
    // 进度/日志由 ensureProgressUi 统一创建在进度条下方，避免重复 id 导致日志写到隐藏节点
    body.innerHTML = html;
    actions.innerHTML = "";
    if (!betaMode || (latestMeta && latestMeta.id)) {
      var btn = document.createElement("input");
      btn.type = "button";
      if (betaMode) {
        btn.value = updateAvail ? "安装此 Beta" : "重新安装此 Beta";
        btn.addEventListener("click", function () {
          runInstall("install_version", latestMeta.id);
        });
      } else {
        btn.value = updateAvail ? "升级到最新版" : "重新安装最新版";
        btn.addEventListener("click", function () {
          if (latestMeta && latestMeta.id && isBetaVersionId(data.latest_version) === false) {
            runInstall("install_version", latestMeta.id);
          } else if (latestMeta && latestMeta.id && !isBetaVersionId(latestMeta.id)) {
            runInstall("install_version", latestMeta.id);
          } else {
            runInstall("install_latest", "");
          }
        });
      }
      actions.appendChild(btn);
    }
    // 「检查 Beta 版更新」放在关闭按钮之前（仅正式检查结果面板）
    if (!betaMode) {
      var btnBeta = document.createElement("input");
      btnBeta.type = "button";
      btnBeta.value = "检查 Beta 版更新";
      btnBeta.addEventListener("click", function () {
        openPanel("检查 Beta 更新");
        body.innerHTML = "<p>正在检查 Beta 版更新…</p>";
        actions.innerHTML = "";
        api("check_update")
          .then(function (d) {
            showCheck(d, { beta: true });
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
      });
      actions.appendChild(btnBeta);
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
    go.value = "安装此版本";
    go.addEventListener("click", function () {
      var id = cache.selected || "";
      if (!id) return;
      if (!window.confirm("确定安装 " + id + " ？将覆盖当前主题文件。")) return;
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
            runInstall(action, version, tryN + 1);
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

  function bootAll() {
    mountVersionInPageTitle();
    bindFormUi();
    bindVersionUi();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAll);
  else bootAll();
  // Unraid may reflow title after our script; remount once more shortly
  setTimeout(mountVersionInPageTitle, 0);
  setTimeout(mountVersionInPageTitle, 200);
})();
