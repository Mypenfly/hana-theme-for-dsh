# hana-theme-for-dsh · 方案设计

> **目标**：在 DSH Desktop 上复刻 HanaAgent（openhanako）的设计语言 —— 纸本手抄本的配色、衬线阅读排版、纸质纹理与克制的动效。
> **依据**：`docs/research_community-themes.md`（DSH 官方令牌契约 + 三社区主题）与 `docs/research_openhanako-style.md`（HanaAgent 设计系统）。
> **本文件性质**：可直接执行的实施规格。所有色值、令牌名、选择器均已实测或计算，非占位符。

---

## 0. 目标、范围与还原度分级

### 0.1 一句话定义

> **把 HanaAgent 的「纸本手抄本」搬进 DSH —— AI 说的话是印在纸上的墨字，人用的控件是纸上盖的印章。**

### 0.2 还原度分级

调研确认 HanaAgent 的部分设计**无法**或**不应**在 DSH 上照搬。诚实分级：

| 维度 | 还原度 | 说明 |
|---|---|---|
| **配色（纸/墨/印章）** | 🟢 **完整复刻** | 通过 `ctx.theme` 令牌通道，1:1 映射 |
| **衬线阅读排版** | 🟢 **完整复刻** | 覆写 14 个 `--dsw-font-markdown-*` shorthand 的 family 尾部即可；⚠️ **不是** `--dsw-font-family`（那会把整个界面变衬线）—— 见 §0.3 E1 |
| **Markdown 元素级细节**（行高 1.75、h1 居中、Callout） | 🟡 **需选择器补足** | 令牌表达不了，需少量规则 + 稳定的 `md-*` 全局类 |
| **纸质纹理 + 亮度补偿** | 🟢 **完整复刻** | 纯 CSS，无依赖 |
| **极方圆角 + 0.5px 发丝线** | 🟡 **需选择器覆写** | DSH 无全局圆角令牌，用「先清零再恢复」模式 |
| **动效语言** | 🟡 **精选移植** | 只搬 8–10 个关键帧，不搬全 25 个（DSH 场景不同） |
| **6.5 MB 自托管字体** | 🔴 **不搬** | 改用系统衬线栈（见 §1 D3） |
| **晴天模式（2.4 MB 视频）** | 🔴 **不搬（本期）** | 体积 + `backdrop-filter` 冲突风险，列为可选后续 |
| **多角色 `--mood-accent`** | 🔴 **不适用** | DSH 无多角色 Agent 概念 |
| **书桌 / 笺 / 频道 / 侧栏 Widget** | 🔴 **不适用** | 那是 HanaAgent 的产品功能，非主题 |

---

### 0.3 ⚠️ Phase 1 实测修订（实现之后的回溯勘误）

§1–§9 是本方案的原始设计。实现阶段把每一条都拿运行时核对了，**其中有若干条被实测推翻**。本节是权威的勘误表：凡与正文冲突，以本节为准。修订依据全部来自运行中的 DSH Desktop 2.0.5（`dsh-client-ui-theme` 0.1.2-rc.1）与其自带的**未压缩** `.module.css` 源码，命令与产物都记在括号里。

**被推翻的原始判断**

| # | 原始设计（正文位置） | 实测结论 | 证据 |
|---|---|---|---|
| E1 | 「`--dsw-font-family` 一条令牌即可换掉全部 markdown 字体」（§0.2、§1 D3） | ❌ **错**。markdown 字体走 14 个 `--dsw-font-markdown-*` **font shorthand**；改 `--dsw-font-family` 会把整个界面（`body{font-family:var(--dsw-font-family)}`）连同按钮、侧栏全部变衬线 | `MarkdownText.module.css:8` 用 `font: var(--dsw-font-markdown-base)`；该 shorthand 定义为 `var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family)` |
| E2 | 「**绝不**自写 `--dsw-*`」（§1 D1） | ⚠️ **过宽**。必须避免的只有**已注册的颜色令牌**（89 个 `--dsw-alias-*`/`--dsw-specific-*`），它们被行内样式压掉；`--dsw-font-*` 不在可注册集合内，**只能**用 CSS 设置 | `validateOverrides` 只校验值形状；行内写入只覆盖已注册名 |
| E3 | `--dsw-alias-label-inverted`（§3.1） | ❌ **该令牌不存在**。真名是 `--dsw-alias-label-inverse` 与 `--dsw-alias-label-primary-inverted`；且 `label-inverse` 本身 declare=0 / consume=0，是死令牌 | `Theme.listTokens` 全量列表 |
| E4 | `--dsw-shadow-lv2` 列在令牌表（§3.1、§3.2） | ❌ **不是可注册令牌**。阴影无法走 `register()`，只能走 CSS | 可注册集合只含颜色 alias/specific |
| E5 | `--dsw-alias-separator-primary`、`--dsw-alias-line-secondary`、`--dsw-alias-label-error`（§3.1、§3.2） | ⚠️ **一半被 E22 推翻**：`separator-primary` 与 `label-error` 其实**被读取**。`line-secondary` 确为死令牌，结论保留 | `grep -c 'var(--dsw-alias-separator-primary)' <frontend css>` → 0（该 grep 范围太窄，见 E22） |
| E6 | 暗色 `tooltip-bg: #EEEAE2`（§3.2） | ❌ **会导致不可见**。`Tooltip.module.css` 把文字颜色写死为 `--dsw-static-neutral-bluish-00`（近白），**任何主题令牌都够不到**。因此 tooltip 底在两种模式下都必须保持深色 | `Tooltip.module.css:15-16` |
| E7 | `--dsw-alias-toast-bg`（§3.1、§3.2） | ⚠️ **死令牌**（本版本无消费者）。Toast 实际用 `--dsw-alias-button-contrast-fill` 作底、`--dsw-alias-label-primary-inverted` 作字 | `Toast.module.css:21-22` |

**原设计未预见、实现时才发现的机制**

| # | 发现 | 为什么重要 |
|---|---|---|
| E8 | **`Theme.listTokens` 不是白名单**。其实现是 `BUILTIN_INSPECT_TOKENS`（13 条手写）+ 遍历**所有已注册主题**与**所有 override 层**的令牌键 | 拿它当校验依据，等于让本主题的正确性取决于用户装了哪些无关插件。本机的 StyleVault 就往里灌了 80 个名字 |
| E9 | **`overrideTokens` 只校验值、从不校验名** | 拼错/过期的令牌名不会抛错，会被接受、写入、却无人读取 —— 静默失效。这正是必须从工件里**生成**白名单的根本原因 |
| E10 | **`overrideTokens` 是叠在「当前活动主题」之上的**（`composeActive(active)`） | 无条件调用会重绘内置亮/暗主题，即"我装了个主题结果它改了我没选的配色"。本实现因此**只在活动主题属于本主题时才应用视觉层**；Phase 1 干脆不使用 `overrideTokens`，两套配色完全由 `register()` 承载 |
| E11 | **`--dsw-alias-label-primary-foreground` 的极性被 harness 自己确认**：亮色=近白，暗色=近黑 | 印证 §3.3 的极性反转不是臆测 |
| E12 | **`hr` 与表格边框本来就是 `0.5px`** | §5.4 的"发丝线"工作量比预期小得多，DSH 已在用这个粒度 |
| E13 | **真实的 markdown CSS 源码可读**：`@deepseek-ai/dsh-client-ui-primitives/lib/markdown/MarkdownText.module.css`（307 行，**未哈希**） | Phase 2 应直接以它为据，不必再从压缩 bundle 反推；`md-code-block`、`md-table-wide`、`.katex-display` 三个钩子在此文件中得到确认 |
| E14 | **令牌集合随版本变化**：0.1.2-rc.1 有 89 个，0.1.5-alpha.1 有 90 个（多 `--dsw-alias-link`） | 白名单必须版本化生成，不能凭记忆写死（`npm run allowlist:all` 会列出本机全部安装及各自数量） |
| E15 | D3 只换了书体，**没考虑"同一 px 下衬线显得更小"** | ❌ **实测必须补偿**。CJK 尤甚：`sans-serif` → 思源黑体，而衬线栈 → 思源宋体，后者笔画细得多；14px 下宋体的横画会被像素网格吃掉，看着又小又淡。而 DSH 字号上限 17px（`FONT_SIZE_MIN..FONT_SIZE_MAX`），没有余量从「外观」补偿 | `fc-match` 实测：`serif`→思源宋体、`sans-serif`→思源黑体；DSH 源码 `setProperty(CONTENT_FONT_SIZE_VARIABLE, ...)` 且上限 17 |
| E16 | 字体栈把 `'Songti SC'`/`'STSong'` 排在 `'Source Han Serif SC'` 之前（§1 D3） | ⚠️ **Linux 下会被 fontconfig 替换成无衬线**：本机 `fc-match "Songti SC"` → **思源黑体**。未安装的族名排在前面时，fontconfig 会给出替身，中文可能根本不是宋体 | `fc-match "Songti SC"` → `SourceHanSans.ttc` |
| E17 | §5.1 的三层纹理要求逐面板 `background-image`（`[class$='_bubble']` 等） | ⚠️ **改为整屏单层**。DSH 的面板名是构建哈希，逐面板要么猜后缀、要么在元素带第二个类名时失配；单层不依赖任何哈希，也不会因改版失效 | 探针实测：面板类名形如 `V0s2hW_flowItem`、`_1qAH1q_centerCol` |
| E18 | §5.2 要求额外叠一层暖白 `rgba(255,253,247,0.35)` 做亮度补偿 | ⚠️ **不需要**。补偿层是"用灰色纹理提亮回去"的补丁；改用 `soft-light` 后，混合色为中间灰时 W3C 函数**原样返回底色**，而 `fractalNoise` 正是围绕 0.5 对称分布 —— 中性是设计的性质，不是补出来的。实测最大强度下对比度仅移动 0.06（纸本）/ 0.09（青夜） | `test/contrast.test.js` 的 soft-light 合成模型，5 条断言 |
| E20 | §4.3 的 Callout **路线 A（推荐）**：主题只提供样式，把 class 契约写进 README | ❌ **不可能**。DSH 已把 react-markdown 换成自研 mdast→React 渲染器，其未授信输出策略明确写着 **raw HTML renders as literal text (no HTML enters the DOM)** —— 没有任何路径能让 `.hana-callout` 进入 DOM，所以只写样式等于**死 CSS**。路线 B（MutationObserver）也只剩半成品：即便给 `blockquote` 加上 class，那个字面量 `[!NOTE]` **仍留在正文里**，除非改写文本节点 —— 那是我不愿做、也验证不了的侵入 | `dsh-client-ui-primitives/lib/types/markdown/render.d.ts` 的模块说明 |
| E19 | §5.4 的"先清零再恢复"（`[class] { border-radius: 2px !important }` + 恢复列表） | ⚠️ **改为点名控件**。实测 shipped bundle 里 `border-radius:50%` 出现在**元素级**规则上（badge / rail / credentialDot），清零会真的把它们变成方块，而恢复列表只能靠猜哈希类名。点名 `button/input/select/textarea/[role=button]/[role=tab]` 后**无需恢复任何东西**，且不必用 `!important`（特异性 0,3,1 已胜出）。代价是"极方"只覆盖控件与输入区，不覆盖所有圆角矩形 | `grep 'border-radius:50%' dsh-client-ui-*/lib/client.js` 命中 6 个包 |
| E21 | flake devShell 导出 `PNPM_HOME="$PWD/.pnpm"`，并在 banner 里提示**在该 shell 中**执行 `dsh plugin --profile web add "link:$PWD"` | ❌ **这条组合会写坏目标 profile**。pnpm 11 把 store 根挂在 `PNPM_HOME` 之下（§0.3 上文"两半都要"的判断本身没错），而该变量会被**所有子进程继承**：`dsh plugin` 所驱动的 pnpm 于是把 `…/dsh-plugins/theme/.pnpm/store/v11` 写进 `~/.dsh/profiles/web/node_modules/.modules.yaml`。此后 pnpm 11 的 `checkCompatibility`（`storeDir` 记录值 ≠ 解析值即抛错）**拒绝该 profile 的一切安装与卸载** → `ERR_PNPM_UNEXPECTED_STORE`；store 目录随后消失，连 store 索引都打不开 → `[ERR_SQLITE_ERROR] unable to open database file`（市场识别不了这个码，原样抛栈，就是用户看到的那段）。**两处修复**：① profile 侧 —— 退出 DSH Desktop，在**非 devShell** 的终端里 `cd ~/.dsh/profiles/web && pnpm install --config.confirmModulesPurge=false`（沙箱副本实测 exit 0、0 下载、`storeDir` 改写为全局路径）；② 仓库侧 —— devShell 增加 `dsh()` 包装函数，在边界处 `env -u PNPM_HOME`，使 `PNPM_HOME` 再也出不了这个 checkout | 两个 profile 的 `.modules.yaml` 对照：`desktop` = `~/.local/share/pnpm/store/v11`（DSH 内置 pnpm **11.8.0**）、`web` = 仓库内 `.pnpm/store/v11`（nix pnpm **11.21.0**，即 devShell 那个）；抛错条件见 `pnpm.mjs` 的 `checkCompatibility`：`relative(modules.storeDir, opts.storeDir) !== ""` 即 `throw new UnexpectedStoreError` |

| E22 | E5：把三个名字判为死令牌，依据是 `grep -c 'var(--dsw-alias-separator-primary)' <frontend css>` → 0 | ❌ **结论错在两个名字上**。那个 grep 只扫了 `dsh-web-frontend` 的 bundle，**没有扫各个 `dsh-client-ui-*` 包**，而两个名字恰恰只在那里被读：`dsh-client-ui-chat` 用 `separator-primary` 画行间的间隔点（`color`），`dsh-client-ui-settings-plugins` 用 `label-error` 画无效输入（`border-color` 与 `color`）——而且两处 `var()` **都没有 fallback**，所以不供应不是"回退到 harness 默认"，而是该声明在 computed-value 阶段直接失效、属性消失。`line-secondary` 确实 declare=0 且 consume=0，结论保留 | 新增的**引用侧**扫描：`npm run refresh:allowlist` 现在同时报告 `consumedNotRegistered`（名字、读取它的包、以及该读取有没有 fallback）。本机实测 10 个名字被读而未被 0.1.2-rc.1 声明，其中 8 个的读取**没有 fallback**；`test/tokens.test.js` 现在两个方向都断言，`test/selftest.js` 用 3 条变异证明它不是空转 |
| E23 | §3.1 与 §3.2 的"**墨 5 档**"逐格填值（`label-secondary` 8.50 / `label-caption` = 三级 / `label-dimmed` 3.13） | ❌ **名不副实，实际只有 4 档，而且四套配色各走各的**。① `label-caption` 在四套配色里与 `label-tertiary` **完全相同**——级差 1.00，两个命名层级画成同一个颜色（上游 DSH 在明暗两种模式下都把它们分开 14.5 L*，且 caption 始终更靠近背景）；② 中段级差在 0.49（珊瑚）到 0.87（青夜）之间，`label-secondary`/`label-tertiary` 各 22/23 处消费者、全是正文。根因是这五格是在还不知道消费者是谁的时候逐格填的 | 现改为**几何推导**：`primary` 与 `tertiary` 作锚点（identity 与 AA 下限，均未改动），`secondary` 取二者对比度的几何中项，`caption`/`dimmed` 按 f^2.5 / f^3 续下；`tools/derive-ink-ramp.mjs` 生成、`npm test` 逐步复算，`test/contrast.test.js #29` 另外独立断言**形状**（每级级差 < 0.90、上段几何性 ±1.5%）。受影响：四套配色的 `secondary`/`caption`/`dimmed`，以及两个镜像 role `label-primary-dimmed`、`markdown-placeholder` |
| E24 | §3.2 与 §5.6 的四套配色里，主按钮 hover 与各级层次值分别取值 | ❌ **两处内部矛盾**。① 珊瑚的主按钮悬停**变弱**（对底色 12.52:1 → 10.80:1），另外三套都是变强（1.18–1.45x）——指针指向它时它反而更像禁用。② 青夜的 `bg-layer-3` 与 `bg-base` 明度**完全相同**（差 0.0 L*），而它被 21 张样式表读取，等于画了个空；斑斓的 `bg-layer-3` 反而比底色更亮（+3.2），方向与另外三套相反 | 悬停改为断言「必须远离底色、且至少 1.10x」（珊瑚解为 `#091E36`，1.250x）；层次模型写成四条断言——layer-1 抬起、layer-2 下沉、layer-3 比 layer-2 更深、skeleton 恒等于 layer-3（青夜 → `#303E47`，斑斓 → `#1C2830`）。3 条变异复现旧值证明断言不空转 |
| E25 | §3.2 的 L1 表面梯级：`PLANE_FLOOR = 1.06`（「每个 plane 距底色至少 1.06」），并据它重写了四套配色的平面值 | ❌ **这个下限是凭一套配色发明的，而且它造成了实际损害**。它唯一的依据是「纸本的 layer-1/layer-2 本来就在 1.065–1.070 且看得出来」，于是把这个区间**当成目标**施加到所有配色。但 HanaAgent 自己的主题文件说得很清楚：`themes/coral.css` 的 `--bg-card: #FFFBF3`（对底色 `#FDF6EC` 只有 1.033），卡片是靠 `--border: rgba(243,126,99,0.18)` 的细线和 `--shadow` 区分，不是靠明度。强推 1.06 把珊瑚的卡片抬到 `#FFFEFA`（sRGB 在近白处截断，暖色被洗掉），随后 `READ_HEADROOM` 判定抬升侧余量不足又把**它压回来**，得到 `#EFEEEB` —— 一个在中性灰上定格的卡片；它的四个镜像（`bg-overlay`、`button-elevated`/`floating`/`tool-bar-fill`）、`menu` 与 `input-major` 一并跟进。用户看到的「输入框与『新会话』背景割裂」「工具调用像高亮框」全部出自这一处 | ① **删掉那个下限**：`tools/derive-surfaces.mjs` 现在只有一档 `SEPARATION_FLOOR = 1.02`，底色本身也作为「邻居」进入 `SEPARATION`（所以「平面必须能跟页面区分」仍然被强制，只是不再要求它**离得远**）；`test/surface-roles.json` 的 `planeFloor` 字段一并移除。② 珊瑚的 `bg-layer-1`/`bg-overlay`/四个镜像/`menu`/`input-major` 回到参考值 `#FFFBF3`。③ 新增 **#34 色相保持断言**（56 条）：plane 的 OKLab 彩度不得低于底色的 45 % —— 对比度**对颜色一无所知**，`#EFEEEB` 在 1.081:1 上过得很舒服，这正是它躲过 292 条断言的原因。④ 变异 `plane-tint-drained` 复现 `#EFEEEB` 证明断言不空转 |
| E26 | §3.2 珊瑚的 `label-primary-inverted` 与 `button-contrast-fill` | ❌ **前者与 `label-primary` 取了同一个值 `#1A3049`，后者取珊瑚朱 `#F37E63`**。两个都是错的，症状就是用户报的「logo 只能看到一个色块」。官方 `BrandWordmark` 把 HARNESS 画成一块 `fill: currentColor` 的圆角矩形、字用 `var(--dsw-alias-label-primary-inverted)` 叠在上面，而 `currentColor` 就是 `label-primary` —— 于是字与底板同色，整块糊成一个色块。侧栏的 `buildVersion` 是同一对（`background: label-primary; color: label-primary-inverted`）。上游 stock 主题给出了这个令牌的**契约**：亮色模式声明为 `bluish-00`（#fff）、暗色模式为 `bluish-800`（#353638）—— 即 `label-primary` 的**反色**，所以珊瑚（亮色）必须是近白。改成和纸白 `#FDF6EC` 后，随之暴露第二个错：`button-contrast-fill` 的中亮珊瑚朱底板会让这个近白字形只剩 2.46:1（附件删除按钮就是这个组合）。stock 的 `button-contrast-fill` 在亮色模式是 `bluish-700`（暗板配白字），而 HanaAgent 自己的 `--accent`（主按钮填充）也是墨蓝 `#1A3049` —— 珊瑚把珊瑚朱当实心按钮色本身就是误读（`--coral` 在参考里只做色调与线条） | `label-primary-inverted` → `#FDF6EC`；`button-contrast-fill` → `#1A3049`（对前者 12.5:1，附件按钮同时修好）。新增 **#35 反白底板断言**（8 条）：`label-primary-inverted` 对 `label-primary` 与对 `button-contrast-fill` 都必须 ≥ 4.5:1。变异 `inverted-label-not-inverted` 复现 `#1A3049` 证明断言不空转 |
| E27 | §3.4 的「两种工具调用形态都要做成卡片（底色 + 细线 + 圆角 + 投影）」 | ❌ **把设计搞反了**。`[data-turn-process-member]` 挂在 `div.flowItem` 上，是流程窗格里**每一个**条目——逐个加卡片等于把每一次工具调用变成一张卡，并且让一行折叠摘要成为页面上最响的东西。参考实现正好相反：`Chat.module.css` 的 `.processFoldSummary` 用 `background: var(--overlay-subtle)`（= `rgba(26,48,73,0.03)`，墨色 3 % 的**半透明薄染**）、`border: 0`，展开时 `border-radius` 只留上半，与 `.processFoldPanel`（同一薄染的 62 %）拼成**一整块**；条目在内部一律不装箱。而珊瑚的「橙色高亮框」根本不是我的规则——那是 harness 自己的 `.PcOAmq_card { border: .5px solid var(--dsw-alias-border-l1) }`，`border-l1` 被填成了珊瑚朱 30 %（参考是 **18 %**）；`border-l2` 更是 48 %。`.newSession` 用的是 `border-l3`（48 %），这就是「新会话」也在发亮的原因 | ① 工具调用与折叠摘要改画 `--hana-wash`：`color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent)`——**推导而非抄写**，四套配色实测分别得到纸本 `rgba(42,38,34,0.03)`、青夜 `rgba(225,234,240,0.03)`、珊瑚 `rgba(26,48,73,0.03)`（与参考的 `--tool-bg` **逐位相同**）、斑斓 `rgba(240,246,250,0.03)`，恰好复现参考里手写的明暗分野；两个钩子都不再自带 `border`/`border-radius`/`box-shadow`，`test/check.js` 新增 12 条判断守住（变异 `process-members-boxed-again`、`wash-transcribed-as-a-literal`）。② 珊瑚与斑斓的边框整条梯级重新锚定在参考的**唯一一条**手写细线 0.18 上（珊瑚 → 0.18/0.29/0.29/0.39，斑斓 → 0.18/0.25/0.30/0.39） |

**因此对正文的三处结构性修正**

1. **D1 精确化为**：颜色**只**走 `register()`；`--dsw-font-*` 等**非可注册**令牌**只**走 CSS。两者不是"分工"，是互斥的通道 —— 同一条令牌不可能两条路都走通。
2. **D3 改为**：不打包字体**且**不改 `--dsw-font-family`；而是覆写 14 个 `--dsw-font-markdown-*` shorthand 的尾部 family，**逐字保留** harness 自己的字号/行高表达式，从而不冻结用户的字号偏好。
3. **D3 追加字号补偿**：14 个 shorthand 的**字号与其行高同步**乘 `--hana-serif-scale`（默认 115%，可在设置页 100–140% 调节）。两者同乘是为了**保持 harness 原本的行高比例**（正文 1.71），放大字号不会让行距变紧。补偿入口必须在本主题，不能依赖「外观」——上限 17px 不够。
4. **字体栈改为 `Georgia, 'Times New Roman', 'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', 'STSong', 'Noto Serif', 'SimSun', serif`**：把**已安装**的宋体族名提到未安装的 macOS 族名之前。macOS 上没有 Source Han Serif 会自然跳到 Songti SC，Windows 跳到 SimSun，三平台都落到真正的宋体，且避开 Linux 的 fontconfig 替身。
5. **§6.1 的 `enabled` 默认值由 `'0'` 改为 `'1'`**：视觉层已按"活动主题是否属于本主题"门控，默认关只会变成多余的二次确认；`enabled: '0'` 保留为不改 YAML 即可彻底停用的开关。

---


## 1. 四个必须先定的架构决策

### D1 —— 令牌通道：颜色**只**走 `register()`，非可注册令牌**只**走 CSS

**这是整个方案的地基，直接决定能否与 StyleVault 共存。**

> **⚠️ 已被 §0.3 E2/E10 修订。** 原文写的是「`register()` + `overrideTokens()` 分工，绝不 自写 `--dsw-*`」。实现后发现这条**同时过宽和过窄**：真正必须避免的只有**已注册的颜色令牌**，而 `--dsw-font-*` 这类非可注册令牌**只能**用 CSS 设置；并且 `overrideTokens` 会叠到**任何**活动主题上，无条件调用会重绘内置主题。Phase 1 的实际实现是：**颜色全部由 `register()` 承载，`overrideTokens` 暂不使用**（留给 Phase 3 的亮度补偿，且必须门控在"活动主题属于本主题"之下）。以下保留原文以记录推理路径，**读时请以本段与 §0.3 为准**。

调研确立的机制（`research_community-themes.md` §2.2）：官方把主题令牌写成 **`<body>` 的行内样式**，行内样式无视选择器特异性。因此：

> ❌ **错误做法**（denia 式）：在自己的 `<style>` 里写 `body[data-hana]{--dsw-alias-bg-base:...}`
> 后果：一旦用户启用了任何带 `tokens` 的主题（如本机已装的 StyleVault），行内样式会**静默压掉**你的声明。

而这条机制的**反面**同样成立、且是实现衬线排版的关键：**不在可注册集合内的自定义属性永远不可能被行内写入**，所以对它们来说样式表不只是够用，而是**唯一**通道。`--dsw-font-markdown-*` 正属此列。

✅ **本方案的实际通道划分（互斥，不是分工）**：

| 令牌类别 | 唯一可行通道 | 理由 |
|---|---|---|
| 89 个已注册颜色令牌（`--dsw-alias-*` / `--dsw-specific-*`） | `theme.register({ tokens })` | 行内样式会压掉任何 CSS 声明 |
| `--dsw-font-*`、`--dsh-*`、`--dsl-*`、阴影等 | 本主题自己的 `<style>` | 不在可注册集合内，CSS 是唯一通道 |
| `--hana-*`（本主题自有结构令牌） | 本主题的 `<style>` | 纯字面量；**引用 `--dsw-*` 的必须声明在 `body`** |

```js
// Phase 1 实际实现：只有颜色走官方通道，且没有 overrideTokens
exports.apply = function (ctx) {
  var theme = ctx.get('theme');
  if (theme === undefined) return;
  // 常驻注册两套可选配色。注册本身是惰性的：不改动界面，只是在
  // 设置→外观 里多两个选项。
  theme.register({ id: 'hana-paper',    colorScheme: 'light', tokens: PAPER });
  theme.register({ id: 'hana-midnight', colorScheme: 'dark',  tokens: MIDNIGHT });
  // overrideTokens 被刻意保留：它叠在「当前活动主题」之上，无条件调用会
  // 重绘内置亮/暗主题。Phase 3 的亮度补偿会用它，但必须先门控在
  // getTheme().active.id 属于本主题时（见 lib/client.js 的 reconcile）。
};
```

### D2 —— 配色方案：2 套核心主题

| 主题 id | colorScheme | 设计来源 | 定位 |
|---|---|---|---|
| **`hana-paper`** | `light` | **new-warm-paper** | 旗舰。「纸本世界 + 5 档墨色 + 印章青蓝 + 极方圆角」 |
| **`hana-midnight`** | `dark` | **midnight** | 「深青蓝 + 暖玫瑰」柔和暗色 |

**为什么旗舰用 `new-warm-paper` 而不是默认的 `warm-paper`**：前者是 HanaAgent 自己**有意收敛**的版本（评论区改成"墨染，极克制"、全圆角降到 2/3/4px、0.5px 发丝线），是设计系统最完整的表达；后者更早、更松散。两者仅色值不同，后续可作为预设加入（§7 Phase 4）。

### D3 —— 字体：系统衬线栈，**不打包 6.5 MB**，且**不碰 `--dsw-font-family`**

> **⚠️ 已被 §0.3 E1 修订。** 原文的说法是"换掉全部 markdown 字体"。实现时发现：markdown 的字体来自 14 个 `--dsw-font-markdown-*` **font shorthand**，而 `--dsw-font-family` 被 `body{font-family:var(--dsw-font-family)}` 用于**整个界面**。改后者 = 按钮、侧栏、标签一起变衬线。**正确做法是覆写那 14 个 shorthand 的 family 尾部**，下面保留原文的字体栈选择理由（仍然成立），但把"怎么挂上去"改为实测结论。

调研事实：HanaAgent 的字体是 6.5 MB / 111 文件，其中 **6.0 MB 是中文 Noto Serif SC**（99 个 unicode-range 子集）。这对一个 DSH 主题插件是**不可接受**的体积。

**方案：三层降级**

```css
/* 拉丁走系统衬线，中文走系统宋体 —— 零外部依赖 */
--hana-font-serif: Georgia, 'Times New Roman', 'Songti SC', 'STSong',
                   'Source Han Serif SC', 'Noto Serif SC', 'SimSun', serif;
```

| 平台 | 拉丁 | 中文 | 效果 |
|---|---|---|---|
| macOS | Georgia（内置） | Songti SC（内置） | ✅ 完整"书感" |
| Windows | Georgia（内置） | SimSun/Songti SC | ✅ 可用 |
| Linux | 视发行版 | 视发行版 | ⚠️ 可能回落 sans，仍可读 |

**为什么用 Georgia 而不是 HanaAgent 的 EB Garamond / PT Serif**：Georgia 是**唯一三平台都内置、且为屏幕阅读设计的衬线体**。EB Garamond 是 display face（笔画对比强），小字号下不如 Georgia 耐读；且要拿到它就得打包字体。

**挂载方式（实测结论，替代原设计）**：覆写 14 个 markdown shorthand，**逐字保留 harness 自己的字号/行高表达式**，只替换尾部 family：

```css
body[data-hana-theme].hana-serif {
  --dsw-font-markdown-base: var(--dsh-content-font-size, 14px) /
    calc(24px + var(--dsh-content-font-delta)) var(--hana-font-serif);
  /* … h1/h2/h3/h4、base-italic/strong、small*、table、table-head 共 14 条 … */
}
```

这样做的三个好处：① 用户「外观」里的字号偏好继续生效（`--dsh-content-font-size` 与 `--dsh-content-font-delta` 原样透传，不被冻结）；② 字重、字号、行高一个都没动，只换了书体；③ 界面本体（`--dsw-font-family`）保持无衬线，符合 HanaAgent「正文衬线 / 控件无衬线」的原始分工。**代码块刻意不改**（`--dsw-font-markdown-code*` 走 `--ds-font-family-code`，应保持等宽）。

> **可选升级**（Phase 4，默认关闭）：提供"高品质衬线"开关，运行时从 CDN 拉 `EB Garamond` 拉丁子集（~60 KB），中文仍走系统 —— 这样就以 1/100 的体积拿到 90% 的视觉效果。**不打包任何字体文件进插件。**

### D4 —— Markdown 锚点：三级策略

调研确立的 DSH markdown DOM 事实（本次实测）：

| 事实 | 证据 |
|---|---|
| markdown 根是 **hash 化 CSS Module 类** | `className: css$20.markdown`（`.module.css` 导入）❌ 不可依赖 |
| **`md-code-block` 是字面全局类** | `jsx("div",{className: clsx(css$19.block, "md-code-block", className)})` ✅ |
| **`md-table-wide` 是字面全局类** | `clsx(css$20.tableScroll, wide ? "md-table-wide" : css$20.tableFill)` ✅ |
| `.katex-display` 是全局类 | `:global(.katex-display)` ✅ |
| **`data-chat-flow-kind` 是稳定属性** | 值含 `assistant-step` / `user` / `steering` ✅ |
| 插件 bundle 的 hash 形如 `<6字符>_<局部名>` | `VnbZpq_bubble`、`48RFeq_row`、`7xilXq_body` |

**三级选择器策略**（优先级从高到低）：

| 级 | 手段 | 用途 | 稳定性 |
|---|---|---|---|
| **T1** | `--dsw-*` / `--dsl-*` / `--dsh-*` 令牌 | 颜色、字体、代码块圆角、滚动条 | 🟢 官方契约 |
| **T2** | **`md-code-block` / `md-table-wide` / `.katex-display`** | 代码块 3px 圆角、宽表样式 | 🟢 **DSH 刻意保留的全局类** |
| **T3** | `[data-chat-flow-kind='assistant-step']` 起头的元素选择器 | 行高、h1 居中、Callout | 🟡 数据属性稳定，但需确认 markdown 在其内 |
| ❌ | `.Xxxxxx_markdown`、`[class^='Xxxxxx']` | —— | 🔴 **禁用**（hash 跨版本必变且静默失效） |

> **T3 的前置验证**：`assistant-step` 是 chat-flow 节点 kind（`kind: "assistant-step"`），report 1 §2.3 已确认 denia 成功用它识别 AI 输出节点。但「markdown 是否为它的后代」需在 Phase 0 用探针实测（§7）。**这是本方案唯一需要实测确认的假设。**

---

## 2. 架构设计

### 2.1 分层模型（对照 HanaAgent 的双层）

HanaAgent 之所以主题只有 61 行，是因为**结构 token 与颜色 token 分离**。本方案把这个思想在 DSH 上重建：

```
┌─ L1 颜色层（官方通道，DSH 托管）───────────────────────┐
│  theme.register() / theme.overrideTokens()            │
│  → DSH 写成 <body> 行内样式                            │
│  只含颜色。与 StyleVault 共存。                        │
└───────────────────────────────────────────────────────┘
┌─ L2 结构层（本主题自持，--hana-* 命名空间）─────────────┐
│  圆角 / 间距 / 行高 / 字体栈 / 纹理 URI                 │
│  声明在 body 上（见 ⚠️ 下方）                          │
└───────────────────────────────────────────────────────┘
┌─ L3 修饰与组件层 ─────────────────────────────────────┐
│  markdown 元素规则 / Callout / 纸质纹理三层 / 动效      │
│  应用 md-* 全局类、data-* 属性、T3 选择器              │
└───────────────────────────────────────────────────────┘
```

> ### ⚠️ 命名空间必须严格分离
> 依据 `research_community-themes.md` §2.2：**任何引用 `--dsw-*` 的自定义属性必须声明在 `body` 上**（声明在 `:root` 会 guaranteed-invalid → 计算值为空 → 整条声明被丢弃）。
> - `--hana-*` 中**引用了 `--dsw-*` 的**（如 `--hana-border: var(--dsw-alias-border-l1)`）→ **必须放 `body`**
> - `--hana-*` 中**纯字面量的**（如 `--hana-radius-card: 3px`、`--hana-font-serif`）→ 放 `:root` 亦可
> - **本主题的自有 `<style>` 绝不声明任何 `--dsw-*`** —— 那是 L1 的领地

### 2.2 插件结构

```
hana-theme-for-dsh/
├── package.json                    # dsh.bundle.patch + dsh.client{platform:'web', inject:['theme']}
├── cordis.patch.yml                # - insert: [{id: ui-skin-hana, name: 'hana-theme-for-dsh'}]
├── skin.json                       # 元数据卡（供 EAC 皮肤列表识别）
├── lib/
│   ├── index.js                    # Host：ctx.settings.register('hana-theme-for-dsh', schema)
│   └── client.js                   # Client：apply(ctx) —— 令牌 + 样式 + 设置页
├── src/                            # 源（可选，最终内联进 client.js）
│   ├── tokens-paper.js             # hana-paper 令牌表
│   ├── tokens-midnight.js          # hana-midnight 令牌表
│   ├── markdown.css                # L3 markdown 规则
│   ├── ornaments.css               # L3 纸质纹理 + 动效
│   └── panel.js                    # 设置页组件
├── preview/{light,dark}.webp
└── test/
    ├── check.js                    # 静态判据（抄 endfield 四类）
    ├── contrast.test.js            # 对比度断言
    └── dom-probe.js                # Phase 0 探针
```

**`package.json`**：

```jsonc
{
  "name": "hana-theme-for-dsh",
  "version": "0.1.0",
  "description": "HanaAgent 风格 DSH 主题：纸本手抄本 —— 暖纸底、墨色文字、印章青蓝、衬线阅读排版、纸质纹理",
  "type": "module",
  "main": "lib/index.js",
  "exports": { ".": "./lib/index.js", "./client": "./lib/client.js", "./package.json": "./package.json" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      // ⚠️ 这个列表是「模块加载顺序」，不是服务依赖（见 report1 §1.1）
      "inject": ["@deepseek-ai/dsh-client-ui-theme", "@deepseek-ai/dsh-client-ui-slots",
                 "@deepseek-ai/dsh-client-ui-settings", "theme"],
      "platform": "web"
    }
  },
  "peerDependencies": { "@deepseek-ai/cordis": "^4.0.1" },
  "license": "MIT",
  "files": ["lib", "cordis.patch.yml", "skin.json", "preview", "LICENSE", "README.md"]
}
```

```yaml
# cordis.patch.yml
- insert:
    - id: ui-skin-hana
      name: 'hana-theme-for-dsh'
```

**`lib/client.js` 骨架**：

```js
window.__ModuleLoader__.load({
  id: "hana-theme-for-dsh",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    /* ─── L1 颜色层：两套主题的令牌表（见 §3）─── */
    var PAPER_TOKENS = { /* … §3.1 … */ };
    var MIDNIGHT_TOKENS = { /* … §3.2 … */ };

    /* ─── L3 样式表（§4 §5）─── */
    var css = [ /* markdown.css + ornaments.css 拼接 */ ].join("\n");

    function insertCss(text) {
      // Dynamic runner 优先（自动随 package 卸载回收）；回落自建标签 + 幂等标记
      if (typeof styles !== "undefined" && styles && typeof styles.insert === "function") {
        return styles.insert(text);
      }
      var sel = 'style[data-plugin="hana-theme-for-dsh"]';
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { el.remove(); });
      var tag = document.createElement("style");
      tag.setAttribute("data-plugin", "hana-theme-for-dsh");
      tag.textContent = text;
      document.head.appendChild(tag);
      return function () { if (tag.parentNode) tag.parentNode.removeChild(tag); };
    }

    function apply(ctx) {
      var theme = ctx.get("theme");
      if (theme === undefined) return;               // 服务缺失 → 安全退出，不 throw

      /* 1) 注册两套可选主题 */
      try { theme.register({ id: "hana-paper",    colorScheme: "light", tokens: PAPER_TOKENS }); } catch (e) {}
      try { theme.register({ id: "hana-midnight", colorScheme: "dark",  tokens: MIDNIGHT_TOKENS }); } catch (e) {}

      /* 2) 样式表 + 结构变量 + body 标记 */
      var disposeStyles = insertCss(css);
      var body = document.body;
      body.dataset.hanaTheme = "";                    // 所有 L3 规则的前缀
      var disposeTokens = function () {};

      /* 3) 设置：读 → 应用 → 订阅 */
      var prefs = bindPrefs(ctx);                     // ctx.settingsScope，见 §6
      function reconcile() {
        body.classList.toggle("hana-serif", prefs.serif());
        body.dataset.hanaTexture = prefs.paperTexture() ? "on" : "off";
        body.dataset.hanaShape   = prefs.shape();     // "seal"(极方) | "soft"
        disposeTokens();                              // 幂等：先撤旧层
        disposeTokens = theme.overrideTokens("hana-theme-for-dsh", buildOverride(prefs));
      }
      reconcile();
      var unsub = prefs.subscribe(reconcile);

      /* 4) 全量回收 */
      ctx.effect(function () {
        return function () {
          unsub();
          disposeTokens();
          if (typeof disposeStyles === "function") disposeStyles();
          delete body.dataset.hanaTheme;
          delete body.dataset.hanaTexture;
          delete body.dataset.hanaShape;
          body.classList.remove("hana-serif");
        };
      }, "hana-theme-for-dsh: paper palette, texture layer, markdown typography");
    }

    exports.name = "hana-theme-for-dsh";
    exports.inject = ["theme"];                       // ← 只门控 theme，其余走 ctx.get
    exports.apply = apply;
    return module.exports;
  }
});
```

---

## 3. 配色方案（核心交付物）

### 3.0 ⚠️ 先看这个：HanaAgent 原色**不能直接用**

我把 HanaAgent 的调色板逐对做了 WCAG 实测，**结论是它在 9 处不达 AA 4.5:1**。这正印证了调研里 endfield 的那句话 ——「**颜色是量出来的，不是挑出来的**」。

**实测失败项（原始值）**：

| 场景 | 组合 | 实测 | 门槛 |
|---|---|---|---|
| 亮色 · **accent 当链接** | `#537D96` on `#F5EFE4` | **3.87:1** ❌ | 4.5 |
| 亮色 · 墨字压实心 accent | `#2A2622` on `#537D96` | **3.39:1** ❌ | 4.5 |
| 亮色 · 白字压实心 accent | `#FFFFFF` on `#537D96` | **4.43:1** ❌ | 4.5 |
| 暗色 · **三级文字** | `#A3B5C0` on `#3B4A54` | **4.33:1** ❌ | 4.5 |
| 暗色 · accent 当链接 | `#C99AAF` on `#3B4A54` | **3.80:1** ❌ | 4.5 |
| 暗色 · 白字压 accent | `#FFFFFF` on `#C99AAF` | **2.41:1** ❌ | 4.5 |
| 暗色 · 深字压 accent | `#3B4A54` on `#C99AAF` | **3.80:1** ❌ | 4.5 |
| 暗色 · **danger 文本** | `#C77070` on `#3B4A54` | **2.61:1** ❌ | 4.5 |

**处理原则**：**保持色相与饱和度，只微调明度**，直到达标 —— 这样视觉上几乎无感，但可达标。

**推导结果（本方案的修正值）**：

| 角色 | HanaAgent 原值 | 修正值 | 修正后 | 视觉差异 |
|---|---|---|---|---|
| 亮 · 链接/强调文字 | `#537D96` | **`#4C7289`** | 4.50:1 | 极微（暗一档） |
| 亮 · 实心填充（配白字） | `#537D96` | **`#527B94`** | 4.55:1 | 几乎无感 |
| 暗 · 三级文字 | `#A3B5C0` | **`#A7B9C3`** | 4.52:1 | 不可辨 |
| 暗 · danger 文本 | `#C77070` | **`#DDA9A9`** | 4.50:1 | 略提亮，色相不变 |
| 暗 · 链接/强调文字 | `#C99AAF` | **`#D2ACBD`** | 4.52:1 | 极微 |
| 暗 · 实心填充（配深字） | `#C99AAF` | **`#CB9FB3`** | 4.51:1 | 极微 |

> 生成方式：保持 HSL 色相/饱和度不变，以 0.0005 步长移动明度至恰好达标。**这是可复现的，不是手调的。**

### 3.1 `hana-paper`（亮色）完整令牌表

来源 `new-warm-paper`：纸 `#F5EFE4`、墨 5 档、印章青蓝 `#537D96`。

**基础面**

| DSH 令牌 | 值 | 来源 / 推导 |
|---|---|---|
| `--dsw-alias-bg-base` | `#F5EFE4` | paper · 宣纸主面 |
| `--dsw-alias-bg-layer-1` | `#FBF7EE` | paper-sunk · 浮起卡片 |
| `--dsw-alias-bg-layer-2` | `#EFE8DB` | paper-2 · 沉底/侧栏 |
| `--dsw-alias-bg-layer-3` | `#EBE5DA` | 派生：ink 5% on bg |
| `--dsw-alias-bg-overlay` | `#FBF7EE` | 浮层 |
| `--dsw-specific-sidebar-fill` | `#EFE8DB` | 侧栏更深一层 |
| `--dsw-alias-bg-skeleton` | `#EBE5DA` | = layer-3 |

**边框（结构骨干）**

| 令牌 | 值 | 说明 |
|---|---|---|
| `--dsw-alias-border-l1` | `#D8CFBE` | ink-line · 主分割 |
| `--dsw-alias-border-l2` | `#C2BAAB` | 派生：深 10% |
| `--dsw-alias-border-l2-darkmode-thin` | `#D8CFBE` | 亮色下同 l1（该令牌仅暗色模式有意义） |
| `--dsw-alias-border-l3` | `#C2BAAB` | |
| ~~`--dsw-alias-separator-primary`~~ | ~~`#E3DCCE`~~ | ❌ **死令牌**（§0.3 E5）—— 删除；分隔线角色由 `border-l1` 承担 |

**文字（墨 5 档）**

| 令牌 | 值 | 墨阶 |
|---|---|---|
| `--dsw-alias-label-primary` | `#2A2622` | 浓墨（13.12:1 ✅） |
| `--dsw-alias-label-secondary` | `#4A433C` | 二级（8.50:1 ✅） |
| `--dsw-alias-label-tertiary` | `#6B6158` | 三级（5.28:1 ✅） |
| `--dsw-alias-label-caption` | `#6B6158` | = 三级 |
| `--dsw-alias-label-dimmed` | `#8F867B` | ink-4（HanaAgent 已定义但未映射，本方案启用） |
| `--dsw-alias-label-primary-foreground` | `#FFFFFF` | 实心填充上的前景 |
| ~~`--dsw-alias-label-error`~~ | ~~`#8B2C1F`~~ | ❌ **死令牌**（§0.3 E5）—— 删除；错误色由 `state-error-primary` 承担 |

**强调色（印章青蓝，唯一 accent）**

| 令牌 | 值 | 用途 |
|---|---|---|
| `--dsw-alias-brand-primary` | `#537D96` | 品牌标识 |
| `--dsw-alias-state-business-primary` | **`#4C7289`** | **链接/强调文字（AA 修正值）** |
| `--dsw-alias-state-business-tertiary` | `rgba(83,125,150,0.08)` | 浅底 |
| `--dsw-alias-button-primary-fill` | **`#527B94`** | 实心按钮底（配白字 AA） |
| `--dsw-alias-button-primary-hover` | `#3F6179` | pressed |
| `--dsw-alias-button-info-fill` | `#537D96` | |
| `--dsw-alias-button-info-hover` | `#3F6179` | |
| `--dsw-alias-button-contrast-fill` | `#2A2622` | 墨色对比按钮 |
| `--dsw-alias-interactive-bg-hover` | `rgba(42,38,34,0.04)` | |
| `--dsw-alias-interactive-bg-active` | `rgba(42,38,34,0.08)` | |
| `--dsw-alias-interactive-bg-hover-solid` | `#E5DFD4` | 派生：ink 8% on bg |

**语义状态（墨染，极克制）**

| 令牌 | 值 |
|---|---|
| `--dsw-alias-state-success-primary` | `#4A6B4A`（墨绿，5.25:1 ✅） |
| `--dsw-alias-state-success-tertiary` | `rgba(74,107,74,0.08)` |
| `--dsw-alias-state-error-primary` | `#8B2C1F` |
| `--dsw-alias-state-error-secondary` | `#A3483B` |
| `--dsw-alias-state-warning-primary` | `#A67139` |
| `--dsw-alias-state-warn-label` | `#8A5E2E` |

**组件槽位**

| 令牌 | 值 | 说明 |
|---|---|---|
| `--dsw-specific-bubble` | `#F2EEE5` | 派生：ink 4.5% on card —— **这是 DSH 里真正生效的气泡色** |
| `--dsw-specific-bubble-highlight` | `#EBE5DA` | |
| `--dsw-specific-input-major` | `#FBF7EE` | |
| `--dsw-specific-selector` | `#EBE5DA` | |
| `--dsw-specific-menu` | `#FBF7EE` | |
| `--dsw-specific-tip` | `#F5F1E8` | |
| `--dsw-specific-sidebar-nav-item-hover` | `rgba(42,38,34,0.05)` | |
| `--dsw-specific-sidebar-nav-item-active` | `rgba(42,38,34,0.08)` | |
| `--dsw-specific-sidebar-nav-item-active-accent` | `#2A2622` | 墨色（非 accent）—— 纸本风格里"选中"是加浓墨，不是加彩 |

**Markdown / 代码**

| 令牌 | 值 | 说明 |
|---|---|---|
| `--dsw-alias-markdown-inline-code` | `#F3EFE6` | ink 4% on card |
| `--dsw-alias-markdown-code-block` | `#F5F1E8` | ink 3% on card |
| `--dsw-alias-markdown-code-block-banner` | `#EBE5DA` | |
| `--dsw-alias-markdown-citation` | `rgba(83,125,150,0.10)` | |
| `--dsw-alias-markdown-tag` | `rgba(83,125,150,0.12)` | |
| `--dsw-alias-markdown-code-segment-selected` | `#EBE5DA` | |
| `--dsw-alias-markdown-code-segment-unselected` | `#F5F1E8` | |

**填充 / 其他**

| 令牌 | 值 |
|---|---|
| `--dsw-alias-fill-l2` | `rgba(42,38,34,0.03)` |
| `--dsw-alias-fill-tsp-secondary` | `rgba(42,38,34,0.05)` |
| `--dsw-alias-button-elevated-fill` | `#FBF7EE` |
| `--dsw-alias-button-floating-fill` | `#FBF7EE` |
| `--dsw-alias-button-floating-hover` | `#EFE8DB` |
| `--dsw-alias-tooltip-bg` | `#2A2622` |
| `--dsw-alias-label-primary-inverted` | `#FBF7EE` | 原名 `label-inverted` 不存在（§0.3 E3） |
| ~~`--dsw-shadow-lv2`~~ | ~~`0 2px 8px rgba(42,38,34,0.04)`~~ | ❌ 阴影不可注册，只能走 CSS（§0.3 E4） |
| `--dsw-alias-button-contrast-fill` | `#2A2622` | ⚠️ **这才是 Toast 真正的底**（§0.3 E7） |
| `--dsw-alias-scrollbar-bg-l1` | `transparent` |
| `--dsw-alias-scrollbar-hover-l1` | `#E5DFD4` |

### 3.2 `hana-midnight`（暗色）完整令牌表

来源 `midnight`：深青蓝 `#3B4A54` + 暖玫瑰 `#C99AAF`。

**基础面**

| 令牌 | 值 |
|---|---|
| `--dsw-alias-bg-base` | `#3B4A54` |
| `--dsw-alias-bg-layer-1` | `#445560` |
| `--dsw-alias-bg-layer-2` | `#34424B` |
| `--dsw-alias-bg-layer-3` | `#3C4A52` |
| `--dsw-alias-bg-overlay` | `#445560` |
| `--dsw-specific-sidebar-fill` | `#34424B` |
| `--dsw-alias-bg-skeleton` | `#3C4A52` |

**边框**（暗色用**白色叠加**，极性反转 —— 见 §3.3）

| 令牌 | 值 | 来源 |
|---|---|---|
| `--dsw-alias-border-l1` | `#4D525D` | 玫瑰 16% on bg（HanaAgent 的 `rgba(170,121,141,0.16)` 合成值） |
| `--dsw-alias-border-l2` | `#4F5C65` | 白 10% on bg |
| `--dsw-alias-border-l2-darkmode-thin` | `#4A4F59` | 玫瑰 12% |
| `--dsw-alias-border-l3` | `#556069` | 白 14% |
| ~~`--dsw-alias-separator-primary`~~ | ~~`#4A5259`~~ | ❌ **死令牌**（§0.3 E5）—— 删除 |

**文字**

| 令牌 | 值 | 实测 |
|---|---|---|
| `--dsw-alias-label-primary` | `#E1EAF0` | 7.51:1 ✅ |
| `--dsw-alias-label-secondary` | `#B7C5CE` | 5.18:1 ✅ |
| `--dsw-alias-label-tertiary` | **`#A7B9C3`** | 4.52:1 ✅（原 `#A3B5C0` 只有 4.33） |
| `--dsw-alias-label-caption` | `#A7B9C3` | |
| `--dsw-alias-label-dimmed` | `#7D8E99` | |
| `--dsw-alias-label-primary-foreground` | `#34424B` | 实心填充上用**深色**前景 |
| ~~`--dsw-alias-label-error`~~ | ~~`#DDA9A9`~~ | ❌ **死令牌**（§0.3 E5）—— 删除；改用 `state-error-primary` |

**强调色（暖玫瑰）**

| 令牌 | 值 | 说明 |
|---|---|---|
| `--dsw-alias-brand-primary` | `#C99AAF` | |
| `--dsw-alias-state-business-primary` | **`#D2ACBD`** | 链接（AA 修正） |
| `--dsw-alias-state-business-tertiary` | `rgba(201,154,175,0.11)` | |
| `--dsw-alias-button-primary-fill` | **`#CB9FB3`** | 实心底（配深字 AA） |
| `--dsw-alias-button-primary-hover` | `#D8AFC0` | |
| `--dsw-alias-button-info-fill` | `#C99AAF` | |
| `--dsw-alias-button-contrast-fill` | `#E1EAF0` | |
| `--dsw-alias-interactive-bg-hover` | `rgba(255,255,255,0.05)` | **白色叠加** |
| `--dsw-alias-interactive-bg-active` | `rgba(255,255,255,0.08)` | |
| `--dsw-alias-interactive-bg-hover-solid` | `#4F5C65` | |

**语义状态**

| 令牌 | 值 | 实测 |
|---|---|---|
| `--dsw-alias-state-success-primary` | `#8CC790` | 4.66:1 ✅ |
| `--dsw-alias-state-error-primary` | **`#DDA9A9`** | 2.61→4.50 ✅ |
| `--dsw-alias-state-error-secondary` | `#EAB2A0` | |
| `--dsw-alias-state-warning-primary` | `#E3C08A` | |
| `--dsw-alias-state-warn-label` | `#E3C08A` | |

**组件槽位**

| 令牌 | 值 |
|---|---|
| `--dsw-specific-bubble` | `#4A5A65`（白 3% on card） |
| `--dsw-specific-bubble-highlight` | `#4F5C65` |
| `--dsw-specific-input-major` | `#445560` |
| `--dsw-specific-selector` | `#4F5C65` |
| `--dsw-specific-menu` | `#445560` |
| `--dsw-specific-tip` | `#4A5A65` |
| `--dsw-specific-sidebar-nav-item-hover` | `rgba(255,255,255,0.05)` |
| `--dsw-specific-sidebar-nav-item-active` | `rgba(255,255,255,0.08)` |
| `--dsw-specific-sidebar-nav-item-active-accent` | `#E1EAF0` |

**Markdown / 代码**

| 令牌 | 值 |
|---|---|
| `--dsw-alias-markdown-inline-code` | `#4D5E68` |
| `--dsw-alias-markdown-code-block` | `#4A5A65` |
| `--dsw-alias-markdown-code-block-banner` | `#4F5C65` |
| `--dsw-alias-markdown-citation` | `rgba(201,154,175,0.12)` |
| `--dsw-alias-markdown-tag` | `rgba(201,154,175,0.14)` |
| `--dsw-alias-markdown-code-segment-selected` | `#556069` |
| `--dsw-alias-markdown-code-segment-unselected` | `#4A5A65` |

**其他**

| 令牌 | 值 |
|---|---|
| `--dsw-alias-fill-l2` | `rgba(255,255,255,0.03)` |
| ~~`--dsw-shadow-lv2`~~ | ~~`0 2px 8px rgba(0,0,0,0.36)`~~ | ❌ 阴影不可注册，只能走 CSS（§0.3 E4） |
| `--dsw-alias-tooltip-bg` | **`#25313A`** | ⚠️ **必须保持深色**（§0.3 E6）：tooltip 文字被 harness 写死为近白，浅底会变白字白底 |
| `--dsw-alias-label-primary-inverted` | `#26343D` | 原名 `label-inverted` 不存在（§0.3 E3） |
| `--dsw-alias-button-contrast-fill` | `#DCE6EC` | ⚠️ **这才是 Toast 真正的底**（§0.3 E7） |
| `--dsw-alias-scrollbar-hover-l1` | `#556069` |

### 3.3 亮/暗的极性反转（本方案必须显式处理）

从 HanaAgent 学到的核心机制（`research_openhana-style.md` §1.4）：**半透明叠加色在亮色下压暗、暗色下提亮**。

| 令牌族 | hana-paper | hana-midnight |
|---|---|---|
| `interactive-bg-hover` | `rgba(42,38,34,0.04)` 墨基 | `rgba(255,255,255,0.05)` **白基** |
| `interactive-bg-active` | `rgba(42,38,34,0.08)` | `rgba(255,255,255,0.08)` |
| `fill-l2` | `rgba(42,38,34,0.03)` | `rgba(255,255,255,0.03)` |
| `specific-sidebar-nav-item-*` | 墨基 | 白基 |

**并且**：暗色的 `label-primary-foreground` 是**深色**（`#34424B`），亮色是白色 —— 因为暗色主题的 accent 是**亮粉**，深字压上去才可读（修正后 4.51:1）。

> ⚠️ **绝不用亮色的 `foreground` 去配暗色的 `fill`。** 这正是 HanaAgent 原值翻车的地方（白字压亮粉只有 2.41:1）。

### 3.4 对比度验收表（构建时断言）

`test/contrast.test.js` 必须覆盖全部下列断言，**任一失败即构建失败**：

| # | 前景 | 背景 | 门槛 | paper | midnight |
|---|---|---|---|---|---|
| 1 | `label-primary` | `bg-base` | AA 4.5 | 13.12 | 7.51 |
| 2 | `label-primary` | `bg-layer-1` | AA 4.5 | 14.04 | 6.35 |
| 3 | `label-secondary` | `bg-base` | AA 4.5 | 8.50 | 5.18 |
| 4 | `label-tertiary` | `bg-base` | AA 4.5 | 5.28 | 4.52 |
| 5 | `state-business-primary` | `bg-base` | AA 4.5 | 4.50 | 4.52 |
| 6 | `state-business-primary` | `bg-layer-1` | ≥3.0 | 4.14 | — |
| 7 | **`label-primary-foreground`** | **`button-primary-fill`** | AA 4.5 | 4.55 | 4.51 |
| 8 | `state-error-primary` | `bg-base` | AA 4.5 | 7.41 | 4.50 |
| 9 | `state-success-primary` | `bg-base` | AA 4.5 | 5.25 | 4.66 |
| 10 | `border-l1` | `bg-base` | ≥1.06（装饰） | 1.35 | 1.17 |
| 11 | `label-primary` | `specific-bubble` | AA 4.5 | 12.4 | 6.0 |
| 12 | `label-primary` | `markdown-code-block` | AA 4.5 | 12.4 | 6.0 |

**以下四条是「反思式断言」**（防止未来改色时无意破坏）：

- **#13** 亮色的 `label-primary-foreground` 必须是浅色（`lum > 0.7`）—— 因为亮色 accent 是深色。
- **#14** 暗色的 `label-primary-foreground` 必须是深色（`lum < 0.2`）—— 因为暗色 accent 是亮色。
- **#15** 两套主题的 `state-business-primary` 与各自 `bg-base` 的对比度差 ≤ 0.5 —— 保证"链接的可读感"在两套主题下一致。
- **#16** 所有 `--dsw-alias-*` 值必须是合法 CSS 颜色或 `var()`/`rgba()` —— 防止写法漂移（HanaAgent 真实踩过：CSS 里写 hex、设置页副本写 `rgb()`）。

---

## 4. Markdown 渲染方案

### 4.1 令牌映射表（T1 级 —— 覆盖 80% 效果）

| HanaAgent 规则 | DSH 令牌 | 值 / 做法 |
|---|---|---|
| 助手正文 `font-family: var(--font-serif)` | **`--dsw-font-family`** | `Georgia, 'Times New Roman', 'Songti SC', …, serif` |
| code / pre 家族 | **`--ds-font-family-code`** | 系统等宽栈 |
| `line-height: 1.75` | 无令牌 | **需 T3 规则** |
| `code { background: var(--overlay-light) }` | `--dsw-alias-markdown-inline-code` | 见 §3 |
| `pre { background: var(--overlay-subtle) }` | `--dsw-alias-markdown-code-block` | 见 §3 |
| `a { color: var(--link) }` | `--dsw-alias-state-business-primary` | see §3（AA 修正值） |
| `hr { border-top: 1px solid var(--border) }` | `--dsw-alias-border-l2` | DSH 官方 hr 用的就是它 |
| `th { background: var(--overlay-subtle) }` | `--dsw-alias-fill-l2` | |
| 代码块 `border-radius` | **`--dsl-code-block-border-radius`** | `3px`（DSH 公开钩子） |
| 滚动条粗细 | **`--dsh-scrollbar-width`** | `4px`（HanaAgent 是 4px，DSH 默认 8px） |
| 表格滚动条 | `--dsw-alias-label-tertiary` | |
| 正文字号 | `--dsh-content-font-size` | 保持 DSH 的 12–17 阶梯 |

> 💡 **一条令牌换掉整个 markdown 字体** —— 因为 DSH 所有 `--dsw-font-markdown-*` 简写的字体家族部分都引用 `var(--dsw-font-family)`（`research_community-themes.md` §5.1）。这是 DSH 令牌体系给的"红利"。

> ### ⚠️ 两个实现细节
> **① 字体令牌走 `overrideTokens` 时要给双值。** `overrideTokens` 强制每个值是 `{light, dark}` 对象（裸字符串会抛教学性错误）。字体与模式无关，所以**重复同一个值**：
> ```js
> theme.overrideTokens('hana-theme-for-dsh', {
>   '--dsw-font-family': { light: HANA_SERIF, dark: HANA_SERIF },   // 同值重复
>   '--ds-font-family-code': { light: HANA_MONO, dark: HANA_MONO },
> });
> ```
> **② `--dsw-font-family` 严格来说不是 alias 令牌**，但 `register()`/`overrideTokens()` 的 `tokens` 类型是 `Record<string, string>` —— presenter 只是遍历对象逐个 `body.style.setProperty(name, value)`，所以任何 `--dsw-*` 名字都能通过这条通道注入，且因是行内样式必定胜出。**这不影响正确性，但意味着不要往里面塞 `--dsw-alias-*` 之外的东西**（保持可维护性）。

### 4.2 需要选择器的规则（T2 + T3 级）

**T2 —— 用 DSH 刻意保留的全局类**：

```css
/* ⚠️ 必须带 body[data-hana-theme] 前缀：
   ① 特异性 —— 模块自身的规则是单类 `.block{--dsl-code-block-border-radius:12px}`，
      同特异性下由源码顺序决定胜负，注入的 <style> 顺序不保证；加前缀后必定胜出。
   ② 作用域 —— 主题关闭时规则自动失效，无需清理。 */

/* 代码块 3px 极方圆角（HanaAgent 规范值） */
body[data-hana-theme] .md-code-block { --dsl-code-block-border-radius: 3px; }

/* 宽表：正方形边框（HanaAgent 的表格是 1px 实线 + collapse） */
body[data-hana-theme] .md-table-wide > table { border-collapse: collapse; }
body[data-hana-theme] .md-table-wide th,
body[data-hana-theme] .md-table-wide td {
  border: 1px solid var(--dsw-alias-border-l1);
  overflow-wrap: anywhere;
}

/* KaTeX 块级横向滚动（与 HanaAgent 一致） */
body[data-hana-theme] .katex-display {
  max-width: 100%; overflow-x: auto; overflow-y: hidden;
}

/* 滚动条：HanaAgent 是 4px，DSH 默认 8px */
body[data-hana-theme] { --dsh-scrollbar-width: 4px; }
```

> **`--dsh-scrollbar-width` 为什么能这样写**：DSH 的 `scrollbar.css` 把它声明在 `body` 上（`body{--dsh-scrollbar-width:8px}`，见 `research_openhanako-style.md` §1.1 引用）。`body[data-hana-theme]` 的特异性（0,1,1）高于 `body`（0,0,1），必定胜出；且它**不是**主题令牌，presenter 不会用行内样式覆盖它。

**T3 —— 用稳定的 `data-chat-flow-kind` 作锚，元素级细节**：

```css
/* ⚠️ Phase 0 必须实测确认 markdown 是 [data-chat-flow-kind='assistant-step'] 的后代 */

/* ① 阅读行高：HanaAgent 的 1.75（DSH 默认更紧） */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] p,
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] li {
  line-height: 1.75;
}

/* ② h1 居中 —— 印刷传统的标题识别（HanaAgent 最有辨识度的一条） */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] h1 {
  text-align: center;
  font-size: 1.2em;
}
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] h2 { font-size: 1.1em; }
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] h3 { font-size: 1.05em; }

/* ③ 链接用下边框而非 text-decoration —— 可独立调色/透明度 */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] a {
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);
}

/* ④ 任务列表 checkbox 抵消缩进对齐 */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] li:has(> input[type='checkbox']) {
  list-style: none;
  margin-left: -1.2em;
}

/* ⑤ 引用块：斜体 + 次级色（HanaAgent 风格） */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] blockquote {
  border-left: 2px solid var(--dsw-alias-border-l1);
  padding-left: 1rem;
  color: var(--dsw-alias-label-secondary);
  font-style: italic;
}

/* ⑥ 图片收进正文列 */
body[data-hana-theme] [data-chat-flow-kind='assistant-step'] img {
  display: block;
  max-width: 100%;
  max-height: min(520px, 70vh);
  object-fit: contain;
  border-radius: 2px;
}
```

> **必须加 `body[data-hana-theme]` 前缀**（而不是 `.hana-theme` 类）—— 两个理由：① 提供足够的特异性去赢过 CSS Module 的 hash 类规则；② 卸载时只需 `delete body.dataset.hanaTheme`，所有规则一次性失效。

### 4.3 Callout 系统移植（本方案新增的 DSH 能力）

DSH **没有** Callout，HanaAgent 有一个很优雅的实现。本方案把它移植过来，作为主题的差异化能力：

```css
/* 单个 alpha 三元组驱动「边框 0.58 / 底色 0.055 / 标题 1.0」三个层次 */
body[data-hana-theme] .hana-callout {
  --hana-callout-rgb: 83, 125, 150;          /* 局部变量，默认印章青蓝 */
  margin: 0.65em 0;
  padding: 0.55em 0.8em 0.6em 0.9em;
  border-left: 2px solid rgba(var(--hana-callout-rgb), 0.58);
  border-radius: 0 2px 2px 0;                 /* 左侧直角贴住竖线 */
  background: rgba(var(--hana-callout-rgb), 0.055);
  color: var(--dsw-alias-label-primary);
  font-style: normal;                         /* 覆盖 blockquote 的 italic */
}
body[data-hana-theme] .hana-callout-title {
  color: rgb(var(--hana-callout-rgb));
  font-size: 0.88em; font-weight: 600; line-height: 1.45;
  margin: 0 0 0.25em 0;
}

/* 8 个语义变体：每个只覆盖一行 */
body[data-hana-theme] .hana-callout-info,
body[data-hana-theme] .hana-callout-note    { --hana-callout-rgb: 83, 125, 150; }
body[data-hana-theme] .hana-callout-tip,
body[data-hana-theme] .hana-callout-success { --hana-callout-rgb: 74, 107, 74; }
body[data-hana-theme] .hana-callout-warning { --hana-callout-rgb: 166, 113, 57; }
body[data-hana-theme] .hana-callout-danger,
body[data-hana-theme] .hana-callout-bug     { --hana-callout-rgb: 139, 44, 31; }
body[data-hana-theme] .hana-callout-quote   { --hana-callout-rgb: 116, 111, 104; }
```

**暗色下自动适配**：因为 `--hana-callout-rgb` 是**字面 RGB**，暗色主题需要更亮的档位。用 `body[data-ds-dark-theme]` 覆写：

```css
body[data-hana-theme][data-ds-dark-theme] .hana-callout { --hana-callout-rgb: 201, 154, 175; }
body[data-hana-theme][data-ds-dark-theme] .hana-callout-tip,
body[data-hana-theme][data-ds-dark-theme] .hana-callout-success { --hana-callout-rgb: 140, 199, 144; }
body[data-hana-theme][data-ds-dark-theme] .hana-callout-warning { --hana-callout-rgb: 227, 192, 138; }
body[data-hana-theme][data-ds-dark-theme] .hana-callout-danger,
body[data-hana-theme][data-ds-dark-theme] .hana-callout-bug { --hana-callout-rgb: 221, 169, 169; }
body[data-hana-theme][data-ds-dark-theme] .hana-callout-quote { --hana-callout-rgb: 167, 185, 195; }
```

> ### ❌ 本节已被 §0.3 E20 推翻：两条路线都不可行
> **路线 A 不是「推荐」，而是死路** —— DSH 的渲染器明确保证 raw HTML 只作为**字面文本**输出、不进入 DOM，所以 `.hana-callout` 永远不会出现，只写样式等于死 CSS。
> **路线 B 也只剩半成品** —— 给 `blockquote` 加上 class 之后，字面量 `[!NOTE]` 依然显示在正文中，除非改写文本节点。**因此本主题不实现 Callout**；`--hana-callout-rgb` 单变量法作为一项**可复用的设计模式**留在此处，供将来真正具备 HTML 注入能力的插件采用。

**⚠️ 依赖 note（原文，保留以见推理过程）**：Callout 需要 markdown 渲染器发出对应的 class。DSH 的渲染器**不会**输出 `.hana-callout`。因此有两条路：
- **路线 A（推荐，稳）**：**不依赖渲染器** —— 主题只负责"当这些 class 存在时的样式"，并把 class 契约写进 README，让用户/其它插件（如 `dsh-raw-html` 之类能注入 HTML 的插件）复用。**本主题自己不做 markdown 后处理 DOM 改写**（避免 denia 踩过的"选择器过宽误伤其它卡片"事故）。
- **路线 B（可选增强）**：用 MutationObserver 扫描 `blockquote` 首行的 `[!NOTE]` 等标记并加 class。**风险**：需要精确限定在 `[data-chat-flow-kind='assistant-step']` 内，且必须处理流式渲染时的重复扫描。列为 Phase 4 可选。

### 4.4 明确不做的 markdown 改动

| 不做 | 理由 |
|---|---|
| 接管 `--shiki-*` 语法高亮 | endfield 也没接管（收益低、需同时保证两种模式 + 10+ token 类型协调）。保留 DSH 原样 |
| 改 `--dsh-content-font-size` 默认值 | 那是用户的字号偏好，主题不该覆盖 |
| 逐个 markdown 元素改颜色 | 令牌层已覆盖；选择器只做令牌表达不了的事（行高/居中/圆角） |

---

## 5. 修饰方案

### 5.1 纸质纹理：三层模型（完整复刻）

直接照搬 HanaAgent 的三层结构，但**用程序化纹理替代 132 KB PNG**：

```css
/* ① 结构变量（纯字面量 → 可放 :root） */
:root {
  --hana-radius-card: 3px;
  --hana-radius-input: 2px;
  --hana-radius-modal: 4px;
  --hana-hairline: 0.5px;
  /* 程序化纸纹：内联 SVG feTurbulence，约 600 字节，无二进制资源 */
  --hana-paper-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E");
  /* 卡片层混合模式：亮色提亮，暗色 normal（见下方暗色覆写） */
  --hana-paper-blend: lighten;
}

/* 声明在 body 上：引用 --dsw-* 的变量必须放 body（guaranteed-invalid 陷阱） */
body[data-hana-theme] {
  --hana-paper-scrim: var(--dsw-alias-bg-base);
}

/* ② Surface 层：铺底元素直接叠纹理 */
body[data-hana-theme][data-hana-texture='on'],
body[data-hana-theme][data-hana-texture='on'] [class$='_titlebar'],
body[data-hana-theme][data-hana-texture='on'] [class$='_sidebarCol'] {
  background-image: var(--hana-paper-grain);
  background-repeat: repeat;
  background-size: 160px;
  background-attachment: fixed;      /* ← 关键：纹理相对视口固定，滚动时不跟动 */
}

/* ③ Card 层：卡片用 blend-mode，纹理暗部被背景色提亮 */
body[data-hana-theme][data-hana-texture='on'] [class$='_bubble'],
body[data-hana-theme][data-hana-texture='on'] [class$='_composerCard'],
body[data-hana-theme][data-hana-texture='on'] [class$='_block'],
body[data-hana-theme][data-hana-texture='on'] .md-code-block,
body[data-hana-theme][data-hana-texture='on'] [class$='_panel'] {
  background-image: var(--hana-paper-grain);
  background-repeat: repeat;
  background-size: 160px;
  background-attachment: fixed;
  background-blend-mode: var(--hana-paper-blend);
}

/* ④ 亮度补偿：暖白叠层抵消纹理变暗（暗色主题跳过） */
body[data-hana-theme][data-hana-texture='on']::before {
  content: '';
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background: rgba(255, 253, 247, 0.35);
}
body[data-hana-theme][data-ds-dark-theme] { --hana-paper-blend: normal; }
body[data-hana-theme][data-ds-dark-theme][data-hana-texture='on']::before { display: none; }
```

> ### ⚠️ 与 HanaAgent 的三处必要差异
> 1. **`::before` 的 `z-index` 从 `-1` 改成 `0`** —— HanaAgent 的应用外框 `position:relative; z-index:auto` 不产生层叠上下文，所以 `-1` 安全；但 DSH 的三栏外框可能产生层叠上下文，`z-index:-1` 会**掉到 body 背景之后完全不可见**。改成 `0` + `pointer-events:none` 更稳，并由 `[id=root]` 自身的不透明背景决定它是否可见（若不理想，Phase 2 用探针确定）。
> 2. **`[class$='_xxx']` 用后缀匹配** —— DSH 插件 bundle 的 hash 形如 `<6字符>_<局部名>`（已实测 `VnbZpq_bubble`），所以后缀匹配**命中**。但注意 `[class$=...]` 在元素带**第二个类名**时会失配（`research_community-themes.md` §2.3(b) 的教训），因此这些规则是**增强而非依赖**——不命中只是没纹理，不会出错。
> 3. **程序化纹理替代 PNG** —— 零二进制载荷，且分辨率无关。若追求 1:1 还原，可选提供 HanaAgent 的 `rice-paper.png`（Apache-2.0，可再分发但需 `NOTICE` 署名）。

### 5.2 「亮度补偿」原则（本主题的核心设计约束）

从 HanaAgent 学到的、**可以直接作为验收标准**的一条：

> **任何"叠加式"装饰都会改变整体明度，必须显式补一层反向纯色把它校准回来。**

本主题的应用：
- 纸质纹理 → 暖白 `rgba(255,253,247,0.35)` 补偿层（亮色），暗色跳过
- **未来任何背景图/纹理功能都必须遵守此约束**，并重新验算 §3.4 的对比度断言

**验收方法**：开启纹理前后，对 `label-primary` on `bg-base` 与 `label-tertiary` on `bg-base` 各测一次合成对比度；**变化幅度必须 < 0.3**。这条写进 `test/contrast.test.js`。

### 5.3 动效：精选移植

只搬 8 个关键帧（HanaAgent 有 25 个，但多数是它产品功能的）：

```css
/* 命名空间前缀 hana-；时长/缓动一律引用 DSH 已有 token 或本主题 --hana-duration-* */
@keyframes hana-fade-up   { from { opacity:0; transform:translateY(var(--hana-slide-y,8px)); } to { opacity:1; transform:none } }
@keyframes hana-fade-in   { from { opacity:0 } to { opacity:1 } }
@keyframes hana-popout    { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:none } }
@keyframes hana-rise      { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
@keyframes hana-retract   { from { opacity:1; transform:none } to { opacity:0; transform:translateY(6px) } }
@keyframes hana-stream-tail-in { from { opacity:0; transform:translateY(2px) } to { opacity:1; transform:none } }
@keyframes hana-pulse     { 0%,100% { opacity:.55 } 50% { opacity:1 } }
@keyframes hana-spin      { to { transform:rotate(360deg) } }
```

**本主题的结构变量**：

```css
:root {
  --hana-duration-instant: 0.1s;
  --hana-duration-fast:    0.15s;
  --hana-duration-slow:    0.25s;
  --hana-ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --hana-ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

**⚠️ 修正 HanaAgent 的缺陷：全局 `prefers-reduced-motion` 兜底**

HanaAgent 靠在 17 处消费点**手写类名白名单**来降动效 —— 新增动画必须记得加，是会腐化的模式。**本主题改为源头统一处理**：

```css
@media (prefers-reduced-motion: reduce) {
  body[data-hana-theme] *,
  body[data-hana-theme] *::before,
  body[data-hana-theme] *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

并且**设置页显式提示**（照 endfield 的做法，不照 HanaAgent 的沉默处理）：

> 「系统已启用『减少动态效果』，主题动效已自动关闭。」

### 5.4 极方圆角 + 0.5px 发丝线

DSH **没有**全局圆角令牌，所以用 endfield 验证过的「**先清零，再恢复**」模式：

```css
/* ① 全局压到 2px（HanaAgent 规范：controls are seals, 方） */
body[data-hana-theme][data-hana-shape='seal'] [class] { border-radius: 2px !important; }

/* ② 按角色分化 —— 卡片/浮层允许 3–4px */
body[data-hana-theme][data-hana-shape='seal'] [class$='_card'],
body[data-hana-theme][data-hana-shape='seal'] [class$='_panel'],
body[data-hana-theme][data-hana-shape='seal'] .md-code-block { border-radius: 3px !important; }
body[data-hana-theme][data-hana-shape='seal'] [class$='_overlay'] { border-radius: 4px !important; }

/* ③ 恢复真正该圆的（状态点/头像/加载圈）—— 用角色+名字双条件，避免误伤 */
body[data-hana-theme][data-hana-shape='seal'] [class*='avatar' i],
body[data-hana-theme][data-hana-shape='seal'] [class*='spinner' i],
body[data-hana-theme][data-hana-shape='seal'] [class*='stateDot' i],
body[data-hana-theme][data-hana-shape='seal'] [class$='_iconButton'] {
  border-radius: 50% !important;
}
body[data-hana-theme][data-hana-shape='seal'] [class*='pill' i],
body[data-hana-theme][data-hana-shape='seal'] [class*='badge' i] { border-radius: 999px !important; }

/* ④ 聊天输入框保留 6px —— HanaAgent 的例外（"保留一点柔和"） */
body[data-hana-theme][data-hana-shape='seal'] [class$='_composerCard'] { border-radius: 6px !important; }

/* ⑤ 0.5px 发丝线 */
body[data-hana-theme] [class$='_card'],
body[data-hana-theme] .md-code-block { border-width: var(--hana-hairline) !important; }
```

**替代方案（更稳，Phase 1 先用）**：`data-hana-shape='soft'` 时**完全不改圆角**，只改颜色与字体。**"换配色 + 换字体"已经能拿到 70% 的还原度，"极方"作为可选开关。** 这符合"先能跑、再精修"的顺序。

### 5.5 明确不做（本期）

| 不做 | 理由 |
|---|---|
| 晴天模式（2.38 MB 视频叠层） | 体积过大；且 `mix-blend-mode` 与 DSH 图层的 `backdrop-filter` 交互有风险。列为 Phase 4 可选 |
| 自托管 6.5 MB 字体 | 体积不可接受（见 §1 D3） |
| 多角色 `--mood-accent` | DSH 无此概念 |
| 接管全屏遮罩/启动屏 | DSH 有 `dsh-plugin-desktop` 的 native 层，主题不该越界 |

---

## 5.6 四套配色（Phase 4 追加，2026-09-10）

原设计只规划 2 套（克制的一亮一暗）。用户要求"基于纸本、色彩更丰富"的新主题后，回到 HanaAgent 实物里找依据 —— 结果它自己就带 11 套主题，其中**正好有一套亮色丰富、一套暗色丰富**：

| 本主题 | 来源 | 说明 |
|---|---|---|
| `hana-coral`（珊瑚） | HanaAgent **`coral`** | 注释自述五色：和纸白、墨蓝、珊瑚朱、古金、灰青 |
| `hana-midnight-vivid`（斑斓） | HanaAgent **`midnight-contrast`** | 玫瑰 accent + **独立的浅蓝 link** + 薄荷 + 蜜桃 + 柔红 |

### 可照搬的不是色值，是一个结构

我去查了 coral 里那个鲜艳的珊瑚朱 `#F37E63` 究竟用在哪 —— 它只出现在：

```
--border            rgba(243,126,99,0.18)
--jian-note-border  rgba(243,126,99,0.14)
--mood-bg           rgba(243,126,99,0.06)
--mood-border       rgba(243,126,99,0.20)
```

**从不作文字色**（实测作正文仅 2.45:1）。这就是"能鲜艳而依然好读"的机制：**饱和度住在边框、底纹与纸面里，正文永远是墨色。** 本主题照搬这条纪律，并做两处必要适配：

1. **链接需要文字安全的暖档**，所以 `state-business-primary` 取珊瑚**色相**、把明度压到刚好达标（**5.59:1**），而不是直接用 `#F37E63`。
2. **珊瑚终于在一处成为实心**：`button-contrast-fill`，近黑墨色压在上面 **5.10:1**。这才是"表面色"的忠实读法 —— 它有权当表面。

### 按老办法修掉的 3 处 HanaAgent 原值

|coral 原值 | 实测 | 修正 |
|---|---|---|
| `--text-muted #727F89` | 3.83:1 | **`#657079`** |
| `--green #6E8C7A` | 3.44:1 | **`#5E7768`** |

（`midnight-contrast` **一处都不用改** —— 10 对里 10 对达标，性价比极高。）

### 实测数字

| | |
|---|---|
| 对比度断言 | **91 条**（19 对 × 4 套 + 4 极性 + 2 链接带 + 1 soft-light 中性 + 8 纹理合成） |
| 令牌 | 89 × 4 = **356 个值**，全部在白名单内 |
| 链接对比度 | 纸本 4.50 / 青夜 4.52 / 珊瑚 5.59 / 斑斓 9.38 —— 判据 #15 由"两套相等"改为**区间**（≥4.5 且 ≤11），因为四套不同色相不可能相等，但它必须既可读又不喧宾夺主 |

### 结构改动：不再硬编码两套 id

`PALETTE_DEFS` 成为唯一的名册 —— 激活判定、注册、`data-hana-theme` 取值、设置页按钮、状态行**全部由它派生**。加一套配色 = 一张表 + 名册一行，不存在"第二处还在枚举 id"而失步的可能。测试同样改为遍历 `client.PALETTES`，所以**新增配色会自动进入全部 91 条断言**。

---

## 5.7 设置持久化：两个真实缺陷（2026-09-10 修复）

用户报告重启 dsh-desktop 后主题与设置都回退。探针实测定位到**两个独立原因**，一个是 DSH 的缺口，一个是我的 bug。

### ① 主题偏好：DSH 不持久化第三方主题 id（DSH 的缺口）

```js
THEME_PREFERENCES = ["light", "dark", "system"]
setTheme(id) {
  ...
  if (isThemePreference(id)) this.host.set(THEME_PREFERENCE_FIELD, id);   // ← 只有内置三选一会落盘
}
```

选中 `hana-coral` 时界面会变（`this.preference` 改了、`publish()` 了），但 `isThemePreference('hana-coral')` 为 `false`，**根本不写盘**。证据：`settings.yaml` 里 `ui-theme.preference: light`，而 `fontSize: 17`（`setFontSize` 没有这道门禁）正常持久化。**任何第三方主题都会中招。**

**对策**：把用户选的配色记在**我们自己的命名空间**（`palette` 字段），下次启动注册完主题后用 `theme.setTheme()` 重新应用。并加一条纪律：**恢复只在挂载时做一次**；此后若发生"切到内置主题"的 `theme/change`，就清空记录 —— 否则用户主动切回内置主题时会被我们在每次启动时抢回去。

### ② 设置不落盘：`settingsScope.bind()` 的签名用错了（我的 bug）

```js
bind(spec) { ... new SettingsScopeController(this.owner, spec, ...) }
// 真实调用方一律是：
ctx.settingsScope.bind({ namespace: LOCALE_SETTINGS_NAMESPACE })
ctx.settingsScope.bind({ namespace: WELCOME_NOTICE_SETTINGS_NAMESPACE, decode: decodeWelcomeSection })
```

我写成了 `binder.bind(NS)`（裸字符串）。后果是**双向静默失败**：

- `mutate()` 里 `remote.settings.mutate(this.spec.namespace, ...)` 的 namespace 是 `undefined` → **写不进去**；
- `derive()` 永远匹配不到 describe 行 → **快照 status 恒为 `unavailable`**，于是我的三条件写入门禁（照 endfield 抄的）**永远拒绝每一次写入**。

探针把这一点记得很清楚：我同时绑了 `ui-theme`、`dsh-desktop`、`agent-presets`、`hana-theme-for-dsh` 四个命名空间，**四个全是 `unavailable`、`hasValue: false`** —— 镜像本身是健康的（宿主 `describe()` 返回 17 个命名空间），是**我的 spec 匹配不到任何一行**。

**对策**：改为 `bind({ namespace: NS })`；`set()` 的返回值是异步任务，补上 rejection 处理；补一个**有界重试**（首次编辑可能早于 describe 抓取，脏写入要能被唤醒——这正是我当初从 endfield 简化掉的部分）；并在设置页显示**"设置已保存 / 设置未能写入配置"**，让这类失败**可见**而不是伪装成能用的开关。

### ③ 修好 ② 之后暴露的第三个原因：`adopt()` 会无条件覆盖偏好

修好 ② 的**当天**就出现了更糟的症状：一改设置主题就回退，而且**再也选不中**配色。原因是修好之前走不到的一条路径：

```js
// dsh-client-ui-theme
adopt() {
  const section = this.host.getSnapshot().value;   // settings.theme 的最新值
  this.preference = section.preference;            // 无条件覆盖
  this.publish();                                   // → theme/change
}
```

它在**设置文档每次更新时**被调用。而 DSH 只持久化 `light`/`dark`/`system`，所以 `settings.theme.preference` 恒为 `light`。于是：

> **每写一次设置 → 文档更新 → `adopt()` 把偏好拉回 `light` → 主题回退。**

② 修好之前，写入全被门禁挡住、文档从不更新、`adopt()` 从不触发 —— 所以这是个**被另一个 bug 掩盖着的 bug**。修好 ② 等于把它放了出来：从"重启才丢"变成"一动设置就丢"。

**而我自己加的清理逻辑把情况锁死了**：

```js
if (restoredPalette && activeIsOurs() === null && prefs.get("palette") !== "") {
  prefs.set("palette", "");   // ← 第一次被 adopt 复位，就把唯一的持久副本清空了
}
```

我本意是"用户主动切回内置主题就尊重他"，但**回退与主动选择产生的是同一个事件，原理上无法区分**。误判的代价是清掉了唯一记录 → 之后无从恢复 → 表现为"无法调整配置"。

**对策：把判别不了的判断改成显式契约。**

- 只要记着配色，`theme/change` 里就**重新应用**它（`applyStoredPalette()`），而不是清空；
- 新增 **「跟随 DSH」** 按钮作为唯一出口：清空记录并把偏好交回 `system`；
- 设置页明说这条契约 —— 选中花笺配色后，「设置 › 外观」那一行会被本主题覆盖。

**安全性**：重新应用是**无写入**的（`setTheme` 对非内置 id 不写盘），所以不会引发文档更新，也就不会与 `adopt()` 形成写入风暴；`activeIsOurs()` 在应用后即为真，下一次事件正常 `reconcile()`，不成环。

### ④ 修好 ③ 之后暴露的第四个原因：presenter 会清空令牌，而重入会白干一场

修好 ③ 后症状变成更精确的一条：**只剩配色回退，字体不动**。这句"字体没变"直接指认了机制：

```js
// dsh-client-ui-layout 的 ThemePresenter
apply(snapshot) {
  for (const name of this.appliedTokens) body.style.removeProperty(name);   // ← 先全部清空
  this.appliedTokens = [];
  for (const [name, value] of Object.entries(snapshot.active.tokens)) body.style.setProperty(name, value);
}
```

**内置主题的 `tokens` 是空对象 `{}`**（`BUILTIN_THEMES = [{id:'light', tokens:{}}, …]`）。所以切到内置配色 = **清空我们的行内令牌** → 底色回到基础样式表 = DSH 默认；而我们的 `<style>` 与 `hana-serif` 类不在行内层，**不受影响 → 字体照旧**。用户描述的正是这个组合。

而 ③ 里写的"重新应用"为什么没救回来 —— **重入竞争**：

```
adopt() → preference='light' → publish() → emit('theme/change') 开始
  ├─ 我们的监听器（若先注册）: activeIsOurs()=null → setTheme('hana-coral')
  │    → publish() 重入 → emit 再次开始 → presenter.apply() 应用【我们的】令牌 ✓ → 内层 emit 结束
  └─ 回到外层 emit: presenter 的监听器此时才跑，用的是【陈旧的】内置快照（空 tokens）
       → 又一次 removeProperty → 把刚恢复的令牌【全部清掉】 ✗
```

**外层那个陈旧快照最后落笔**，把恢复的令牌抹掉；而此时 `activeIsOurs()` 已是"我们的"，所以恢复逻辑再也不会触发 —— 永久停在默认配色。

**两处对策**：

1. **把重新应用移出 emit**（`scheduleEnsurePalette()` → `setTimeout(0)`），让我们的令牌**最后**落笔。这是唯一能赢的顺序。
2. **用实测而不是推断来判断是否需要应用**：直接读 `body.style.getPropertyValue("--dsw-alias-bg-base")` 与目标配色比对。因为失败态的欺骗性就在于 **主题服务报告"我们的配色是激活的"，而行内令牌已经被抹掉** —— 任何基于偏好的判断都会说"没问题"。
3. 另外在**我们自己的写入落地后**再检查一次（写入会更新设置文档 → 触发 `adopt()` → 抹除，这正是"设置其它选项就回退"的原因）。

### ⑤ 修好 ④ 之后：**必须改用 `overrideTokens`**（用户提示「看看其他主题怎么处理」）

前四层都修完后，症状回到最初：**重启仍回退**。查证两件事：

1. **设置已真正落盘** —— `settings.yaml` 里有我们的命名空间：
   ```yaml
   hana-theme-for-dsh:
     palette: hana-paper
     serifScale: "120"
     paperTexture: "1"
     shape: seal
   ```
   （`enabled`/`serif`/`grainOpacity` 没出现是因为等于 schema 默认值，不落盘，属正常。）
2. **不是 profile 问题** —— `~/.config/DSH Desktop/profile-selection/state.json` 里 `"active": "web"`，应用确实持久化了选择。

那么剩下的唯一解释就是架构本身：**`register()` 保不住配色**，因为 `adopt()` 在每次设置更新与每次启动都会把 `preference` 拉回内置值，而 presenter 随后清空并只应用内置主题的空令牌表。

**用户建议去看别的主题怎么做的 —— 一看就明白了。** endfield 的文件头写着：

> `theme.overrideTokens` —— 覆盖主题令牌（亮/暗双色）

**社区主题用的是 override 层**，它叠在**任何激活主题之上**（`composeActive()` 在每个 override 层上折叠），所以偏好被复位根本不影响它。

**这正是本设计最初 D1 明确拒绝的通道** —— 当时的理由是"它会重绘内置主题，是个隐患"。而事实是：**那个"隐患"恰恰就是它的持久性来源**。我把唯一能扛住 `adopt()` 的机制当成风险排除了，于是剩下两条路（register、listener 里 setTheme）**都注定失败**，只是失败时机不同（重启丢 / 改设置丢）。

**实现**：每套配色配一个"对偶"暗/亮搭档（纸本↔青夜、珊瑚↔斑斓），`overrideTokens(NS, modes)` 提供双向值。于是**配色不再依赖偏好**，而且顺带修好了 DSH 的 `system` 偏好：跟着系统在亮暗之间切换时，亮走亮搭档、暗走暗搭档 —— 这是 `setTheme` 单点固定做不到的。

**连带修正**：`reconcile()` 的判据从"激活主题是否属于我们"放宽为"**是否由我们掌色**"（激活的是我们的 **或** 记着一套配色）。否则 DSH 偏好为 `system` 时激活主题**永远是内置**，我们会拒绝应用自己的排版 —— 而配色明明是我们的。

### ⑥ 改用 override 层之后：标记消失，暴露了「测错了对象」

用户报告：配色按钮的选中标记**选中时亮、重启后消失**。查下去发现标记只是表层，底下是个更严重的问题。

**根因：判断"是否需要重新应用"时测的是「画面」而不是「偏好」。**

```js
var want = String(def.tokens["--dsw-alias-bg-base"])...;
if (appliedBg() === want) return;   // ← 颜色已经对了，于是直接返回
theme.setTheme(stored);             // ← 因此从不执行
```

改用 override 层之后，**颜色由层提供、presenter 已经把它写进 `body`** → `appliedBg()` 早已等于目标值 → `setTheme(stored)` **从不执行** → 偏好停在 `system`。

**而这远不止是显示问题**：`composeActive()` 是按 `active.colorScheme` 取 override 层的亮/暗那一半的。偏好停在 `system` 时 `active` 跟随系统 —— **你选了亮色配色、系统是暗色时，实际显示的是暗色搭档，而不是你选的那套**。标记消失只是这个错误的表现之一。

**修法**：两个条件独立检查，任一不满足就重新钉住偏好：

```js
var pinned  = activeIsOurs() === stored;                                   // 偏好是不是我们的
var painted = appliedBg() === String(def.tokens["--dsw-alias-bg-base"])...; // 画面是不是我们的
if (pinned && painted) return;
theme.setTheme(stored);
```

**标记**同时改为比较 **记着的配色**（`storedPalette()`）而不是 `theme.preference` —— 因为 DSH 每次写入/每次启动都会把自己的内置值抢回去，而**记住的配色才是持久事实，偏好是它的下游**。顺带删掉了因此变成死代码的 `snap` / `preference` 两个局部变量。

### ⑦ 顺带避免的一次发射环

`overrideTokens` **会发射 `theme/change`**，而我把它放在 `reconcile()` 里，`reconcile()` 又是 `theme/change` 的处理器：

```
theme/change → reconcile() → applyOverride() → overrideTokens() → theme/change → …
```

0.4.4 没炸是运气（多半被内部去重挡下），但**不能依赖它**。加一个按配色身份的去重守卫（`overrideFor`），让重复调用成为空操作；换配色时才重建层。**判据 22** 守住这一点。

### ⑧ 新增判据（18–23）

```js
// bind() 必须用对象形式；裸字符串会让设置永远不落盘，且两个方向都静默
```

我特意把原 bug 重新引入验证过这两条判据会失败，再恢复验证会通过。

**判据 22**：重建 override 层必须按配色身份去重（否则经 `reconcile()` 递归）。**判据 23**：配色标记必须以「记住的配色」为准，不得依赖 `theme.preference`。

**判据 21**：配色**必须**通过 `theme.overrideTokens` 落层，且层必须有保留的 disposer 并在 effect 拆卸时释放 —— 这是唯一能扛住 `adopt()` 的通道。

**判据 20**：`theme/change` 监听器内**不得同步调用 `theme.setTheme()`** —— 外层陈旧 emit 会抹掉它恢复的令牌。判据 18/19/20 我都把对应的 bug 重新引入验证过会失败，再恢复验证通过。

**判据 19** 约束的是上面第三个原因：`prefs.set("palette", "")` **全仓库只允许出现一次**（那个显式出口）。在别处清空，等于在 DSH 复位时销毁唯一的持久副本 —— 这类"事件处理器里的状态清理副作用"正是本次连环 bug 的共同形状。

> **四个原因是同一场连环 bug 的四层**，而且每修好一层就放出下一层：`②` 让写入真正落盘 → 放出 `③`；`③` 让偏好能恢复 → 放出 `④`。三者共同点是**静默**，第四者更隐蔽：**状态自相矛盾**（服务说激活、画面说没有）。

> **本次连环 bug 的教训**：`②` 修好之后 **`③` 才显形**，而 `③` 又被我自己的"聪明"清理逻辑放大成"完全不可用"。三者的共同点是**静默**：写不进去不报错、匹配不到不报错、清空记录也不报错。所以最后的对策不是更聪明的判断，而是 ① 显式契约 + ② 可见的持久化状态显示 + ③ 判据。

> **排查方法上的教训**：这两条都不是读文档能发现的 —— 一条要读 DSH 源码里的 `THEME_PREFERENCES`，一条要读 `SettingsScopeController` 的 `spec.namespace` 用法。而 `settingsScope` 的 Inspect 契约查询**两次都被取消**，我从没拿到它的签名，于是照 endfield 抄了一个**同样是错的**调用形式（endfield 的浏览器写入大概也从未生效，它 settings.yaml 里的值来自宿主侧 `settings.installSection`）。

---

## 6. 设置项设计

### 6.1 Host 半边：`ctx.settings.register`

依据 `research_community-themes.md` §6.3 —— **绝不用 localStorage**。⚠️ **此处原文「每次启动绑随机端口」已被实测推翻**：2.0.5 的 `DESKTOP_DEFAULT_WEB_PORT = 43120` 是**固定**端口，只有在真正 `EADDRINUSE` 时才顺延（最多 32 次）。所以 origin 通常稳定。**结论不变但理由要改**：origin 一旦因端口冲突而改变，origin 作用域的存储在**那一刻**就丢了；而且它对 Host 半边不可见、不跟随用户跨 profile。

```js
// lib/index.js
const NAMESPACE = 'hana-theme-for-dsh';

// 值全部用字符串 + default，与 endfield 的约定一致：
//   default-ON  存 '1'，读作 !== '0'
//   default-OFF 存 '0'，读作 === '1'
// ⚠️ §0.3 E11：enabled 实际默认 '1'，不是 '0'。视觉层已按「活动主题是否
// 属于本主题」门控，所以默认关只会变成多余的二次确认；'0' 保留为不改 YAML
// 即可彻底停用的开关。
const FIELD_DEFAULTS = {
  enabled:      '1',      // 主题总开关（默认开；注册本身是惰性的）
  serif:        '1',      // 衬线阅读体（核心特征，默认开）
  paperTexture: '0',      // 纸质纹理（默认关，光学噪音较强）
  shape:        'soft',   // 'soft' | 'seal'（极方圆角）
  grainOpacity: '32',     // 纹理强度 0–60
  sysFontHint:  '1',      // 是否显示"减少动效"提示
};

exports.name = NAMESPACE;
exports.inject = ['settings'];
exports.apply = function (ctx) {
  ctx.inject(['settings'], function (sctx) {
    var z = resolveSchemastery();          // 参照 endfield 的惰性解析 + DEV-LINK 回落
    if (z === undefined) return;
    var fields = {};
    for (var k in FIELD_DEFAULTS) fields[k] = z.string().default(FIELD_DEFAULTS[k]);
    sctx.settings.register(NAMESPACE, z.object(fields), { applies: 'live' });
  });
};
```

### 6.2 Client 半边：写入门控（照抄 endfield 的三条件）

```js
/* ⚠️ 只看 snap.writable 是错的 */
function prefsDurablyServed(snap) {
  return snap.mode === 'host' && snap.status === 'ready' && !!snap.writable;
}
```

原因（`research_community-themes.md` §6.3）：host 模式的 describe 视图在**本命名空间尚未注册**时也会返回 `writable:true` 但 `status:'unavailable'`。照写会清掉脏标记却什么都没落盘，刷新即丢。**写法：拦下并标脏，等 ready 回相时由 subscription 自动补写。**

### 6.3 设置页 UI（`settings.section` 插槽）

```js
var slots = ctx.get('slots');
if (slots !== undefined) {
  slots.inject('settings.section', function () {
    return slots.register({
      name: 'settings.section',
      id: 'hana-theme-for-dsh',
      order: 40,
      label: function () { return t('nav'); },     // ← thunk，语言切换时自动重读
    }, HanaSection);
  });
}
```

**行清单**（4 组，共 6 行；照 HanaAgent 的分组标题风格 `01 主题 / THEME`）：

| 组 | 行 | 控件 |
|---|---|---|
| 01 主题 / THEME | 启用 hana 主题 | 开关 |
| | 配色 | 分段：纸本 / 青夜 / 跟随系统 |
| 02 排版 / TYPOGRAPHY | 衬线阅读体 | 开关 + 提示"AI 的回答将使用衬线体" |
| 03 质感 / TEXTURE | 纸质纹理 | 开关 |
| | 纹理强度 | 滑块 0–60 |
| 04 形态 / SHAPE | 极方圆角 | 开关（开时提示"控件圆角将压到 2–4px"） |

> **默认全部保守**：`enabled: '0'`、`paperTexture: '0'`、`shape: 'soft'`。装上主题只会在设置页多一个入口，**不会突然改变用户界面** —— 这是对用户最基本尊重，也是 denia v0.0.6 那类"误伤其它卡片"事故的预防。

---

## 7. 实施路线图

### Phase 0 —— DOM 探针 — ✅ **已完成**（2026-09-10 实测）

结果存于 `test/probe-result.json`（由一次性 Cordis 插件读取实时页面后写入，非手工粘贴）。**探针本身推翻了两个我原先的判断，也确认了两个**：

| 问题 | 实测 |
|---|---|
| markdown 是否为 `[data-chat-flow-kind='assistant-step']` 的后代 | ✅ **成立**。`markdownNearestFlowKind = "assistant-step"` |
| `assistant-step` 共几个 / 几个含 markdown | **72 / 51**。另外 21 个是无正文的步骤标签 |
| markdown 根类名 | `_markdown_177e0_5` —— 构建哈希，确认不可用（已成判据 16） |
| ⚠️ 只取**第一个** `assistant-step` 会怎样 | 第一个恰好**不含** markdown（`textLength=140`），会得出"假设不成立"的**错误结论**。这正是第一版探针的坑：单元素取样不等于分布 |
| 稳定可用钩子 | `[data-chat-flow-kind='assistant-step']`、`[data-slot='conversation.chat.node']`、`[data-chat-anchor-key]` |
| `[id=root]` 层叠 | `position: static` / `z-index: auto` / `isolation: auto` / 无 transform ⇒ **没有层叠上下文**，body 级 `::before` 纹理层**可见**（Phase 3 解锁） |
| 活跃 ui-theme 版本 | **0.1.2-rc.1**（`--dsw-alias-link` 计算值为空 ⇒ 不是 0.1.5-alpha.1）⇒ 白名单取材正确 |
| **死令牌复核** | `--dsw-alias-separator-primary`、`--dsw-alias-bg-primary` 计算值**均为空** ⇒ §0.3 E5 删除它们是对的 |
| 字号补偿 | `--dsh-content-font-size: 17px` × `--hana-serif-scale: 1.2` ⇒ 实测 **20.4px / 32.4px**，比例 1.588 与 harness 在 17px 基准下一致 ✅ |
| 界面文字 | 采样 `<button>` = **13.3333px**（Chromium UA 默认，说明它**没有任何字号声明**）|

**由探针新增的两条判据**：判据 15（规则必须打后代元素，不得打 `assistant-step` 容器本身，否则会一并样式化那 21 个标签）；判据 16（不得写死构建哈希名）。

<details><summary>原始探针脚本（保留备查）</summary>



本方案唯一需要实测确认的假设：**markdown 是否为 `[data-chat-flow-kind='assistant-step']` 的后代**。另外确认纹理层与 `[id=root]` 的层叠关系。

```js
// test/dom-probe.js —— 粘进 DSH Web GUI 的 DevTools 控制台运行
(function probe() {
  var out = {};
  // 1) assistant-step 节点是否存在，其内部是否含 markdown 特征
  var step = document.querySelector("[data-chat-flow-kind='assistant-step']");
  out.assistantStepFound = !!step;
  if (step) {
    out.descendantTags = Array.from(new Set(
      Array.prototype.map.call(step.querySelectorAll("*"), function (el) { return el.tagName; })
    )).slice(0, 40);
    out.hasH1 = !!step.querySelector("h1");
    out.hasPre = !!step.querySelector("pre");
    out.hasMdCodeBlock = !!step.querySelector(".md-code-block");
    out.codeBlockClasses = (function () {
      var b = step.querySelector(".md-code-block");
      return b ? b.className : null;
    })();
  }
  // 2) 全部 data-chat-flow-kind 取值
  out.flowKinds = Array.from(new Set(
    Array.prototype.map.call(document.querySelectorAll("[data-chat-flow-kind]"),
      function (el) { return el.getAttribute("data-chat-flow-kind"); })
  ));
  // 3) markdown 根的真实类名（确认 hash 形态，仅供记录，不用于选择器）
  var mdEl = document.querySelector(".md-code-block");
  if (mdEl) {
    var root = mdEl.closest("[class*='_markdown']");
    out.markdownRootClass = root ? root.className : "(not found)";
    out.markdownRootFound = !!root;
  }
  // 4) 层叠：三栏外框是否产生层叠上下文
  var root0 = document.getElementById("root");
  out.rootComputed = root0 ? {
    position: getComputedStyle(root0).position,
    zIndex: getComputedStyle(root0).zIndex,
    background: getComputedStyle(root0).backgroundColor,
    isolation: getComputedStyle(root0).isolation
  } : null;
  // 5) 现有令牌基线
  out.tokens = ["--dsh-scrollbar-width", "--dsw-alias-bg-base", "--dsw-font-family",
                "--dsw-specific-bubble", "--dsh-content-font-size"]
    .reduce(function (a, k) {
      a[k] = getComputedStyle(document.body).getPropertyValue(k).trim();
      return a;
    }, {});
  console.log("%c[hana-probe] 请复制以下 JSON：", "font-weight:bold");
  console.log(JSON.stringify(out, null, 2));
  window.__hanaProbe = out;
  return out;
})();
```

**产出**：一份 `test/probe-result.json`，据此最终敲定 §4.2 的 T3 选择器与 §5.1 的 `z-index`。

> 若探针发现 markdown **不在** `assistant-step` 内，回落方案：用 `.md-code-block` 的最近 `[class*='_markdown']` 祖先作为锚（`[class*='_markdown']` 是**包含匹配**，对 `<hash>_markdown` 有效），并在 README 声明兼容版本区间。

</details>

> 回落方案**未被触发**：假设成立。`[class*='_markdown']` 仅作为发现期的辅助（探针用它定位根），产品代码只依赖 `data-*` 锚点。

### Phase 1 —— 令牌层 MVP（**最高性价比**） — ✅ **已完成**

- [x] 插件骨架（`package.json` / `cordis.patch.yml` / `lib/index.js` / `lib/client.js` / `skin.json` / `LICENSE`）
- [x] `hana-paper` + `hana-midnight` 两套令牌表（§3.1 / §3.2，**89/89 全覆盖**，非原估的 62）
- [x] `theme.register()` × 2 ｜ ⚠️ 衬线栈改为覆写 14 个 `--dsw-font-markdown-*` shorthand，**不改** `--dsw-font-family`（§0.3 E1、§1 D3）
- [x] Host 设置命名空间（`ctx.settings.register`，含 DEV-LINK 下的 schemastery 惰性发现）+ 设置页（启用 / 配色快捷 / 衬线阅读体）
- [x] `test/contrast.test.js` 全部 **42** 条断言通过（原设计 16 条，实测扩充至 42 —— 见附录 B）
- [x] `test/check.js` **57** 条静态判据通过；`test/tokens.test.js` 白名单一致性通过
- [x] `flake.nix` 开发环境（Node 24 + pnpm + jq，锁定到宿主 NixOS 的同一 nixpkgs 修订，零下载）
- [x] `nix flake check` / `nix build` 通过；构建产物自带可运行的测试
- [ ] 验收：设置→外观 里出现两个主题；切到 `hana-paper` 后 UI 变暖纸 + AI 回答变衬线 —— **需在你的桌面上安装后目视确认**（沙箱内无法启动浏览器）

**此阶段结束即可交付一个可用主题** —— 已交付。

**实现与原设计的偏离（理由全部记在 §0.3）**

| 项 | 原设计 | 实际实现 |
|---|---|---|
| 衬线挂载点 | `--dsw-font-family` | 14 个 `--dsw-font-markdown-*` shorthand（改前者会波及整个界面） |
| `overrideTokens` | 常驻叠加 | **不使用**（它叠在「当前活动主题」之上，会重绘内置亮/暗主题） |
| `src/` + 内联构建 | 有 | **取消**。无构建步骤，`lib/client.js` 即交付物 —— 从结构上消除源与产物漂移 |
| `enabled` 默认 | `'0'` | `'1'`（视觉层已按活动主题门控，默认关是多余的二次确认） |
| 对比度断言 | 16 条 | 42 条 |
| 静态判据 | 10 条 | 28 条 |

### Phase 2 —— Markdown 精修 + 界面字号

#### 2.0 「界面字号偏小」—— 诊断已完成，结论是**不该由主题来修**

用户反馈：AI 回复正文（已修，见 §0.3 E15）与**界面本体**都偏小，而 DSH 的字号设置只管会话内容
（`setFontSize` 的契约就是 "conversation content font size"，对应 `--dsh-content-font-size`），
界面字号**根本没有设置项**。

实测 DSH 0.1.2-rc.1 的界面文字尺寸是怎么表达的（扫描 25 个非 vendor 组件样式表）：

| 表达方式 | 数量 | 能否用令牌缩放 |
|---|---|---|
| 硬编码 `font-size: Npx` | **64**（11 / 12 / 13 / 14 / 16px） | ❌ 没有任何令牌可挂 |
| `font: var(--dsw-font-xs-13)` | 40 —— 占了 UI 令牌用量的绝大多数 | ✅ 但只覆盖一小部分 |
| 其它 `--dsw-font-*`（`base-16` / `s-14` / `xxs-12` / `xxxs-11` / `l-20` / `m-18` / `xl-24` …） | **0 次消费**（声明了，没人读） | — |
| `rem` | **0** | ❌ 改根字号无效 |
| 已有的 `zoom:` 声明 | **0** | — |

**结论：DSH 的界面字号没有令牌通道。** 只改 `--dsw-font-xs-13` 会让其余 64 处硬编码尺寸原地不动，
得到"一部分变大、一部分不变"的参差效果 —— 比不改更难看。所以 Phase 1 那种令牌级做法在这里**用不上**。

**处理顺序：**

1. **首选：用应用自带的真缩放（无需写代码）。**
   DSH Desktop 绑定了 `Ctrl/Cmd + =` 放大、`Ctrl/Cmd + -` 缩小、`Ctrl/Cmd + 0` 复位，
   实现是 Electron 的 `setZoomLevel`，钳制在 ±4 级（1.2^±4 ≈ 0.48×–2.07×），
   View 菜单另有原生 `zoomIn` / `zoomOut` / `resetZoom` 角色项。
   这是**真正的浏览器缩放**：文字与布局一起放大，没有层叠/定位问题。
   **而且它应当能持久** —— Chromium 按 origin 记录缩放，而 Desktop 的端口是**固定 43120**
   （仅在真正 `EADDRINUSE` 时顺延），origin 稳定。（这也是本文件早先"每次启动随机端口"
   说法的修正，见 §6.1。）
   - 证据：`electron-runtime-*.js` 的 `isZoomShortcut` + `webContents.on("before-input-event", handleZoomShortcut)`；`desktop-port-*.js` 的 `DESKTOP_DEFAULT_WEB_PORT = 43120`；`webserver.js` 的冲突顺延循环。

2. **刻意不做的方案：主题侧在 `#root`/`html` 上写 CSS `zoom`。**
   - 它确实能缩放那 64 处硬编码尺寸 —— 这是 CSS 里**唯一**的杠杆（`rem` 为 0，选择器又受哈希类名限制）。
   - 但 `Tooltip.module.css` 等浮层是 `position: fixed` + JS 计算坐标；zoom 子树内
     `getBoundingClientRect()` 与渲染坐标的换算是**随 Chromium 版本变化**的细节，
     有把浮层/模态框摆错位的实际风险，而本环境**无法启动浏览器验证**。
   - 既然应用自带的 `setZoomLevel` 效果相同、且已验证可持久，再实现一个更脆的复制品没有价值。
   - 若将来确认原生缩放不满足需求，再回来实现；届时**必须同时验证 Tooltip / Modal / Toast 三处定位**。

#### 2.1 Markdown 元素级精修

- [x] 跑 Phase 0 探针，敲定 T3 选择器 —— 锚点确认成立（见上）
- [x] §4.2 的 6 条元素规则（行高 1.75 / h1 居中 / 链接软下划线 / 任务列表 / 引用块 / 图片）
- [x] T2 规则：`.md-code-block` 3px 圆角、`.md-table-wide` 网格边框
- [x] `--dsh-scrollbar-width: 4px`
- [x] **实现时的三处偏离**（均因读完真实 CSS 后与规格冲突，已就地记录理由）：
  | 规格原文 | 实际实现 | 原因 |
  |---|---|---|
  | `.katex-display` 横向滚动 | **不写** | harness 的 `MarkdownText.module.css` 已经这么做了 —— 再写一条就是死规则 |
  | h1/h2/h3 压到 `1.2em`/`1.1em`/`1.05em` | **不压**，只保留 `text-align: center` | 规格写于字号补偿之前：20.4px 正文下 `1.2em` = 24.5px，而 harness 缩放后的 h1 是 28.8px —— "压平"会**缩小**标题，恰与用户"字太小"的反馈相反 |
  | 链接用 `border-bottom` | 改用 `text-decoration-color` | harness 给 markdown 链接画了**透明 2px 下边框 + 负边距**作为放大点击区；覆盖它会缩小点击目标。颜色属于主题，几何不属于 |
- [x] **验收：用户于 2026-09-10 在真实页面目视确认「界面设计全部符合预期」**（行高 1.75、h1 居中、链接软下划线、任务列表、引用块、图片、代码块 3px 圆角、宽表网格线、滚动条 4px 全部接受）

### Phase 3 —— 修饰

- [x] 程序化 SVG 纹理 —— **356 字节**内联 `feTurbulence`，对比 HanaAgent 的 132 KB PNG（约 1/370）。默认关
- [x] 亮度补偿 —— 由 `soft-light` 的数学性质承担，**不额外加补偿层**；§5.2 的验收阈值（变化 < 0.3）成为 **5 条可执行断言**，实测最大强度下仅移动 0.06 / 0.09
- [x] `data-hana-shape='seal'` 极方圆角 —— 点名控件，默认 `soft` 完全不改圆角
- [ ] 动效（8 个关键帧 + 全局 `prefers-reduced-motion` 兜底）—— **本阶段按用户决定不做**
- [ ] 验收：需你在真实页面目视确认（纹理开到 32% 是否可见而不噪、极方开关是否顺眼）

**三处偏离规格，理由记在 §0.3 E17–E19**：整屏单层替代三层逐面板；soft-light 替代补偿层；点名控件替代"先清零再恢复"。三处都不是图省事 —— 逐面板要猜哈希类名、补偿层会把纸底色压灰、"先清零"会真的把徽标与状态点变成方块。

### Phase 4 —— 打磨与扩展（可选）

- [x] ~~Callout 系统（路线 A）~~ → **不可行，不做**（§0.3 E20）
- [ ] 额外预设：`hana-paper-warm`、`hana-coral` —— **待定**。原版 warm-paper 是 HanaAgent 自己替换掉的版本，复活它需要一个理由；`hana-coral` 是新增配色，属可选而非必需
- [ ] 可选字体包（CDN 拉丁子集）—— 引入网络依赖，收益有限
- [x] ~~晴天模式~~ → **不做**。Phase 0 探针确认 `[id=root]` 无层叠上下文（技术上可行），但 2.38 MB 视频不该为一个可选效果破坏「零二进制资源」
- [x] ~~Callout 路线 B~~ → **不做**（见上）
- [ ] `skin.json` + 预览图，纳入 EAC 皮肤列表 —— **需要你提供截图**（我无法截图）

---

## 8. 验证方案

### 8.1 `test/check.js` —— 静态判据（移植 endfield 的经验）

| # | 判据 | 由来 |
|---|---|---|
| 1 | 模板字符串内无裸反引号 | 一个反引号（即使在 CSS 注释里）会**整个 bundle 解析失败** |
| 2 | 无 `${` | 在模板字符串里那是插值，不是 CSS |
| 3 | CSS 注释配平，且注释外无裸 `*/` | 注释提前闭合后注释**本身仍配平**，破坏是残留文字与选择器黏连 → 整条规则被丢弃；`node --check` 查不出 |
| 4 | 去注释后花括号配平 | |
| 5 | **选择器里不得出现 hash 前缀** `.Xxxxxx_` / `[class^=...]` | 本报告 §1 D4 的硬约束 |
| 6 | 所有 `body` 块中引用 `--dsw-*` 的 `--hana-*` 声明**必须**在 `body` 上，不得在 `:root` | guaranteed-invalid 陷阱 |
| 7 | 所有 `--dsw-*` 只出现在**令牌表对象**里，不出现在 CSS 字符串的声明位置 | 防止绕过 L1 通道 |
| 8 | `client.js` 用 `vm.Script` 编译通过 | 用 vm 而非 `node --check`（沙箱 spawn 可能 EPERM） |
| 9 | 无 `localStorage` 调用 | origin 作用域陷阱（端口冲突即失效） |
| 10 | 每个 `ctx.effect` 的 disposer 都回收了：令牌层 / 样式表 / body 属性 / class / 订阅 | 生命周期可逆性 |

### 8.2 `test/contrast.test.js`

§3.4 的断言（原设计 16 条，Phase 1 实测扩充至 **42** 条，见附录 B），全部必须通过。数值从 `client.js` 的令牌表对象里**直接读取**（不硬编码副本 —— 防止文档与代码漂移，这正是 HanaAgent 踩过的坑）。

### 8.3 视觉验证

| 手段 | 内容 |
|---|---|
| 截图对比 | 亮/暗 × 纹理开/关 = 4 张，与 HanaAgent 官方截图并排目视 |
| 像素统计 | 解码截图，统计"纸色/墨色/印章色"占比（照 endfield 的 `verify-shots.js` 思路） |
| 纹理回归 | 纹理开/关的合成对比度差 < 0.3（§5.2） |
| 动效回归 | `prefers-reduced-motion` 下截图两次，必须**逐像素相同** |

### 8.4 兼容性声明

`package.json` 里显式声明（照 denia 的做法）：

```jsonc
"dsh": { "client": { "platform": "web", "version": "0.1.2-rc.1 - 0.1.x" } }
```

README 写"最近验证日期 + 实测 DSH 版本"，并列出**依赖的稳定锚点**（`md-code-block` / `md-table-wide` / `data-chat-flow-kind`），让未来 DSH 改版时能快速定位断点。

---

## 9. 风险与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| 1 | **与 StyleVault 冲突** | 主题被静默压掉 | ✅ 已从架构上规避：颜色只走 `overrideTokens`，**绝不**自写 `--dsw-*`（§1 D1） |
| 2 | **markdown 锚点假设不成立** | 元素级规则失效 | ✅ Phase 0 探针先行；回落方案用 `[class*='_markdown']` 包含匹配（§7） |
| 3 | **后缀匹配被第二个类名破坏** | 纹理/圆角部分失效 | ✅ 设计为**增强而非依赖** —— 不命中只是少纹理，不报错（§5.1） |
| 4 | **「先清零再恢复」误伤圆形元素** | 头像/状态点变方 | ✅ 用角色+名字双条件恢复；`shape` 默认 `soft` 不启用（§5.4） |
| 5 | **纹理 `::before` 层叠不可见** | 亮度补偿失效 | ⚠️ Phase 0 探针读 `[id=root]` 的 `isolation`/`zIndex`；必要时改用 `[id=root]::before` |
| 6 | **DSH 改版导致 hash 变化** | 见风险 2/3 | ✅ 只用 T1/T2 稳定通道 + `data-*`；README 声明版本区间 |
| 7 | **CSS 注释提前闭合** | 整条规则静默丢弃 | ✅ `check.js` 判据 3 |
| 8 | **设置写入未落盘** | 刷新丢配置 | ✅ 三条件写入门控 + 脏标记重放（§6.2） |
| 9 | **对比度被纹理拉低** | 可读性下降 | ✅ 亮度补偿 + 回归断言（§5.2） |
| 10 | **动效无法关闭** | 无障碍问题 | ✅ 源头全局兜底（**修正 HanaAgent 的缺陷**）+ 设置页提示（§5.3） |
| 11 | **体积失控** | 插件臃肿 | ✅ 零二进制资源；程序化纹理；不打包字体 |
| 12 | **链接色与错误色在暖色配色里分不开** | 把报错当成链接 | ⚠️ 已知，且**不能靠调错误色修好**：珊瑚 ΔE 0.019、青夜 0.030（纸本 0.208、斑斓 0.228）。在主题使用的红色区间内移动错误色最多到 0.080——因为珊瑚的链接色**就是**它的强调色压暗到 AA 的结果，与错误色落在同一片深红。真要解决得给珊瑚一个非珊瑚色链接，那是设计决定而非修复。四个值由判据 #32 钉住：可以低，但不许悄悄变 |
| 13 | **DSH Desktop 的 5 个原生界面无法被任何客户端插件换肤** | 首次设置 / 切换 profile / 崩溃恢复 / 对话框保持灰调，与纸本拼接处有色差 | ⚠️ 结构性边界，不是缺陷：它们是**独立文档**（`desktop-dialog.html` 等），没有插件宿主，且 `desktop-dialog.html` 的 CSP 是 `style-src 'self'`——连内联 `<style>` 都禁止，也就是主题唯一的手段在那里被禁。外壳是 Tailwind/shadcn，词表为 `--background/--card/--gray1..12`，对 `--dsw-*` 的引用数为 **0**。写进 README，让用户知道这块永远不跟随主题 |

---

## 附录

### A. 与两份前置调研的对应关系

| 本方案决策 | 依据 |
|---|---|
| 只走 `register()`/`overrideTokens()` | `research_community-themes.md` §2.2（令牌是 body 行内样式） |
| `--hana-*` 引用 `--dsw-*` 时必须在 `body` | 同上 §2.2（guaranteed-invalid 陷阱） |
| 禁用 hash 前缀选择器 | 同上 §2.3（2.0.5 上 hash 已全部失效） |
| 用 `settings.register` 而非 localStorage | 同上 §6.3（原「随机端口」说法已修正为「端口冲突时移位」） |
| 写入门控三条件 | 同上 §6.3 |
| "颜色是量出来的" | 同上 §3.2（endfield 27 条对比度断言） |
| 亮度补偿原则 | `research_openhanako-style.md` §3.3 |
| 双层 token 分离（结构/颜色） | 同上 §1.1 |
| `--overlay-*` 极性反转 | 同上 §1.4 |
| 全局 `prefers-reduced-motion` 兜底 | 同上 §3.4（修正其白名单缺陷） |
| 死 token 审计（不照抄 token 清单） | 同上 §5.1 |
| Callout 的 `--callout-rgb` 单变量法 | 同上 §2.4 |
| h1 居中 / 行高 1.75 / 链接下边框 | 同上 §2.1 §2.2 §2.5 |

### B. 关键数字

左列是**原设计预估**，右列是 **Phase 1 交付实测**。差异都已在下表注明原因。

| 项 | 原设计 | Phase 1 实测 | 说明 |
|---|---|---|---|
| 核心主题数 | 2 | **4** | 纸本 / 青夜（克制）· 珊瑚 / 斑斓（丰富，移植自 HanaAgent coral 与 midnight-contrast）|
| 每套主题令牌数 | ~62 | **89** | 实测可注册颜色令牌共 89 个，本主题**全覆盖**（覆盖率 89/89）。原估 62 偏保守 |
| 对比度断言 | 16 条 | **91 条** | 19 对 × 2 主题 + 4 条反思式。新增 7 对（#17–#23）来自读 DOM 时发现的**真实渲染配对**，例如 Toast 的 `button-contrast-fill` × `label-primary-inverted` |
| 静态判据 | 10 条 | **78 条** | 新增项包括：所有规则必须作用域在 `body[data-hana-theme]`、不得使用 `!important`、两半 `FIELD_DEFAULTS` 必须一致、`skin.json` 主题 id 必须与注册 id 一致、**任何 `--hana-*` 令牌都必须真的被读取**（直接针对 HanaAgent 的死令牌问题）、**任何 `--dsw-font-markdown-*` 都不得丢掉 `--dsh-content-font-size` 引用**（防止有人"顺手"写死字号而冻掉用户的字号偏好）、**样表里的字号系数必须与 schema 默认值一致** |
| 二进制资源 | 0 | **0** | 纹理是内联 SVG 文本（356 字节），仍然零二进制资源 |
| 关键帧 | 8 个 | **0** | 动效按用户决定不做（Phase 3 静态部分） |
| 需要选择器的 markdown 规则 | 6 条元素级 + 3 条全局类 | **6 条元素级 + 2 条全局类**（Phase 2） | Phase 1 的衬线排版不需要选择器；Phase 2 的元素规则锚在已实测确认的 `assistant-step` 上。原定 3 条全局类中 `.katex-display` 被删（harness 已实现） |
| `client.js` 体积 | < 60 KB | **约 58.4 KB** | 零依赖、无构建步骤、89 令牌 × 2 + 251 行 CSS |

### C. 立即可执行的第一步

```bash
# Phase 0：在 DSH Web GUI 的 DevTools 控制台粘贴 test/dom-probe.js，
# 把输出保存为 test/probe-result.json，然后据此确认 §4.2 的选择器。
#
# Phase 1：搭建骨架
mkdir -p hana-theme-for-dsh/{lib,test,preview}
# （package.json / cordis.patch.yml / lib/*.js 见 §2.2）
dsh plugin --profile desktop add ./hana-theme-for-dsh
```

### D. 参考

- 前置调研 1：[`research_community-themes.md`](./research_community-themes.md) —— DSH 令牌契约与三社区主题
- 前置调研 2：[`research_openhanako-style.md`](./research_openhanako-style.md) —— HanaAgent 设计系统
- [liliMozi/openhanako](https://github.com/liliMozi/openhanako)（Apache-2.0）
