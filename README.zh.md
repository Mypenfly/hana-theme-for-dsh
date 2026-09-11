# hana-theme-for-dsh

[English](./README.md) · **简体中文**

一个给 [DeepSeek Harness](https://github.com/deepseek-ai) 的「纸本手抄」主题 —— 暖纸底、墨色文字、单一强调色、衬线阅读排版。设计语言移植自 [liliMozi/openhanako](https://github.com/liliMozi/openhanako)（HanaAgent，Apache-2.0）。

**没有搬运 HanaAgent 的任何源码。** 配色是重新推导的，而且每一种颜色都由本仓库自己的测试套件重新验证过对比度 —— 因为 HanaAgent 的原值在本主题采用的这四套配色里，有 **12 处不达 WCAG AA**（实测）。

## 四套配色

| id | 模式 | 底色 | 性格 | HanaAgent 来源 |
|---|---|---|---|---|
| `hana-paper` | 亮 | `#F5EFE4` 暖纸 | 克制 —— 单一印章青蓝 | `new-warm-paper` |
| `hana-midnight` | 暗 | `#3B4A54` 青蓝夜 | 克制 —— 单一暖玫瑰 | `midnight` |
| `hana-coral` | 亮 | `#FDF6EC` 和纸白 | **丰富** —— 和纸白、墨蓝、珊瑚朱、古金、灰青 | `coral` |
| `hana-midnight-vivid` | 暗 | `#26343D` 更深的青蓝 | **丰富** —— 玫瑰 accent、独立的浅蓝链接、薄荷、蜜桃、柔红 | `midnight-contrast` |

丰富的那两套之所以"鲜艳而不吵"，是因为一条值得点名的结构纪律：**饱和度住在边框、底纹与纸面里，正文永远是墨色。** HanaAgent 的 `coral` 里那个鲜艳的 `#F37E63` 只出现在 `rgba()` 边框、便笺边和 mood 底色中 —— 作正文实测只有 2.45:1。本主题照搬这条纪律，并做两处必要适配：链接取珊瑚的**色相**、把明度压到刚好达标（5.59:1）；而鲜艳的珊瑚**只在一处成为实心** —— `button-contrast-fill`，近黑墨色压在上面 5.10:1。这才是"表面色"的忠实读法：**它有权当表面。**

## 外观

| | |
|---|---|
| **纸本** · `hana-paper`<br>暖纸底、墨色文字、单一印章青蓝 | **青夜** · `hana-midnight`<br>青蓝夜底、单一暖玫瑰 |
| ![纸本 —— 暖纸底、墨色文字、单一印章青蓝](./assets/paper.webp) | ![青夜 —— 青蓝夜底配暖玫瑰](./assets/midnight.webp) |
| **珊瑚** · `hana-coral`<br>和纸白、墨蓝、珊瑚线、古金便笺面 | **斑斓** · `hana-midnight-vivid`<br>玫瑰 accent、独立浅蓝链接、薄荷与蜜桃 |
| ![珊瑚 —— 和纸白底、墨蓝文字、珊瑚线条与古金便笺面](./assets/coral.webp) | ![斑斓 —— 玫瑰 accent、独立浅蓝链接、薄荷与蜜桃](./assets/vivid.webp) |


## 安装

### 先说约束

有两条会把最直觉的命令挡住：

- **`dsh plugin --profile desktop …` 会被拒绝**，拒绝的是 `desktop` 这**个字面名字** —— 那个 profile 由 Electron 应用独占管理。
- **应用内的市场是目录制的。** 它的安全章节写明只允许安装 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 精选列表内的来源，而且它的界面上**没有任何自由输入框**。它对 `link:`/`file:` 的支持是用来**恢复**一个已经存在的本地安装，不是安装入口。

所以从下面三条里选一条。

### 用你自己可控的 profile（推荐）

Desktop 应用启动的是你在它的 profile 菜单里选中的那个 profile，而 `dsh plugin` 只拒绝 `desktop` 这一个名字。所以让**你可控的 profile** 变得和它自带的一样完整即可：

```bash
dsh plugin --profile web add "link:/path/to/hana-theme-for-dsh"
# 然后在应用的 profile 菜单里选 web
```

专用 profile 也可以，但**必须从模板创建**：

```bash
dsh --profile hana --from-default-profile web --port 43210
dsh plugin --profile hana add "link:/path/to/hana-theme-for-dsh"
```

`dsh plugin --profile <名字> add` 是**按 profile 自己的名字**去查模板表的，查不到就退化成 `DEFAULT_PROFILE_BUNDLES = ["@deepseek-ai/dsh-base"]`。所以随手起的名字会建出一个**没有 web app、因而没有界面**的 profile。请用 `--from-default-profile web`，并给一个空闲的 `--port`，免得和正在运行的桌面实例抢端口。

无论走哪条，**设置都会跟着你走**：`settings.yaml` 位于 `<DSH_HOME>/settings.yaml`，**跨 profile 共享**。

### 想装进自带 profile —— 需要先进目录

要通过市场装进应用独占管理的 `desktop` profile，插件必须**被收录进那个精选目录** —— 这是唯一受支持的路径。先发到 npm 或 GitHub，再提交收录。

`dsh plugin --profile desktop add` 永远不会生效；而用 `pnpm add -w` 加一条 `dsh.profile.bundles` 手改那个 profile 也不受支持 —— 那个文件归应用所有。

### 卸载与停用

```bash
dsh plugin --profile <profile> remove hana-theme-for-dsh
```

装了但让它彻底静默：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: ui-skin-hana
  disabled: true
```

## 它改什么，以及它拒绝改什么

**改。** 当前配色对应的 89 个 alias/specific 颜色令牌；**同一配色下的 11 个语法高亮变量**（代码块里的注释、关键字、字符串等，见下方「代码块的语法高亮」）；以及当某套花笺配色生效且「衬线阅读体」打开时，markdown 阅读正文的**字体族**，加上可选开启的修饰层。

**还有一处，默认关闭。** 「侧栏印章」会把侧栏左上角的官方标志换成一枚「花」字方印。这是本主题**唯一一处覆盖应用自带界面**的地方，所以默认关着 —— 换掉别人的标志是一个主张，而装上主题不该强加主张。它的两个颜色不是新挑的：`--dsw-alias-button-primary-fill` 配 `--dsw-alias-label-primary-foreground`，正是 `test/contrast.test.js` 里的第 7 对断言，四套配色全部达标。判据 #28 守着这条关系——**印章一旦被指向一对没人验证过的颜色，构建就失败**。

**拒绝。** 其它一切。而这里最重要的行为是一条**否定式**的：**只要没有任何花笺配色被认领，本插件就什么都不贡献** —— 不注入样式表、不设 body 属性、不加令牌层。装上它既不可能重绘内置主题，也不可能把自己的排版漏进别的皮肤。

另外两个值得知道的选择：

- **界面本体保持无衬线。** 把 `--dsw-font-family` 改成衬线栈是举手之劳，但那会把按钮、侧栏、每一个标签一起改掉。只有阅读正文变成书，界面保留自己的声音。
- **你的字号偏好继续生效。** 主题覆写的是 DSH 的 markdown **font shorthand**，并逐字保留 harness 自己的字号与行高表达式，所以 `--dsh-content-font-size` 是透传的，不会被冻结。

## 代码块的语法高亮

这是本主题**第二个颜色通道**，也是一处曾经真实漏掉的地方。

DSH 用 shiki 的 `css-variables` 主题着色代码，官方注释写得很清楚：*"All token colors resolve through `--shiki-*` custom properties"*。跑一遍 harness 自己的高亮器就能看到：每个彩色 span 都是 `style="color:var(--shiki-token-X)"`，39 个行内 style、7 个变量、**零个字面色值**。

问题出在两个**互相独立**的选择上：

| | 由什么决定 |
|---|---|
| 代码块的**底色** | 本主题选的配色（`--dsw-alias-markdown-code-block`） |
| 代码块的**语法色** | harness 按**当前 colorScheme** 切换（`:root` 一套、`body[data-ds-dark-theme]` 一套）|

两者从来没有被放在一起检查过。**在真实引擎里实测**（`test/verify/build-shiki-probe.mjs`）：四套配色里有三套，抽样用到的 5 个语法色有 4 个不达 AA，最差 **2.88:1** —— 而当时那套 91 条断言全绿。

还有一处更尖锐的：`body[data-ds-dark-theme]` 取自**当前活动主题**的 colorScheme，而配色是走 override 层上来的，两者之间有一个窗口——override 层已经铺上暗色纸面，偏好却还没被钉住。**在这个窗口里，亮色语法色落在暗色代码底上**，实测 5 个全不达标，最差 **1.13:1**，也就是看不见。

修法是把这 11 个变量**按配色**行内写在 `body` 上（和字号补偿、纹理强度同一套路），于是语法色跟随**用户选的那套配色**，而不是跟随 colorScheme——那个窗口从此不可能渲染错。

数值由 `tools/derive-shiki.mjs` 推导，不是手挑的：色相与饱和度保留 harness 自己的（token 角色要能认出来），**一个共享系数**把整组朝各自纸面需要的方向等比推。共享系数是「调色板还是调色板」的关键——**逐个推到刚好 4.5:1 是被试过并否掉的**，那会把九个 token 压到同一个明度上，注释和关键字一样响。变换是渐近的，所以永远不会被裁到纯黑/纯白而悄悄丢掉色相。36 对现在全部达标，最差 4.50:1；实测确认「钉住」与「未钉住」两种状态渲染完全一致。

| 配色 | 代码底色 | 语法色对比度区间 |
|---|---|---|
| 纸本 | `#F5F1E8` | 4.51 – 9.46 |
| 青夜 | `#4A5A65` | 4.50 – 5.81 |
| 珊瑚 | `#F7EFE6` | 4.53 – 9.48 |
| 斑斓 | `#2E3F49` | 4.50 – 7.43 |

青夜的区间偏窄，是它**代码底本身偏亮**（`#4A5A65`，一块中等明度的石板）的必然代价：中等明度会把任何前景色板压扁。想拿回区分度，正解是把它的代码底压暗（例如 `#2A3A44`，与页面底 `#3B4A54` 的分离度相同但方向相反），代价是代码块从「浮起的浅色卡片」变成「下沉的暗色凹槽」——**那是一次观感改动，所以留给你决定**，没有替你做。

## 设置项

**设置 › 花笺主题**

| 行 | 默认 | 说明 |
|---|---|---|
| 启用花笺主题 | 开 | 关闭会注销一切并撤掉配色层 |
| 配色 | 跟随 DSH | 四套配色 + **跟随 DSH**；见下方契约 |
| 衬线阅读体 | 开 | 只作用于阅读正文 |
| 衬线字号补偿 | 115%（100–140%） | 见「阅读字号」 |
| 纸质纹理 | 关 | 整屏程序化纸纹 |
| 纹理强度 | 32%（0–60%） | |
| 极方圆角 | 关 | 只把能点名的控件压方 |
| 侧栏印章 | 关 | 用「花」字方印替换侧栏官方标志（本主题唯一一处覆盖自带界面）|

设置页还会显示**设置是否已持久落盘**。如果它说没有，那重启后一定会丢 —— 这条提示存在，是因为一个**静默不落盘**的开关比一个坏掉的开关更糟。

**配色契约。** DeepSeek Harness 只持久化 `light`/`dark`/`system` 作为主题偏好，第三方主题 id **永远不会写盘**。所以本插件把你的选择记在自己的设置命名空间里，**并且**把颜色作为 override 层应用 —— override 层叠在**任何**激活主题之上。后果是坦白且刻意的：**只要你选了一套配色，「设置 › 外观」那一行就会被本插件接管。** 想交回控制权就点 **「跟随 DSH」** —— 它会忘掉配色并把偏好交还给系统设置。

## 阅读字号

同一个像素尺寸下，衬线看起来比它替换掉的无衬线更小。中文尤其明显：无衬线栈解析到思源黑体，而衬线栈解析到思源宋体，后者笔画细得多 —— 14px 基准下，宋体的细横画会被像素网格吃掉。而 DSH 把自己的正文字号上限卡在 17px，没有余量从「外观」那一行补偿。

所以 markdown 的每一个字号**连同它的行高**都乘上一个你可调的系数。两者同乘，**逐字保留 harness 原本的行高比例**，因此放大字号永远不会把行距压紧。

## 想让界面整体变大

DSH 的字号设置只管会话内容；界面文字**根本没有设置项**。实测它的 25 个非 vendor 组件样式表：界面文字是 **64 处硬编码的 `font-size: Npx`**，而活的界面字号令牌基本只有一个（`--dsw-font-xs-13`，40 处）—— 其它 `--dsw-font-*` 界面尺寸**声明了但无人消费**，而且**全项目没有一个 `rem`**。所以界面字号**没有令牌通道**；只改那一个活令牌会让另外 64 处原地不动，参差比不改更难看。

请改用应用自带的缩放 —— 那是真正的 Electron 缩放，文字与布局一起放大：

| 按键 | 效果 |
|---|---|
| `Ctrl/Cmd` + `=` | 放大（每级 ×1.2） |
| `Ctrl/Cmd` + `-` | 缩小 |
| `Ctrl/Cmd` + `0` | 复位 |

范围钳制在 ±4 级（约 0.48×–2.07×）。因为 DSH Desktop 在**固定**回环端口上提供界面（43120，仅在真正发生端口冲突时顺延），origin 是稳定的，Chromium 按 origin 记录的缩放因此能跨重启保留。本主题**刻意不提供** CSS `zoom` 的复制品：它会有把 `position: fixed` 的 tooltip 与模态层摆错位的风险，而用一个更脆的复制品去替代一个能用的原生机制，是笔坏买卖。

## 本主题围绕哪些坑而建

这些都是**读已安装的 harness 得出的**，不是读文档。其中大多数由 `test/check.js` 里的判据守住。

- **已注册令牌是以行内样式写在 `<body>` 上的。** 在自有样式表里写 `--dsw-alias-*` 的主题，会在任何别的插件写令牌的那一刻被静默压掉。所以颜色只走主题服务。
- **反过来才让排版成为可能。** 不在可注册集合内的自定义属性永远不可能被行内写入，所以对 `--dsw-font-markdown-*` 来说样式表是**唯一**通道。
- **内置主题根本没有令牌**（`{ id: 'light', tokens: {} }`）。`ThemePresenter.apply()` 会先移除它上一次应用过的每一个令牌，再应用下一个主题的 —— 所以切到内置配色会把第三方主题的颜色全部抹掉，而它的样式表、因而它的排版，**毫发无损**。"字体没变、只有配色回退"就是这个签名。
- **DSH 只持久化 `light`/`dark`/`system` 作为主题偏好。** override 层是唯一能扛过 `adopt()` 的机制，而 `adopt()` 在**每次写入和每次启动**都会重读设置文档。
- **`settingsScope.bind()` 收的是 spec 对象** —— `bind({ namespace, decode? })`，**不是命名空间字符串**。传裸字符串会让 `spec.namespace` 成为 `undefined`，于是作用域匹配不到任何 describe 行（**每个**命名空间的 `status` 都停在 `unavailable`），而每一次写入都发给 `undefined`。**两个方向都是静默失败。**
- **`theme.overrideTokens()` 会发射 `theme/change`**，所以在 `theme/change` 监听器里调用它会递归。
- **`theme/change` 监听器内不得同步调用 `setTheme()`。** `publish()` 是同步发射的：重入调用会先让 presenter 用你的快照跑一遍，然后外层 emit 继续时 presenter 又拿**陈旧快照**跑一遍，把你刚恢复的东西抹掉。
- **`Theme.listTokens` 不是白名单** —— 它报告的是"当前恰好注册了什么"，包括别的插件的令牌。
- **`overrideTokens` 只校验值、从不校验名。** 拼错的令牌会被接受、然后无人读取 —— 这正是 `test/token-allowlist.json` 要从已安装的样式表**生成**的原因。
- **`--dsw-alias-tooltip-bg` 在两种模式下都必须保持深色。** `Tooltip.module.css` 用的是一个硬编码的近白色，任何主题令牌都够不到它。
- **`--dsw-alias-toast-bg` 是死令牌。** Toast 的表面是 `--dsw-alias-button-contrast-fill` 配 `--dsw-alias-label-primary-inverted`。
- **raw HTML 永远不进入 DOM。** DSH 把 react-markdown 换成了自研的 mdast→React 渲染器，其策略是"raw HTML 只作为字面文本输出"。所以 GitHub 风格的 `[!NOTE]` Callout **永远无法被样式化** —— 见下方「没做的部分」。
- **markdown 根类名是构建哈希**（`_markdown_177e0_5`）。所以 markdown 规则锚在 `[data-chat-flow-kind='assistant-step']` 上，而且是**对着实时页面实测确认**的，不是假设的。
- **代码块的语法色是第二个颜色通道，而且它是行内的。** shiki 把颜色写成 `style="color:var(--shiki-token-X)"`，所以**任何样式表规则都够不到它们**——行内样式压过选择器。唯一能改语法色的办法是改那些自定义属性的**值**。而 harness 把它们声明在 `:root`（亮）与 `body[data-ds-dark-theme]`（暗）上，也就是跟着 **colorScheme** 走，而代码块**底色**跟着**配色**走。两个独立的选择，从来没人把它们放在一起检查过。
- **`--shiki-foreground` 挂在 `:root` 上是坏的。** 它的值是 `var(--dsw-alias-label-primary)`，而那个别名只写在 `body` 上；自定义属性的 `var()` 在**声明它的那个元素**上求值，所以它在 `:root` 上算不出来，整条声明作废——最后靠 `color` 继承回退才碰巧能看。本主题把它行内写在 `body` 上，正好绕过这个坑。
- **`--dsw-static-*` 原始色阶不是「表面」，是一层地基。** 重绘它能清掉品牌残色，但那会一次性改掉所有消费者，包括本主题从未测量过的——所以本主题走 alias 层，并把这 73 个名字在台账里逐个记为 `harness`。
- **`--dsh-state-ongoing` 够不到。** 它被钉在 `--dsw-static-deepseek-450` 上、声明在组件类 `.dot, .matrix`，body 级规则压不过、类名又是构建哈希。如实记为已知残留，不假装覆盖。

## 开发

只需要 Node 和 pnpm，而且**没有构建步骤** —— `lib/client.js` 就是交付物，手写而成，**审阅者读到的文件就是浏览器运行的文件**。

```bash
nix develop                  # Node 24 + pnpm + jq，锁定到宿主系统的 nixpkgs
npm test                     # 静态判据 + 白名单 + 表面台账 + 对比度 + 运行时 + 变异自检
npm run runtime              # 只跑运行时那套（插件真的被执行）
npm run selftest:verbose     # 变异测试：逐条说明每个 bug 被哪一节抓住
npm run verify:render        # 真机门禁：浏览器是否解析出所声明的颜色（需要浏览器）
npm run refresh:allowlist    # 从已安装的 DSH 重新推导令牌白名单
npm run allowlist:all        # 列出本机全部 DSH 安装及各自令牌数
npm run refresh:surfaces     # 重新扫描 DSH 的全部「承载颜色」的自定义属性
npm run surfaces:list        # 逐条打印台账，看每个表面归谁管
npm run derive:shiki         # 重新推导四套配色的语法高亮色板
npm run probe                # 打印 Phase 0 DOM 探针，供 DevTools 控制台使用
```

`nix flake check` 在无网络沙箱里跑同一套测试。在 NixOS 上 flake 是推荐的入口；`flake.lock` 锁定到宿主系统所构建的那个 nixpkgs 修订，所以这个 shell **什么都不用下载**。

```
lib/index.js     Host 半边 —— 持久设置命名空间
lib/client.js    Client 半边 —— 配色、语法色板、样式表、设置页（交付物）
test/            各种门禁（含 runtime.test.js 与 selftest.js）
test/verify/     真机验证脚手架（不是门禁，见下）
tools/           refresh-allowlist.mjs / scan-color-surfaces.mjs / derive-shiki.mjs
docs/            本实现所依据的调研与设计文档
```

**`test/verify/` 是实测脚手架，不是判据。** 对比度断言算的是表里的数字；这里的脚本回答的是另一个问题——**浏览器实际渲染成了什么**。`shiki-mechanism.mjs` 用 harness 自己的高亮器打印真实 markup，`build-shiki-probe.mjs` 拼出一个只含真实交付物的页面（真的 CSS、真的令牌、真的 shiki 输出、真的 `CodeBlock.module.css`），用无头浏览器渲染后**在页面里打印引擎读到的计算样式**，一张截图就把实测数字带回来。代码块那处缺陷就是它抓出来的，而 91 条断言当时全绿。

## 测试才是重点

主题是**静默失败**的。拼错的令牌不会被抱怨、也无人读取；一个多余字符会让浏览器丢掉一条规则然后继续跑；样式表里的颜色看起来完全正确，直到用户装了另一个写令牌的插件。所以这里的检查不是仪式。

**`test/contrast.test.js` —— 176 条断言。** 19 对 × 4 套配色、按模式的前景极性、链接可读性区间、纸纹的合成模型、**代码块语法色 9 × 4 + 4 条「色板没有被压平」**、**20 条墨色梯度的形状**、**4 条悬停方向**、**16 条层次模型**、**4 条记录在案的链接/错误色间距**。数值**从交付的令牌表里直接读取**，绝不用第二份副本。加 `--verbose` 会打印每一对实测值。

墨色那 20 条值得单独说，因为它修的是**一个名不副实的说法**。`skin.json` 和 L1 头部都写着「墨 5 档」，实际交付的是 4 档、而且是四种不同的节奏：`label-caption` 在四套配色里与 `label-tertiary` **完全相同**（级差 1.00 —— 两个命名层级画成同一个颜色），中段级差则在 0.49（珊瑚）到 0.87（青夜）之间摆动。根因是这五格是在还不知道消费者是谁的时候逐格填的。

所以现在不是「五个人工取值」，而是**两个锚点 + 一条几何规则**：`label-primary`（配色的身份）与 `label-tertiary`（必须过 AA 的那一档）不动，`secondary` 取二者对比度的**几何中项**，`caption`/`dimmed` 按 f^2.5 / f^3 续下，取值落在 OKLab 里从 primary 指向 tertiary 的直线上。`tools/derive-ink-ramp.mjs` 生成这些值，`npm test` 逐步复算；`contrast.test.js` 另外**独立断言形状**（每级级差 < 0.90、上段几何性 ±1.5%）。只断言数值会让工具和测试变成同一句话的两遍，只断言形状则允许数值在任何满足形状的地方乱跑。

一个跨配色共享的因子是**做不到**的，工具本身也这么说：青夜的正文墨色只有 7.51:1，从 AA 到墨色的跨度很短，它的因子必然是 0.78 而纸本是 0.63。要拉平就得动正文墨色或 AA 下限。被拉平的是**形状**。

「为了让 `tertiary` 有余量而抬高它」试过并**否决**了：f = sqrt(t/p)，抬高下限会**收紧每一个级差**，而且恰恰收在最紧的那几套配色上。「余量」和「节奏」是两个问题，混在一起会让这个工具悄悄变成一次改版。所以青夜的 4.52:1 是**被报告成 TIGHT**，而不是被悄悄挪走。

**`tools/derive-ink-ramp.mjs --check`** 也在 `npm test` 里，理由和 `derive-shiki` 一样：值可以从两个锚点重算出来，所以它们不该有漂移的自由。

**`test/check.js` —— 91 条静态判据。** 禁止哈希选择器、禁止在 `:root` 上声明、禁止在样式表里声明已注册的颜色令牌、禁止无人读取的 `--hana-*` 令牌、禁止用裸字符串调 `settingsScope.bind()`、禁止在 `theme/change` 监听器里同步 `setTheme()`、override 层必须幂等、语法色板必须在配色路径上应用且在 detach 路径上释放、每一个运行时路径都必须在 `files` 里、以及一条 `ctx.effect` 释放链覆盖每一个副作用。新增的判据都做过**变异测试**——把 `applyShiki()` 或 `clearShiki()` 删掉，构建必须失败。

**`test/surfaces.test.js` —— 颜色表面台账，195 条。** 这是这套测试里唯一一条**关于测试本身**的判据，也是那个缺陷留下的真正教训。

原来那 19 对断言是**手工挑的**。手工挑的清单只能覆盖有人想到的表面，于是**没人想到的表面无论套件多绿都不会被测量**。代码块语法色就是证明：它从来不在清单上，而这套主题恰恰就是决定代码块底色的人。

所以修法不是「把漏掉的对子补上」，而是**从工件里枚举**：`tools/scan-color-surfaces.mjs` 扫描已安装 harness 里每一个「承载颜色」的自定义属性（字面色值，**或者**引用颜色令牌的 `var()`——`--shiki-foreground` 就是后者，只找字面值会漏掉代码块的墨色），要求每一个都有一条**记录在案的处置**：

| 分类 | 数量 | 含义 |
|---|---|---|
| `theme` | 103 | 本主题必须提供，且确实提供了 |
| `derived` | 4 | harness 声明成对某个本主题拥有的令牌的引用，自动跟随 |
| `harness` | 82 | 归 harness，本主题**不得**写（自带明暗两套，或者不钉构建哈希就够不到）|
| `boot` | 6 | 启动屏，插件挂载之前就画完了 |

台账里出现 `UNCLASSIFIED` 就构建失败，所以 **DSH 升级引入一个新颜色表面时，决定是「被做出的」，而不是「被漏掉的」**。它当场就抓到 5 个此前无人看见的表面，其中一个值得点名：`--dsh-state-ongoing`（进行中状态点）被钉在原始色阶 `--dsw-static-deepseek-450` 上，harness 自己的注释都写了「Ongoing blue has no alias token」。它声明在组件类 `.dot, .matrix` 上，body 级规则压不过它，而那个类名是每构建一变的 CSS Module 名——**想够到它就等于钉一个构建哈希，而判据 5 和 16 明令禁止**。于是它被如实记为一条**已知的、刻意的残留**：每一套配色下，进行中状态都是一颗品牌蓝的点。

台账的另一个方向同样重要：**声称 `theme` 的表面必须真的被提供**，否则台账会漂成虚构——那比没有台账更糟，因为它让缺口看起来是关着的。

**`test/tokens.test.js`** —— 每个颜色令牌名都必须出现在由已安装 harness 生成的白名单里；四套配色必须覆盖**同一组**名字；语法色板的 11 个名字必须与 harness 声明的**完全一致**（同样由 `refresh-allowlist.mjs` 从已安装工件里生成）；`--shiki-background` 必须等于它在上面作画的 `--dsw-alias-markdown-code-block`。

它现在**两个方向都断言**，而第二个方向是补上的缺口。原来的判据只界定「可以用哪些名字」，于是「一个都不用」也能满足它——**而那正是交付时的状态**：`--dsw-alias-link` 被 `dsh-client-ui-primitives` 用无 fallback 的 `var()` 读着，却没有任何人声明它。所以现在：任何一个被读到的未声明名字都**必须被供应**（读取带 fallback 的可以拒绝，但必须在生成器里写明理由）；每个供应值必须等于它**绑定的那个角色**，两个方向都由 `test/selftest.js` 的变异证明不是空转。

**`test/runtime.test.js` —— 95 条断言，插件真的被执行。** 上面所有套件读的都是**源码文本**或**交付的表格**；这一套读的是**行为**。这个区别在这里比在别处重要得多，因为「主题静默失败」本来就是运行时属性：一个被 presenter 抹掉的令牌、一个重入的监听器、一次输掉竞态的延迟重应用、一次落不到盘的写入——**没有一个是能从文件文本里看出来的**，而这个项目历史上唯一那次严重缺陷（§5.7 的四层设置持久化连环 bug）**全部由这些构成**。那次 bug 得出的教训是「① 显式契约 + ② 可见的持久化状态 + ③ 判据」；① 和 ② 早就上了，**③ 从来没上**。

它守住十一条行为：

| # | 行为 |
|---|---|
| 1 | **装上但什么都不改** —— 没有任何配色被认领时，文档一个字节都不动（这条否定式承诺是整个架构存在的理由）|
| 2 | `detach()` 完全可逆 —— 属性、class、行内属性、`<style>` 全部还原 |
| 3 | 语法色板被应用、**跟随配色**（而不是 colorScheme）、切换配色时不残留、卸载时清除 |
| 4 | override 层只在选择变化时重建（那个防无限递归的身份守卫）|
| 5 | **§5.7 回归** —— 写一次设置就丢掉配色的那条链，现在必须活下来 |
| 6 | 延迟重应用是**顺序**保证，所以断言的是顺序：flush 之前状态必须是坏的，之后必须恢复 |
| 7 | 设置写入门控 —— 域未就绪时不落盘、不丢脏标记、就绪后重放；面板必须**说出来** |
| 8 | 设置面板能渲染、控件接到真实的配置行、「跟随 DSH」交还控制权 |
| 9 | 总开关关闭后注销并还原 |
| 10 | 暗色配色不会被换成它的亮色搭档（钉住偏好那一步确实在干活）|
| 11 | 四个修饰开关真的到达 DOM；**越界值回退而不是写入坏值** |
| 12 | 侧栏印章：默认不注册、开则注册、关则注销、卸载带走、画出的是**已验证的那对颜色** |
| 13 | 印章在没有任何配色被认领时保持沉默（否则内置主题下也会换掉标志）|

**`npm run verify:render` —— 真机门禁（需要浏览器，所以不在 `npm test` 里）。**

它问的是**别的门禁够不到的那个问题**：浏览器**实际解析**成了什么颜色。`contrast.test.js` 证明表可读，`runtime.test.js` 证明插件**写**了正确的值，这一条证明**引擎把它们解析成了写入的值**。一个级联错误——输掉的特异性、算不出来的 `var()`、被丢掉的声明——前两条都会放行，只会死在这里。

**它不是像素比对**，是刻意的。字体、hinting、浏览器版本都随机器变，像素基线要么因为不是 bug 的原因变红，要么容忍度松到什么也抓不住。真正要紧的窄得多也确定得多：**引擎把这几个自定义属性解析成了这几个颜色**——从 `getComputedStyle` 读出来，对着 `lib/client.js` 里的值**要求精确相等**。

它还在引擎里复验了语法高亮修复存在的那个理由：标着 `UNPINNED` 的变体（暗色纸面已铺、活动 colorScheme 还是亮色）必须解析出**和钉住状态完全相同**的语法色。

读数会写成 `test/verify/render-baseline.json` **提交进仓库**——漂移因此变成一份可审阅的 git diff。改了配色、语法层或升级了 DSH/浏览器之后：

```bash
npm run verify:render          # 对照基线比对
npm run verify:render:update   # 有意改动时重写基线（读那份 diff，那就是 review）
npm run verify:render:shot     # 顺便留一张截图给人看
```

探针页面里的行内样式**由真实插件产出**，不是从表格里复述的。这一点是被一次变异测试逼出来的：早先的版本自己拼样式串，于是把 `applyShiki()` 从 reconcile 里删掉之后，这道门禁**依然是绿的**——页面照样是对的，因为探针自己把它画对了。现在值来自 `test/harness.js`（驱动真 bundle、点真实设置面板、读行内表），链路因此是完整的：**插件写 → 引擎解析**。

**`test/selftest.js` —— 变异测试，证明上面那套不是空转的。** 一个因为错误原因而通过的测试，看起来和一个因为正确原因而通过的测试**一模一样**，而绿色的运行输出里没有任何东西能把两者分开。这个仓库已经站错过边：91 条对比度断言全绿，而整整一个颜色通道是不可读的。

所以它取**真实的** bundle，注入一个**真的发生过**或**很像是下一个**的 bug，在**新进程**里跑上面那套，并要求它失败。两件事让它诚实而不是装饰：

1. **注入本身被验证。** 锚点文本找不到时（比如有人重构了那一行），这条变异被报为 `INAPPLICABLE` 并**计入失败**——一条悄悄没生效的变异会「通过」却什么也没证明，**这正是这个文件存在的意义**。
2. **检查的是期望的章节文本**，不只是一个非零退出码——「有什么东西失败了」也会被一次无关的崩溃满足。

**20 条变异对应 20 条行为，全部被抓；**其中 3 条打在生成的数据文件与绑定表上，2 条**复现本项目真实交付过的**墨色同值与珊瑚悬停变弱。外加一条基线（未变异的三套源码都必须通过），否则「它失败了」不说明任何事。

变异现在可以指定**目标文件**与**要跑的套件**（`test/runtime.test.js` / `tokens.test.js` / `contrast.test.js`），所以 `test/load-client.js` 与 `test/tokens.test.js` 也接受 `HANA_BUNDLE` / `HANA_ALLOWLIST` 指向副本——真实文件永远不被改写。这一步是必要的：一个从没被证明能对**已知坏输入**失败的判据只是装饰。

> **一个诚实的说明**：B1 没有**发现**新 bug——真实 bundle 在这 11 条行为上本来就是对的。它的价值是把「没有 bug」从一句注释变成**有证据的结论，并且锁住**。这和一个 bug 修复同样有价值，只是读起来没那么戏剧化。

这套测试是有战功的。它抓到过：一次加载期崩溃、本主题自己配色里的三个死令牌、一个死掉的 `--hana-*` 令牌、一个**只有从 registry 安装才会踩到**的打包缺口；在设置持久化那个 bug 之后，它会**拒绝构建**用裸字符串绑定设置作用域的代码；**整个代码块语法高亮通道**；以及**一套会在空转中全绿的运行时沙箱**——`test/load-client.js` 的沙箱里根本没有 `document`，而那正是 `apply()` 第一行要判的东西，于是每条可视路径都提前返回、每条断言都通过。

## 兼容性

已针对 **DeepSeek Harness Desktop 2.0.5 / 2.0.6** 与 **`@deepseek-ai/dsh-client-ui-theme` 0.1.2-rc.1**（89 个已注册颜色令牌 + 11 个语法变量）验证。`package.json` 声明测试过的区间为 `0.1.2-rc.1 – 0.1.5-alpha.1`。

那个区间不是空的：0.1.5-alpha.1 多一个令牌 `--dsw-alias-link`，而**本机装着的 `dsh-client-ui-primitives`（随社区市场一起分发的那份）确实在读它**，并且 `var()` 里**没有 fallback**。没有 fallback 时，声明在 computed-value 阶段直接失效——不是「回退到默认值」，是那个属性消失。所以本主题**供应**它，另有 8 个同类名字：

| 名字 | 读它的包 | 绑到哪个已有角色 |
|---|---|---|
| `--dsw-alias-link` | `dsh-client-ui-primitives` | `brand-text` |
| `--dsw-alias-label-error` | `dsh-client-ui-settings-plugins` | `state-error-primary` |
| `--dsw-alias-separator-primary` | `dsh-client-ui-chat` | `border-l1` |
| `--dsw-alias-label-quaternary` | `dsh-client-ui-agent-preset` | `label-dimmed` |
| `--dsw-alias-state-warning-primary` | `settings-plugin-inventory` 等 | `state-warn-primary` |
| `--dsw-alias-bg-layer-4` | `dsh-client-ui-settings-plugins` | `interactive-bg-hover-solid` |
| `--dsw-alias-fill-l2`、`--dsw-alias-fill-tsp-secondary` | `dsh-client-ui-jobs`、`agent-preset` | `bg-layer-3` |
| `--dsw-alias-border-default` | `dsh-plugin-desktop` | `border-l1` |

每一个都**绑定**到本主题已经定义的角色，不引入新颜色，因此没有第二份值需要同步；绑定关系由 `test/tokens.test.js` 断言。唯一**拒绝**的是 `--dsw-alias-font-mono`（它是字体通道不是颜色，且它的读取带 fallback `ui-monospace, monospace`），拒绝理由记录在生成器里而不是省略掉。

这套判断来自新增的**引用侧扫描**：`npm run refresh:allowlist` 现在不只看「谁声明了」，还看「谁在读」，并记录每个读取**有没有 fallback**。原因写在 `--dsw-alias-link` 上：旧的白名单判据说「不在 89 个之内的名字是静默空操作」——对**声明**成立，对**引用**不成立，而这两者之间就是上面这 9 个名字。

依赖的稳定锚点：89 个已注册令牌名、11 个 `--shiki-*` 名、`--dsw-font-markdown-*`、`--dsh-content-font-size`、`body[data-ds-dark-theme]`、`md-code-block`、`md-table-wide`、`data-chat-flow-kind`、`data-composer-card`、`settings.section`。

harness 升级后请跑这四条，并**读那份 diff**：

```bash
npm run refresh:allowlist     # 令牌名 + 引用侧扫描；消失的令牌 = 一个静默失效的覆写
npm run refresh:surfaces      # 颜色表面；新出现的表面会以 UNCLASSIFIED 让构建失败
npm run derive:ink            # 墨色梯度；改动任何一档后重新推导
npm run derive:shiki          # 语法色；同上
```

第二条是本仓库在代码块那处缺陷之后新增的：**一个新的颜色表面不会再无声无息地溜过去**，它会带着「请做决定」的要求出现在台账里。

## 没做的部分，以及为什么

- **Callout。** DSH 的渲染器保证 raw HTML 只作为字面文本输出、不进入 DOM，所以 `.hana-callout` 永远不可能被发出。路线 A 是死 CSS；MutationObserver 方案则会把 `[!NOTE]` 这个字面量留在正文里。**记录在案，而不是做一半。**
- **动效。** 刻意不做。八个关键帧本身微不足道；风险在于**流式输出期间入场动画会被反复重放** —— 而这恰恰是动效 bug 的聚集地，也恰恰是不盯着一次长生成就看不见的地方。
- **晴天模式**（HanaAgent 的 2.38 MB 视频叠层）。技术上可行，但会为一个可选效果破坏本插件**零二进制资源**的性质。
- **打包字体。** HanaAgent 带了 6.5 MB，其中 6.0 MB 是中文。系统衬线栈免费拿到了大部分效果。
- **青夜的代码底色没有压暗。** 见「代码块的语法高亮」末尾：压暗它能拿回语法色的区分度，但那是一次观感改动，留给你决定。
- **`--dsh-state-ongoing` 仍是品牌蓝。** 够不到（见上方坑列表），如实记录在台账里，没有假装覆盖。
- **界面字号。** 无令牌通道（实测 64 处硬编码 px），改用应用自带的 Electron 缩放，刻意不做 CSS `zoom` 的复制品。
- **DSH Desktop 的 5 个原生界面换不了肤。** 首次设置、切换 profile、创建 profile、崩溃恢复、desktop 对话框——它们是**独立文档**，没有插件宿主；而且 `desktop-dialog.html` 的 CSP 是 `style-src 'self'`，**连内联 `<style>` 都禁止**，也就是主题唯一还有的手段在那里是被禁的。它们的外壳是 Tailwind/shadcn，词表是 `--background` / `--card` / `--gray1..12` / `--tw-*`，对 `--dsw-*` 的引用数是 **0**。这不是缺陷，是边界：**那几屏永远是灰的，不会跟着主题走。** 后面那棵树有 83 张样式表（store 里存了两份），台账把它们记成 `notCovered`。
- **暖色配色里链接色与错误色分不开。** 珊瑚测得 OKLab ΔE **0.019**、青夜 0.030（纸本 0.208、斑斓 0.228）——也就是说在珊瑚里，报错和链接是同一个颜色。**这条不能靠调错误色修好**：珊瑚的链接色**就是**它的强调色压暗到 AA 的结果，与错误色落在同一片深红；在主题使用的红色区间里搜索，最好也只到 0.080。真要解决得给珊瑚一个非珊瑚色的链接，那是设计决定而不是修复，所以留着。四个值被判据 #32 钉住：**可以低，但不许悄悄变。**

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。

这是**设计语言**的移植，不是代码移植。没有搬运或内联 HanaAgent 的任何源文件；配色是重新推导的，并在此重新验证对比度。HanaAgent 采用 Apache-2.0。
