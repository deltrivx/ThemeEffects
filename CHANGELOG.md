## v2.8.1 - 2026-08-04

### Dashboard 布局修复
- 统一 PC 与移动端 Dashboard 卡片标题区域的图标、标题、摘要、控件排列和高度，避免标题遮挡、重叠及底部异常空白
- 修复 Dashboard 内容区域的纵向对齐，保持原生表格、列宽、换行和内容 DOM 不变
- 恢复 Docker/VM 正式版原生浮动排列、固定内容宽度和间距，保留停止项筛选逻辑
- 修复移动端 Docker/VM 两列排列，以及容器图标、名称和运行状态行的显示关系
- 优化接口、用户、共享、系统等卡片的标题控件和摘要布局
- 增强 Dashboard 自定义下拉菜单的定位、键盘操作、滚动和窗口尺寸适配
- ThemeMusic 继续由独立插件维护，Theme Effects 不包含音乐运行代码

## v2.7.2 - 2026-08-01

### 更新检测修复
- 清除 v2.5.1 遗留的 `channel: latest`，新版本索引只允许当前正式版拥有唯一 `latest` 标记
- 正式版检查优先按顶层 `latest_version` 精确选择版本元数据，不再先搜索历史 `channel: latest`
- 修复 Unraid 已安装 v2.7.0 时错误选择 v2.5.1、进而显示无更新或尝试降级的问题
- 发布校验新增 latest 频道唯一性约束，避免同类索引错误再次进入 Release

## v2.7.1 - 2026-07-31

### 许可与安装默认值
- 程序代码由 MIT 改为 PolyForm Noncommercial License 1.0.0，个人及非商业组织可在非商业目的下使用、修改和分发，商业使用须取得书面授权
- 首次安装写入 `SERVICE="disabled"`，用户需在设置页手动开启；升级不再强制覆盖已有服务开关
- 设置页与 Loader 在服务配置缺失时均采用关闭作为安全默认值

### 更新日志布局
- 版本列表移除横向滚动，长版本说明和标签可在左栏内自动换行
- 双栏网格允许内容收缩，手机窄屏自动切换为单列，弹窗和日志正文只保留纵向滚动

## v2.7.0 - 2026-07-31

### 独立仓库与历史整理
- 删除 2.0 以前的版本快照、版本索引和 GitHub Release，仅保留独立插件时代的历史
- 移除旧项目专属 Loader、`style.md5`、迁移逻辑、停用服务逻辑和失效说明
- 历史 2.x 快照只保留运行文件，统一重建为 JSON 文件清单
- 当前代码不再迁移、停用或改写其他插件的服务配置、用户 CSS 和上传资源

### 三种安装方式
- PLG、终端 OTA、终端全量统一使用同一版本索引、归档和逐文件校验链路
- 安装器优先一次下载 Release 归档，先验证总 SHA256，再按 `files.manifest` 二次校验
- Raw 或 Release 端点连接异常时快速切换镜像，避免小文件请求阻塞数分钟
- OTA 仅写入哈希变化项；全量模式重新写入全部运行文件；PLG 安装后同步插件列表元数据
- 三种安装方式均自动清理 Theme Effects 自身的旧 Loader、音乐组件、缓存和重复注入

### 仓库与发布规范
- README、About、插件管理器说明、支持、安全和贡献文档全面中文化
- 程序代码采用 MIT；原创文档与明确标注的原创视觉资产采用 CC BY-NC-SA 4.0
- Release 统一为 ZIP、TAR、PLG、`files.manifest`、`install.sh` 和 `SHA256SUMS` 六项产物
- 新增自动发布验证，覆盖版本索引、快照哈希、脚本、PLG、文档与跨平台归档
- macOS 构建剥离 AppleDouble 和扩展属性，避免 Unraid/Linux 解包警告

## v2.6.4 - 2026-07-31

### 概述
**v2.6.4**：开机 plg **先 flash 恢复 runtime 再 OTA**；GitHub 超时/离线重启不再把插件打进 `plugins-error` 导致界面「丢失」。

### 变更
- `theme.effects.plg`：`restore_from_flash` → 多镜像拉 `install.sh` → OTA 失败回退 flash；runtime 在则 `exit 0`
- 包 id **v2.6.4**（业务同 v2.6.3 + 官方 boot 路径）；plg version `2026.07.31b`

---

## v2.6.2 - 2026-07-30
## v2.6.3 - 2026-07-30

### 概述
**v2.6.3**：切换页面 / 刷新瞬间自定义鼠标不再短暂回到系统默认。

### 变更
- `ThemeEffects_Loader.page`：在 `style.css` 之前注入 critical cursor 样式 + 同步 boot 脚本（html/body 立即打类并 sticky inline）
- 导航链接点击与 pageshow 多段 reassert，缩短 FOUC 窗口
- `ucwc-mouse-fx.js`：sticky inline cursor；更密 boot reassert；导航点击出页前 reassert

---


### 概述
**v2.6.2**：三方鼠标样式在**全部交互动作**下保持自定义指针（悬停链接/按钮/表格/菜单、点击、拖动等不再回落到系统默认）。

### 变更
- `style.css`：对 `html.ucwc-cursor-custom body *` 及 Unraid/jQuery UI 常见控件扩大 `cursor: var(--ucwc-cursor) !important` 覆盖；输入框仍保留文本光标
- `ucwc-mouse-fx.js`：mouseover/mousedown/mouseup/click 与 DOM 变更时 reassert；清理 body 上残留的系统 cursor 内联样式

---

## v2.6.1 - 2026-07-30

### 概述
**v2.6.1**：安装/升级时**彻底清除**主题特效内置音乐残留（文件、Loader 注入痕迹、`MUSIC_*` 配置键、cover/lyrics 缓存），不影响独立插件 **theme.music**。

### 变更
- `scripts/install.sh` 新增 `purge_legacy_music_residue`：安装前与写盘后再执行
- 删除 `ucwc-music*` / `ucwc-music-api.php` / host；清理 `cover-cache`、`lyrics-cache`（仅 theme.effects 下）
- 从 `theme-effects.cfg` 剥离历史 `MUSIC_*` 键；擦除 Loader 中误留的 music 脚本行
- 卸载路径同步加强残留清理

---

## v2.6.0 - 2026-07-30

### 概述
**正式版 v2.6.0**：主题特效与音乐完全隔离；内置音乐组件/API/资源全部清除（对齐 v2.5.1 无音乐运行面）。音乐请使用独立插件 **ThemeMusic**。

### 变更
- **清除音乐**：删除 `ucwc-music.js/css/host`、`ucwc-music-api.php` 及设置页/Loader/save/cfg 中全部 `MUSIC_*` 逻辑
- **自定义鼠标跨页**：菜单栏切换页面时保持自定义指针，避免短暂恢复系统默认（Loader 早重申 + mouse-fx reassert + style !important）
- 保留壁纸/粒子/吉祥物/字体颜色/鼠标特效/应用页增强/OTA

---

## v2.6.0-Beta32 - 2026-07-30

### 概述
**Beta32**：修复 Apps **标题叠图标**（图标完全装入 iconArea）；收紧介绍 clamp，避免与绝对底栏按钮重叠；真机移动端音乐：FLAC/CIFS demuxer seek 失败后 **硬重置 audio** 并跨页续播（Dashboard→Docker 已验证）。

### 变更
- **Apps 卡片**
  - `iconArea` 固定 **7.2rem** 且 `overflow:hidden`，图标 **6.8rem**（不再 8rem 溢出叠标题）
  - 标题 `margin-top:0.45rem`、`padding-top:0`、`z-index:1`，保证在图标下方
  - 介绍 3 行 clamp / `max-height:5.2rem`，与绝对 `ca_bottomLine` 之间留白
  - 继续 1.8.x：`bottomLine` absolute 贴底 + 卡片 `24rem` + `overflow:hidden`
- **音乐移动端 / 真机**
  - 检测 sticky `audio.error`（含 FFmpeg demuxer seek failed）→ `hardResetAudio` 重建元素
  - 失败 seek 放弃中段定位，从安全位置重载，避免 play() 永久失败
  - 流 API：更大 chunk、关 gzip/缓冲、CIFS fseek 失败时顺序跳过
  - 配置保持：`MUSIC_AUTOPLAY=yes` + `MUSIC_DASH_ONLY=no` 时全站 chip 续播
- 版本号：**v2.6.0-Beta32**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta31 - 2026-07-30

### 概述
**Beta31**：按 **1.8.x 可用布局** 重做 Apps 卡片（介绍不再被挤出卡片）；移动端在**用户手势内同步 `play()`**，解决真机自动播放/续播无效。

### 变更
- **Apps 卡片（对齐 1.8.x，而非 stock relative top:18rem）**
  - `.ca_bottomLine` **绝对贴底**（`bottom:0.55rem`），取消 stock `top:18rem/15rem` 相对定位
  - 卡片固定 `24rem` + **`overflow:hidden`** + 底部 `padding` 给按钮行，介绍不会画出卡片
  - 去掉 header 强制 `18.5rem`（该高度在主题字体下把 `.cardDescription` 顶到按钮下）
  - 介绍 `position:static`，作者下 4 行截断，`max-height` 限制在按钮行之上
  - 图标区 `margin-top:0.35rem`（1.8.x）；角标/Spotlight 仍用官方 inset，落在卡内
  - fav/pin 仍内联在 bottomLine（现代 CA）
- **音乐移动端**
  - 手势解锁路径：**同步** `HTMLAudioElement.play()`（不再等 `canplay` 异步后再 play，避免丢失 user activation）
  - `primeAudioTrack` 预加载 src；`unlockMediaPipeline`（AudioContext + silent buffer）
  - 续播/自动播放失败时预加载 + 文案「点一下任意处续播」
- 版本号：**v2.6.0-Beta31**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta30 - 2026-07-30

### 概述
**Beta30**：按官方 CA Narrow 垂直节奏重做应用卡片（撤销 Beta28/29 破坏性改写）；修复标题叠图标、右上角 LIMETECH/SPOTLIGHT 裁切；加强移动端自动播放/续播手势解锁。

### 变更
- **Apps 卡片（对齐 stock）**：`.ca_bottomLine` 恢复 `position:relative; top:18rem`（spotlight `15rem`），不再 absolute 贴底
- 恢复 `.ca_backgroundClickable` **18.5rem**、`.ca_iconArea` **margin-top:-2rem**、标题 **padding-top:1.25rem**、图标 **8rem**
- 介绍仅去掉误套用的 18.5rem 高度，保留 stock `.cardDescription` / `.cardDesc` 位置与 4 行截断
- 卡片 `overflow:visible`，圆角规则不再对 `.ca_holder` 强制 `overflow:hidden`（修复右上角徽章被裁）
- 停止把 fav/pin 从 bottomLine 提升到卡片根（避免与 LIMETECH 角标抢位）
- **音乐移动端**：更早绑定 pointer/touch 解锁；Audio 挂入 DOM + playsInline；续播/自动播放失败后持续 gesture 重试
- 版本号：**v2.6.0-Beta30**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta29 - 2026-07-30

### 概述
**Beta29**：对照官方 Community Applications Narrow 皮肤，真正修复应用卡片介绍与按钮重叠、作者下方大片空白（Beta28 选择器未命中新版 DOM）。

### 变更
- **根因**：新版 CA 介绍类名为 `.cardDescription` / `.cardDesc`（非旧 `.ca_descriptionArea`）；介绍节点还带 `.ca_backgroundClickable` 的 **height:18.5rem**；主题把 `.ca_bottomLine` 绝对贴底后，该固定高度变成作者→介绍空洞，介绍被顶到按钮行
- 覆盖 `.cardDescription` / `.cardDesc` / `.cardDescriptionRepo`，重置 height/top 为流式布局并 4 行截断
- 收紧 header 带 `.ca_backgroundClickable` / `.dockerCardBackground` 高度，以及 title/author 的 stock 大 padding/margin
- 覆盖 `.ca_bottomLineSpotLight { top:15rem !important }`，按钮行仍贴卡片底
- 保留 Beta28 音乐无封面默认 ♪
- 版本号：**v2.6.0-Beta29**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta28 - 2026-07-30

### 概述
**Beta28**：应用商店卡片介绍与「信息/支持/安装」按钮重叠、作者与介绍间距过大；音乐无匹配封面时恢复默认 ♪ 艺术底，不显示浏览器错误文档图标。

### 变更
- **Apps 卡片**：`.ca_bottomLine` 绝对贴底后补 `padding-bottom`；介绍改为 `static` 流式贴在作者下并 3 行截断，避免压住按钮
- 收紧 author/repo 与 title 间距，去掉多余空白
- **音乐封面**：`<img>` 仅在解码成功后显示（`.has-cover`）；失败/无匹配拆除 img，保证默认 ♪ 渐变底
- 版本号：**v2.6.0-Beta28**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta27 - 2026-07-30

### 概述
**Beta27**：真机封面常为文档/音符占位（API empty）。针对 `Artist - Album (2010) FLAC/CD1/02.曲名.flac` 布局加强解析与取图。

### 变更
- 本地封面：同级 → **上级/上上级**（多碟 CD1 封面常在专辑根）
- 元数据：剥离曲序、解析 `艺人 - 专辑`、跳过 CD1 碟文件夹；列表副标题更干净
- FLAC：**流式**读 METADATA_BLOCK_PICTURE（不限旧 8MB 头），优先 type=3 封面
- 网络：iTunes/网易多组查询 + 更大图；失败仍可 remote 代理
- 含 Beta26 前端「不闪灭」加固
- 版本号：**v2.6.0-Beta27**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta26 - 2026-07-30

### 概述
**Beta26**：修复音乐卡片专辑封面「一闪而过就消失」——成功绘制后不再被 empty/失败/blob 撤销误清。

### 变更
- 封面 empty/失败响应：**已成功绘制的同曲封面保留**，不再立刻 `clearCoverDom`
- 切歌时**保留上一张封面**直到新图 ready；仅确认无封面时才清 DOM
- `blob:` URL **延迟 revoke**，避免撤销仍在用的 src 触发 `onerror` 拆图
- `missId` 标记确认无封面的曲目，阻断 `updateMeta` 空响应重试循环
- 浏览器复测：加载与下一首切换后 `has-cover` 与 blob 图持续保持
- 版本号：**v2.6.0-Beta26**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta25 - 2026-07-30

### 概述
**Beta25**：加固 OTA 拉版本索引，缓解 `TLS connect error: unexpected eof while reading`。

### 变更
- `ucwc-update.php` / 后台任务：HTTP/1.1 + TLS1.2、同主机重试、多镜像回退（jsDelivr / gitmirror / ghfast）
- `install.sh`：`fetch_index`/`download` 同样走镜像链，成功后钉住可用 `REPO_RAW`
- 日志记录镜像成功/失败，便于排查
- 版本号：**v2.6.0-Beta25**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta24 - 2026-07-30

### 概述
**Beta24**：修复卡片/chip 按钮点击无效——捕获阶段 `stopPropagation` 曾阻断播放控制。

### 变更
- chip/卡片防导航改为 **冒泡阶段** 拦截，按钮 handler 可正常触发
- 曲目播完（repeat=off）全站模式下 **保留 chip 浮层**，不再误隐藏
- 浏览器复测：播放/暂停/上一首/下一首/列表切换均可用，且不跳转页面
- 版本号：**v2.6.0-Beta24**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta23 - 2026-07-30

### 概述
**Beta23**：取消 popup/新标签宿主。chip 以 **页内 fixed 浮层** 嵌入 Unraid 网页；卡片与 chip 点击仅控制播放，不做页面跳转。

### 变更
- 移除 `window.open` / `ucwc-music-host.html` 宿主遥控方案
- chip 为站内嵌入小窗（`position:fixed`），全站常显；与卡片双向同步
- 卡片/chip/列表按钮 `preventDefault`，只做播放控制
- 跨页靠 session 续播（同文档 SPA 保活；整页硬刷新需浏览器允许自动播放）
- 版本号：**v2.6.0-Beta23**（beta）；正式 latest 仍为 **v2.5.1**

# 更新日志

## v2.6.0-Beta22 - 2026-07-30

### 概述
**Beta22**：全站播放时，用 **与 chip 同外观的迷你小窗** 作为音频宿主；切 Unraid 页面不中断、不轮询闪歌。关闭 Unraid 标签后小窗随心跳退出。卡片与 chip 双向同步。

### 变更
- 恢复同域 `ucwc-music-host.html`，**UI 复刻 chip 样式**（非另做标签页 UI）
- 用户点击播放时打开/复用命名小窗；Audio 只在小窗里跑
- 页面 chip **全站常显**（含仪表盘），与卡片 play/曲目/音量/模式同步
- 宿主心跳：Unraid 页关闭后小窗自动结束
- 有宿主时页面禁止本地 playAt 乱跳，解决切页进度丢失
- 版本号：**v2.6.0-Beta22**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta21 - 2026-07-30

### 概述
**Beta21**：切换页面后若实际已暂停，播放按钮显示为播放（不再强制显示暂停/播放中）。

### 变更
- `isUiPlaying()` 仅看真实 `audio.paused`，续播重试不再伪装播放图标
- pause 事件始终刷新按钮；跨页 intent 可保留，但不谎报 live playing
- 重试耗尽后清 pending，按钮回到播放态
- 版本号：**v2.6.0-Beta21**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta20 - 2026-07-30

### 概述
**Beta20**：修复移动端点击「曲目/歌词」切换时卡片宽度抖动；清理重复移动端 CSS 覆盖。

### 变更
- **定宽锁定**：`≤720px` 卡片使用 `width/max-width: min(420px, 100vw-24px)`，list⇄lyrics 同一外宽
- **防撑开**：右栏 `contain: inline-size` + overflow hidden；列表/歌词同高 148px；`scrollbar-gutter: stable`
- **清理**：去掉误追加的第二套 `@media (max-width:720px)`（曾把 max-width 覆盖回 100%）
- 版本号：**v2.6.0-Beta20**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta19 - 2026-07-30

### 概述
**Beta19**：移动端卡片固定最大宽度；跨页/刷新按上次进度续播；进仪表盘不再轮询闪过多首歌曲。

### 变更
- **移动端定宽**：`≤720px` 卡片 `max-width:420px` 居中，纵向排列且不再被无限拉宽
- **续播进度**：`pendingSeekTo` + metadata/seeked 后再播放；禁止 playAt 早期把进度写成 0；流地址去掉每次 `Date.now()` 强刷
- **消除轮询闪歌**：list 返回先钉住会话曲目再渲染；`resumeAttempted`/`resumeLockId` 防重复 playAt；mount 不再二次触发 resume
- 版本号：**v2.6.0-Beta19**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta18 - 2026-07-30

### 概述
**Beta18**：修复音乐卡片专辑封面仍不显示；移动端恢复自动纵向排列；仪表盘位置记忆不再强制回左上第一格；刷新后按上次进度续播，避免播放按钮单独闪烁。

### 变更
- **封面**：扩大本地封面扫描；支持内嵌封面提取；下载写盘失败时走同源代理；前端 blob 加载更稳
- **移动端**：`max-width:720px` 取消 240px 定宽右栏与左侧 max-width，主区自动上下排列
- **位置**：优先挂到 `#db-box1/2/3` 列；remount 不再把卡片拽回首位；`DASH_POS_KEY` v2；MutationObserver 记忆用户拖动后的位置
- **续播**：刷新恢复曲目与 `currentTime`；`isUiPlaying` 以真实 audio 为准，减少图标空闪
- 版本号：**v2.6.0-Beta18**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta17 - 2026-07-30

### 概述
**Beta17**：曲目列表与歌词复用框中，过长文本改为横向自动滑动（跑马灯），可完整展示，不再仅靠省略号截断。

### 变更
- **曲目列表**：长歌名/艺人名在右侧固定宽栏内左右循环滚动
- **歌词行**：过长歌词同行横向滑动；未溢出仍居中
- 尊重 `ucwc-reduce-motion` / 系统减少动态效果时回退省略号
- 版本号：**v2.6.0-Beta17**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta16 - 2026-07-30

### 概述
**Beta16**：修复仪表盘音乐卡片左上角专辑封面不显示；曲库加载后立即拉取封面；联网下载改用图片 Accept 并优先写入 cover-cache。

### 变更
- **封面触发**：`fetchList` / `updateMeta` 在有曲目时调用 `loadCoverForCurrent`（此前仅 playAt/mount 部分路径会加载）
- **封面下载**：`m_http_get` 支持自定义 Accept；封面请求使用 `image/*`，避免 CDN 返回非图片
- **缓存写入**：优先写 flash `cover-cache`；raw 流允许 cover-cache 路径
- **UI**：封面 img 层级与 has-cover 回退更稳；缓存图 complete 时也能立刻显示
- 版本号：**v2.6.0-Beta16**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta15 - 2026-07-30

### 概述
**Beta15**：文件选择器（fileTree / 本地路径树）背景对齐标题栏；更新进度条大蓝色百分号旁去掉重复阶段文案；自定义鼠标「从电脑上传」第一行宽度与 path/select 对齐。

### 变更
- **文件选择器背景**：Unraid fileTree / jqueryFileTree 背景改为与标题栏相同的 `rgba(0,0,0,0.5)`；电脑端 file 控件同色
- **更新进度**：条下仅保留左侧大号蓝色 `%`，去掉旁侧阶段文案（阶段仅保留在进度条上方状态行）
- **自定义鼠标上传**：`从电脑上传` file 输入改为 `var(--ucwc-ctrl-w)`，与本地路径框/下拉同宽；`alignPathFieldWidths` 同步写入 file 行
- 版本号：**v2.6.0-Beta15**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta14 - 2026-07-29

### 概述
**Beta14**：音乐曲目/歌词右侧栏固定宽度；仪表盘卡片不再每次更新强制顶到左上角第一个位置（记忆相邻锚点）；专辑封面显示，本地缺失时自动联网下载并缓存。

### 变更
- **曲目/歌词栏**：右侧复用面板固定 **240px**，长曲名省略号截断，不再撑开卡片宽度
- **仪表盘位置**：`placeInDashboard` 默认追加到末尾；用 localStorage 记忆前后锚点/索引，更新后恢复；已存在 host 不再插回首位
- **专辑封面**：`action=cover`（本地 cover/同名图 → cover-cache → iTunes / 网易云下载）；卡片 art 区显示；MediaSession artwork 同步
- 版本号：**v2.6.0-Beta14**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta13 - 2026-07-30

### 概述
**Beta13**：自定义鼠标双路上传（电脑 + Unraid 路径）；**取消音乐宿主弹窗**，保留 chip + 会话/重试/静音解锁尽力续播；下拉框背景对齐标题栏；更新进度条仅保留条下左侧大号蓝色百分号。

### 变更
- **鼠标自定义样式**：与自定义壁纸同款双路上传（从电脑上传 + 从本地路径复制），保存端支持 `MOUSE_CURSOR_LOCAL_PATH`
- **音乐续播**：移除 `ucwc-music-host.html` 与 BroadcastChannel 宿主方案；保留可拖动 chip 与 `pendingResume`/`isUiPlaying` 防闪；跨页为浏览器策略下的尽力续播，拦截时点 chip 播放即可
- **下拉菜单**：`select` 背景色改为与标题栏相同的 `rgba(0,0,0,0.5)`
- **更新进度**：取消状态行与阶段旁多余百分号，仅保留进度条下方左侧大号蓝色 `%`
- 版本号：**v2.6.0-Beta13**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta12 - 2026-07-30

### 概述
**Beta12（重发）**：**保留 chip**；用同域音乐宿主小窗解决切页必须点击才能续播；自定义鼠标文件框对齐壁纸宽度；续播 UI 不再 play/pause 狂闪。

### 变更
- **回滚顶栏方案**：恢复可拖动 mini chip（上一曲/播放/下一曲 + 单行歌词）
- **浏览器自动播放限制**：全站播放时，在 chip/卡片**用户点击播放**会打开同域 `ucwc-music-host.html` 小窗承载 Audio；宿主跨 Unraid 整页导航保活，chip 仅作遥控（BroadcastChannel / postMessage）
- **续播闪烁**：`pendingResume` + `isUiPlaying`，重试期间图标稳定
- **鼠标**：自定义样式文件行 `ucwc-upload-dual` + `min(420px,100%)` 对齐壁纸上传框
- 版本号：**v2.6.0-Beta12**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta11 - 2026-07-29

### 概述
**Beta11**：chip 用 transform 拖动；续播静音解锁重试；歌词 lrclib + 网易云双源；自定义鼠标完全对齐壁纸 hideRow 形态。

### 变更
- **chip 拖动**：`translate3d` 定位，避开 Unraid CSS 钉死 right/bottom；pointer/mouse/touch + capture
- **续播**：`tryPlayUnlocked`（正常播放失败则静音 play 再恢复音量）+ 多次重试
- **歌词**：lrclib 失败时回退网易云搜索/歌词 API；无 mbstring 兼容；缓存目录保留
- **鼠标**：自定义样式文件改壁纸同款 upload-row 结构；`syncUi`/`hideRow` 统一显隐；`MOUSE_CURSOR` 纳入表单 dirty 列表
- 版本号：**v2.6.0-Beta11**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta10 - 2026-07-29

### 概述
**Beta10**：切换页面后自动多次重试续播；chip 拖动修复；歌词出站代理 + 插件缓存；自定义鼠标显隐对齐壁纸 `hideRow`。

### 变更
- **续播**
  - 导航后短时多次 `play()` 重试 + Media Session
  - `pageshow` / 可见性变化时再试；被策略拦截时 chip 提示「自动续播中…」
- **chip**
  - 用 `setProperty(..., important)` 覆盖定位；同时监听 pointer/mouse/touch
  - 默认 CSS 的 right/bottom 不再 `!important` 卡死拖动
- **歌词**
  - `m_http_get` 读取 Unraid 出站代理
  - 音频目录不可写时写入 `/boot/config/plugins/theme.effects/lyrics-cache`
  - 多查询/打分匹配；失败原因回传到状态栏
- **鼠标**
  - 自定义样式文件 / 热点坐标改用与壁纸相同的 `hideRow`（含 `syncUi`）
  - 去掉 PHP 行内 display 抢控制
- 版本号：**v2.6.0-Beta10**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta9 - 2026-07-29

### 概述
**Beta9**：音乐卡片间距与固定高度；全站 **mini chip**（可拖动 + 上一曲/播放/下一曲 + 实时单行歌词）按进度续播；歌词自动下载；自定义指针文案与显隐；防多重播放。

### 变更
- **布局**
  - 按钮 / 进度条 / 音量间距加大；自动播放状态文案置于音量条下方
  - 曲目与歌词共用区固定高度（桌面 168px / 窄屏 148px），避免模块抖动
  - 曲目列表滚动条淡化
- **全站续播 chip**
  - 仪表盘：卡片；其它页：可全局拖动 mini chip
  - chip 含上一曲 / 播放暂停 / 下一曲 + 当前歌词一行
  - 按会话进度 seek 续播，播放中不隐藏 chip；单次自动 resume 防叠播
- **歌词**
  - 无本地 `.lrc` 时通过 lrclib.net 自动下载并保存到音频同目录
- **设置**
  - 取消「界面形态」，仅卡片
  - 「自定义上传」→「**自定义样式**」；样式文件与热点坐标仅在该选项下显示且可交互
- 版本号：**v2.6.0-Beta9**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta8 - 2026-07-29

### 概述
**Beta8**：强化**全站续播**（导航落盘意图 + 手势/chip）；自定义指针相关项仅在选择「自定义上传」时显示。

### 变更
- **全站续播**
  - 会话增加 `intent`；`pagehide` / `beforeunload` / `freeze` / 隐藏页 / 链接点击使用 `savePlaySessionForNav` 强制保留 playing
  - 自动播放被拦时保留意图，非仪表盘显示「继续播放」chip，并在任意手势解锁后续播
  - 主动点暂停会清除意图，避免误续播
- **自定义指针 UI**
  - 「自定义指针文件」「热点坐标」仅在 `MOUSE_CURSOR=upload` 时显示（PHP 初始 + JS 切换）
- 版本号：**v2.6.0-Beta8**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta7 - 2026-07-29

### 概述
**Beta7**：本地 **LRC 歌词 V1**——同名旁路 / `lyrics/` 子目录；右栏滚动高亮；与进度条 seek 同步。

### 变更
- **API** `ucwc-music-api.php`
  - `list` 增加 `has_lrc`
  - 新 `action=lyrics`：解析 sidecar `.lrc`（UTF-8/GBK、`[offset:]`、多时间戳行），路径校验与 stream 同级
- **前端**
  - 切歌加载歌词；`timeupdate` 二分定位当前行并居中滚动
  - 曲目列表有词角标「词」；空态提示放置 `.lrc`
- 设置页帮助补充 LRC 用法
- 版本号：**v2.6.0-Beta7**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta6 - 2026-07-29

### 概述
**Beta6**：跨页续播优化；音乐卡片双栏布局（进度/控制在按钮下、右栏曲目⇄歌词）；鼠标指针全站生效修复；支持自定义指针上传。

### 变更
- **全站播放 / 跨页续播**
  - 播放会话同时写入 `sessionStorage` + `localStorage`（含进度/曲目 id，TTL 6h）
  - `pagehide` / `beforeunload` / 隐藏页时落盘
  - 进页自动尝试续播；被浏览器自动播放策略拦截时：挂一次手势解锁，非仪表盘显示右下角「继续播放」chip（无完整卡片）
- **音乐卡片布局**
  - 左侧：封面/元信息 + 按钮行；**进度条与音量控制移到按钮下方**，宽度与整行按钮对齐
  - 右侧：曲目 / 歌词共用区，默认曲目；原曲目按钮改为 **曲目 ⇄ 歌词** 切换
- **鼠标指针全站**
  - 修复 Loader 早期白名单把 `neon3d/holo/cyber/crystal` 打成 system 的问题
  - 交互元素改用 `var(--ucwc-cursor)`，不再整站强制 `pointer`
- **自定义指针上传**
  - 支持 png/webp/svg/cur/ico（≤2MB），热点坐标 X/Y；保存为 `assets/cursor-custom.*`
  - 设置页 + AJAX 分段保存 + Loader 注入 URL
- 版本号：**v2.6.0-Beta6**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta5 - 2026-07-29

### 概述
**Beta5**：纠正播放范围语义——**卡片永远只在仪表盘**；全站可无 UI 续播；卡片外壳对齐仪表盘 14px 玻璃圆角。

### 变更
- **音乐卡片 UI**
  - 仅在仪表盘挂载；非仪表盘页**不再**插入同款卡片
  - 样式对齐 `table.dashboard > tbody`：`border-radius: 14px`、玻璃底 `rgba(12,16,24,0.42)`、分层阴影与标题栏顶光
- **播放范围**
  - `MUSIC_DASH_ONLY=yes` → **仅仪表盘播放**（离开仪表盘停播并清会话）
  - `MUSIC_DASH_ONLY=no` → **全站播放**（其它页面不挂卡片，用 `sessionStorage` 跨页续播；受浏览器自动播放策略限制）
- 版本号：**v2.6.0-Beta5**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta4 - 2026-07-29

### 概述
**Beta4**：指针方案升级；音乐卡片对齐仪表盘磁贴并修复按钮拉长；播放范围改为「仅仪表盘播放 / 全站播放」。

### 变更
- **鼠标指针**：移除圆点/十字/旧霓虹/隐藏；新增 **霓虹立体 / 全息玻璃 / 赛博利刃 / 水晶切面**（SVG 立体高光）；旧选项自动映射到霓虹立体
- **音乐卡片**
  - 边框/标题栏对齐 `share_status.dashboard`
  - 控件改 SVG 圆形按钮，覆盖全局 button 边框导致的**拉长失真**
  - 预留 **歌词区域**（V1 占位，后续 LRC）
- **播放范围**（原「仅仪表盘显示」）
  - `MUSIC_DASH_ONLY=yes` → **仅仪表盘播放**
  - `MUSIC_DASH_ONLY=no` → **全站播放**（非仪表盘页内容流顶部同款卡片）
- 版本号：**v2.6.0-Beta4**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta3 - 2026-07-29

### 概述
**Beta3：音乐真正作为仪表盘卡片**；**系统指针样式**（类 Windows 主题改鼠标本身）；路径选择框宽度对齐其它下拉；fileTree 下拉主题化背景。

### 变更
- **音乐**
  - 去掉 `position:fixed` 右下角浮层，挂载到仪表盘内容流（`#db-box` / grid-stack / dashboard 表附近）
  - 卡片标题栏「音乐」+ 播放控件，样式贴近 `share_status.dashboard` 磁贴
- **鼠标指针样式（`MOUSE_CURSOR`）**
  - 选项：系统默认 / 圆点 / 十字准星 / 霓虹箭头 / 隐藏指针
  - 通过 `html[data-ucwc-cursor]` + CSS `cursor: url(data-svg)` 改系统指针外形（非仅 canvas 光晕）
  - 输入框保持文本光标；链接/按钮保持 pointer；与 canvas 光晕特效独立，可单独开启
- **路径选择器**
  - `.ucwc-path-field` 与同页 `<select>` 共用 `--ucwc-ctrl-w`
  - 打开设置页时测量邻近下拉（如 `MUSIC_SOURCE`）实际像素宽，写回 CSS 变量，路径框与下拉 **同宽对齐**
- **fileTree 下拉**
  - 半透明深色渐变 + 描边/阴影，去掉突兀纯黑原生背景；条目 hover 主题青；宽度跟随控件列
- 版本号：**v2.6.0-Beta3**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta2 - 2026-07-29

### 概述
**Beta2：设置控件对齐原生 Unraid**。下拉菜单右侧统一显示箭头；目录/路径字段使用 Unraid `fileTree` 选择器（文本框 + 文件夹按钮），不再像「纯文本框」。

### 变更
- **下拉菜单**：全局 `select` 与主题特效页 `select` 增加右侧 chevron（`appearance: none` + SVG 箭头），便于与普通输入区分
- **路径/目录选择**
  - 壁纸本地路径、吉祥物 GIF 路径、**音乐本地目录**：`ucwc-path-field`（输入框 + 浏览按钮）
  - 音乐目录启用 `data-pickfolders`，点击文件夹即可写入路径（jquery.fileTree）
  - `wireFileTreePickers` 绑定所有 `.ucwc-local-path`，浏览按钮触发打开路径树
- 版本号：**v2.6.0-Beta2**（beta）；正式 latest 仍为 **v2.5.1**

## v2.6.0-Beta - 2026-07-29

### 概述
**Beta：音乐组件第一期（V1）**。仪表盘右下角播放卡片 + 本地目录音源；默认关闭，需在「主题特效 → 音乐」中开启。正式版 `latest` 仍为 **v2.5.1**，本版通过 **检查 Beta 更新** 安装。

### 变更
- **音乐 V1**
  - 设置页新增「音乐」分段：`MUSIC_ENABLE` / `MUSIC_UI` / `MUSIC_SOURCE` / `MUSIC_LOCAL_DIR` / `MUSIC_VOLUME` / `MUSIC_AUTOPLAY` / `MUSIC_SHUFFLE` / `MUSIC_REPEAT` / `MUSIC_DASH_ONLY`
  - 本地音源：扫描 `/mnt/` 下目录（如 `/mnt/user/Music`），支持 mp3/flac/m4a/aac/ogg/opus/wav/wma
  - API：`ucwc-music-api.php`（`config` / `list` / `stream`，含 Range 流式）
  - 前端：`assets/ucwc-music.js` + `assets/ucwc-music.css` 固定玻璃卡片（播放/进度/音量/列表/随机/循环）
  - Loader 注入 `window.__UCWC_THEME__.music`；开启时按需加载 CSS/JS；默认仅仪表盘显示
  - 默认 `MUSIC_ENABLE=no`；V1 仅卡片 UI + 本地源（浮层 / Emby·JF·Navidrome 留待后续）
- **安装**：`install.sh` 拉取并安装音乐 API 与资源；OTA `files.manifest` 含新文件
- 版本号：**v2.6.0-Beta**（beta 通道）；正式 latest 仍为 **v2.5.1**

## v2.5.1 - 2026-07-29

### 概述
**正式版：OTA 增量更新**。正式版与 Beta 检查/安装均支持 **OTA（仅下载变更文件）** 与 **全量（完整下载）** 两种模式。

### 变更
- **OTA 更新**：拉取版本包 `files.manifest`（sha256），与本地 flash 文件比对，未变文件跳过下载（大文件如 hutao.gif / 壁纸收益明显）
- **全量更新**：强制重新下载包内全部文件，用于修复本地损坏
- **Web UI**：检查更新 / Beta 检查 / 更新日志安装均提供 OTA 与全量按钮
- **install.sh**：`install <version> [ota|full]`，环境变量 `UCWC_INSTALL_MODE`；默认 OTA
- **进度日志**：显示「OTA 跳过 / 下载」统计与模式
- **插件页安装（2026.07.29h–j）**：修复 Plugins 页安装「卡死无进度」——`theme.effects.plg` 将 install.sh 的 stderr 合并到 stdout，并用 `stdbuf -oL` 行缓冲；`UCWC_PLUGIN_INSTALL=1` 时进度走 stdout，插件管理器 `popen` 可实时显示；`CHANGES` 改 CDATA，避免裸 `&` 导致 XML 解析失败整页装不上；**2026.07.29j** 抬高 plg 版本，避免已装同号时出现 `not reinstalling same version` 而跳过
- 版本号：**v2.5.1**（stable / latest）；插件元数据 **2026.07.29j**

## v2.5.0 - 2026-07-29

### 概述
**正式版：鼠标特效**。将 Beta 通道打磨完成的桌面端光标特效合入 stable；默认关闭，设置页独立分段控制。

### 变更
- **鼠标特效（正式）**
  - 新引擎 `assets/ucwc-mouse-fx.js`：柔光光晕 / 光环 / 光迹 / 星火
  - 可选点击涟漪；空闲约 0.9s 柔和淡出
  - 配置键：`MOUSE_FX` / `MOUSE_STYLE` / `MOUSE_SIZE` / `MOUSE_INTENSITY` / `MOUSE_COLOR` / `MOUSE_CLICK_RIPPLE`
  - 设置页「鼠标特效」分段应用；改选项可即时预览
  - Loader 注入偏好；未开「减少动效」时常驻加载引擎，由开关控制运行
  - 移动端 / 触控 / 减少动效自动停用；性能档 low 关闭鼠标特效
  - 默认 `MOUSE_FX=no`，需手动开启
- **安装进度**：安装日志「正在安装」阶段展示进度百分比；大文件下载时持续更新，避免误判卡住
- **更新检查**：Beta 与正式版检查面板可互相切换（「检查 Beta 版更新」↔「检查正式版更新」）
- **应用成功提示**：成功后在对应分段「应用」按钮旁显示一次（不再占顶栏全局文案）
- 版本号：**v2.5.0**（stable / latest）
## v2.5.0-Beta3 - 2026-07-29

### 概述
**体验与更新流 Beta3**。修正 Beta 检查文案（已装最新可重装 / 无最新 Beta 分界清晰）；「应用」成功提示改到对应分段按钮旁；鼠标颜色控件小幅打磨。

### 变更
- **Beta 检查**：仅当存在高于当前正式版的 Beta 才视为「有最新 Beta」
  - 已安装 = 远程最新 Beta → **已安装最新 Beta，可重装**
  - 已安装 < 远程最新 Beta → 发现新 Beta，可更新
  - 目录 Beta 均不高于正式版 → **无最新 Beta 版**（不提供旧 Beta 安装）
- **应用成功提示**：取消顶栏全局「主题特效已应用并生效」；刷新后在本段「应用」按钮旁显示一次，刷新/离开即消失
- **鼠标颜色**：自动/自定义模式加载同步；自动时取色器半透明，点击可切入自定义
- 版本号：**v2.5.0-Beta3**（beta；latest 仍 v2.4.3）

## v2.5.0-Beta2 - 2026-07-29

### 概述
**鼠标特效 Beta2**。引擎常驻加载（可即时开关）、空闲淡出、新增「星火」样式、设置页改选项即时预览。

### 变更
- **常驻加载**：未开「减少动效」时始终加载 `ucwc-mouse-fx.js`，由 `MOUSE_FX` 控制运行
- **空闲淡出**：光标静止约 0.9s 后柔和消失
- **新样式 spark（星火）**：移动溅射 + 点击爆发
- **自动色**：跟随主题 accent 变量
- **设置页即时预览**：改选项即生效；「应用」落盘
- 版本号：**v2.5.0-Beta2**（beta；latest 仍 v2.4.3）

## v2.5.0-Beta - 2026-07-29

### 概述
**鼠标特效 Beta**。新增独立桌面端光标光晕/光环/光迹特效（不拦截点击），设置页独立「鼠标特效」分段；默认关闭。正式功能仍迭代中，后续将有 v2.5.0-Beta2… 直至正式 v2.5.0。

### 变更
- **新增** `assets/ucwc-mouse-fx.js`：柔光光晕 / 光环 / 光迹 + 可选点击涟漪
- **配置键**：`MOUSE_FX` / `MOUSE_STYLE` / `MOUSE_SIZE` / `MOUSE_INTENSITY` / `MOUSE_COLOR` / `MOUSE_CLICK_RIPPLE`
- **设置页**：粒子与吉祥物之间新增「鼠标特效」分段「应用」
- **Loader**：`__UCWC_THEME__` 注入鼠标偏好；开启且未「减少动效」时加载脚本
- **性能档 low**：应用时关闭鼠标特效
- **移动端 / 触控 / 减少动效**：自动不运行
- 版本号：**v2.5.0-Beta**（beta 通道；`latest_version` 仍为 v2.4.3）

### 说明
- 默认 `MOUSE_FX=no`，需在设置中手动开启
- 不改变现有壁纸 / 粒子 / 吉祥物默认行为

## v2.4.3 - 2026-07-29

### 概述
**正式版**：恢复代码编辑器（CodeMirror / Ace / Monaco）输入对齐。

### 变更
- 全局表单 textarea 的 padding/border/width 不再打穿编辑器隐藏输入层
- 光标与文字偏移修复（恢复 commit 100320a）
- 继承 v2.4.2：Docker/VM 1.8.x float 排布
- 版本号：**v2.4.3**（stable / latest 当时指向本版）

## v2.4.2 - 2026-07-29

### 概述
**第五个 2.x 正式版**。按 1.8.x 方式恢复仪表盘 Docker / 虚拟机芯片排布与间距：去掉 v2 grid-squeeze 与过激 bottom-gap，回到 float + 137px 标签宽 + stock 20px 行距。

### 变更
- **Docker/VM 排布**：`float:left`（取消 `td display:grid` / chip `flex`）
- **标签宽**：恢复 1.8.x `span.inner { width: 137px }`
- **行距**：恢复 stock `margin-bottom: 20px`（取消 6px bottom-gap）
- **设置页**：移动端 `span.inner` 自动换行仅限 settings/tools，不再误伤仪表盘芯片
- 版本号：**v2.4.2**（stable / latest）

## v2.4.1 - 2026-07-29

### 概述
**第四个 2.x 正式版**。仪表盘 Docker/虚拟机底空收紧；Beta 检查不再推荐低于正式版的旧 Beta；自定义上传文案与控件对齐优化。

### 变更
- **Docker/虚拟机底空**：收紧内容行 padding；`span.outer` 底边距 20px→6px，末行空洞约 40px→12px
- **Beta 检查逻辑**：`compareVersions` 比较版本；仅当存在 **高于** 当前正式版的 Beta 才提示可装；否则显示「无最新 Beta 版」
- **自定义壁纸上传布局**：文案 + 格式 + 大小同一行；文件框下移左对齐
- **从本地上传 / 自定义吉祥物**：同上双路布局（电脑上传 · 本地路径）
- 版本号：**v2.4.1**（stable / latest）

## v2.4.0 - 2026-07-29

### 概述
**第三个 2.x 正式版**。仪表盘磁贴控件与关闭按钮布局修正；性能档位真正改写主题特效配置；移除无效 GPU_ACCEL；加固部分保存与首次优化 toast。

### 变更
- **仪表盘图标统一**：标题区 stop/reboot/power 与 cog/wrench/chevron 等统一 **1.8rem**
- **关闭磁贴位置**：由 `td` 首行挪到各模块 **右侧图标组最前**；解锁排序时与其它控件同行；缺 `tile-header-right-controls` 的模块（如无 autofan 风扇）自动创建容器
- **关闭磁贴常显修复**：不再对 `i.tile` / `fa-close` 强制 `display:inline-flex`，尊重原版 `i.tile{display:none}` 与 LockButton
- **性能档位真正生效**：修复设置页「应用」把 `perf` 段误判为 `all` 的 bug；`PERF_PROFILE=low|balanced|high` 点应用时直接改写粒子/减少动效/模糊等级等配置（`auto` 仅运行时软调节）
- **移除 GPU_ACCEL**：客户端无实质减负；UI/配置/保存键清理，保留性能档位与首次建议
- **首次优化 toast**：`CLIENT_OPTIMIZED` 可持久；quietSave 默认仅写 perf 段，避免冲掉其它设置
- **部分保存安全**：缺失 POST 键不再把 PARTICLES/HUTAO/BG_BLUR 等打回默认
- 版本号：**v2.4.0**（stable / latest）


## v2.3.0 - 2026-07-28

### 概述
**第二个 2.x 正式版**。完善自定义上传体验与性能档位：上传提示布局、Unraid 路径树选择、字体预览对齐、浏览器 GPU 合成加速与首次使用自动建议。

### 变更
- **上传提示下移**：电脑上传格式/大小说明移到选取框正下方（壁纸与吉祥物）
- **Unraid 路径树**：本地路径框支持手输 + 点击调用 `jquery.fileTree` 浏览 `/mnt/user`（与系统内部文件选择一致）
- **自定义吉祥物**：与壁纸同步双路上传布局与路径选择器
- **字体预览对齐**：预览区包裹隔离，修复设置页偏移
- **GPU 加速**：`GPU_ACCEL=auto|on|off`；自动时按服务器是否存在核显/显卡（`/dev/dri`）倾向开启；作用于浏览器合成层（CSS/Canvas），不调用服务器 GPU 画主题
- **性能档位**：`PERF_PROFILE=auto|high|balanced|low`；Loader 在 auto 时按客户端能力套用档位类名
- **首次使用优化**：`CLIENT_OPTIMIZED`；首次打开设置页按设备内存/核心等弹出建议，可一键应用并保存
- **粒子 DPR**：低配 / 无 GPU 时进一步限制 canvas 像素比
- 版本号：**v2.3.0**（stable / latest）

## v2.2.0 - 2026-07-28

### 概述
**首个 2.x 正式版**。汇总 v2.0.0 起 Beta 能力，并加入模糊背景性能优化、模糊等级、双路上传与运行时总开关。

### 变更
- **模糊性能**：壁纸仅单层 `filter: blur`（去掉 saturate）；取消永久 `will-change`；`contain`/`isolation` 隔离绘制；壁纸就绪后去掉 html/`::before` 双层绘制；`fit()` 几何去重 + 视口滚动防抖
- **模糊等级**：壁纸 / 吉祥物各自弱·中·强（`BG_BLUR_LEVEL` / `HUTAO_BLUR_LEVEL`）
- **双路上传**：自定义壁纸与吉祥物支持「从电脑上传」与「从 Unraid 本地路径」（`/mnt/user`）
- **运行时总开关**：标题栏「特效」开关写入 `theme.effects.cfg` `SERVICE`；关闭后不注入壁纸/粒子/吉祥物/主题 CSS
- **移动端仪表盘**：Docker / 虚拟机列表两列布局修复
- **字体三期**（自 beta）：自定义字族名、本地 woff2/woff/ttf/otf 上传与 `@font-face`
- **字体/颜色**（自 beta）：正文/标题字体与字号、颜色预设与自定义色
- **独立插件**（自 2.0.0）：使用独立 `theme.effects` 目录、Loader、配置和版本生命周期
- 版本号：**v2.2.0**（stable / latest）

## v2.1.2-beta - 2026-07-28

### 概述
字体三期：自定义 CSS 字体名 + 本地字体文件上传（woff2/woff/ttf/otf），Loader 注入 `@font-face`。

### 变更
- 正文字体 / 标题字体新增「自定义名称」「本地字体文件」
- 自定义名称：填写系统已安装字体的 CSS 名（如 Microsoft YaHei）
- 本地字体：上传 ≤4MB 的 woff2/woff/ttf/otf，存于 `assets/fonts/`
- Loader 按需 `@font-face`（UCWC Local Body / Title）
- 升级安装保留 `assets/fonts/*`
- 版本号：**v2.1.2-beta**

## v2.1.1-beta - 2026-07-28

### 概述
字体/颜色二期：更多字体与配色预设、标题字号、硬编码字体改走 CSS 变量、预览区增强。

### 变更
- 正文字体新增 Inter / Rubik / 思源黑体；标题新增 Exo 2 / Inter / Rubik / 思源
- 正文字号扩展至 13–18；新增「标题字号」跟随/稍小/中等/较大/特大
- 颜色预设新增「紫罗兰」「日落」
- 导航预览改为标题/正文/标签三行实景预览
- style.css 导航项、磁贴标题、表单 dt 跟随 `--ucwc-font-*` 变量
- Google Fonts 按所选族按需加载；系统/雅黑/思源可离线
- 版本号：**v2.1.1-beta**

## v2.1.0-beta - 2026-07-28

### 概述
字体样式/颜色一期可配置；自定义壁纸/吉祥物显示已上传状态与缩略图预览。

### 变更
- 新增设置段「字体」：正文字体、标题字体、标题大写、字号、颜色预设（赛博/冰蓝/金色/薄荷/自定义）及正文/标题/标签色
- Loader 动态注入 CSS 变量与按需 Google Fonts；默认保持 Rajdhani + Orbitron（标题默认不再强制 uppercase）
- 自定义本地壁纸 / 自定义吉祥物：显示已上传缩略图与状态，避免误以为「未选择文件」即无资源
- 升级安装时保留 background-custom.jpg / mascot-custom.gif / background-dynamic.jpg
- 版本号：**v2.1.0-beta**

## v2.0.0-beta3 - 2026-07-28

### 概述
修复设置/工具页移动端长标签（如 Auto Update Applications）不换行；复测自定义壁纸与自定义 GIF 吉祥物。

### 变更
- Settings/Tools 磁贴：`.PanelText` 强制 `white-space: normal` + 断词
- 移动端（≤900px）：`.Panels` 横向滑动保留，但去掉会继承到标签的 `nowrap`
- Users 磁贴同步允许长用户名换行
- 移动端（≤720px）：全局 settings 表单 `dt` 换行；`span.inner` 固定 137px 改为可收缩换行
- 版本号：**v2.0.0-beta3**

## v2.0.0-beta2 - 2026-07-28

### 概述
设置页移动端长标签居中换行；「检测更新」改为「检查更新」并支持检查 Beta；「背景粒子特效」改为「粒子特效」。

### 变更
- 移动端（≤720px）：主题特效表单 `dt`/`dd` 允许换行并居中，与 PC/其它设置页一致
- 按钮文案：检测更新 → **检查更新**
- 检查更新结果中，关闭按钮前增加 **检查 Beta 版更新**
- 表单标签：背景粒子特效 → **粒子特效**
- 版本号：**v2.0.0-beta2**

## v2.0.0-beta - 2026-07-28

### 概述
独立 Unraid 插件 **Theme Effects**，建立完整的插件目录、设置页和发布链路。

### 变更
- 插件目录：`/boot/config/plugins/theme.effects` + `/usr/local/emhttp/plugins/theme.effects`
- 新增 `ThemeEffects_Loader.page`，通过自有 Buttons 页面完成全局注入
- 配置：`theme.effects.cfg`（SERVICE）+ 原有 `theme-effects.cfg`
- GitHub / Raw / install 脚本地址全部切换至新仓库
- 安装时清理 Theme Effects 自身遗留的重复注入文件
- 新增 `theme.effects.plg` 供插件管理器安装
- 版本号：**v2.0.0-beta**

### 说明
- 2.0 起使用独立插件结构和版本索引
