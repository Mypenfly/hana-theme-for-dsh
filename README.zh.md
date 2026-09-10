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

**改。** 当前配色对应的 89 个 alias/specific 颜色令牌；以及当某套花笺配色生效且「衬线阅读体」打开时，markdown 阅读正文的**字体族**，加上可选开启的修饰层。

**拒绝。** 其它一切。而这里最重要的行为是一条**否定式**的：**只要没有任何花笺配色被认领，本插件就什么都不贡献** —— 不注入样式表、不设 body 属性、不加令牌层。装上它既不可能重绘内置主题，也不可能把自己的排版漏进别的皮肤。

另外两个值得知道的选择：

- **界面本体保持无衬线。** 把 `--dsw-font-family` 改成衬线栈是举手之劳，但那会把按钮、侧栏、每一个标签一起改掉。只有阅读正文变成书，界面保留自己的声音。
- **你的字号偏好继续生效。** 主题覆写的是 DSH 的 markdown **font shorthand**，并逐字保留 harness 自己的字号与行高表达式，所以 `--dsh-content-font-size` 是透传的，不会被冻结。

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

## 开发

只需要 Node 和 pnpm，而且**没有构建步骤** —— `lib/client.js` 就是交付物，手写而成，**审阅者读到的文件就是浏览器运行的文件**。

```bash
nix develop                  # Node 24 + pnpm + jq，锁定到宿主系统的 nixpkgs
npm test                     # 白名单 + 对比度 + 静态判据
npm run refresh:allowlist    # 从已安装的 DSH 重新推导令牌白名单
npm run allowlist:all        # 列出本机全部 DSH 安装及各自令牌数
npm run probe                # 打印 Phase 0 DOM 探针，供 DevTools 控制台使用
```

`nix flake check` 在无网络沙箱里跑同一套测试。在 NixOS 上 flake 是推荐的入口；`flake.lock` 锁定到宿主系统所构建的那个 nixpkgs 修订，所以这个 shell **什么都不用下载**。

```
lib/index.js     Host 半边 —— 持久设置命名空间
lib/client.js    Client 半边 —— 配色、样式表、设置页（交付物）
test/            各种门禁
tools/           refresh-allowlist.mjs，生成 test/token-allowlist.json
docs/            本实现所依据的调研与设计文档
```

## 测试才是重点

主题是**静默失败**的。拼错的令牌不会被抱怨、也无人读取；一个多余字符会让浏览器丢掉一条规则然后继续跑；样式表里的颜色看起来完全正确，直到用户装了另一个写令牌的插件。所以这里的检查不是仪式。

**`test/contrast.test.js` —— 91 条断言。** 19 对 × 4 套配色、按模式的前景极性、链接可读性区间，以及纸纹的合成模型。数值**从交付的令牌表里直接读取**，绝不用第二份副本。加 `--verbose` 会打印每一对实测值。

**`test/check.js` —— 78 条静态判据。** 禁止哈希选择器、禁止在 `:root` 上声明、禁止在样式表里声明已注册的颜色令牌、禁止无人读取的 `--hana-*` 令牌、禁止用裸字符串调 `settingsScope.bind()`、禁止在 `theme/change` 监听器里同步 `setTheme()`、override 层必须幂等、每一个运行时路径都必须在 `files` 里、以及一条 `ctx.effect` 释放链覆盖每一个副作用。

**`test/tokens.test.js`** —— 每个颜色令牌名都必须出现在由已安装 harness 生成的白名单里，且四套配色必须覆盖**同一组**名字。

这套测试是有战功的。它抓到过：一次加载期崩溃、本主题自己配色里的三个死令牌、一个死掉的 `--hana-*` 令牌、一个**只有从 registry 安装才会踩到**的打包缺口；以及在设置持久化那个 bug 之后，它现在会**拒绝构建**用裸字符串绑定设置作用域的代码。

## 兼容性

已针对 **DeepSeek Harness Desktop 2.0.5 / 2.0.6** 与 **`@deepseek-ai/dsh-client-ui-theme` 0.1.2-rc.1**（89 个颜色令牌）验证。`package.json` 声明测试过的区间为 `0.1.2-rc.1 – 0.1.5-alpha.1`；后者只多一个令牌（`--dsw-alias-link`），本主题不使用它，白名单把它记为 `versionDependent`。

依赖的稳定锚点：89 个已注册令牌名、`--dsw-font-markdown-*`、`--dsh-content-font-size`、`body[data-ds-dark-theme]`、`md-code-block`、`md-table-wide`、`data-chat-flow-kind`、`data-composer-card`、`settings.section`。

harness 升级后请跑 `npm run refresh:allowlist` 并**读那份 diff**。**消失的令牌，就是一个静默失效的覆写。**

## 没做的部分，以及为什么

- **Callout。** DSH 的渲染器保证 raw HTML 只作为字面文本输出、不进入 DOM，所以 `.hana-callout` 永远不可能被发出。路线 A 是死 CSS；MutationObserver 方案则会把 `[!NOTE]` 这个字面量留在正文里。**记录在案，而不是做一半。**
- **动效。** 刻意不做。八个关键帧本身微不足道；风险在于**流式输出期间入场动画会被反复重放** —— 而这恰恰是动效 bug 的聚集地，也恰恰是不盯着一次长生成就看不见的地方。
- **晴天模式**（HanaAgent 的 2.38 MB 视频叠层）。技术上可行，但会为一个可选效果破坏本插件**零二进制资源**的性质。
- **打包字体。** HanaAgent 带了 6.5 MB，其中 6.0 MB 是中文。系统衬线栈免费拿到了大部分效果。

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。

这是**设计语言**的移植，不是代码移植。没有搬运或内联 HanaAgent 的任何源文件；配色是重新推导的，并在此重新验证对比度。HanaAgent 采用 Apache-2.0。
