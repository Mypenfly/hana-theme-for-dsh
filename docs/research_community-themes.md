# DSH 社区主题扩展调研报告

> 调研对象：`Ewnscat-ya/dsh-client-ui-skin-denia`、`zouyuxuan122/Deepseek-Harness-EAC`、`ymh0000123/dsh-theme-endfield`
> 调研方式：三仓库完整克隆到 `.research/` 逐文件阅读，并以本机安装的 DSH Desktop 2.0.5 源码作为**权威契约**做交叉验证。
> 结论中所有令牌名、选择器、API 签名均取自真实代码或本机 `node_modules`，非推测。

---

## 目录

- [0. 调研对象与定位差异](#0-调研对象与定位差异)
- [1. 开发技术栈](#1-开发技术栈)
- [2. 开发板块（可定制的界面清单）](#2-开发板块可定制的界面清单)
- [3. 美学（配色设计）](#3-美学配色设计)
- [4. 静态资源（图片/字体/背景）](#4-静态资源图片字体背景)
- [5. 界面与 Markdown 渲染主题设计](#5-界面与-markdown-渲染主题设计)
- [6. 主题开发的基本工作流](#6-主题开发的基本工作流)
- [7. 关键陷阱清单](#7-关键陷阱清单)
- [8. 对本机环境的落地建议](#8-对本机环境的落地建议)
- [附录](#附录)

---

## 0. 调研对象与定位差异

三个仓库**不是同一类东西**，直接对比技术栈会得出错误结论。先区分层级：

| 项目 | 类型 | 体量 | 本质 |
|---|---|---|---|
| **denia** | 客户端皮肤包（单主题） | 2.5 MB，`client.js` 1673 行 | 「一个皮肤就是一个 npm 包」，纯 Client 侧 DOM/CSS 覆写 + 自定义 HTTP 路由存设置 |
| **endfield** | 客户端主题插件（单主题） | 904 KB，`client.js` 4694 行 | 走**官方 `ctx.theme.overrideTokens` 令牌通道** + 官方设置命名空间持久化 + 大量工程化测试 |
| **EAC** | 桌面发行版（含皮肤子系统） | 137 MB（`git clone` 后） | 官方 dsh 的 Electron/Tauri 桌面封装，**内置 10 款皮肤** + `dsh-skin-switch` 皮肤切换插件 + 插件管理体系 |

> **EAC 的关键认知**：它本身**不是主题**，而是「主题的分发与切换 Host」。它的皮肤包里 `lib/client.js` 常常是构建产物（如 maid-atelier 的 2.7 MB 单文件），真正的皮肤代码来自上游（`zhu1090093659/dsh-web`、`Small-tailqwq/dsh-deep-whale`）。研究 EAC 的价值在于看清**皮肤如何被发现、列出、切换、互斥、以及如何统一进 profile**。

---

## 1. 开发技术栈

### 1.1 共同底座：DSH Client 插件契约

三个项目都遵守同一份契约 —— 一个 npm 包，`package.json` 里声明 `dsh` 字段，并**同时提供 Host 与 Client 双入口**：

```jsonc
{
  "name": "dsh-theme-endfield",
  "type": "module",
  "main": "index.js",                    // Host 入口
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",           // Client 入口（浏览器里跑）
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },   // 让 bundle 把自己插进 web profile
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "…ui-theme", "theme"],
      "platform": "web"
    }
  },
  "peerDependencies": { "@deepseek-ai/cordis": "^4.0.1" }
}
```

#### ⚠️ 两个 `inject` 语义完全不同（最易混淆的一处）

这是核对官方源码后确认的关键区分，**很多主题作者搞混**：

| 位置 | 谁来读 | 语义 |
|---|---|---|
| `package.json` → `dsh.client.inject` | **Host**（写进 client boot manifest） | **模块加载顺序**：这些 bundle 必须先加载完，我的 bundle 才能跑。**不是**服务依赖声明 |
| `client.js` → `exports.inject` | **Cordis** | `apply()` 的**服务门控**：这些服务就绪前不调用 `apply()`，缺失时插件进入 waiting |

endfield 的实际形态就是两者不同：

```jsonc
// package.json
"dsh": { "client": {
    "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-locale",
               "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-settings",
               "@deepseek-ai/dsh-client-ui-theme", "theme"],
    "platform": "web" } }
```
```js
// client.js 结尾
exports.inject = ["theme"];        // 只有 theme 是硬门控
exports.name = "dsh-theme-endfield";
exports.apply = apply;
```

其余服务（`slots` / `settingsScope` / `locale` / `sessions`）全部走 `ctx.get(name)` 并处理 `undefined` —— 这样任何一个可选服务缺失都不会把整个主题卡在 pending 状态。

**`cordis.patch.yml` 负责把自己注册进 profile：**

```yaml
# denia / miku / maid-atelier 用同一个形状
- insert:
    - id: ui-skin-denia                              # 行 id：互斥管理的抓手
      name: '@dsh-external/dsh-client-ui-skin-denia' # 包名
```

**技术栈结论**：

- **语言**：纯 JavaScript（ESM）。**没有 JSX、没有 TS、没有打包器要求** —— 分发的是已产出的 `lib/client.js`。EAC 内的皮肤虽由 TS 编译而来，但同样以 ESM 产物分发（文件头带 `//#region src/index.ts` 与 `//# sourceMappingURL`）。
- **Client 侧 React**：需要注册 UI 时必须用 `React.createElement` / 编译后的 `react_jsx_runtime.jsx(...)`（EAC 的 `dsh-skin-switch/lib/client.js` 即是）。
- **Client bundle 的封装格式**：`lib/client.js` 不是裸模块，而是 `window.__ModuleLoader__.load({ id, factory })` 形式 —— denia 的 `client.js` 结尾就是：

  ```js
  exports.apply = apply;
  return module.exports;
  });
  //# sourceMappingURL=client.js.map
  ```

  即「模块 id + 工厂函数」，工厂里用局部 `module`/`exports` 再 `return module.exports`。EAC 的 `dsh-font-custom` 注释直说：*"Hand-written ModuleLoader bundle — no build step required."*
  **含义**：手写这个封装完全可以，不需要任何构建链；上游 `dsh-web-ui` 提供的脚手架（`scripts/dsh-skin-new`、`shared/tsdown.client.ts`）只是可选的便利。
- **CSS**：**注入 `<style>` 标签**，不是 CSS-in-JS、不是 constructable stylesheet。三个项目全部如此。denia 用的是标准做法：

  ```js
  var tagId = "@dsh-external/dsh-client-ui-skin-denia/denia.module.css";
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var styleTag = document.createElement("style");
      styleTag.dataset.plugin = "@dsh-external/dsh-client-ui-skin-denia";
      styleTag.dataset.pluginCss = tagId;
      styleTag.textContent = css;
      document.head.appendChild(styleTag);
  }
  ```

  用 `data-plugin-css` 做**幂等标记**（bundle 可能被 boot loader 与 cordis composition 挂载两次），endfield 在注释里明确记录了这一点。

  **在 Dynamic Cordis 环境里还有更好的通道**：runner 提供了一个 `styles` 全局内建 —— `styles.insert(css)` 返回 disposer，实现的标签带 `style[data-dyn=<pluginId>]` 且**随 package 卸载自动回收**。endfield 的 `insertCss()` 优先用它，回落到自建 `<style data-plugin=...>`：

  ```js
  function insertCss(css) {
      // Dynamic Cordis runner provides the `styles` global; standalone bundle does not.
      if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
          return styles.insert(css);            // 自带 tag + 自动 dispose
      }
      // 回落：先删同名重复，再插入自己的标签，返回 remover
      document.querySelectorAll('style[data-plugin="dsh-theme-endfield"]').forEach(el => el.remove());
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-theme-endfield';
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => tag.remove();
  }
  ```

### 1.2 三条不同的技术路线

| 维度 | denia | endfield | EAC 皮肤（miku 等） |
|---|---|---|---|
| 令牌通道 | 自写 `<style>` 直接声明 `--dsw-*` | **`ctx.theme.overrideTokens()`** | 自写 `<style>` |
| Host 半边 | 有（`webServer` 注册 HTTP 路由存设置） | 有（`ctx.settings.register` 声明命名空间） | 近乎空（`function apply() {}`） |
| 设置持久化 | 自定义 `/api/dsh-denia/palette-settings` + profile 文件 | 官方 settings 命名空间 → `settings.yaml` | 通常无（纯 CSS） |
| 设置 UI | 自建悬浮面板（右下角 🎨） | `settings.section` 插槽（设置页一个 tab） | 无 |
| 生成物 | 手写源码 | 手写源码 | TS 构建产物 |
| 规模 | 1.6 k 行 | 4.7 k 行 | 100 k+ 行（含内联资源） |

### 1.3 官方服务清单（Client 侧可注入）

摘自本机 `dsh-client-ui-theme` / `dsh-client-ui-settings` / `dsh-client-ui-slots`：

| 服务 | 获取方式 | 用途 |
|---|---|---|
| `theme` | `ctx.get('theme')` 或 `inject: ['theme']` | `register()` / `overrideTokens()` / `setTheme()` / `getTheme()` |
| `slots` | `ctx.get('slots')` | `slots.inject(slotName, cb)` + `slots.register(def, Component)` |
| `settingsScope` | `ctx.get('settingsScope')` | 浏览器侧读写 Host 设置命名空间 |
| `settings` | Host 侧 `ctx.inject(['settings'], …)` | `settings.register(ns, schema, {applies:'live'})` |
| `locale` | `ctx.get('locale')` | `locale.register(ns, {zh, en})` 做界面文案双语 |
| `sessions` | `ctx.get('sessions')` | 会话状态（endfield 用它驱动"雷霆大字"状态动画） |
| `webServer` | Host 侧 `inject: ["webServer"]` | `webServer.register({kind:'exact'|'prefix', path, handler})` |
| `remote` / Typert | `@deepseek-ai/dsh-api-remotes` | Client→Host 结构化 RPC（EAC 皮肤切换用） |

> **`inject` 与 `ctx.get` 的选择**（endfield 在 `client.js:2195` 有明确注释）：
> - 硬依赖 → 写进 `inject: [...]`，服务缺失时插件进入 waiting，服务出现后 Cordis 自动激活。
> - 软依赖 → `ctx.get('x')` 并处理 `undefined`。endfield 故意**不**声明 `inject: ['sessions']`，因为那会让主题在没有 sessions 服务时整体不挂载。

---

## 2. 开发板块（可定制的界面清单）

主题本质上只做两件事：**改 CSS 自定义属性（令牌）** 和 **改 DOM/注入图层**。前者是主路径，后者是补充。

### 2.1 权威令牌体系：`--dsw-*`

本机 `@deepseek-ai/dsh-client-ui-theme` 的 `lib/client.js` 与全部 `dsh-client-ui-*` 包合计声明 **约 368 个 `--dsw-*` 自定义属性**。这是**唯一被官方承认的配色入口**（该包 README 原文：*"The token sheets are the sole color authority"*）。

**令牌分层**（命名即分层）：

| 前缀 | 含义 | 数量级 | 主题是否该改 |
|---|---|---|---|
| `--dsw-static-*` | 原始色阶（含 DeepSeek 品牌蓝 `--dsw-static-deepseek-50…900`） | 大量 | 谨慎，见 §3.5 |
| `--dsw-alias-*` | **语义别名层 —— 主题的主战场** | ~90 | ✅ 主要目标 |
| `--dsw-specific-*` | 具体组件槽位（气泡、侧栏、输入框） | ~12 | ✅ 按需 |
| `--dsw-font-*` | 字体简写阶梯（`--dsw-font-markdown-h1` 等） | ~180 | ✅ 排版主题化 |
| `--dsw-shadow-lv*` / `--dsw-elevation-*` | 阴影与描边 | ~6 | ✅ |
| `--dsw-corner-shape` | 超椭圆圆角（`@supports` 内生效） | 1 | 少数主题会改 |
| `--shiki-*` | 语法高亮（**声明在 `:root`**） | 11 | 可选，见 §5.2 |
| `--ds-*` | 更底层的补充层（代码字体、过渡） | 5 | ✅ 改字体/过渡节奏 |

**三层结构**（内核 `dsh-client-ui-theme` 的 `design-platform.css` 内，全部在同一个字符串常量里）：

```css
/* Layer 1 —— 静态色板，在 body 上。色相族：amber / blue / deepseek / green
   / neutral / neutral-bluish / red；档位 00/50/60/75/100/…/950/1000 */
body { --dsw-static-deepseek-500:#4176e6; --dsw-static-neutral-00:#fff;
       --dsw-static-neutral-bluish-1000:#0f1115; … }
body[data-ds-dark-theme] { … 同名，暗色值（静态色板基本与配色无关）… }

/* Layer 2 —— 语义别名，在 body 上，引用 Layer 1。主题改的就是这一层 */
body { --dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00);
       --dsw-alias-label-primary:var(--dsw-static-neutral-bluish-1000);
       --dsw-alias-state-business-primary:var(--dsw-static-deepseek-500);
       --dsw-alias-markdown-code-block:var(--dsw-static-neutral-bluish-50);
       --dsw-specific-sidebar-fill:var(--dsw-static-neutral-bluish-50); … }
body[data-ds-dark-theme] { --dsw-alias-bg-base:var(--dsw-static-neutral-bluish-950); … }

/* Layer 3 —— Shiki，在 :root（不是 body！这就是上面那个陷阱的来源） */
:root { --shiki-background:var(--dsw-alias-markdown-code-block);
        --shiki-token-keyword:#d6336c; … }
body[data-ds-dark-theme] { --shiki-token-keyword:#faa2c1; … }
```

**`--dsw-alias-*` 的分组命名**（改令牌前先看它属于哪组）：

```
bg-          base / layer-1..4 / mask-1..3 / mask-photo / mask-drop
             / module-platform / multi-select / overlay / skeleton
border-      l1 / l2 / l2-darkmode-thin / l3 / l4 / inverted / inverted2
label-       primary / primary-bluish / primary-dimmed / primary-foreground
             / primary-inverted / secondary / tertiary / quaternary
             / caption / dimmed / error
button-      primary-fill / -hover / -dimmed / contrast-fill / elevated-fill
             / floating-fill / -hover / ghost-active-fill / -hover / -border
             / info-fill / -hover / tool-bar-fill / -hover / -fill-invisible
interactive- bg-hover / bg-hover-solid / bg-hover-accent / bg-hover-danger / bg-active
markdown-    code-block / code-block-banner / inline-code / citation / tag
             / placeholder / code-segment-selected / code-segment-unselected
scrollbar-   bg-l1 / bg-l2 / hover-l1 / hover-l2
state-       business-primary / business-tertiary
             / success-primary / -secondary / -tertiary
             / error-primary / -secondary
             / warn-primary / -secondary / -tertiary / warn-label
brand-       primary / primary-invert / brand-text
specific-    bubble / bubble-highlight / input-major / login-input / menu
             / selector / sidebar-fill / sidebar-nav-item-active
             / sidebar-nav-item-active-accent / sidebar-nav-item-hover / tip
```

> **`--dsw-alias-*` 的默认值本身就是 `var(--dsw-static-*)` 引用** —— 这是官方设计系统的实现方式，也说明了为什么"只改别名层"通常就够了（改静态层会连带影响一组语义令牌，风险大得多）。

**主题必需的 `--dsw-alias-*` 核心 30 项**（denia 实际覆写的完整集合，可作为最小可用清单）：

```
bg-base  bg-layer-1  bg-layer-2  bg-layer-3  bg-overlay
border-l1  border-l2  border-l2-darkmode-thin  border-l3
label-primary  label-primary-bluish  label-secondary  label-tertiary  label-caption
brand-primary  brand-text
button-elevated-fill  button-floating-fill  button-floating-hover
button-info-fill  button-info-hover
interactive-bg-active  interactive-bg-hover  interactive-bg-hover-solid
state-business-primary  state-business-tertiary
specific-input-major  specific-selector  specific-sidebar-fill
shadow-lv2
```

其余高频项（endfield 额外接管）：

```
--dsw-static-deepseek-50…900        # 中和残留品牌蓝
--dsw-specific-bubble / -highlight  # 气泡底色
--dsw-specific-sidebar-nav-item-active / hover / -accent
--dsw-alias-separator-primary  --dsw-alias-fill-l2
--dsw-alias-state-success/error/warning-primary
```

#### 具体令牌陷阱（都是从真实 bug 里来的）

| 陷阱 | 说明 |
|---|---|
| **填充按钮必须用三件套** | 实心主按钮只能用 `--dsw-alias-button-primary-fill` + `-hover` + **`--dsw-alias-label-primary-foreground`**。**绝不能用 `--dsw-alias-brand-primary` 当填充色** —— 在官方主题里它等于前景色，结果是**黑底黑字** |
| **`--dsw-alias-bg-base` 常是半透明** | 它是 `#ffffff6b` / `#faf7f057` 这类半透明值。**不能当文字色**（EAC 有个真实回归：皮肤切换插件的应用按钮用了它当文字色 → 完全不可见，已写成测试 `skin-switch-css.test.ts` 锁定） |
| **`--dsw-alias-border-l2-darkmode-thin`** | 专门给暗色模式的细发丝线用；亮色模式要给它比 `-l2` 略强的值 |
| **`--shiki-background` 声明在 `:root`** | 而暗色别名作用域是 `body[data-ds-dark-theme]` —— **`:root` 够不到它**。上游 issue #826 记录了这个：暗色模式下 Shiki 代码块会画固定的亮色背景。v2 loader 把 `--shiki-background` 重绑到皮肤作用域的 body 上；v1 皮肤都没重绑，所以**v1 主题下代码块背景靠 `--dsw-alias-markdown-code-block`（皮肤会改）撑着，但 `--shiki-foreground` 与各 token 颜色仍跟内核走** |
| **`--dsw-alias-brand-primary-new-colorprimary-new-color`** | 内核自己的令牌表里就有这个拼接痕迹 —— 上游设计系统的产物，被忠实复制过来了。**别去改它** |
| **`--dsw-skin-scrim` 不是内核令牌** | 由上游 skin-center 写入。只装 EAC 的 `dsh-skin-switch` 时它恒为 `0`（`var(--dsw-skin-scrim, 0)` 的 scrim 层永远不生效） |

### 2.2 ⚠️ 令牌如何被应用：**inline style on `<body>`**

这是**整个主题体系里最关键、最容易踩错的一条机制**。来自 `@deepseek-ai/dsh-client-ui-layout/lib/client.js`：

```js
apply(snapshot) {
    const scheme = snapshot.active.colorScheme;
    document.documentElement.style.colorScheme = scheme;
    const body = document.body;
    if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");   // data-ds-dark-theme
    else body.removeAttribute(DARK_ATTRIBUTE);
    body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`);
    for (const name of this.appliedTokens) body.style.removeProperty(name);
    this.appliedTokens = [];
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
        body.style.setProperty(name, value);        // ← 行内样式
        this.appliedTokens.push(name);
    }
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
}
```

由此推出四条硬性结论：

1. **令牌写在 `body` 的行内样式上**。行内样式无视选择器特异性 —— 你写在 `<style>` 里的 `body[data-x]{--dsw-alias-bg-base:red}` **打不过它**（除非 `!important`）。
2. **但内置 `light`/`dark` 的 `tokens` 是空的**（基础样式表已带两套色板）。所以**默认主题下行内样式不产生任何令牌** → 自写 `<style>` 声明 `--dsw-*` 是有效的。denia、endfield、EAC 皮肤全部依赖这一点。
3. **一旦用户启用了带 `tokens` 的主题（如 StyleVault 预设）或任何 `overrideTokens` 图层，该令牌就会出现行内样式**，自写 `<style>` 的同名声明立刻失效 → **这正是 denia 式皮肤与 StyleVault 冲突的根因**。
4. **因此正确做法是走 `ctx.theme.overrideTokens()`**（endfield 就这么做，见 §1.2）。

**副作用推论**（endfield `docs/engineering-notes.md:47` 实测记录）：任何**引用 `--dsw-*`** 的自定义属性**必须声明在 `body` 上，不能声明在 `:root`**。`:root` 是 `body` 的父元素，在那里引用一个只在 `body` 上定义的变量属于 *guaranteed-invalid*，计算值为空字符串。

| 变量 | 声明位置 | 计算值 |
|---|---|---|
| `--edge-signal` | `:root`（不引用令牌） | `#fff500` ✅ |
| `--edge-line` / `--edge-paper` | `:root`（引用 `--dsw-*`） | `""` 空 ❌ |
| 同上 | `body` | `#d8d9d5` / `#e8e8e2` ✅ |

这个 bug 的真实表现是：`scrollbar-color: var(--edge-line) transparent` 中变量为空 → 整条声明被丢弃 → 滚动条主题静默无效。

### 2.3 DOM 锚点：主题实际选择器清单

由于官方组件用 **CSS Modules（类名 hash 化）**，主题不能依赖具体类名，实际使用的是三类锚点：

**(a) 官方语义属性（稳定）**

从 10 款 EAC 皮肤 + denia + endfield 的实际用法中汇总的**完整稳定锚点清单**——这是自研主题应当优先使用的：

| 锚点 | 含义 | 归属 |
|---|---|---|
| `body[data-ds-dark-theme]` | 暗色模式开关（**由 presenter 从 `active.colorScheme` 设置，不是从 id 判断**） | ui-layout |
| `[id=root]` | React 挂载根；皮肤通常把它背景置为 `background:0 0` 让 body 背景透出 | app |
| `[data-slot='…']` | 插槽渲染出口（`dsh-client-ui-renderer` 写 `"data-slot": slotKey`） | renderer |
| `[data-chat-flow-kind]` | 聊天流节点类型（**`assistant-step` = AI 输出**） | ui-chat |
| `[data-chat-flow]` | 聊天流容器 | ui-chat |
| `[data-conversation-scroll]` | 对话滚动容器 | ui-conversation |
| `[data-phase]` | `hero` \| `active` —— 会话阶段 | ui-conversation |
| `[data-composer-seat]` | 输入区座位 | ui-conversation |
| `[data-composer-card]` | 输入卡片根 | ui-conversation |
| `[data-input-mirror]` | composer 文本镜像（控制高度/过渡） | ui-conversation |
| `[data-pane]` | `sidebar` / `conversation` / `details`（**本内核不存在，见下**） | 其它 shell |
| `[data-terminal]` | 终端表面（xterm 需具体色值，必须本地重设令牌） | ui-cordis |
| `[data-question-key]` | ask_user 问题块 | ui-user-questions |
| `[data-state='running']` | 运行中状态（配 `[data-variant=think]` 做思考动效） | tool cards |
| `[data-gitgraph-lanes]` / `-glyph`(`node`\|`merge`) / `-chip` / `-ref` / `-ref-current` / `-dialog` / `-current-branch` | Git 图 | git plugin |
| `role=button\|tab\|tablist\|menu\|menuitem\|option\|link\|treeitem\|checkbox\|switch\|radio\|combobox\|dialog\|tooltip\|listbox` | ARIA 角色（**最稳的一类**，maid-atelier 的工作区树就只锚 `[role='tree']` / `[role='treeitem']`） | 各处 |
| `aria-checked` / `-expanded` / `-selected` / `-current` / `-disabled` / `-haspopup` | ARIA 状态 | 各处 |
| `data-testid` | 测试钩子（顺带可用） | 各处 |

> **上游还规划了一层显式语义属性** —— `data-dsh-surface` / `data-dsh-part` / `data-dsh-plugin`（8 个 surface + 71 个 part + 14 个 plugin 的枚举，归属 skin-center，见其 `contracts/semantic-attrs-v1.md`）。**但 EAC 内置的 10 款皮肤早于这一层，全部不使用它**（grep 结果为零）。自研时可以主动采用 —— 它是**唯一为"主题锚点"而设计的属性层**，未来上游主题都会迁到那里。

**(b) 类名片段匹配（脆弱但可用）**

denia 用 `[class*='_centerCol']`、`[class*='_viewArea']`、`[class*='_composerSeat']`、`[class*='detailsCol']`、`[class*='sidebarCol']` 定位三栏布局 —— 这是匹配 CSS Modules 生成类名中的原始名片段。

#### 🔴 实测警告：hash 精确匹配的选择器在 DSH 2.0.5 上已经全部失效

endfield 里有大量**精确 hash 前缀**选择器（`.wSkVaW_root`、`.pXSMma_root`、`.uV2eYG_add/_primary`、`.zGbnIq_secondaryButton`、`.Md3f7G_turnStatus`、`.YDXeBa_projectRow`、`.qDHVXG_*`、`.JObwrW_colorMessages`、`.gNWCoW_inspectButton`、`.SVAs4q_label` …）。核对本机 `dsh-desktop 2.0.5` 后确认：**这些 hash 一个都不存在了**，当前 hash 已变成 `uPhUma_composerHero`、`V0s2hW_turnStatus`、`Q7WfXG_add`、`JdJrwG_headline`、`WXmFEW_root` 等。

**后果实测**（该主题自身功能静默失效）：

| 失效项 | 原因 |
|---|---|
| 水印整块消失（默认设置下） | `findConversationRoot()` / `isHeroVisible()` 返回 `null` |
| 回合状态文字重着色、composer 发送按钮修正、工作区行强调、预设 chip、hero 光晕修正 | 对应 hash 规则全部 inert |
| **等高线背景仍正常** | `findAppFrame()` 用的是**后缀匹配** `[class$='_centerCol']` → 依然命中 |

**结论（自研时必须遵守）**：
- ✅ **优先用**：官方语义属性（`data-*`、`data-slot`）、**后缀匹配** `[class$='_centerCol']`、`[class$='_iconButton']`、**根无关包含匹配** `[class*='turnStatus']`（但要 `:not([class*='turnStatusClock'])` 排除同类干扰）、以及结构推导（`col.parentElement`）。
- ❌ **绝不用**：`[class^='XxxxYy_']`、`.XxxxYy_root` 这类把 hash 写死的形式 —— 它们**跨 DSH 小版本必坏，且不会报错，只会静默失效**。
- ⚠️ `[class$='…']` 也有陷阱：元素若带**第二个类名**，后缀匹配会静默失配（endfield 的 `_arrow` 后缀就因此制造过新 bug）。

**含义**：任何依赖类名的主题都必须**声明兼容版本区间**（denia 的 `dsh.client.version: "0.1.0-rc.6 - 0.1.1-rc.2"` + README 写"最近验证日期"就是为此），并为每个类名依赖准备"命中失败时不炸、只是不装饰"的降级路径。

**(c) 主题自建标记（最稳）**

denia 注入的所有装饰元素都带 `data-skin-owner="denia"` + `data-skin-chrome="..."`，卸载时按这两个属性统一回收。这是**必须照抄的模式**（见 §6.4）。

### 2.4 插槽体系：注册设置界面

官方 `dsh-client-ui-settings` 声明的槽位类型：

| 槽位 | 用途 |
|---|---|
| `settings.trigger` / `settings.header` / `settings.close` | 设置面板外壳 |
| `settings.action` | 有序的头部动作 |
| **`settings.section`** | **每个功能一个设置页 —— 主题用这个** |
| `settings.plugins.tab` | 插件区标签页 |
| `settings.onboarding` | 引导步骤 |

**三种实际注册写法**（按现代程度排序）：

```js
// ① 官方推荐：slots.inject + register（endfield client.js:4197 / EAC dsh-font-custom:471）
const slots = ctx.get('slots')
slots.inject('settings.section', () =>
  slots.register(
    { name: 'settings.section', id: 'dsh-theme-endfield', order: 35, label: () => t('section') },
    EndfieldSection
  )
)

// ② StyleVault 写法（本机已装，可直接参考）
ctx.slots.inject("settings.section", () =>
  ctx.slots.register(
    { name: "settings.section", id: "stylevault", order: 35, label: () => "StyleVault" },
    StyleVaultSection
  )
)

// ③ denia 的选择：完全绕过插槽，自己在右下角画一个折叠面板（🎨）
```

> `slots.inject(name, cb)` 的语义是「等该槽位被声明后再注册」，比直接 `register` 更健壮 —— 主题插件可能先于 settings 外壳挂载。

### 2.5 主题自己能被选择的通道

除了自建设置页，官方还提供**注册成可选主题**（用户能在 设置→外观 里切到它）：

```js
ctx.theme.register({ id: 'denia', colorScheme: 'dark', tokens: { /* --dsw-alias-* */ } })
```

| 方法 | 语义 |
|---|---|
| `theme.register({id, colorScheme, tokens})` | 注册一个可选主题，返回 disposer。**重复 id 抛错**。`dispose` 掉当前激活主题会把偏好重置回默认 |
| `theme.overrideTokens(source, {token: {light, dark}})` | **在激活主题之上叠一层令牌覆盖**，不污染注册表。同 source 再次调用会**替换**该整层。返回 disposer |
| `theme.setTheme(id)` / `theme.getTheme()` | 写偏好 / 读不可变快照 |
| `theme.setFontSize(px)` | 12–17 整数 px |
| `'theme/change'` 事件 | 快照变化（用户切换 / 注册表变更 / 系统配色变化） |

**`overrideTokens` 的强制契约**：每个令牌值必须是 `{light, dark}` **双值对象**，不能是裸字符串（会抛教学性错误）。原因：避免用户切到另一种模式时覆盖值变得不可读。

### 2.6 ⚠️ 两条正在并行的技术路线：v1 皮肤 vs v2 主题中心

调研中发现的关键战略信息：**社区里存在两代互不兼容的主题架构**，且方向正在切换。

| | **v1（当前主流，三个调研对象都是）** | **v2（上游 skin-center，DSH 尚未内置）** |
|---|---|---|
| 形态 | 完整 dsh Client 插件（`lib/client.js`） | **纯资源目录** |
| 组成 | `package.json` + `lib/*.js` + `skin.json` | `skin.json` + `skin.css` + 可选 `patches.css` + 可选 `hooks.mjs` + `assets/` + `preview/` |
| CSS 作用域 | 自己写 `body[data-dsh-<id>]` | **loader 用 lightningcss 强制包在 `html[data-dsh-skin="<id>"]` 下** |
| 校验 | 无（`skin.json` 无 schema、无验证） | **fail-closed 校验**：未知字段是硬错误；`skin.json` v1 的 `package`/`wiring`/`bodyAttr` 是显式弃用白名单（忽略 + 迁移警告） |
| CSS 白名单 | 无 | 禁 `@import`、禁远程/协议相对 URL、禁路径逃逸、禁内联 JS；**`[class*=...]` 用法会告警** |
| 令牌覆盖 | 手写 | `official-tokens-v1.json` + 未覆盖令牌的 `color-mix()` 派生回退 |
| 切换方式 | 重写 `cordis.patch.yml` + **重启** | `$DSH_HOME/skin-center-active.json` + `POST /api/skin-center/v2/active`，**客户端原子切换、不重启** |
| 用户自定义壁纸 | 无 | ✅ Wallpaper Engine 桥（Steam app 431960 / `libraryfolders.vdf` / `appmanifest_431960.acf`；视频→`<video>`，web→沙箱 `iframe`，scene→内置 WebGL 播放器） |
| 自定义主题编辑器 | 无 | ✅ 但**只生成审计过的令牌白名单的固定声明**（`CUSTOM_THEME_ALLOWED_TOKENS`）—— 无选择器、无 URL、无自由 CSS |

**对自研的实践含义**：

1. **现在做 v1**（能立刻在 DSH Desktop 上跑），但**把令牌层与选择器层分开组织**——v2 的 `skin.css`（L1 令牌重映射 + L2 语义选择器）与 `patches.css`（L3 任意选择器，高风险）这个分层很值得照抄到自己的文件结构里，将来迁移成本最低。
2. **v2 的校验清单就是一份免费的最佳实践检查表**：先自己守这些规矩（未知字段报错、不用 `[class*=]`、不用 `@import`、不写自由 CSS），迁移时零改动。
3. **`patches.css` 被单列为 L3 高风险**——与本报告 §2.3 的实测结论完全一致：**基于 CSS Module hash 的选择器是这套体系里最脆的一环。**

---

## 3. 美学（配色设计）

### 3.1 denia —— 角色驱动的情感化配色

**主题母题**：鸣潮·达妮娅「虚无之泡」。泡泡 + 锁链 + 星星，粉/冰蓝/紫构成"虚质少女"调色板。

自带令牌（`--denia-*`，与 `--dsw-*` 并存）：

```css
--denia-pink:#E8A5BF;      --denia-rose:#D4859E;
--denia-ice-blue:#A0C4E8;  --denia-purple:#9B6BD8;  --denia-violet:#7B4DBE;
--denia-red:#E0554D;       --denia-porcelain:#F8F2F5; --denia-gold:#C5A468;
--denia-ink:#2D1B4E;
--denia-glass:rgba(248,240,245,0.45);
--denia-shadow:0 18px 54px rgba(45,27,78,0.12),0 2px 8px rgba(45,27,78,0.08);
```

**双形态设计**（不是简单明暗，而是**叙事化的两种状态**）：

| 形态 | 名称 | 底色 | 文字 | 立绘 |
|---|---|---|---|---|
| 亮 | 布景之形 | `#F5EAF6` 渐变 | `#5D3A8E` | 慵懒校园氛围 |
| 暗 | 幻灭之形 | `#0D0820` → `#1F1230` | `#F5D5E8` | 虚质星空 |

**手法清单**：
- **玻璃卡片**：`[id=root]` 上 `backdrop-filter: blur(5px)` + 半透明渐变 + 内描边高光 `inset 0 1px rgba(255,255,255,0.6)`。
- **Scrim 可读性层**：背景图上叠一层 `linear-gradient` 半透明遮罩（亮 `rgba(245,234,246,·)` / 暗 `rgba(13,8,32,·)`），透明度随用户「背景透明度」滑块**动态反算**，保证文字始终可读。
- **形态切换动画**：亮→暗 4000 ms（`erupt`），暗→亮 5000 ms（`awaken`），切换期间插一层全屏 overlay，用 MutationObserver 延迟实际 theme swap 到动画峰值。
- **渐变文字**：工作区/会话标题粉紫渐变。
- **自适应淡出**：DevTools 打开检测（对比 `outerWidth/outerHeight` 与 `innerWidth/innerHeight`）+ 详情面板打开时，立绘/吉祥物淡出到 `opacity:0.2`。

**对比 denia 的规模**：内置 20+ 个可调参数（内容宽度 500–1000px、立绘高度 30–80vh、气泡数 5–40、速度 30–200% 等）。

### 3.2 endfield —— 可量化的工业编辑风（**最值得学习的一篇**）

`docs/design-language.md` 是一份 212 行的完整设计规范，核心三条规则：

> 1. **纸与墨是主体，强调色是信号** —— 强调色只用于"需要被看见的那一处"，不铺面。
> 2. **全直角** —— 圆角把界面推向"柔和产品"，直角推向"技术文档/工程图纸"。
> 3. **数字等宽** —— 开 `tnum`，避免表格数字跳动时横向抖动。

**中性色（纸/墨/线）**：

| 角色 | 令牌 | 亮色 | 暗色 |
|---|---|---|---|
| 纸底 | `--dsw-alias-bg-base` | `#e8e8e2` | `#101110` |
| 面板/气泡 | `--dsw-alias-bg-layer-1` | `#f2f2ec` | `#181a18` |
| 沉底块 | `--dsw-alias-bg-layer-2` | `#dcddd6` | `#1e201d` |
| 浮层 | `--dsw-alias-bg-overlay` | `#f2f2ec` | `#1c1e1c` |
| 细线 | `--dsw-alias-border-l1` | `#d8d9d5` | `#343633` |
| 重线 | `--dsw-alias-border-l2` | `#b6b8b3` | `#4a4d49` |
| 正文 | `--dsw-alias-label-primary` | `#101110` | `#f5f5f0` |
| 次要文字 | `--dsw-alias-label-secondary` | `#4a4c48` | `#898d89` |

> 亮色不用纯白、暗色不用纯黑：`#e8e8e2` 带暖灰是"纸"而非"屏幕"；`#101110` 留一点绿倾向避免死黑。

**强调色两套 + 派生体系**（关键工程贡献）：

| 变量 | 谷地黄（默认） | 武陵青 | 用途 |
|---|---|---|---|
| `--edge-accent` | `#fff500` | `#14d0d0` | 实心底、图标、焦点环、光标 |
| `--edge-accent-rgb` | `255,245,0` | `20,208,208` | 约 30 处 `rgba(var(--edge-accent-rgb), α)` |
| `--edge-accent-deep` | `#e8e000` | `#10b8b8` | 悬停/按下加深 |
| `--edge-accent-onpaper` | `#d9c700` | `#14d0d0` | 亮色下唯一需要"压纸填充"的槽位 |
| `--edge-status-light` | `#6b5d00` | `#006a6a` | 亮色回合状态文字 |
| `--edge-status-light-mid` | `#3f3600` | `#003f3f` | 亮色流光亮带 |
| `--edge-status-dark` | `#fff500` | `#14d0d0` | 暗色回合状态文字 |
| `--edge-status-dark-mid` | `#a08a00` | `#7ee7e7` | 暗色流光亮带 |

**最重要的美学方法论：颜色是量出来的，不是挑出来的。**

- 亮色模式下 `#fff500` 压在纸底上只有 **1.07:1**（面板上 1.02:1）—— 不是"配色选择"而是"一次抹除"。所以亮色下"强调色作为文字"的槽位全部换成同色相**深色档**：谷地黄 → `#6b5d00`（5.35:1），武陵青 → `#006a6a`（5.22:1）。
- 暗色方向相反：底近黑，强调色本身够亮，直接用原色。
- 武陵青初版 `#0daaaa` 相对亮度仅 31.7%（不到谷地黄 86.6% 的四成），提到 `#14d0d0` = 49.8%；上界 `#16dcdc` 时亮色下与纸底只剩 1.39:1 开始"融进纸里"。**`#14d0d0` 是两种模式下都站得住的最亮一档** —— 这两条边界被写成断言（亮度下限 45%、上限 56%、必须留在青碧色轴）。
- 亮带方向两个配色**相反**：谷地黄**压暗**（向上已到顶），武陵青**提亮**（向下的余量不足，更深的青只有 3.54:1 不达标）。同一条 AA 4.5:1 规则导出两个相反方向 —— 这是"不能照抄"的典型。

**对比度规则（27 项断言，构建失败即拦截）**：

| 角色 | 谷地黄 | 武陵青 | 门槛 |
|---|---|---|---|
| 实心强调底 + 墨色字 | 16.50:1 | 9.88:1 | AA 4.5 |
| 悬停加深底 + 墨色字 | 13.60:1 | 7.72:1 | AA 4.5 |
| 暗色图标/链接 | 15.26:1 | 9.14:1 | ≥3 |
| 回合状态·亮色主色 | 5.35:1 | 5.22:1 | AA 4.5 |
| 回合状态·暗色亮带 | 5.11:1 | 12.06:1 | AA 4.5 |

**三条附加规则**：
- 渐变文字要对 `bg-base` 与 `bg-layer-1` **两种底色都达标**（亮带会扫过字形；`prefers-reduced-motion` 下上游把 `background-size` 钉成 100%，亮带**永久留在字里**）。
- **装饰性表面另用一套标准**：前景守 AA 4.5:1；装饰（水印、等高线）守"不抢眼但可见"区间（约 **1.06 ～ 1.6:1**）。低于 1.06:1 形同不存在。
- hero 光晕只许更轻不许更响（单侧判据）。

**令牌映射的"清品牌残色"**（§design-language 五）：DSH 自带 DeepSeek 品牌蓝，必须整组重映射，否则纸墨界面里会留零散蓝点：

| 令牌组 | 处理 |
|---|---|
| `--dsw-static-deepseek-50…900` | 整组换成中性灰阶 |
| `--dsw-static-deepseek-450` | 亮→`--edge-accent-onpaper`，暗→`--edge-accent` |
| `--dsw-static-deepseek-500/600` | → 墨/纸色（**不可动**，见下） |
| `--dsw-alias-button-info-fill` | 亮→墨黑，暗→强调色 |
| `--dsw-alias-state-business-primary` | 同上 |
| `--dsw-specific-sidebar-nav-item-active-accent` | 同上 |
| `--dsw-alias-label-primary-bluish` | → 正文色 |
| `--dsw-specific-bubble` / `-highlight` | → 面板 / 沉底块 |

> ⚠️ `--dsw-static-deepseek-500/200` 是**共享令牌**，同时支撑 `button-info-fill`、`state-business-primary` 与 `bubble-highlight`。改回合状态标签颜色时**不能动它们**，只能覆盖那条规则自己的 `background-image`。

**直角化的实现（先清零再恢复该圆的）**：

```css
body:not(.theme-endfield-round) [class] { border-radius: 0 !important; }
body:not(.theme-endfield-round) [class*='avatar'],
body:not(.theme-endfield-round) [class*='spinner'],
body:not(.theme-endfield-round) [class*='dot'],
body:not(.theme-endfield-round) [class$='_iconButton'] { border-radius: 50% !important; }
```

用 `[class]` 而非 `*`（避免命中无类名的结构性节点）；用 `body:not(.theme-endfield-round)` 前缀让"圆角开关"只是 `<body>` 加/减一个 class —— **无需重新注册样式表**。

**配色切换 = 一个 class 切换**（关键技巧）：整份样式表所有强调色读**调色板变量**，而 `--dsw-alias-brand-primary` 的暗色值被声明为 `var(--edge-accent)`。因为令牌是 `<body>` 行内样式、调色板变量也在 `<body>` 上，**引用在同一元素解析**，class 翻转即自动重解析 —— 不重新注册令牌层、不重算样式、无 JS 重绘。唯一需要 JS 的是 canvas 等高线（canvas 描边不能是 CSS 变量），由一个监听 `<body>` class 的 MutationObserver 触发重绘。

**验证到像素**：`test/verify-shots.js` 解码真实截图统计配色像素占比：

| 截图 | 黄色像素 | 青色像素 |
|---|---|---|
| 谷地黄·亮色 | **5.47%** | 0.44% |
| 武陵青·亮色 | 0.39% | **6.51%** |
| 谷地黄·暗色 | **2.51%** | 0.42% |
| 武陵青·暗色 | 0.34% | **5.40%** |

约 93% 中性像素在两版之间不变 —— 证明切换只动强调色。

### 3.3 endfield 的装饰层挂载技术（可直接复用的手法）

**(a) 装饰文字用 CSS `content`，不放 DOM 文本节点**

水印与加载屏的所有文字都由 CSS 生成，DOM 里没有文本节点：

```css
[data-endfield-watermark]::before { content: 'ENDFIELD'; display: block; white-space: nowrap; }
```

加载屏同理：`content:'END'` / `content:'FIELD'` / `content:'DEEPSEEK HARNESS'` / `content:'TERRA RESEARCH COMMISSION / BOOT SEQUENCE'` 等。**好处**：不进入无障碍树、不被翻译插件改写、不参与文本选择。配套还要显式声明：

```js
el.setAttribute('translate', 'no'); el.className = 'notranslate';
el.setAttribute('lang', 'en'); el.setAttribute('aria-hidden', 'true');
```

**其它零资源的图形手法**：
- 网格底纹：两层 `repeating-linear-gradient`。
- 箭头/尖角：不用 SVG，用 `border-left` + `border-bottom` + `rotate(-45deg)` 画在两个伪元素上。
- 6×2 方块阵列：一组 `<i data-on>` 元素。
- 等高线：canvas 运行时生成（见 §4.3）。

**(b) 挂进"外框内部"而不是 body —— 绕开三处不透明底色**

§7#26 提到应用外框、对话列、详情列会用不透明 `--dsw-alias-bg-base` 盖住 body 级图层。endfield 的解法是把装饰层挂进**外框内部**，并在挂载期间把这几处底色置为透明：

```css
/* :has() 守卫使功能关闭时所有规则自动失效 —— 不需要 JS 增删规则 */
[class*='_frame']:has(> [data-endfield-contour]) { background: transparent !important; }
[class*='_frame']:has(> [data-endfield-contour]) [class$='_composerSeat'] {
  background: linear-gradient(180deg, rgba(0,0,0,0) 0px,
    color-mix(in srgb, var(--dsw-alias-bg-base) 82%, transparent) 36px) !important;
}
```

外框本身是 `position:relative; z-index:auto`（**不产生层叠上下文**），所以 `inset:0; z-index:0` 的子元素正好落在"外框底色之上、所有定位子元素之下"。

**注意**：侧栏底色也一并透明是无害的，因为该主题里 `--dsw-specific-sidebar-fill` 与 `--dsw-alias-bg-base` 本就是同一个值 —— **但这条依赖必须在设计文档里写明**，否则改侧栏色会连带破坏连续性。

**(c) `:has()` 守卫模式很值得抄**

用 `parent:has(> [data-my-layer])` 代替"挂载时加 class、卸载时删 class"：
- 规则始终存在于样式表里，但只在图层存在时生效；
- 卸载只需移除节点，**不需要同步撤销一串 CSS**；
- 崩溃/异常导致的状态不一致面更小。

**maid-atelier 把这个模式用到了极致 —— 模态框出现时隐藏整套皮肤 chrome**：

```css
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) [data-composer-card],
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) [data-skin-chrome=sidebar-corners],
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) [data-skin-chrome=top-trim],
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) [data-skin-chrome=bottom-trim],
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) pre,
body[data-dsh-maid-atelier]:has([class*=VOzbGW_overlay]) [data-terminal] {
  visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
}
```

**为什么必须这么做**：设置模态框是 `z-index:1000`。EAC 有一条**强制测试**（`test/skin-chrome-zindex.test.ts`）——*"while a conversation is open, the Settings modal was covered by the top and bottom bars … every `z-index` in a skin's stylesheet must be less than 1000"*。它遍历每款皮肤 `lib/client.js` 里所有 `z-index: N`，断言 `N < 1000`，只对**模态层自身**的规则放行（maid-atelier 有意把 `.VOzbGW_overlay` 抬到 4000，让设置弹窗盖过所有皮肤 chrome）。

**两条正确姿势**：要么把所有装饰层压在 1000 以下；要么在模态打开时用 `:has()` 整层隐藏。**不要靠"调高 z-index"去抢层级**（见 §7#24）。

**(d) 无障碍（endfield 实测的三处 + 两条属性）**

| 处理 | 实现 |
|---|---|
| 装饰层不进无障碍树 | `aria-hidden="true"`（水印、加载屏、雷霆大字） |
| 装饰层不拦点击 | `pointer-events: none !important`（水印） |
| 动效可关 | `prefers-reduced-motion` 抑制**三处**：等高线形变（`contourWantsAnim`）、雷霆入场（`thunderWantsAnim`）、加载屏收尾（`finish()` 直接移除整块） |
| **关闭时不让用户以为坏了** | 设置页显式提示"系统已启用减少动效"（`contourAnimHintReduced` / `thunderAnimHintReduced`），而不是让开关看起来失效 |

> 最后一条是很容易被忽略的产品细节：**当系统级设置压过你的开关时，UI 必须解释原因**，否则用户会认为主题有 bug。


10 款皮肤，每款一个 `skin.json` 主题元数据卡：

| id | 名称 | accent | 母题 |
|---|---|---|---|
| `xp` | Windows XP | — | 复古拟物 |
| `minecraft` | 我的世界 | — | 像素方块 |
| `qq98` | QQ 1998 | — | 千禧年拟物 |
| `ths` | 同花顺 | — | 金融终端 |
| `trading` | 交易 | — | 数据密集 |
| `blue-fantasy` | 碧蓝幻想 | — | 日式幻想 |
| `dragon-heir` | 龙裔 | — | 东方玄幻 |
| `whale-song` | 鲸歌 | — | 深海 |
| `miku` | 初音未来·电子歌姬 | `#2e9bff` | 蓝紫洋红渐变、音符声波、01 编号徽标 |
| `maid-atelier` | 深海女仆工坊 | `#c5a468` | 双女仆背景、深海蓝蕾丝、长春花蓝 + 柔金 |

**`skin.json` 是事实上的皮肤元数据 schema**（无 JSON Schema 文件，由 `dsh-skin-switch` 读取字段定义）：

> ⚠️ **重要澄清**：`skin.json` **不是 DSH 内核格式**。DSH 内核（Cordis / web client）从不读它；只有 EAC 的 `dsh-skin-switch` 与上游 dsh-web-ui 的皮肤中心读它。**一个皮肤不提供 `skin.json` 也能正常工作** —— 它纯属"皮肤市场的元数据卡"。仓库里也没有任何 JSON Schema 文件，契约完全由读取方代码定义。

```jsonc
{
  "id": "miku",                          // 皮肤短 id
  "name": "初音未来 · 电子歌姬",
  "nameEn": "Hatsune Miku",
  "author": "涂山苏苏",
  "tagline": "蓝紫双马尾 · 01 编号 · 音符波形 · 电子歌姬主题",
  "description": "…长描述，用于设置页卡片…",
  "tags": ["miku", "vocaloid", "blue", "music", "idol", "waveform"],
  "accent": "#2e9bff",                   // 设置页卡片强调色条
  "bodyAttr": "data-dsh-miku",           // 皮肤为 <body> 加的激活属性
  "package": "@linxin666/dsh-client-ui-skin-miku",
  "wiring": { "id": "ui-skin-miku", "bundleWired": false },  // ← 关键：patch 行 id
  "preview": { "light": "…/light.png", "dark": "…/dark.png" },
  "order": 9                             // 设置页排序
}
```

**发现契约**（`dsh-skin-switch/lib/index.js:88`）：皮肤包必须位于 `<profile>/node_modules/@linxin666/<pkg>` 或 `<profile>/node_modules/@dsh-external/<pkg>`，且：
- `package.json` 存在且 `dsh.client.platform === "web"`
- `skin.json` 存在且 `wiring.id` 匹配 `/^ui-skin-[\w-]+$/`

### 3.4 三套美学的对比总结

| | denia | endfield | EAC 皮肤 |
|---|---|---|---|
| 美学类型 | 角色情感化（动漫） | 编辑工业风（克制的量化工设） | 多样（怀旧/游戏/拟物） |
| 是否量化对比度 | 否 | **是，27 项断言** | 未知 |
| 亮暗是否对称 | 否（两种叙事形态） | 否（**方向相反**，有文档论证） | 通常对称 |
| 主色数量 | 9 个 `--denia-*` + 30 个 `--dsw-*` | 8 个派生变量 × 2 套配色 + ~40 个 `--dsw-*` | 依皮肤 |
| 强调色策略 | 粉/紫渐变铺开 | **只做信号，不铺面** | 依皮肤 |
| 装饰手段 | 立绘/GIF/泡泡粒子/锁链/四角星 | canvas 等高线/水印/启动动画 | 背景图为主 |
| 可学性 | 装饰与图层手法的样板 | **方法论与工程严谨性的样板** | 元数据与分发体系的样板 |

---

## 4. 静态资源（图片/字体/背景）

三个项目用了**三种完全不同的策略**，各有取舍。

### 4.1 策略 A：base64 内联进 JS（denia 与 EAC 皮肤）

denia `lib/client.js` 开头就是 7 个大常量，直接把 webp/gif 编码为 data URI：

```js
var DENIA_PALACE_LIGHT    = "data:image/webp;base64,UklGRv4XAwB…";  // 背景图（亮）
var DENIA_PALACE_DARK     = "data:image/webp;base64,UklGRkSyAQB…";  // 背景图（暗）
var DENIA_CHARACTER_LEFT  = "data:image/webp;base64,UklGRg5XAwB…";  // 左立绘
var DENIA_CHARACTER_RIGHT = "data:image/webp;base64,UklGRoiOAgB…";  // 右立绘
var DENIA_CHIBI           = "data:image/gif;base64,R0lGODlhLAEsAdU/APW1zWhYW…";  // Q版动态
var DENIA_CHARACTER_LEFT_DARK  = "data:image/webp;base64,…";
var DENIA_CHARACTER_RIGHT_DARK = "data:image/webp;base64,…";
var DENIA_CHIBI_DARK           = "data:image/gif;base64,…";
```

**SVG 装饰则用运行时 `btoa` 编码**（更省体积、可读、可参数化）：

```js
/** Encode SVG markup as a data:image/svg+xml;base64 URI. */
var svgB64 = function(markup) { return "data:image/svg+xml;base64," + btoa(markup); };
var DENIA_ICON         = svgB64('<svg viewBox="0 0 32 32">…渐变泡泡 + Tacet 十字星…</svg>');
var DENIA_BUBBLE_SWAG  = svgB64('…侧栏底部装饰条…');
var DENIA_STAR_CORNER  = svgB64('…四角星…');
var DENIA_CHAIN_LIGHT  = svgB64('…锁链边框（亮）…');
var DENIA_CHAIN_DARK   = svgB64('…锁链边框（暗）…');
```

代码里有一条注释解释了为什么必须 base64：**"SVG DECORATION ASSETS (base64-encoded for CSS `url()` reliability)"** —— 在 `url()` 里直接放含 `#`、`<`、`>` 的裸 SVG data URI 容易解析失败，base64 最稳。

| 优点 | 缺点 |
|---|---|
| 单文件、无路径解析问题、无 CSP 风险、无相对路径基准歧义 | JS 体积爆炸（maid-atelier 的 `client.js` **2.7 MB**） |
| 桌面端（Electron/Tauri）与 web 端行为完全一致 | 无法按需懒加载；首屏解析成本 |
| 无网络请求 | 修改一个图要重编码整个文件 |

**这是社区皮肤的主流做法**，也正是 EAC 皮肤 `lib/client.js` 动辄 1–3 MB 的原因。

### 4.2 策略 B：用户上传 → Host 路由 → profile 文件（denia 调色板）

这是**唯一真正完整的"用户自定义背景图"实现**，分三段：

**(1) Host 半边注册独立 HTTP 路由**（`lib/index.js`）：

```js
const SETTINGS_ROUTE = "/api/dsh-denia/palette-settings";
const SETTINGS_DIR  = "dsh-client-ui-skin-denia";
const SETTINGS_FILE = "palette-settings.json";
const MAX_BODY_BYTES       = 15 * 1024 * 1024;   // 请求体上限
const MAX_BACKGROUND_BYTES =  7 * 1024 * 1024;   // 单张背景图上限

function profileDir() {
    return join(process.env.DSH_HOME || join(homedir(), ".dsh"), "profiles", profileName());
}
function settingsPath() {
    return join(profileDir(), "data", SETTINGS_DIR, SETTINGS_FILE);
}
function isLoopback(req) {          // ← 安全门：只允许本机
    const a = req.socket && req.socket.remoteAddress;
    return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}
function isBackground(value) {      // ← 只接受白名单 MIME 的 data URI
    if (value === null) return true;
    return typeof value === "string"
        && /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)
        && Buffer.byteLength(value, "utf8") <= MAX_BACKGROUND_BYTES;
}
function apply(ctx) {
    return ctx.webServer.register({ kind: "exact", path: SETTINGS_ROUTE, handler: handleSettingsRoute });
}
export { apply, inject, name };
// inject = ["webServer"]
```

**(2) 写入用原子替换**（避免断电/崩溃写坏文件）：

```js
const temporary = path + ".tmp";
writeFileSync(temporary, JSON.stringify(clean), "utf8");
try { renameSync(temporary, path); }
catch { rmSync(path, { force: true }); renameSync(temporary, path); }
```

**(3) 严格白名单校验**（`sanitizeSettings`）—— 布尔键白名单 + 每个数值键的 `[min, max]` 区间表 + 背景图 data-URI 白名单。任何越界值**直接丢弃而不是钳制**：

```js
const NUMBER_RANGES = {
    contentWidth: [500, 1000], charHeight: [30, 80], charOffsetX: [-50, 50],
    chibiSize: [60, 240], chibiOffsetY: [-420, 300], bgOpacity: [20, 100],
    msgOpacity: [20, 100], bubbleCount: [5, 40], bubbleSpeed: [30, 200]
};
```

**Client 侧**用 `PALETTE_SETTINGS_URL = "/api/dsh-denia/palette-settings"` 做 `GET`/`PUT`。

> denia 在 v0.0.5 的更新日志里明确说明：设置改为保存到 **DSH profile 的皮肤专属文件**，"不再依赖浏览器 origin" —— 这正是下面 §6.3 要讲的随机端口问题的另一种解法。

### 4.3 策略 C：完全不带资源（endfield）

endfield **零二进制资源**：背景是 **canvas 实时绘制的等高线**，水印是 CSS 文字/伪元素，加载动画是 CSS。所有视觉都是**算法生成的**。

| 优点 | 缺点 |
|---|---|
| 仓库 904 KB（对比 denia 2.5 MB / maid-atelier 数 MB） | 需要写生成算法（400+ 行 canvas 代码） |
| 无版权风险 | 表现力受限于算法 |
| 任意分辨率无损、可动态（FPS/速度可调） | canvas 描边不能读 CSS 变量 → 必须 MutationObserver 重绘 |

### 4.4 字体

两条路线：

- **StyleVault（本机已装）**：运行时注入 `<link rel="stylesheet">` 拉 Google Fonts / Fontsource，内置 `WEB_FONT_CATALOG` + `FONT_PRESETS`，并且**镜像 URL 回退**：

  ```js
  function injectStylesheet(href, id) { … link.rel = "stylesheet"; link.href = href; … }
  function googleCssUrl(googleFamilies) { … }
  function googleMirrorCssUrl(googleFamilies) { … }   // 国内可达镜像
  function fontsourceCssUrl(pkg) { … }
  ```

  注释里有一条踩坑记录：*"Do not set crossOrigin on stylesheet links — Google Fonts CSS is not always CORS-enabled for rule inspection, and it can break loading."*

- **EAC `dsh-font-custom`**：设置页直接改字体家族/字号/文字色与代码色。

  它注入的规则是（`lib/client.js:101`）：

  ```js
  if (cfg.codeFont) css += ":root{--ds-font-family-code:" + cfg.codeFont + ";--dsw-alias-font-mono:" + cfg.codeFont + "}";
  ```

  > ⚠️ **`--dsw-alias-font-mono` 在官方令牌表里并不存在**。本机 `@deepseek-ai/dsh-client-ui-*` 全部包中与字体家族相关的只有 `--dsw-font-family` 与 `--dsw-font-mono`（`--dsw-alias-font-*` 前缀零命中）。所以这半条声明是**静默 no-op** —— 一个真实存在于社区代码里的"写了不存在的令牌"案例。真正生效的是 `--ds-font-family-code`（见下方 `--ds-*` 层）。**这就是为什么必须核对官方令牌表，而不是照抄别人的主题。**

- **`--ds-*` 补充层**：除了 `--dsw-*`，还有一层更底层的 `--ds-*`（全部官方包中仅 5 项），Markdown 与代码块直接读它：

  ```
  --ds-font-family-code           # 代码字体家族（MarkdownText/CodeBlock 都读它）
  --ds-transition-duration  --ds-transition-duration-fast  --ds-transition-duration-slow
  --ds-ease-in-out
  ```

  例：`MarkdownText.module.css` 里 `font-family: var(--ds-font-family-code)`、`pre { font-family: var(--ds-font-family-code) }`；链接过渡用 `var(--ds-transition-duration) var(--ds-ease-in-out)`。**主题要改代码字体或全局过渡节奏，改这一层。**

- **令牌旁路**：排版可完全走 `--dsw-font-*`（约 180 项，见 §5.1），无需注入字体文件。

### 4.5 预览图与版权

- 预览图**不入 bundle 内联**，作为普通文件放 `preview/light.webp`、`preview/dark.webp`（denia 96 行的 `skin.json` 只存路径）。
- EAC 由 Host 提供**静态路由**：`GET /api/dsh-skins/preview/<id>/light|dark`（`kind: 'prefix'`）返回包内预览图字节。
- **版权处理是硬要求**，三个项目都做了：
  - denia：`CC BY-NC-SA 4.0`（**禁止商业使用**）+ `NOTICE` 记录完整署名链，README 声明"同人创作，与 Kuro Games 无关联"。
  - endfield：`MIT`，且因为**不含任何原始素材**（全算法生成）而天然干净。
  - EAC：`assets/skins/dsh-skins-LICENSE.txt` = BSD-3-Clause (zhu1090093659)，且 `assets/SOURCES.json`（113 个组件）**逐个记录来源、版本、许可证、上游仓库、catalog 条目**。这是分发第三方皮肤时最规范的做法。

---

## 5. 界面与 Markdown 渲染主题设计

### 5.1 Markdown 走的是专用令牌组

官方 Markdown 样式在 `@deepseek-ai/dsh-client-ui-primitives/lib/markdown/`，共 4 个 CSS Modules：`MarkdownText.module.css`、`CodeBlock.module.css`、`MessageText.module.css`、`JsonBlock.module.css`。

**因为类名 hash 化，主题不应该去匹配 `.markdown`，而应改令牌。** Markdown 专用令牌：

**颜色类（`--dsw-alias-markdown-*`，共 8 项）**

| 令牌 | 作用 |
|---|---|
| `--dsw-alias-markdown-inline-code` | 行内 code 底色 |
| `--dsw-alias-markdown-code-block` | 代码块底色 |
| `--dsw-alias-markdown-code-block-banner` | 代码块顶栏底色 |
| `--dsw-alias-markdown-code-segment-selected` | 代码段（tab）选中 |
| `--dsw-alias-markdown-code-segment-unselected` | 代码段未选中 |
| `--dsw-alias-markdown-citation` | 引用 |
| `--dsw-alias-markdown-placeholder` | 占位符 |
| `--dsw-alias-markdown-tag` | 标签 |

**排版类（`--dsw-font-markdown-*`）** —— 每个都有 `-font-family` / `-font-size` / `-font-style` / `-font-weight` / `-line-height` 五个子属性：

```
--dsw-font-markdown-base           --dsw-font-markdown-base-strong
--dsw-font-markdown-base-italic    --dsw-font-markdown-base-strong-italic
--dsw-font-markdown-small          --dsw-font-markdown-small-strong
--dsw-font-markdown-h1  h2  h3  h4
--dsw-font-markdown-code           --dsw-font-markdown-code-block
--dsw-font-markdown-code-block-small
--dsw-font-markdown-table          --dsw-font-markdown-table-head
```

#### 💡 换字体只需改两个变量

官方 markdown 字体简写的**字体家族部分统一引用 `--dsw-font-family`**，实测形态：

```css
--dsw-font-markdown-h1: 700 calc(21px + var(--dsh-content-font-delta))
                        / calc(30px + var(--dsh-content-font-delta)) var(--dsw-font-family);
```

所以：
- 改 `--dsw-font-family` → **标题、段落、表格、列表全部一起换字体**（不需要逐个覆盖 `-font-family` 子属性）。
- 改 `--ds-font-family-code` → 行内 code 与 `pre` 一起换等宽字体。
- 改 `--dsh-content-font-size`（12–17）→ 整条阶梯按 `--dsh-content-font-delta` 联动。

> 这两个变量**声明在 `:root` 是安全的**（endfield 就声明在 `:root`）—— 因为它们不引用任何 `--dsw-*` 令牌，不触发 §2.2 的 guaranteed-invalid 陷阱。**判据是「值里有没有出现 `var(--dsw-*)`」，而不是「声明在哪个元素」。**

**官方 Markdown 的其余元素用的是通用令牌**（从 CSS Module 实录）：

| 元素 | 适用令牌 |
|---|---|
| 正文 | `var(--dsw-alias-label-primary)` + `font: var(--dsw-font-markdown-base)` |
| 链接 | `var(--dsw-alias-state-business-primary)`；`:focus-visible` 用同色 2px `box-shadow` 环 |
| 列表标记 `li::marker` | `var(--dsw-alias-label-secondary)`；`line-height:24px` |
| 分隔线 `hr` | `height:0.5px; background: var(--dsw-alias-border-l2)` |
| 引用 `blockquote` | `border-left: 2px solid var(--dsw-alias-label-caption); padding-left:14px` |
| 行内 code | `font: var(--dsw-font-markdown-code)` + `background: var(--dsw-alias-markdown-inline-code)` + `border-radius:6px` |
| 表格宽滚动条 | `scrollbar-color: var(--dsw-alias-label-tertiary) transparent` |
| 任务列表复选框 | `accent-color: var(--dsw-alias-label-secondary)` |
| 数学 `katex-display` | `max-width:100%; overflow-x:auto` |

### 5.2 代码高亮：`--shiki-*`

**这是独立于 `--dsw-*` 的第二套令牌体系**，由 `@deepseek-ai/dsh-client-ui-theme` 的 `shiki.css` 提供：

```
--shiki-background              --shiki-foreground
--shiki-token-comment           --shiki-token-constant      --shiki-token-function
--shiki-token-keyword           --shiki-token-link          --shiki-token-parameter
--shiki-token-punctuation       --shiki-token-string        --shiki-token-string-expression
```

这 11 项声明在 `:root` 上，**暗色覆盖写在 `body[data-ds-dark-theme]` 下**（与 `--dsw-*` 落在 `body` 不同 —— shiki 这组是真正挂在 `:root` 的，因为它不引用 `--dsw-*`）。

`CodeBlock.module.css` 顶部注释明确：*"Highlight colors stay on the existing shiki `--shiki-*` sheet (not Prism highlight.css)."* 所以**主题要改语法高亮配色，就覆盖 `--shiki-*`**，不要去写 Prism 那套。

代码块还有一个局部变量组（`--dsl-*`，由 CodeBlock 模块自己定义，可用同名前缀覆写）：
```
--dsl-code-block-banner-background-color   --dsl-code-block-border-radius
--dsl-code-block-banner-font               --dsl-code-block-content-font
```

### 5.3 主题框架自带的全局表面

`dsh-client-ui-theme` 的 `src/styles/` 按序导入 6 个样式表，这是主题可以直接"继承"的基础设施：

| 样式表 | 内容 |
|---|---|
| `base.css` | 令牌定义（唯一颜色权威） |
| `corner-shape.css` | `@supports (corner-shape: superellipse(1.5))` 内定义 `--dsw-corner-shape`，通过通用选择器应用到所有元素及 `::before`/`::after` |
| `design-platform.css` | 平台设计层（声明滚动条令牌） |
| `scrollbar.css` | **`--dsw-alias-scrollbar-*` 的唯一消费者**，必须排在 `design-platform.css` 之后 |
| `gradient-shadow-text.css` | 从 `--dsh-content-font-size` 派生 `--dsh-content-font-delta`，驱动 Markdown 标题/正文阶梯；拥有 `--dsw-shadow-lv*` 与 `--dsw-elevation-*` |
| `shiki.css` | 语法高亮 |

**字号阶梯机制**：官方字体步进器（12–17px，默认 14）只改 `--dsh-content-font-size`；`gradient-shadow-text.css` 把它派生成 `--dsh-content-font-delta`，再驱动整个 Markdown 标题/正文阶梯。次级层 `--dsh-content-font-size-secondary` = 设置值 −1（≤14 时）或 −2（>14 时），默认 13px，供表格变体与 flow row 使用。**密集小字与代码字号固定，不随阶梯**。

**滚动条重绑定契约**：`--dsh-scrollbar-thumb` / `--dsh-scrollbar-thumb-hover` 绑定在 `body`（l1 表面令牌）；抬升表面（菜单/浮层/对话框）在自己的容器上重绑定到 l2 令牌；`--dsh-scrollbar-width` 镜像 WebKit 滚动条布局宽度供旁边表面对齐。WebKit 走伪元素路径，Firefox 走 `@supports not selector(::-webkit-scrollbar)` 内的标准属性 —— **两条路径互斥**。

### 5.4 三个项目对 Markdown 的处理对比

| | 做法 |
|---|---|
| **denia** | 只在用户打开「消息文字配色」开关时，对**自己标记的** `[data-denia-msg]` 节点（双重门控：位于 `_viewArea` 内 **且** 带 `data-chat-flow-kind`）逐个覆盖 `h1..h4` / `code` / `pre` / `pre code` / `blockquote` / `ul,ol` / `li::marker` / `hr` 的**颜色**（亮暗各一套）。不改字号。 |
| **endfield** | **完全走令牌，几乎不写逐元素 markdown CSS**。其 139 条规则块里**没有任何 `h1/h2/p/pre/blockquote/ul/ol/li/hr/img` 选择器**（只有 `a`、`a:hover`、`tbody tr:hover`、`[class*='table' i] th/td`）。Markdown 排版与配色 100% 由令牌驱动：`--dsw-font-family` + `--ds-font-family-code` + `--dsw-alias-markdown-*` 七个槽位。 |
| **EAC 皮肤** | 以 `--dsw-*` 令牌整体换色为主，少数皮肤额外覆写代码块。 |

#### 两种思路的取舍

| | 逐元素覆写（denia） | 令牌驱动（endfield） |
|---|---|---|
| 抗上游重构 | ❌ hash 化类名一变就断 | ✅ 令牌是官方稳定契约 |
| 表达力 | ✅ 可以做到任意细节（圆角、边框、阴影、伪元素） | ⚠️ 只能改令牌覆盖的维度 |
| 代码量 | 大（每个元素 × 亮暗两套） | 小（7–10 个令牌） |
| 风险 | 选择器过宽会误伤（denia v0.0.6 真实事故） | 低 |

**建议**：**默认走令牌驱动**；只在令牌覆盖不到的地方（装饰图层、动画、自定义面板）才写选择器，且优先用 `data-*` 锚点而非类名。

#### 语法高亮：endfield 故意不接管

值得注意：**endfield 完全不碰 `--shiki-*`** —— 代码高亮在两种模式下都保持 DSH 原样，只是压在主题化的 `#ecece6` / `#181a18` 代码块底色上。这是一个**有意的减法**：语法高亮配色需要同时满足"在两种模式的可读性"以及"与 10+ 种 token 类型协调"，收益低风险高。**自研主题可以照此决策。**

> denia 的 Markdown 覆写是**教训的来源**：v0.0.6 曾出现设置页/插件列表/模型列表等卡片被误加消息框装饰（因为选择器太宽），修复方式是**双重门控 + 离开会话视图时清除残留标记**。给自己的消息节点打标记时，务必同时验证"标记只落在聊天节点上"。

### 5.5 其他必须覆盖的界面表面（检查清单）

| 表面 | 建议手段 |
|---|---|
| 应用三栏外框 | `[class*='_centerCol']` / `[class*='sidebarCol']` / `[class*='detailsCol']`（脆弱，需版本区间声明） |
| 应用根 `[id=root]` | `--dsw-alias-bg-base` + 可选 `backdrop-filter` |
| 侧栏 | `--dsw-specific-sidebar-fill`、`--dsw-specific-sidebar-nav-item-*` |
| 输入区/composer | `--dsw-specific-input-major`、`--dsw-alias-bg-overlay` |
| 消息气泡 | `--dsw-specific-bubble` / `--dsw-specific-bubble-highlight` |
| 详情/workbench 面板 | `[class*='detailsCol']` |
| 设置面板 | `--dsw-alias-bg-overlay`、`--dsw-specific-selector`、`--dsw-alias-bg-layer-2/3` |
| 工具调用卡片 | `--dsw-alias-bg-layer-2`、`--dsw-alias-border-l1` |
| 文本选中 | `::selection { color:…; background: var(--edge-accent) }` |
| 输入光标 | `caret-color` |
| 焦点环 | `outline: 2px solid …; outline-offset: 1px` |
| 滚动条 | `--dsh-scrollbar-thumb` / `-hover`（或 `::-webkit-scrollbar-thumb`） |
| 模态/浮层 | `--dsw-alias-bg-overlay`、`--dsw-elevation-panel` |
| `theme-color` meta | presenter 自动跟随 `getComputedStyle(body).backgroundColor`；denia 额外用 MutationObserver 强制接管 |

---

## 6. 主题开发的基本工作流

### 6.1 脚手架

**最小可运行主题包**（8 个文件）：

```
my-theme/
├── package.json        # dsh.bundle.patch + dsh.client{platform:'web', inject:[...]}
├── cordis.patch.yml    # - insert: [{id: ui-skin-my-theme, name: <包名>}]
├── index.js            # Host 半边（可空：export function apply() {}）
├── client.js           # Client 半边（全部主题逻辑）
├── skin.json           # 皮肤元数据卡（可选但推荐，EAC/skin-switch 会读）
├── preview/light.webp  # 预览图（可选）
├── preview/dark.webp
└── README.md
```

`index.js` 的最小形态（EAC miku 就是这样）：

```js
/** Host loader entry for the browser-only skin plugin. Provides no host-side behavior. */
export function apply() {}
```

但**如果你想持久化设置，Host 半边不能空** —— 要么 `ctx.settings.register(...)`（endfield 路线），要么 `webServer.register(...)` 自建路由（denia 路线）。

### 6.2 开发循环

**(a) 仓库内自测（endfield 的做法，最适合严肃主题）**

```bash
node check.js        # 样式表静态校验：反引号 / ${} / CSS 注释提前闭合 / 顶层漏进散文 / :root 误引用令牌
node selftest.js     # 校验器自检（防止 check.js 自己悄悄失效）
npm test             # 20+ 个测试：样式不变量、配色对比度、设置页、真实浏览器渲染、
                     # 等高线平滑/尖点/覆盖率/性能、可访问性、24/60/120 FPS 预算
npm run shots        # 真实截图
npm run shots:verify # 解码截图统计像素占比（见 §3.2）
```

`check.js` 的四类判据都来自真实事故：
1. 模板字符串里出现反引号（哪怕在 CSS 注释里）→ 整个 client bundle 解析失败。
2. `${...}` 在模板字符串里是插值，不是 CSS。
3. **CSS 注释提前闭合**（最隐蔽 —— 注释本身仍配平，破坏是残留说明文字落到顶层与下一条选择器黏连，整条规则被丢弃）。`node --check` **查不出**这类问题。
4. `:root` 块里引用 `--dsw-*` 的声明（见 §2.2）。

**(b) 装配到 profile**

```bash
# 本地路径开发
dsh plugin --profile desktop add /path/to/my-theme

# 从 GitHub 装
dsh plugin --profile web add github:ymh0000123/dsh-theme-endfield

# 卸载
dsh plugin --profile web rm dsh-theme-endfield
```

或手动放进 `<DSH_HOME>/profiles/<name>/node_modules/…`，再在 `cordis.patch.yml` 里加行。

**`dsh plugin add` 的内部行为**（核对 `@deepseek-ai/dsh/lib/plugin-F7ZVfRyo.js`）：

1. 它是一个**很薄的 pnpm 转发器** —— 在 `$DSH_HOME/profiles/<name>` 目录里执行 pnpm。
2. 装完后 `reconcilePlugins()` 扫描依赖，**凡 manifest 里声明了 `dsh.bundle.patch` 的包，自动追加到 `dsh.profile.bundles`**。
3. 所以**不需要手工编辑 profile 的 `package.json`** —— 只要你的包里带了 `cordis.patch.yml` 且 `package.json` 声明了 `dsh.bundle.patch`，安装即自动接线。这正是 patch 文件头部注释所声称的行为。

**(c) 热重载**

本机 desktop profile 的 `package.json` 里有：

```json
"dsh": { "profile": { "patchReload": "live" } }
```

官方文档（`@deepseek-ai/dsh/README.md:36`）：*"`patchReload: live` watches the profile and home-level patch files; `startup` applies them once."*

**结论**：`cordis.patch.yml` 的改动**可以热生效**；但 `client.js` 的改动需要**重载页面 / 重启 DSH**（没有 HMR）。普通皮肤开发的实际循环是「改 client.js → 重启/强刷 → 看效果」。设置项则应有独立持久化，重启后保留。

### 6.3 ⚠️ 持久化：**不要用 localStorage**

这是三个项目里最重要的一条共识，endfield 在 `docs/engineering-notes.md:23` 用一整节论证：

> `localStorage` 的作用域是「协议 + 主机 + **端口**」同源维度，而 **DSH Desktop 每次启动都在 `127.0.0.1` 上绑定一个随机临时端口**。端口一变 origin 就变，上次保存的设置永远读不到 —— 表现就是"**重启后设置恢复默认**"。

**三个候选都不治本**（键空间都挂在 origin 上）：`localStorage`（随机端口即清空）、`sessionStorage`（更糟，标签页间不共享）、`IndexedDB`（仍按 origin 分库）。

**正解是 DSH 自己的用户设置服务：**

```js
// Host index.js —— 声明命名空间
ctx.inject(['settings'], sctx => sctx.settings.register('dsh-theme-endfield', schema, { applies: 'live' }))
// schema 每个字段都用字符串 + .default(...)：default-ON 存 '1'（读作 !== '0'），
// default-OFF 存 '0'（读作 === '1'）
```

```js
// Client —— 读写同一命名空间
const scope = ctx.get('settingsScope')          // 或 ctx.settingsScope.bind(spec)
scope.set(field, value)                         // 写（Host 原子落盘）
scope.getSnapshot().value                       // 读（已由 schema 校验并合并默认值）
scope.subscribe(() => reconcileFromPrefs())     // 订阅：落盘/镜像变化即热生效
```

落盘位置：`<DSH_HOME>/settings.yaml` —— **由 Host 决定，与页面 origin/端口无关**，所以 dsh web（固定端口）与 DSH Desktop（随机端口）走同一条路径。

**两个必须处理的边界**：

1. **写入门控**：不能只看快照的 `writable`。host 模式下 describe 视图即使本命名空间**尚未被注册**也会返回 `writable:true` 但 `status:'unavailable'` —— 照写会清掉脏标记却什么都没落盘，刷新即丢。正确判据是 `mode==='host' && status==='ready' && writable`。endfield 的做法是**拦下这种写并标脏**（页面内仍生效），等快照 ready 回相时由 subscription 自动补写。
2. **启动竞态**：`apply()` 早于 transport 就绪时先读 schema 默认值（内存镜像），第一个真值镜像到达后切到持久值。stylevault 也遇到过同类问题，它用「4 秒 boot 窗口内反复 reassert」来对抗 `settingsScope.adopt()` 的异步覆盖（注释原文：*"Beat async settingsScope.adopt() race (common cause of 'refresh = default')"*）。

> **denia 的替代解法**：自建 `/api/dsh-denia/palette-settings` 路由 + 写 `<profile>/data/<skin>/palette-settings.json`。同样绕开 origin 问题，代价是要自己实现路由、原子写、白名单校验、loopback 门（约 150 行 Host 代码）。**推荐用官方 settings 命名空间，除非你需要存大块二进制（如用户上传的背景图）**。

### 6.4 生命周期：每个副作用都必须可回收

官方硬要求（也是 denia 被反复修 bug 的地方）：

```js
function apply(ctx) {
    // …所有 DOM 写入、定时器、监听器…
    ctx.effect(function () {
        return function () {          // ← disposer
            delete body.dataset.dshDenia;
            if (msgFrameTimer) clearTimeout(msgFrameTimer);
            if (detailsIntervalId) clearInterval(detailsIntervalId);
            window.removeEventListener("resize", syncDevToolsState);
            observer.disconnect();
            themeColorObserver.disconnect();
            // 恢复被覆写的 body 行内样式
            previous.forEach(function (value, prop) { body.style.setProperty(prop, value); });
            // 按 owner 标记统一回收自建节点
            document.querySelectorAll("[data-skin-owner='" + SKIN_OWNER + "']")
                    .forEach(function (el) { el.remove(); });
            // 清除打在应用节点上的标记
            document.querySelectorAll(staleSel).forEach(function (el) { /* delete el.dataset[...] */ });
        };
    }, "ui-skin-denia: layered background, bubble field, character art, …");
}
```

**denia 被修复过的真实泄漏**（v0.0.6 更新日志）：
- 500ms 轮询定时器与 resize 监听在停用/重载后不释放。
- `[id=root]` 的 `backdrop-filter` 等行内样式没恢复 → 所以要在 apply 时**先保存原值**（`BACKDROP_PROPERTIES.forEach(p => previous.set(p, body.style.getPropertyValue(p)))`）。
- `theme-color` meta 被改写后没还原（保存 `previousThemeColor`）。

**必须回收的副作用类型清单**：`ctx.effect` disposer、`ctx.on` 事件、定时器（`setTimeout`/`setInterval`/`requestAnimationFrame`）、`MutationObserver`、`ResizeObserver`、`window` 监听、注入的 `<style>`/`<link>`、自建的 DOM 节点、覆写的行内样式、改写的 `document.title` / `meta`。

**幂等**：bundle 可能被 boot loader 与 cordis composition **挂载两次**。用 `style[data-plugin-css=...]` 标记 + 全局标志位防重（endfield 在 `client.js:29-34` 有专门注释）。

### 6.5 质量门禁与 CI

endfield 的 `.github/workflows/ci.yml`（**304 行**）+ `.github/scripts/` 提供了最完整的样板，是**社区主题里工程化程度最高的**。

**三层测试架构**（全部零依赖，无 jsdom）：

| 层 | 手段 | 覆盖 |
|---|---|---|
| (a) 进程内 `vm` + 桩 | 用**真实的 `client.js`** 跑在录制的 `React`（只实现 `useState`/`createElement`）与 `slots` 桩上 | 设置页 13 行 4 组、唯一 key、每个开关写入其文档化字段、断言 `client.js` 里**没有 `localStorage` 调用** |
| (b) 无头 Chrome + 真实 `client.js` | 手写 mock DOM/CSS，断言**实测像素** | 等高线渲染/杂点/平滑/尖点/可访问性/覆盖率/性能、加载动画、水印层叠、配色切换、设置按钮、关闭态 |
| (c) 截图工具链 | `--headless=new --virtual-time-budget --screenshot` | `shoot.js` 出 4 张图（亮暗 × 两配色），`verify-shots.js` 解码后**按色相族分类统计像素**并断言黄/青主导性 |

**几个可直接复用的巧思**：

- **`vm.Script` 代替 `node --check`**：因为某些沙箱里 spawn 捕获管道 stdio 会 EPERM，进程内编译更可靠。
- **`selftest.js` 变异测试守卫**：把 9 个**真实历史 bug** 注入 `client.js` 副本，断言 `check.js` **必须失败且给出预期消息**；若注入的 regex 已不再匹配则打印 `INJECTION DID NOT APPLY (test is vacuous)`。**这一招抓到过配色重构后 turnStatus 注入静默失效、CRLF 的 `\n` 不匹配等问题。**
- **`hover-check.js` 自建 CDP 客户端**：手写 RFC6455 websocket 连 `--remote-debugging-port`，发 `Input.dispatchMouseEvent {type:'mouseMoved'}` 来测**真实 `:hover`**。原因：计算样式触发不了 `:hover`，此前**删掉发布的 `:hover` 规则测试依然全绿**（被一个 `.HOVERPROBE` 测试专用规则单独撑住了）。
- **只用 `zlib` 解码 PNG**（约 10 个测试文件这么做），不引入任何图像库依赖。
- **`contour-perf.test.js` 完全避开 rAF**：无头环境的 rAF 会被合并成 n=1，改为按函数名从 `client.js` 中切出算法源码，在紧循环里计时，并丢弃前两次采样。
- **`run-tests.js` 把 `package.json` 的 `test:ci` 行当单一事实来源**：解析它、逐条执行（5 分钟超时），一轮报出**全部**失败而短路停止。
- **`whitespace-check.js` 显式解析 diff 区间**（`BASE_SHA` 否则 `HEAD~1`）—— 裸 `git diff --check` 在干净的 CI checkout 上**什么都检查不到**；无区间时**跳过而不是假装通过**。
- **`check-patch-yml.js` 断言 patch 数组里有 `insert` 段且含带 `id` 的 `dsh-theme-endfield` 行** —— 因为结构错误的 patch **能装上但永远不会挂载**。
- **`package-check.js` 断言每个 `exports` 目标、每个 `files` 条目、`main` 都真实存在** —— 本地 workspace 会隐藏发布时才暴露的缺失条目。
- **CI 用 `::error file=…,line=…` 工作流命令**上报，fork PR（只读 token）也能拿到行内注解；`permissions: contents: read` 为 job 默认，跑代码的两个 job 从不拿写权限。

**`.github/scripts/` 清单**：

| 脚本 | 作用 |
|---|---|
| `syntax-check.js` | 对 index/client/check/selftest + 所有 `test/*.js` 跑 `node --check`，把 stderr 行号映射成行内注解 |
| `whitespace-check.js` | 空白/行尾检查（显式 diff 区间） |
| `check-patch-yml.js` | 校验 `cordis.patch.yml` 结构 |
| `package-check.js` | 校验 `package.json` 的 `exports`/`files`/`main` 都真实存在 |
| `run-tests.js` | 从 `package.json` 解析 `test:ci` 并逐条执行 |

**测试工程化的可复用经验**（`docs/engineering-notes.md` §验证方法论）：
- 稀疏掩码的一致率**必须先算零假设基线**（否则 89.99% 的镜像对称可能纯属随机）。
- **视觉模型的文字描述不能作为颜色结论的依据**。
- 命中测试判断不了 `pointer-events:none` 的层叠。
- 两版渲染必须**只差一个变量**，否则无法归因。
- **计算样式触发不了 `:hover`**。
- 做「有字 / 无字」差分时要**保留一个零宽空格**。
- **虚拟时间会快进过要拍的那一帧**（`--virtual-time-budget=4000` 会跳过一个 3 秒后自动隐藏的动画）。
- 计数断言不能用同一个集合既当预期又当计数器。
- 定时器泄漏要让**两个到期时刻错开**才观测得到。
- 沙箱对象展开会带上幂等标志。
- 按固定字节长度截取源码的断言会**悄悄失去覆盖**。
- **注入式自检必须断言注入本身生效**（一个永远不会失败的守卫比没有守卫更糟）。
- **无头环境的 rAF 不能用来采样性能**。

#### ⚠️ 官方文档与代码的漂移（提醒：不要只信文档）

调研中确认 endfield 自身的文档已经与实际代码脱节：

| 漂移 | 实况 |
|---|---|
| `docs/features.md` 概览表 | 漏了 `contourScrollPause`（滚动时暂停动画）开关 —— 它存在于 `index.js`、client 和面板里 |
| `docs/testing.md` 说「10 行」 | `settings-rows.test.js` 断言的是 **13 行** |
| `client.js:2525/2531` 引用 `test/probe-edge-line.js`、`test/probe-css.js` | **这两个文件不存在** |
| `docs/design-language.md` 一处写 ink-on-武陵青 `6.62:1`、另一处写 `9.88:1` | `6.62` 是提亮前 `#0daaaa` 的陈旧数字（文档自己记录了这段历史），代码注释里也残留 3 处 |
| 两个变量定义后从未引用 | `--edge-signal-dim`、`--edge-panel` |
| 两个变量被定义了两次 | `--edge-word`、`--edge-gap` |

**教训**：`test/shoot.js` 还残留着 localStorage 播种（`palette='wuling'`、`contour='1'`、`watermark='0'`）—— 迁移到 settings 命名空间时**测试脚手架被漏掉了**，导致两张「武陵青」截图实际渲染的是谷地黄，`npm run shots:verify` 的青色主导断言应当失败。**这类"生产代码已迁移、测试脚手架没跟上"的漏网是最常见的漂移来源。**

### 6.6 分发与互斥

**(a) 分发**：正常 npm 包 / GitHub 直装。`package.json` 的 `files` 必须包含 `lib/`、`cordis.patch.yml`、`skin.json`（如有）、`preview/`、`LICENSE`、`README.md`。

**(b) 版本兼容声明**：denia 在 `package.json` 里显式声明：

```json
"dsh": { "client": { "version": "0.1.0-rc.6 - 0.1.1-rc.2", "platform": "web" } }
```

并在 README 里写"最近验证日期"。**这是对付 §2.3 类名片段脆弱性的必要防护。**

**(c) 皮肤互斥**：皮肤是全局 CSS 覆盖，**同时启用两个会互相打架**。EAC 的解法（`dsh-skin-switch/lib/index.js`）是把互斥做成**数据而不是代码**：

- 所有皮肤行以 `id: ui-skin-*` + `disabled: true` 形式存在于 `cordis.patch.yml`（"默认皮肤 = 无皮肤"）。
- 切换时**重写 patch 文本**：选中的 skin 删掉 `disabled: true`，其余全部加上。
- 只追踪**自己 roster 内**的 id（`readSkinStates()` 里的注释：*"other `ui-skin-*` rows, e.g. an upstream skin center, are not ours"*）。
- 全 roster 都是皮肤的 patch 块会被丢弃并重新追加（保持文件整洁）。
- 切换后**需要重启服务**才生效 —— UI 明确提示 *"The new skin takes effect after the service restarts."*
- 选择界面注册在 **`settings.plugins.tab`** 槽位（`id: "skin"`, `order: 15`），预览图由 Host 半边的 loopback 路由 `GET /api/dsh-skins/preview/<rowId>/light|dark` 提供。

denia 的 README 也提到同样的机制：*"mutual exclusion between skins is managed by `scripts/dsh-skin` (home-layer disabled rows)"*。

> **上游有另一套架构**（v2 皮肤中心）：`$DSH_HOME/skin-center-active.json` + `POST /api/skin-center/v2/active` + Wallpaper Engine 桥，走**客户端原子切换 + `html[data-dsh-skin]`**，**不写 `cordis.patch.yml`、不需要重启**，并真正支持用户自定义壁纸。两套架构不互通 —— 选一套就要放弃另一套的皮肤列表。

**(d) EAC 皮肤的额外硬约束**（其测试强制，值得自研时遵守）**：

| 约束 | 原因 |
|---|---|
| 每个 `z-index` 必须 **< 1000** | 1000 是设置模态框 `.VOzbGW_overlay` 的层级；超出会把设置页压在下面 |
| **不得**用 `--dsw-alias-bg-base` 作为**文字**颜色 | 它常常是半透明的，当文字色会不可读 |
| 不要依赖 `--dsw-skin-scrim` | **这不是 DSH 内核令牌**，由上游 skin-center 写入；只有装了那个插件时 scrim 层才会响应 |
| 不要依赖 `[data-pane=...]`、`.aionui-*`、`[data-aionui-*]`、`.VOzbGW_overlay` 等选择器 | 其中部分**在 DSH 2.0.5 内核里并不存在** —— 它们来自皮肤当初编译时的 shell 版本，或来自 dsh-web-ui 自己的 aionui 插件 |

**(e) 权限与安全边界**：
- 自建 HTTP 路由**必须做 loopback 校验**（`req.socket.remoteAddress` ∈ `127.0.0.1` / `::1` / `::ffff:127.0.0.1`），否则局域网内任何人可读写你的设置。
- 请求体与单张图片都要有**字节上限**（denia：body 15 MB / 单图 7 MB）。
- 上传内容走**白名单 MIME + data-URI 前缀校验**，不做 MIME 嗅探。
- 版本更新提示等链接**用 DOM API 生成，不要拼 `innerHTML`**（denia v0.0.6 修复项），并加 `rel="noopener noreferrer"`。

---

## 7. 关键陷阱清单

按"踩了会静默失效"排序：

| # | 陷阱 | 后果 | 正确做法 |
|---|---|---|---|
| 1 | **用 `localStorage` 存设置** | DSH Desktop 随机端口 → 重启即恢复默认 | `ctx.settings.register` / `settingsScope` |
| 2 | **在 `:root` 声明引用 `--dsw-*` 的变量** | guaranteed-invalid → 计算值为空 → 整条声明被丢弃 | 声明在 `body` 上 |
| 3 | **自写 `<style>` 声明 `--dsw-*` 与其它令牌主题共存** | 一旦有主题注册了 tokens，行内样式覆盖你的声明 | 走 `ctx.theme.overrideTokens()` |
| 4 | **只改背景令牌不改前景** | 造出"白字压黄底"这类 1.05:1 的不可见组合 | 改一个背景令牌时**一起检查谁在上面写字** |
| 5 | **两处令牌被映射成同一个值** | 元素失去区分度 | endfield 归档的"二类问题" |
| 6 | **色值只对一种模式成立** | 切到另一模式即不可读 | 用对比度断言同时验两种模式 |
| 7 | **`--dsw-static-deepseek-500/200` 是共享令牌** | 动它会连带改掉气泡和 business-primary | 只覆盖那条规则自己的 `background-image` |
| 8 | **覆盖值给裸字符串而非 `{light,dark}`** | `overrideTokens` 抛教学性错误 | 总是给双值 |
| 9 | **模板字符串里出现反引号 / `${}`** | 整个 client bundle 解析失败 | `check.js` 静态校验 |
| 10 | **CSS 注释提前闭合** | 残留文字落到顶层与选择器黏连，整条规则被丢弃；`node --check` 查不出 | `check.js`（判据：**选择器里不会出现「字母后的句点 + 空格」，散文会**） |
| 11 | **选择器过宽**（denia 的 `data-denia-msg` 曾误伤设置页卡片） | 设置页/插件列表被误加装饰 | 双重门控（在 `_viewArea` 内 **且** 带 `data-chat-flow-kind`）+ 离开会话视图清除残留 |
| 12 | **副作用不回收** | 停用后定时器/监听器仍跑，样式残留 | `ctx.effect` disposer 全量回收，按 owner 标记清节点 |
| 13 | **不防重复挂载** | 样式表叠加两份 | `style[data-plugin-css=...]` 幂等标记 + 全局标志位 |
| 14 | **canvas 描边读 CSS 变量** | canvas 不能用 CSS 变量 | MutationObserver 监听 `<body>` class 重绘 |
| 15 | **只看 `writable` 就写设置** | 清掉脏标记但没落盘，刷新即丢 | 判据为 `mode==='host' && status==='ready' && writable` |
| 16 | **自建 HTTP 路由不做 loopback 校验** | 局域网可读写你的设置 | 校验 `req.socket.remoteAddress` |
| 17 | **依赖 hash 化类名** | DSH 内部改名即断 | 优先用 `data-*`/`data-slot` 锚点；类名片段匹配必须声明兼容版本区间 |
| 18 | **忽略 `prefers-reduced-motion`** | 渐变亮带在字里永久停留 | 该模式下上游把 `background-size` 钉成 100%，要按这个事实校验对比度 |
| 19 | **用了不存在的令牌**（如 `--dsw-alias-font-mono`） | 静默 no-op，功能"写了但没生效" | 对照官方令牌表核对；真实名称是 `--dsw-font-mono` / `--ds-font-family-code` |
| 20 | **`z-index` ≥ 1000** | 盖住设置模态框（`.VOzbGW_overlay` = 1000） | 所有皮肤层级保持 < 1000 |
| 21 | **把 `--dsw-alias-bg-base` 当文字色** | 该令牌常为半透明 → 文字不可读 | 文字色只用 `--dsw-alias-label-*` 系列 |
| 22 | **依赖别的皮肤的私有令牌 / 其它 shell 版本的选择器** | 属性/选择器在你的内核里不存在 → 整条规则失效 | 只用官方令牌表 + DSH 2.0.5 实际存在的锚点；对类名片段匹配声明版本区间 |
| 23 | **假设 `skin.json` 是内核契约** | DSH 内核根本不读它 | 它是市场元数据；缺了也能跑，但会从皮肤列表里消失 |
| 24 | **把层叠问题当成"z-index 不够高"** | 创建了层叠上下文后，内部再高的 z-index 也关在里面；平局按 DOM 顺序决定，后追加的兄弟节点赢 | endfield 真实事故：水印与 hero 容器同为 `z-index:1` → 平局 → 水印每次必胜 → 盖住模型下拉菜单（实测 **9945–11002 px 误绘**）。正解是降到 `z-index:0`（或显式 `isolation: isolate`） |
| 25 | **`inject` 写错地方** | 把「模块加载顺序」当成「服务依赖」，或反之 | `package.json` 的 `dsh.client.inject` = 加载顺序（Host 写 manifest）；`client.js` 的 `exports.inject` = Cordis 服务门控。可选服务一律 `ctx.get()` |
| 26 | **把定位/角色混进带背景的层** | 三个元素会用不透明 `--dsw-alias-bg-base` 盖住 body 级图层：**应用外框、对话列、详情列** | 装饰层要挂进外框内部并临时把这几处底色置为透明（用 `:has()` 守卫使关闭时全部规则失效） |
| 27 | **「关闭」用 rAF 内 early-return** | 关闭后每帧仍被唤醒 | "off must cost nothing"：关闭时**停掉循环/取消订阅/移除监听**，而不是在里面提前返回 |
| 28 | **用 `--dsw-alias-brand-primary` 当实心按钮填充色** | 官方主题里它等于前景色 → **黑底黑字** | 填充三件套：`--dsw-alias-button-primary-fill` + `-hover` + `--dsw-alias-label-primary-foreground` |
| 29 | **用 `--dsw-alias-bg-base` 当文字色** | 它常是半透明（`#ffffff6b`）→ 文字不可见（EAC 有真实回归并被测试锁定） | 文字色只用 `--dsw-alias-label-*` |
| 30 | **`--shiki-background` 在 `:root`、暗色别名在 `body[data-ds-dark-theme]`** | `:root` 够不到 body 作用域 → 暗色下代码块画固定亮色底（上游 issue #826） | 在皮肤作用域的 body 上重绑 `--shiki-background` |
| 31 | **皮肤自带新素材目录** | EAC 的 `plugin-copy.ts` 有**固定 `TOP_DIRS` 白名单**（`lib docs preview vendor node_modules data assets runtime src client styles`），新目录会**在同步时被静默丢弃** | 素材内联进 bundle，或放进白名单内的目录 |
| 32 | **以为皮肤能热重载** | EAC 的 `plugin-sync.mjs` 明确禁止皮肤运行时更新（`skins cannot use runtime updates`），改皮肤必须重启服务 | 开发循环是「改 → 重启 → 刷页」；设置项才做热生效 |

---

## 8. 对本机环境的落地建议

### 8.1 当前环境实况

```
$DSH_HOME = ~/.dsh
profile   = desktop
bundles   = @deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app, dshmarket, dsh-context, dsh-stylevault
patchReload = live
```

`~/.dsh/profiles/desktop/cordis.patch.yml` 已有主题相关行：

```yaml
- id: bloom-theme        { disabled: true  }
- id: opencode-palette   { disabled: true  }
- id: ui-skin-claude-style { disabled: false }
- id: dsh-theme-escook   { disabled: true  }
```

**已装且启用的主题引擎：`dsh-stylevault` v0.3.0** —— 这是一个成熟的"主题管理 + 令牌覆盖"插件（2912 行 `client.js`），**就是你自研主题时最直接的本地参考实现**：

```js
const inject = ["theme", "slots"];                       // ← 与官方契约一致
…
for (const p of PRESETS) theme.register({ id: p.id, colorScheme: p.colorScheme, tokens: p.tokens });
…
theme.overrideTokens("stylevault", toOverrideModes(flat));  // ← 正确的令牌覆盖通道
…
ctx.slots.inject("settings.section", () =>
  ctx.slots.register({ name: "settings.section", id: "stylevault", order: 35, label: () => "StyleVault" },
                     StyleVaultSection));
```

它会注入 `stylevault-options-layer` 与 `stylevault-static-layer` 两个 `<style>` 标签，通过 `injectStylesheet()` 拉 Google Fonts（含镜像回退），并做 palette → token 的 `packTokens()` 归一化（含"亮色主题里把纯白钳掉"等细节）。

**⚠️ 直接后果**：StyleVault 会通过 `overrideTokens` 往 `<body>` 写行内令牌。**你新写的主题如果采用"自写 `<style>` 声明 `--dsw-*`"的 denia 式做法，会和 StyleVault 冲突**（§2.2 陷阱 3）。**新主题请直接走 `ctx.theme.overrideTokens()`**。

### 8.2 推荐的自研主题架构

综合三份调研，建议的形态：

```
theme/                                  # 本工作区
├── package.json                        # dsh.bundle.patch + dsh.client{platform:'web', inject:['theme','slots']}
├── cordis.patch.yml                    # - insert: [{id: ui-skin-<name>, name: <包名>}]
├── skin.json                           # 元数据卡（id/name/accent/bodyAttr/wiring.id/preview/order）
├── lib/
│   ├── index.js                        # Host：ctx.settings.register(<ns>, schema, {applies:'live'})
│   └── client.js                        # Client：apply(ctx) + 样式表 + 设置页
├── preview/{light,dark}.webp
├── docs/research_community-themes.md   # 本文件
├── docs/design-language.md             # 抄 endfield：色板表 + 派生变量表 + 对比度表 + 三条设计规则
└── test/                               # check.js（四类静态判据）+ 对比度断言 + 截图像素统计
```

**技术选型建议**：

| 决策点 | 建议 | 依据 |
|---|---|---|
| 令牌通道 | `ctx.theme.overrideTokens('<source>', {token:{light,dark}})` | §2.2；与 StyleVault 共存 |
| `inject` 写法 | `package.json` 的 `dsh.client.inject` 写**加载顺序**；`client.js` 的 `exports.inject = ['theme']` 只做**硬门控**；其余全走 `ctx.get()` | §1.1；避免可选服务缺失导致整个主题 pending |
| 持久化 | `ctx.settings.register` + `ctx.settingsScope` | §6.3；Desktop 随机端口 |
| 设置 UI | `slots.inject('settings.section', …)` | §2.4；与其它主题一致 |
| CSS 注入 | 优先 `styles.insert(css)`（Dynamic runner 内建，自动回收）；回落自建 `<style>` + 幂等标记 | §1.1 |
| 配色切换 | `<body>` 加/减 class + 令牌值用 `var()` 引用调色板变量 | §3.2；零重绘 |
| 自定义变量声明位置 | 值里**出现 `var(--dsw-*)`** 的必须声明在 **`body`**；值里没有的（如 `--dsw-font-family`）可放 `:root` | §2.2、§5.1 |
| **DOM 锚点策略** | **后缀匹配** `[class$='_centerCol']` + **根无关包含** `[class*='turnStatus']` + 官方 `data-*`；**禁用** hash 前缀 `.XxxxYy_root` | §2.3；hash 在 2.0.5 已全变 |
| 静态资源 | 装饰性 SVG 用 `btoa` 内联；大图放 `preview/` 外部文件；**用户上传走 Host 路由 + profile 文件** | §4 |
| Markdown | 只改 `--dsw-font-family` / `--ds-font-family-code` / `--dsw-alias-markdown-*`；**不要**匹配 hash 化类名 | §5.1 |
| 语法高亮 | 可以不接管（endfield 就没接管）；要接管则改 `--shiki-*`（11 项） | §5.2、§5.4 |
| 反品牌色 | 整组重映射 `--dsw-static-deepseek-*` | §3.2 |
| 明暗双模式 | 每个令牌都给双值；用断言验两种模式 | §3.2 |
| z-index | 全部 < 1000，且不要与同级元素 `z-index` 打平 | §6.6(d)、§7#24 |
| 测试 | 移植 endfield 的 `check.js` 判据 + `selftest.js` 变异测试 + 对比度断言 | §6.5 |

### 8.3 可以立刻照抄的三份参考

| 需求 | 参考文件 |
|---|---|
| **令牌覆盖 + 设置页注册 + 主题注册**的完整正确写法 | `~/.dsh/profiles/desktop/node_modules/dsh-stylevault/lib/client.js`（本机已装，可直接读） |
| **设计语言文档 + 对比度断言 + 静态校验器**的工程样板 | `.research/endfield/docs/design-language.md`、`check.js`、`test/palette-contrast.test.js` |
| **用户上传背景图 + 原子写 + 白名单校验**的 Host 实现 | `.research/denia/lib/index.js`（仅 153 行，读了就懂） |

---

## 附录

### A. 本地调研产物

```
.research/
├── denia/        # Ewnscat-ya/dsh-client-ui-skin-denia  (2.5 MB)
│   ├── lib/client.js   1673 行
│   ├── lib/index.js     153 行   ← Host：webServer 路由 + 原子写 + 白名单
│   ├── skin.json         29 行
│   └── cordis.patch.yml   7 行
├── endfield/     # ymh0000123/dsh-theme-endfield  (904 KB)
│   ├── client.js       4694 行   ← Client：令牌覆盖 + 等高线 canvas + 设置页
│   ├── index.js         174 行   ← Host：ctx.settings.register
│   ├── check.js         264 行   ← 四类静态判据
│   ├── docs/*.md       1025 行   ← design-language / engineering-notes / features / testing
│   └── test/*.js         22 个测试文件
└── eac/          # zouyuxuan122/Deepseek-Harness-EAC  (137 MB)
    └── dsh-desktop/assets/
        ├── skins/            10 款内置皮肤（各含 package.json/skin.json/cordis.patch.yml/lib/）
        │   └── dsh-skins-LICENSE.txt   BSD-3-Clause (zhu1090093659)
        ├── plugins/dsh-skin-switch/    皮肤切换（434 行 client + 341 行 host）
        ├── plugins/dsh-font-custom/    字体与颜色自定义
        └── SOURCES.json                113 个组件的完整来源台账
```

### B. 权威契约来源（本机 DSH Desktop 2.0.5）

根路径：`/nix/store/gq1mwqvq9zwyvss511vgjpm0k41q9rkh-dsh-desktop-2.0.5-unstable-2026-09-08/lib/dsh-desktop/resources/app/node_modules/dsh-plugin-desktop/node_modules/@deepseek-ai/`

| 包 | 提供 |
|---|---|
| `dsh-client-ui-theme` | `--dsw-*` 令牌表（唯一颜色权威）、`ctx.theme` 服务、`ThemeDefinition`/`ThemeSnapshot`/`ThemeTokenOverrides` 类型、6 个全局样式表、shiki 令牌 |
| `dsh-client-ui-layout` | **主题 presenter**（把令牌写成 `<body>` 行内样式、设 `data-ds-dark-theme`、`color-scheme`、`theme-color`） |
| `dsh-client-ui-settings` | `ctx.settingsScope`、`ctx.settingsSchema`、槽位类型声明 |
| `dsh-client-ui-slots` | `ctx.slots.inject` / `ctx.slots.register` |
| `dsh-client-ui-primitives/lib/markdown/` | 4 个 Markdown CSS Modules（MarkdownText / CodeBlock / MessageText / JsonBlock） |
| `dsh-settings` | `ctx.settings.register(ns, schema, {applies})` |
| `dsh`（`README.md:36`） | profile 结构、`bundles`、`patchReload: live|startup` |

### C. 关键 API 速查

```js
// ---- Client 半边 ----
exports.inject = ["theme"];           // 硬依赖；软依赖用 ctx.get()
exports.name   = "my-theme";
exports.apply  = function (ctx) { … };

const theme = ctx.get('theme');
if (theme === undefined) return;                       // 服务不可用时安全退出
const dispose = theme.overrideTokens('my-theme', {
    '--dsw-alias-bg-base':     { light: '#e8e8e2', dark: '#101110' },
    '--dsw-alias-label-primary': { light: '#101110', dark: '#f5f5f0' },
    '--dsw-alias-brand-primary': { light: '#101110', dark: 'var(--my-accent)' }, // 值可为 var()
});
// theme.register({ id:'my-theme', colorScheme:'light', tokens:{…} });   // 也可注册成可选主题

const slots = ctx.get('slots');
slots.inject('settings.section', () =>
    slots.register({ name:'settings.section', id:'my-theme', order:35, label:()=>'我的主题' }, Section));

const scope = ctx.get('settingsScope');
scope.set('enabled', '1');
scope.subscribe(() => reconcile(scope.getSnapshot().value));

ctx.effect(() => () => { /* dispose 一切副作用 */ });
```

```js
// ---- Host 半边（持久化路线）----
export const inject = ['settings'];
export function apply(ctx) {
    ctx.inject(['settings'], sctx => sctx.settings.register('my-theme', schema, { applies: 'live' }));
}
```

```js
// ---- Host 半边（自建路由路线，用于存大块二进制）----
export const inject = ['webServer'];
export function apply(ctx) {
    return ctx.webServer.register({ kind: 'exact', path: '/api/my-theme/settings', handler });
}
// handler 内必须：loopback 校验 → 字节上限 → 白名单校验 → 原子 rename 写入
```

### D. 参考链接

- [Ewnscat-ya/dsh-client-ui-skin-denia](https://github.com/Ewnscat-ya/dsh-client-ui-skin-denia)
- [zouyuxuan122/Deepseek-Harness-EAC](https://github.com/zouyuxuan122/Deepseek-Harness-EAC)
- [ymh0000123/dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield)
- [GptsApp/dsh-stylevault](https://github.com/GptsApp/dsh-stylevault)（本机已装 v0.3.0）
- [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（9 款皮肤上游）
- [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)（maid-atelier 上游）
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（插件目录）

### E. 许可证提示

| 项目 | 许可证 | 注意 |
|---|---|---|
| denia | **CC BY-NC-SA 4.0** | **禁止商业使用**；衍生必须同许可；署名链见其 `NOTICE` |
| endfield | MIT | 无原始素材，最宽松可借鉴 |
| EAC 内置皮肤 | BSD-3-Clause | 版权属 zhu1090093659；分发需保留版权声明 |
| StyleVault | MIT | 可自由参考 |

> 自研主题若使用任何游戏/影视角色素材，请照 denia 的做法：单独写 `NOTICE` 记录素材来源与版权方，README 声明"同人创作、与版权方无关联"，并选非商业许可。**endfield 的"全算法生成、零外部素材"路线可以完全回避这个问题。**
