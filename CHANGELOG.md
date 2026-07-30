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
- **独立插件**（自 2.0.0）：`theme.effects` 目录，不再依赖 Custom WebUI CSS
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
独立 Unraid 插件 **Theme Effects**（仓库改名 `deltrivx/ThemeEffects`），解除对 Custom WebUI CSS 的依赖。

### 变更
- 插件目录：`/boot/config/plugins/theme.effects` + `/usr/local/emhttp/plugins/theme.effects`
- `CustomCSS_Loader.page` → `ThemeEffects_Loader.page`（自有 Buttons 全局注入）
- 配置：`theme.effects.cfg`（SERVICE）+ 原有 `theme-effects.cfg`
- GitHub / Raw / install 脚本地址全部切换至新仓库
- 安装时自动从旧 `custom.css` 寄生安装迁移配置与用户资源，并清理双注入
- 新增 `theme.effects.plg` 供插件管理器安装
- 版本号：**v2.0.0-beta**

### 说明
- 历史 `v1.x` 包仍保留在 `versions/`（路径仍为旧结构，仅供回滚参考）

## v1.8.3-15 - 2026-07-28

### 概述

自定义壁纸/吉祥物大小限制显示在文件选择按钮旁；安装过程去掉「完整安装」等过时文案。

### 变更

- 自定义本地壁纸选择后旁注：`jpg/png/webp/gif，≤12MB`
- 自定义吉祥物选择后旁注：`仅 GIF，≤8MB`
- 检测更新/安装日志不再显示「完整安装」及粒子/胡桃分项状态行

## v1.8.3-14 - 2026-07-28

### 概述

三段标题使用 Unraid 黑色横条；版本号与检测更新/更新日志挂到「主题特效」标题行右侧；去掉安装于与版本操作完成提示。

### 变更

- 背景 / 粒子 / 吉祥物：`div.title` 黑色横条，与其它设置页一致
- 取消「主题版本操作已完成…」提示
- 取消「安装于 …」；版本号 + 检测更新/更新日志放在主标题「主题特效」右侧

## v1.8.3-13 - 2026-07-28

### 概述

三段标题恢复 Unraid 默认样式；自定义壁纸/吉祥物增加大小限制提示；保留「更新日志」，安装过程去掉粒子/胡桃等过时分项信息，统一完整安装。

### 变更

- 背景 / 粒子 / 吉祥物标题改回 markdown `**标题**`（与其它设置页一致，不再居中条带）
- 自定义本地壁纸提示：jpg/png/webp/gif，建议 ≤12MB
- 自定义吉祥物提示：仅 GIF，≤8MB
- 保留「更新日志」查看与安装指定版本；去掉粒子/胡桃/主题特效分项标签与过时确认文案，安装一律完整覆盖

## v1.8.3-12 - 2026-07-28

### 概述

主题特效三段标题居中；自定义吉祥物闪烁二次加固（visibility 冻结帧）；复测分段应用隔离与大文件上传不卡「应用中」。

### 修复与改进

- 背景 / 粒子 / 吉祥物标题改为居中 `ucwc-fx-section-title` 条带样式
- 吉祥物：标签页隐藏时用 canvas 冻结当前帧覆盖；恢复时不重跑全量 `apply()`，避免 class thrash 与 GIF 重启
- `src` 仍仅在 URL 变化时设置；隐藏 live GIF 使用 `ucwc-mascot-frozen`（绕过 opacity !important）
- 分段应用逻辑保持 `UCWC_SECTION` 部分合并（本版复测确认互不覆盖）

### 校验

- 分段 isolation：`particles` / `mascot` / `bg` 各改一项，cfg 其他段字段不变
- 自定义 GIF / 壁纸 multipart 上传：HTTP 200，无「应用中」挂起
- auth-request `CONTENT_LENGTH` 清空仍在 locations.conf

## v1.8.3-11 - 2026-07-28

### 概述

自定义吉祥物最小化再打开闪烁修复；主题特效页「检测更新 / 更新日志」移至版本栏右侧 pill 按钮；背景 / 粒子 / 吉祥物分段独立「应用」。

### 修复与改进

- 吉祥物改为真实 `<img id="ucwc-mascot">` 层（不再用 `html::before` 背景 GIF），避免标签页隐藏/恢复时解码重启闪烁；`src` 仅在 URL 变化时设置
- 版本栏右侧放置「检测更新」「更新日志」，样式对齐应用页搜索条 DockerHub/Apps pill
- 背景 / 粒子 / 吉祥物各段独立「应用 + 完成」；保存支持 `UCWC_SECTION` 部分合并，互不覆盖

### 校验

- 分段 apply：`particles` / `mascot` / `bg` 均 `ok:true` 且保留其他段配置
- ThemeEffects 页含 `ucwc-pill-btn`、三段 `ucwc-btn-save-*`；Dashboard Loader 含 `ensureMascot`

## v1.8.3-10 - 2026-07-28

### 概述

修复主题特效「自定义吉祥物 / 自定义壁纸」点击「应用」后长期卡在「应用中…」：大文件 multipart 上传时 nginx `auth_request` 子请求继承 `CONTENT_LENGTH`，PHP-FPM 空等 body → 504。

### 修复

- nginx：为 `/auth-request.php` 清空 `CONTENT_LENGTH` 并强制 `REQUEST_METHOD GET`（`ucwc-auth-request.conf`）
- 持久化：片段写入 flash；`ThemeEffects` / `CustomCSS_Loader` 在 `rc.nginx` 重建 `locations.conf` 后自动回注并 `HUP` webGUI nginx
- AJAX：有吉祥物或壁纸文件时一律 `FormData` multipart（此前仅壁纸走 multipart）
- 上传：流式 `move_uploaded_file` + 头部 magic 校验，避免多 MB `file_get_contents`
- 前端：应用/上传超时（45s / 120s）与 502/504/413 明确提示，失败后恢复「应用」按钮

### 校验

- 约 5.1MB 自定义 GIF 上传：`HTTP 200`，约 1.5s，`HUTAO_TYPE=custom`
- 模拟 wipe `locations.conf` → 打开任意页（Loader）回注 → 再次大文件上传成功
- ucwc-theme-fx.js.md5: `c3898ea5b00e3a77df54e4afba66dcf3`
- ucwc-theme-fx-save.php.md5: `550ff38f73af3b3bac28b555a76ac02e`

## v1.8.3-9 - 2026-07-28

### 概述

修复 iStoreOS / FnOS 等虚拟机自定义图标消失：图标守卫不再把合法的 `/mnt/user/icons/` 路径预替换成问号。

### 修复

- `/mnt/user/…`、`/mnt/user0/…`、`/boot/config/plugins/…` 视为可加载 Web 路径，仅在真实 onerror 后回退
- 虚拟机磁贴回退使用 `linux.png` 而非 Docker 问号图
- 保留无图标 pulse 关闭与 PNG 尺寸锁定

### 校验

- apps-enhancement.js.md5: `816ebf4c0fb9dfa2557349abceae817d`

## v1.8.3-8 - 2026-07-28

### 概述

根据用户视频确认：仪表盘「一直闪」主要是无彩色图标旁绿色「已启动」三角的 `pulse` 呼吸光；全视口关闭 Docker/VM 磁贴状态脉冲。

### 修复

- 仪表盘 / Docker / VM 磁贴上 `.fa-play/.fa-square/.fa-pause` 取消 `animation: pulse`，改为静态微光
- FA 剪影图标（无 PNG 时的 `i.img`）去掉 filter/animation，避免与脉冲叠闪
- 保留 v1.8.3-7 的 PNG 尺寸锁定与 onerror 一次回退

### 校验

- style.md5: `0241ac18668cefbd4f650036b1d14807`
- apps-enhancement.js.md5: `535d0ef245d30081b5ac2c22bee35994`

## v1.8.3-7 - 2026-07-28

### 概述

修复其他设备仪表盘 Docker 无图标时持续闪烁：锁定图标尺寸与一次失败回退，避免 onerror / drop-shadow 重绘循环。

### 修复

- 仪表盘 / Docker 容器图标固定 32×32，无图标或 404 时一次回退到问号图（再失败用内联 SVG），不再循环 `onerror`
- 回退图标去掉 `filter: drop-shadow`；窄屏去掉磁贴图标滤镜与状态脉冲，减轻移动端 GPU 闪烁
- 拦截 `/mnt/...` 等非 Web 路径图标源，避免其它设备反复 404 重绘

### 校验

- style.md5: `cccfe82a61b80fc5567e65acddeb8c77`
- apps-enhancement.js.md5: `535d0ef245d30081b5ac2c22bee35994`

## v1.8.3-6 - 2026-07-28

### 概述

修复浏览器安装 POST 无法到达 PHP（auth-request 卡住）时永远停在 3%：支持带 CSRF 的 GET 入队，前端奇偶次重试切换 GET/POST。

### 修复

- `install_*` 允许 `GET + csrf_token` 立即入队（与 `check_update` 同路径，更不易卡在 POST auth）
- 前端安装提交：奇数次 GET+csrf，偶数次 POST；失败日志写在进度条下并自动重试
- 保留 1.8.3-5 的无弹窗进度日志、索引短缓存、后台多路径拉起

### 校验

- ucwc-update.php.md5: `9f9963acbd3f4b45fc0af664054ede0f`
- ucwc-theme-fx.js.md5: `87778801e7b130b6d86757a64863ea88`
- ucwc-theme-fx.css.md5: `debe9d109d5a7d8cf66fe7fe7822b958`

## v1.8.3-5 - 2026-07-28

### 概述

修复 WebUI 安装仍卡 3% / 失败时弹窗：安装状态与错误一律写在进度条下方日志；入队失败自动重试；版本索引短缓存减轻 php-fpm 压力。

### 修复

- 安装路径去掉 `alert`：成功/失败/超时均写入进度条下 `#ucwc-out` 日志
- 提交安装请求失败（超时、504、空响应等）最多自动重试 4 次，并提示 auth-request/fpm 繁忙原因
- `check_update` 对 `versions/index.json` 做 45s 磁盘缓存，降低并发 GitHub 占用 worker
- 后台任务拉起增加 `exec`/`proc_open`/`popen` 回退；入队写 hit/enqueue 诊断日志
- 进度 UI 单一 `ucwc-progress-wrap`，避免重复 `#ucwc-out` 把日志写到隐藏节点

### 校验

- ucwc-update.php.md5: `0e6ae20a7b8b1fc26f7237e7930848ea`
- ucwc-theme-fx.js.md5: `951ebc5188f7defe8237ea7029bb50e3`
- ucwc-theme-fx.css.md5: `debe9d109d5a7d8cf66fe7fe7822b958`

## v1.8.3-4 - 2026-07-28

### 概述

修复主题特效页安装进度卡在 3%：Web 请求不再同步访问 GitHub，安装任务立即排队到 CLI 后台。

### 修复

- `install_*` 立刻返回 `job_id`（毫秒级），准备/下载/安装在 `nohup php` 中执行
- 避免单 worker php-fpm 被占用导致 auth-request 504、前端永远停在「启动任务 3%」
- curl 优先 IPv4；前端提交超时与进度轮询重试

### 校验

- ucwc-update.php.md5: `a1c41d66ac05b59bf6263899d14c732f`
- ucwc-theme-fx.js.md5: `b9df34c1aaec0bb5e76e9d4962c0cf0e`

## v1.8.3-3 - 2026-07-28

### 概述

在 v1.8.3-2 基础上完善主题特效：安装进度动态显示、吉祥物自定义与模糊、粒子数量滑条修复。

### 版本管理 / 安装进度

- 安装 / 重装 / 卸载改为异步任务（`job_id`），前端轮询 `job_status`
- 更新面板内进度条、百分比、阶段文案与滚动日志（参考 Docker 更新体验）
- 版本号校验支持 `v1.8.3-N` 后缀

### 吉祥物

- 文案统一：吉祥物开关 / 类型 / 大小 / 位置 / 模糊
- 新增 **吉祥物类型**（默认胡桃 / 自定义 GIF）
- 自定义吉祥物：本地上传 GIF（`mascot-custom.gif`），参考自定义壁纸流程
- **吉祥物模糊**：对角色本身 `filter: blur`（与背景模糊同理），非底板毛玻璃

### 粒子

- 修复粒子数量滑条几乎无效：去掉面积 auto-cap，按 30–120 生效（移动端 ×0.7）

### 校验

- style.md5: `ad6978eeab3ca8fbeca0da244aa0edea`
- apps-enhancement.js.md5: `93d49aa72a6969c2eeaa090a5e909801`
- ucwc-particles.js.md5: `25d1ae731047c5dd35b0932f3ccb8ab6`
- ucwc-theme-fx.js.md5: `1b804045e030d9be5692b21fce15a24b`
- ucwc-theme-fx.css.md5: `58741671a1eafbe12105344a787d13ba`
- ucwc-theme-fx-save.php.md5: `7f5dadaab8798c535509b8fa218e7c30`
- ucwc-update.php.md5: `12619661fb655702089b45b69c33e042`

## v1.8.3-2 - 2026-07-28

### 概述

在 v1.8.3 基础上修复主题特效「应用」可靠性与移动端仪表盘多余粉线，并恢复主题特效页为 GitHub 1.8.3 风格 markdown 布局。

### 主题特效 / 应用

- 新增独立 AJAX 保存端点 `ucwc-theme-fx-save.php`，避免整页 POST 被 nginx/php-fpm 挂起
- 设置类保存默认使用 `application/x-www-form-urlencoded`；仅实际上传自定义壁纸时走 multipart
- 严格登录页判定，消除误报「未登录」；保存成功后立即 `?applied=1` 刷新生效
- BodyInlineJS 下「应用」按钮可点（`.lock` + 延迟解锁）；粒子滑条变更可触发应用
- 恢复 **markdown 表单布局**（选项宽度 / `buttons-spaced` 按钮行与 v1.8.3 一致）
- 去掉背景模式下「修改后需点应用才生效」提示

### 仪表盘 / 移动端

- 修复 Docker / 虚拟机磁贴开关旁粉色竖线：`span.apps.button` / `span.vms.button` 不再套用主题 `.button` 四边渐变框
- 恢复 Unraid `icon-*` 与 FontAwesome 字体，避免磁贴图标被 Rajdhani 覆盖成异常字形
- 磁贴标题中文不再强制 Orbitron 全大写

### 安装脚本

- 安装主题特效时同步部署 `ucwc-theme-fx-save.php`

### 校验

- style.md5: `75338f0d2b3343bd686e02058cbb0f3f`
- apps-enhancement.js.md5: `93d49aa72a6969c2eeaa090a5e909801`
- ucwc-particles.js.md5: `c1c986fe956f76f081e1b34837957d18`
- ucwc-theme-fx.js.md5: `97881c48f525b3dabcf0da9bd16317b0`
- ucwc-theme-fx.css.md5: `fa1c6ec2a2acccc31b8dc6b9c4a9e0ea`
- ucwc-theme-fx-save.php.md5: `2cb84bd3451386ecfb37413c79200858`

## v1.8.3 - 2026-07-28

### 概述

在 v1.8.2 基础上完善主题特效 WebUI 版本管理、背景模糊，并修复设置/工具页收藏心型位置与发光效果。

### 主题特效 / 版本管理

- **检测更新 / 更新日志**：应用行提供版本检测与 changelog；可从日志中安装指定版本
- **一键卸载**入口保留在更新日志面板（不再单独「版本回退」按钮）
- 服务端 `ucwc-update.php` 支持 Outgoing Proxy、读操作用 GET、写操作 CSRF
- 表单动态显示/隐藏整行（背景模式 / 粒子 / 胡桃），不再预留空白行
- 新增 **背景模糊** 开关（`BG_BLUR`），位于背景粒子特效上方

### 设置 / 工具收藏心型

- 修复 `i.favo` 落在图标中心的问题，固定到磁贴右上角
- 心型增加与磁贴图标同系的霓虹发光与体积阴影

### 其它

- Theme Effects 外置 `ucwc-theme-fx.js/css`，避免 Unraid markdown 破坏选择器
- 粒子开关关闭时同步隐藏数量与减少动效子项

### 校验

- style.md5: `e0764ca85acb5e29f85bc25c12ea4cc8`
- apps-enhancement.js.md5: `93d49aa72a6969c2eeaa090a5e909801`
- ucwc-particles.js.md5: `c1c986fe956f76f081e1b34837957d18`
- ucwc-theme-fx.js.md5: `a5db792959ed066e2cade252b1d3e8c8`
- ucwc-theme-fx.css.md5: `fa1c6ec2a2acccc31b8dc6b9c4a9e0ea`

## v1.8.2 - 2026-07-27

### 概述

在 v1.8.1 基础上完善移动端全屏壁纸与一键安装体验；壁纸以真实 DOM 层铺满视口，状态栏颜色与壁纸顶部采样协调。

### 壁纸 / 移动端

- 恢复并强化 **DOM 壁纸层** `#ucwc-wallpaper`（按 screen / visualViewport 过扫描铺满）
- 壁纸顶色采样写入 `theme-color` / `--ucwc-status-color`，减轻系统状态栏纯黑割裂
- `viewport-fit=cover` 与 iOS `black-translucent` 状态栏样式
- 取消错误的「仅对齐 1.7.1 html fixed」中间方案

### 安装脚本

- **无额外参数即可用**：交互终端显示菜单；非交互直接完整安装最新版（全部功能）
- 安装默认完整功能（粒子 / 胡桃 / 主题特效），不询问；可在 WebGUI 主题特效中关闭

### 主题特效（延续）

- 胡桃大小 / 位置；关闭胡桃不误藏粒子
- 应用后强制刷新当前页
- 在线图库 / 自定义图库API 文案

### 校验

- style.md5: `3697bbcb07f0941a09d285ed27dd1456`
- apps-enhancement.js.md5: `52a22e3d4ae738864ecc30c52dba89c3`
- ucwc-particles.js.md5: `ee94ac8fcee19195944d268c0dcc754c`

## v1.8.1 - 2026-07-27

### 概述

在 v1.8.0 正式版基础上修复一键脚本交互回归，并完善主题特效页与移动端全屏壁纸体验。

### 安装脚本

- **恢复顶层菜单交互**：无参数执行一键命令时，重新显示菜单（安装/升级、历史版本、卸载、退出）
- **仅取消粒子 / 胡桃询问**：选择「一键安装 / 升级最新版」或 `install` 时默认完整安装，不再询问是否安装粒子、胡桃
- 非交互环境可继续使用：`install` / `install <version>` / `uninstall` / `list`

### 主题特效页

- 胡桃大小：小 / 中 / 大（仅开启时显示）
- 胡桃位置：左上 / 右上 / 左下 / 右下（默认右下）
- 关闭胡桃时不再误隐藏粒子等其它选项
- 点击「应用」后**自动强制刷新当前页**使配置立即生效（无需手动再刷一次）
- 文案：动态壁纸 → 在线图库；自定义壁纸API → 自定义图库API

### 移动端 / 全屏

- 壁纸层使用 `cover` + 最大可用高度（`--ucwc-cover-h`）
- 针对全屏顶部状态栏/刘海区域增加向上 overscan（`--ucwc-cover-top` + safe-area）
- 浏览器全屏 / standalone 时尽量消除上下黑边；非全屏保持原有无黑边表现

### 兼容

- Latest 指向 **v1.8.1**；保留 v1.8.0 / v1.7.1 等历史版本
- 已有 `theme-effects.cfg` 升级时不覆盖用户设置，仅补齐新键

### 校验

- style.md5: `247d04dfe281ea944d78dbd28e779d1f`
- apps-enhancement.js.md5: `52a22e3d4ae738864ecc30c52dba89c3`
- ucwc-particles.js.md5: `ee94ac8fcee19195944d268c0dcc754c`

## v1.8.0 - 2026-07-27

### 概述

v1.8.0 在 v1.7.1 基础上基于 Windows 底层进行优化，彻底解决不同平台可能存在 WebUI 卡顿问题、模块视觉精修，并新增主题特效设置页。安装后默认直接启用主题与可选组件，无需交互选择；粒子、胡桃、背景等可在 WebGUI 中自行调整。

### 新功能

#### 主题特效页（设置 → 用户偏好 → 主题特效）

- 中文界面
- **背景模式**
  - **本地壁纸**：本地壁纸1 / 本地壁纸2 / 自定义本地壁纸（浏览器上传）
  - **在线图库**：写真 / 二次元 / 古风 / 自定义图库API
- **背景粒子特效**：开/关、粒子数量（30–120，默认 60）
- **胡桃吉祥物**：开/关
- **减少动效**：开/关
- 配置写入 `theme-effects.cfg`（不改官方 dynamix 显示设置）
- 点击「应用」后保存并刷新生效；编辑过程不做实时预览

#### 壁纸资源（扁平 assets）

- `background-1.jpg`：内置本地壁纸1
- `background-2.jpg`：本地壁纸2
- `background-custom.jpg`：用户上传
- `background-dynamic.jpg`：在线图库缓存
- 粒子引擎：`ucwc-particles.js`（受 cfg 控制）

### 视觉与体验

- 基于 Windows 底层的流畅基线（外壳 / 壁纸 / 层次）
- 模块内图标体积感（Plan A：向下暗色 shape 阴影，非霓虹）
- 内容层顶缘受光 / 轻文字深度

### 安装与默认行为

- 一键安装 / 升级默认指向 **v1.8.0**
- **取消交互询问**（不再询问是否安装粒子 / 胡桃）
- **默认直接安装**完整主题（含粒子、胡桃、主题特效）
- 安装结束提示：可在 **设置 → 用户偏好 → 主题特效** 中自行调整背景、粒子与吉祥物
- `versions/index.json`：`latest_version` / `default` → `v1.8.0`

### 兼容与说明

- 保留 v1.7.1 及更早版本供回滚
- 应用页增强（CA）逻辑延续 v1.7.x
- 在线图库需 Unraid 能访问外网；自定义图库 API 仅支持 http/https 图片地址
- 建议安装后强制刷新浏览器缓存（Ctrl+F5）

### 校验

- style.md5: `83960f8d9384c47a719b7682b4dde11b`
- apps-enhancement.js.md5: `52a22e3d4ae738864ecc30c52dba89c3`
- ucwc-particles.js.md5: `ee94ac8fcee19195944d268c0dcc754c`

## v1.7.1 - 2026-07-23

### 仪表盘深度与性能折中

- 仪表盘模块使用 3 层软投影 + 更深底色与受光高光，减轻纸片感；悬停只抬升、不再改滤镜，避免反复重绘。
- 顶部导航与页内标签条恢复 2 层 drop-shadow 悬浮层次（取消普通 box-shadow 扁平化）。
- 仪表盘页冻结全屏粒子动画（外观保留），其它页面粒子仍可轻微漂移。
- 壁纸继续全屏铺满固定背景，避免短页面底部大片留白。
- 保留页眉 Logo 动态与胡桃吉祥物；切换到后台标签页时暂停 Logo、粒子与状态图标动画。

### 应用商店（Community Applications 2026.07）适配

- 搜索建议改适配新版下拉组件，避免升级后建议框样式失效或位置错乱。
- 建议列表挂到页面顶层并跟随搜索框定位，避免被搜索工具栏裁切。
- 桌面端左侧分类菜单保持常显；补齐「已安装 / 历史应用」等嵌套子菜单样式。
- 主题加载器在插件启用时稳定注入应用页增强脚本，缓存随文件更新自动刷新。
- 应用页 DOM 观察仅作用于应用商店壳层，离开应用页自动断开，减少全站无关开销。

### 应用商店桌面端侧栏

- PC 端左侧分类菜单与右侧内容区同高，菜单过长时可在侧栏内独立纵向滚动。
- 移动端侧栏交互与滚动行为保持不变。

### 顶部导航

- 隐藏顶部菜单栏（仪表盘、主界面等）与右侧切换区的系统细滚动条；窄屏仍可横向滑动切换。

## v1.7.0 - 2026-07-20

### PC 与移动端同步优化

- 统一应用商店在桌面端与手机端的搜索区、侧栏与操作按钮表现，减少两端布局和交互差异。
- 修正 PC 端搜索区与顶部菜单过近的问题；移动端搜索行仅保留左右滑动，避免整行上下拖动干扰。
- 操作中心底栏按钮样式对齐搜索行控件，保证双端视觉一致。

### 代码结构与卡顿治理

- 合并应用页增强脚本为单一 `apps-enhancement.js`，去掉重复注入与冗余逻辑。
- 使用路由级 `body.ucwc-*` 隔离与轻量同步，减少全站无效选择器与重复布局计算。
- 搜索建议定位改为 `requestAnimationFrame` 合并刷新，降低输入、滚动与窗口变化时的卡顿。

### 一键安装脚本可选交互（仅最新版）

- 安装 / 升级最新版时可选择：
  - 粒子特效：安装后背景更有层次、视觉更好看；取消后页面更轻，流畅度提升更明显。
  - 胡桃吉祥物：安装后右下角有吉祥物陪着你；取消后少加载一张大图，流畅度略有提升、界面更干净。
- 默认均安装；选择取消时分别剥离对应 CSS 标记块，不装胡桃时不下载并清理 `hutao.gif`。
- 历史版本安装流程不变；仅最新版提供上述选项。原有安装 / 升级 / 回滚 / 卸载能力保持不变。

## v1.6.1 - 2026-07-16

### 主题结构清理

- 同步本地已验证的 Custom WebUI CSS 主题文件。
- 清理重复 CSS 规则、重复声明和无效选择器，保持视觉表现不变。
- 为主题 CSS 增加结构化章节标注，方便后续维护。

### 默认粒子特效

- 新增默认开启的纯 CSS 粒子层，桌面端和移动端均生效。
- 粒子层叠加在现有背景之上，不新增背景图，不拦截点击。
- 移动端使用更淡、更慢的粒子表现，降低视觉干扰。

### 应用页增强脚本

- 同步 `apps-enhancement.js` 到主题根目录和版本归档。
- 增加重复初始化保护，避免脚本重复注入时重复绑定事件。
- 使用 `requestAnimationFrame` 合并搜索建议定位计算，减少输入、滚动和窗口变化时的重复布局读取。

## v1.6.0 - 2026-07-15

### 新版 Community Applications 双端适配

- 针对新版 Community Applications 页面重新整理桌面端和移动端布局，修复顶部重叠、内容区错位、侧栏高度异常及居中限宽失效。
- 桌面端恢复内容区独立纵向滚动，限制滚动范围并与左侧菜单底部对齐，避免滚动过度后出现空白。
- 桌面端左侧菜单增加顶部留白，调整文字水平位置，避免首项紧贴边框。
- 移动端侧栏取消遮罩和过渡动画，展开后直接显示，未显示区域随整个页面自然纵向浏览。
- 搜索工具栏保持页面内部横向滑动，隐藏可见滚动条，不再撑宽或拖动整个页面。
- 搜索框、结果数量、DockerHub、信息和设置按钮统一高度、中心线和文字基线。

### 搜索建议

- 将搜索建议列表提升到页面顶层，避免被移动端横向搜索工具栏裁切或遮挡。
- 搜索建议固定锚定在搜索框下方，并随页面整体自然上下移动，不再漂浮、乱跳或独立追随滚动。
- 横向滑动搜索工具栏时重新对齐建议框，右边缘停止在搜索/清除按钮之前。
- 清除列表默认缩进，建议框宽度严格匹配文字输入区域。
- 恢复圆角半透明玻璃背景、模糊、边框和阴影，取消位置动画。
- 保留原生候选项点击选择及自动回填搜索框功能。

### 一键脚本

- 新增独立 `apps-enhancement.js`，不再发布或覆盖完整 CA `Apps.page`。
- 安装最新版时仅向当前 CA 页面添加一段带明确标记的脚本引用，重复升级会先清理旧标记，避免重复注入。
- 回滚历史版本或一键卸载时自动移除增强引用和文件，不残留对 CA 页面行为的修改。
- CA 更新覆盖页面后，可重新执行“一键安装 / 升级最新版”恢复应用页增强。

## v1.5.2 - 2026-07-13

### 主界面移动端阵列操作布局

- 修复手机端“磁盘阵列操作”中按钮宽度超过按钮列、覆盖右侧说明文字的问题。
- 重新分配移动端三列宽度，完整容纳“历史记录”和“清除统计信息”等较长按钮。
- 操作按钮组整体左移，按钮与说明文字恢复清晰间距。
- 将 SMB/NFS 共享区域的三个添加按钮整体右移，与移动端卡片左边缘对齐。
- 收窄按钮容器的可用宽度，避免右移后在手机右侧产生新的溢出。
- 遍历仪表板、主界面、共享、用户、设置、插件、Docker、虚拟机和工具页，清除横向滑动模块的可见滚动条。
- 保留所有横向容器的触摸滑动能力，并明确排除应用页面现有的独立适配规则。
- 修改仅在移动端生效，桌面端布局保持不变。


## v1.5.1 - 2026-07-13

### 安装脚本显示设置补全

- 安装和升级时新增强制设置标题自定义背景颜色为 `#000000`。
- 首次安装时同时保存原始标题背景颜色。
- 一键卸载时恢复用户安装前的标题背景颜色。
- 自动显示设置现在完整包含黑色主题、白色主文字、白色次级文字和黑色标题背景。


## v1.5.0 - 2026-07-13

### 应用页面移动端工具栏

- 手机端保留完整 Unraid 系统页眉和顶部导航，应用页面不再单独上移。
- 搜索框改为常驻行内输入，不再打开独立搜索遮罩。
- 分类侧栏取消遮罩，使用与桌面一致的宽度、边距、圆角和深色背景。
- 展开侧栏时仅调整搜索栏下方内容，页眉、导航和搜索工具栏保持原位。
- 侧栏切换按钮固定在横向工具栏左侧，取消额外按钮背景。
- 搜索框、排序、数量统计、DockerHub、动态结果标签、信息和设置按顺序横向排列。
- 搜索结果增多后整行可左右滑动，信息和设置位于内容尾部随之滑动。
- 隐藏工具栏横向滚动条、顶部左右导航滚动条和移动端主内容滚动条，保留手势滚动。
- 搜索框与结果标签采用紧凑可见高度，统一垂直中心和文字基线。
- 修复 `1 - 2 of ...` 数量统计仍为块级元素导致的文字偏移。
- 微调 DockerHub 图标的垂直位置，使其与同排内容视觉居中。

### 桌面端兼容

- 固定桌面行内搜索框和放大镜的横向位置。
- 输入内容并生成大量搜索结果后，搜索图标不再被结果区域向左挤压。
- 保持现有桌面侧栏、卡片和居中限宽布局不变。


## v1.5.0 - 2026-07-13

### 应用页面移动端工具栏

- 手机端保留完整 Unraid 系统页眉和顶部导航，应用页面不再单独上移。
- 搜索框改为常驻行内输入，不再打开独立搜索遮罩。
- 分类侧栏取消遮罩，使用与桌面一致的宽度、边距、圆角和深色背景。
- 展开侧栏时仅调整搜索栏下方内容，页眉、导航和搜索工具栏保持原位。
- 侧栏切换按钮固定在横向工具栏左侧，取消额外按钮背景。
- 搜索框、排序、数量统计、DockerHub、动态结果标签、信息和设置按顺序横向排列。
- 搜索结果增多后整行可左右滑动，信息和设置位于内容尾部随之滑动。
- 隐藏工具栏横向滚动条、顶部左右导航滚动条和移动端主内容滚动条，保留手势滚动。
- 搜索框与结果标签采用紧凑可见高度，统一垂直中心和文字基线。
- 修复 `1 - 2 of ...` 数量统计仍为块级元素导致的文字偏移。
- 微调 DockerHub 图标的垂直位置，使其与同排内容视觉居中。

### 桌面端兼容

- 固定桌面行内搜索框和放大镜的横向位置。
- 输入内容并生成大量搜索结果后，搜索图标不再被结果区域向左挤压。
- 保持现有桌面侧栏、卡片和居中限宽布局不变。


## v1.4.0 - 2026-07-12

### 应用页面手机端适配

- 修复手机端隐藏分类菜单时，搜索控件覆盖“最近添加”标题和说明文字的问题。
- 修复内容区被桌面端位移规则整体下推，导致卡片、标题和工具按钮重叠的问题。
- 修复展开分类菜单时侧栏沿用桌面端顶部、底部和高度，产生大面积错位的问题。
- 手机端恢复 Community Applications 原生响应式定位变量和内容滚动逻辑。
- 保留主题的菜单圆角、文字缩进、分隔线对齐和垂直滚动效果。
- 移动端修复限定在 `767px` 以下，桌面端搜索栏、侧栏、卡片和居中限宽布局保持不变。


## v1.3.0 - 2026-07-12

### 应用页面适配

- 修复新版 Community Applications 页面顶部导航、搜索栏和内容区相互重叠的问题。
- 搜索框与左侧菜单增加统一圆角，优化搜索文字和菜单文字的水平留白。
- 调整左侧菜单顶部间距，避免首项文字和图标紧贴上边框。
- 对齐菜单分隔线与文字区域，移除多余的横向滚动块，同时保留垂直滚动。
- 保留 Community Applications 原生内容排版，仅提供侧栏滚动和底部对齐等必要兼容。
- 适配 Unraid 的居中限宽与无限宽显示模式，避免应用页固定为单一宽度。

### 一键脚本

- 第一项统一为“一键安装 / 升级最新版”：未安装时直接安装，已安装时覆盖升级。
- 第二项统一展示最新版和全部历史版本，用户可直接选择任意版本安装或回滚。
- 第三项新增一键卸载，仅清除本仓库管理的主题文件并禁用 Custom WebUI CSS。
- 安装时自动将 Dynamix 主题设为黑色，并将页眉主文字与次级文字设为白色。
- 首次安装时保存原显示设置；一键卸载时自动恢复，避免污染用户原配置。
- 增加 root、Unraid 配置文件、curl、jq 和交互终端检查，错误提示改为中文。

## v1.2.0 - 2026-07-12

### 单命令交互流程

- 将安装、升级最新版、回滚历史版本和查看版本统一到原有的一键安装命令中。
- 新增统一操作菜单：一键升级最新版、手动选择版本、查看版本列表或退出。
- 移除其他命令行参数和重复操作方式，用户只需记住一条安装命令。
- 将冗长的时间戳版本号调整为简洁的语义化版本。

## v1.1.0 - 2026-07-12

### Unraid 7.3.2 应用页面兼容

- 移除与新版 Community Applications 应用界面冲突的旧布局覆盖。
- 恢复应用页面原生搜索栏、分类侧栏、应用网格、卡片尺寸、滚动和内容流布局。
- 保留全局赛博朋克主题及其他页面的视觉样式。

## v1.0.0 - 2026-07-11

- 首个归档版本。
- 保留旧版 Community Applications 应用页面完整定制样式。
