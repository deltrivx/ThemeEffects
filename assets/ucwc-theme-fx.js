/**
 * Theme Effects page UI — form row toggle + version management.
 * External file so Unraid markdown does not mangle #selectors / JS.
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
        // empty spacer nodes
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
        // multi-field single DL (粒子/胡桃同组): only hide the DT/DD pair
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
        // also hide help blockquote after table section if any
        hideFollowingHelp(tr, hide);
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
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector('select[name="BG_MODE"]')) return forms[i];
    }
    return null;
  }

  function syncUi() {
    try {
      var mode = document.querySelector('select[name="BG_MODE"]');
      var slot = document.querySelector('select[name="BG_LOCAL_SLOT"]');
      var gal = document.querySelector('select[name="BG_GALLERY"]');
      var upload = document.querySelector('input[name="BG_UPLOAD"]');
      var apiEl = document.querySelector('input[name="BG_CUSTOM_API"]');
      var hutao = document.querySelector('select[name="HUTAO"]');
      var hutaoSize = document.querySelector('select[name="HUTAO_SIZE"]');
      var hutaoPos = document.querySelector('select[name="HUTAO_POS"]');
      var particles = document.querySelector('select[name="PARTICLES"]');
      var pCount = document.querySelector('input[name="PARTICLES_COUNT"]');
      var reduce = document.querySelector('select[name="REDUCE_MOTION"]');
      var isLocal = !mode || mode.value === "local";
      var hutaoOn = !!(hutao && hutao.value === "yes");
      var particlesOn = !!(particles && particles.value === "yes");

      hideRow(slot, !isLocal);
      hideRow(upload, !(isLocal && slot && slot.value === "custom"));
      hideRow(gal, isLocal);
      hideRow(apiEl, !(!isLocal && gal && gal.value === "custom"));

      // 胡桃：关则隐藏大小/位置（与原先一致）
      hideRow(hutaoSize, !hutaoOn);
      hideRow(hutaoPos, !hutaoOn);

      // 粒子：关则隐藏数量/减少动效（与胡桃同级交互）
      hideRow(pCount, !particlesOn);
      hideRow(reduce, !particlesOn);

      var countVal = document.getElementById("ucwc-count-val");
      if (pCount && countVal) countVal.textContent = String(pCount.value);
    } catch (e) {}
  }

  function bindFormUi() {
    try {
      var form = findForm();
      if (form) {
        form.addEventListener("submit", function () {
          var file = form.querySelector('input[name="BG_UPLOAD"]');
          if (file && file.files && file.files.length > 0) {
            form.enctype = "multipart/form-data";
          } else {
            form.removeAttribute("enctype");
            try {
              form.enctype = "application/x-www-form-urlencoded";
            } catch (e) {}
          }
        });
      }
      ["BG_MODE", "BG_LOCAL_SLOT", "BG_GALLERY", "HUTAO", "PARTICLES"].forEach(function (name) {
        var el = document.querySelector('select[name="' + name + '"]');
        if (el) el.addEventListener("change", syncUi);
      });
      var range = document.querySelector('input[name="PARTICLES_COUNT"]');
      if (range) {
        range.addEventListener("input", syncUi);
        range.addEventListener("change", syncUi);
      }
      syncUi();
      // 多次同步：等 Unraid markdown / help 绑定完成
      setTimeout(syncUi, 0);
      setTimeout(syncUi, 50);
      setTimeout(syncUi, 200);
      setTimeout(syncUi, 500);
      setTimeout(syncUi, 1000);
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

  function api(action, extra) {
    var isRead = !!READ_ACTIONS[action];
    var opts = {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
    };
    var url = API + "?UCWC_ACTION=" + encodeURIComponent(action) + "&_ts=" + Date.now();

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

    return fetch(url, opts).then(function (r) {
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
    html += '<p id="ucwc-busy-msg" class="ucwc-muted"></p>';
    html += '<div class="ucwc-log" id="ucwc-out" style="display:none"></div>';
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
      // show busy area under log
      var out = document.getElementById("ucwc-out");
      if (!out) {
        var wrap = document.createElement("div");
        wrap.innerHTML =
          '<p id="ucwc-busy-msg" class="ucwc-muted"></p><div class="ucwc-log" id="ucwc-out" style="display:none"></div>';
        body.appendChild(wrap);
      }
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
      var out = document.getElementById("ucwc-out");
      if (!out) {
        var wrap = document.createElement("div");
        wrap.innerHTML =
          '<p id="ucwc-busy-msg" class="ucwc-muted"></p><div class="ucwc-log" id="ucwc-out" style="display:none"></div>';
        body.appendChild(wrap);
      }
      runInstall("uninstall", "");
    });
    actions.appendChild(un);

    var c = document.createElement("input");
    c.type = "button";
    c.value = "关闭";
    c.addEventListener("click", closePanel);
    actions.appendChild(c);
  }

  function runInstall(action, version) {
    if (busy) return;
    setBusy(true, "正在执行，请勿关闭页面（可能需要 1–3 分钟）…");
    var out = document.getElementById("ucwc-out");
    if (out) {
      out.style.display = "block";
      out.textContent = "执行中…";
    }
    api(action, version ? { version: version } : {})
      .then(function (j) {
        setBusy(false);
        if (out) out.textContent = (j.output || j.message || JSON.stringify(j)).slice(0, 8000);
        if (!j.ok) {
          alert(j.message || j.error || "操作失败");
          return;
        }
        updateBar(j);
        var tip = (j.message || "完成") + "\n请强制刷新 WebGUI（Ctrl+F5）。";
        if (j.page_may_vanish) {
          tip += "\n主题特效页可能已移除，将尝试返回仪表盘。";
          alert(tip);
          try {
            window.location.replace("/Dashboard");
          } catch (e) {
            window.location.href = "/Dashboard";
          }
          return;
        }
        alert(tip);
        try {
          window.location.replace("/Settings/ThemeEffects?updated=1&_ts=" + Date.now());
        } catch (e) {
          window.location.href = "/Settings/ThemeEffects?updated=1";
        }
      })
      .catch(function (e) {
        setBusy(false);
        if (out) out.textContent = String(e.message || e);
        alert("操作失败：" + (e.message || e));
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
    api("check_update").then(updateBar).catch(function () {});
  }

  function bootAll() {
    bindFormUi();
    bindVersionUi();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAll);
  else bootAll();
})();
