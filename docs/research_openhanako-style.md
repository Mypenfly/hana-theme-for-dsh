# HanaAgent (openhanako) 设计风格调研报告

> 调研对象：`liliMozi/openhanako`（HanaAgent — 一个有记忆、有人格的私人 AI 助理，Electron 桌面应用）
> 调研范围：**主题配色**、**Markdown 渲染**、**可容纳的修饰**
> 调研方式：仓库完整克隆到 `.research/openhanako/`，逐文件阅读前端设计系统（`desktop/src/`），并做**全量 token 交叉审计**（定义 vs 消费）与**跨主题矩阵生成**。所有色值、选择器、行号均取自真实代码。

---

## 目录

- [0. 项目定位与设计哲学](#0-项目定位与设计哲学)
- [1. 主题配色体系](#1-主题配色体系)
  - [1.1 双层 token 架构](#11-双层-token-架构)
  - [1.2 主题注册、切换与校验](#12-主题注册切换与校验)
  - [1.3 11 套主题完整对比矩阵](#13-11-套主题完整对比矩阵)
  - [1.4 亮/暗对比逻辑（最值得学的一节）](#14-亮暗对比逻辑最值得学的一节)
  - [1.5 形状语言也能被主题覆盖](#15-形状语言也能被主题覆盖)
- [2. Markdown 渲染设计](#2-markdown-渲染设计)
  - [2.1 总览与排版哲学](#21-总览与排版哲学)
  - [2.2 完整规则表](#22-完整规则表)
  - [2.3 代码块与工具栏](#23-代码块与工具栏)
  - [2.4 Callout 系统](#24-callout-系统)
  - [2.5 两个可直接复用的技巧](#25-两个可直接复用的技巧)
- [3. 可容纳的修饰](#3-可容纳的修饰)
  - [3.1 纸质纹理：三层模型](#31-纸质纹理三层模型)
  - [3.2 晴天模式：视频叠层](#32-晴天模式视频叠层)
  - [3.3 「亮度补偿」是一个共同的母题](#33-亮度补偿是一个共同的母题)
  - [3.4 动效语言](#34-动效语言)
- [4. 字体系统](#4-字体系统)
- [5. 设计系统健康度审计](#5-设计系统健康度审计)
- [6. 迁移到 DSH：token 映射方案](#6-迁移到-dshtoken-映射方案)
- [附录](#附录)

---

## 0. 项目定位与设计哲学

HanaAgent 与前一阶段调研的三个 DSH 主题有**本质区别**：它不是"给别人的壳换皮"，而是**自带一套完整设计系统的产品**。这带来两个后果：

1. 它的主题层可以做得**极薄**（每套主题 61–73 行 CSS），因为**结构已经抽干净了**。
2. 它的设计决策带**完整注释与事故记录**，是一份现成的"设计立法"教材。

**核心视觉语言**：纸本手抄本（paper manuscript）。
- 默认主题叫「暖纸」（warm-paper），底色 `#F8F4ED`。
- 强调色叫「印章青蓝」（seal），`#537D96` —— 像一枚盖在纸上的印章。
- 新主题「新暖纸」的自述：*"纸本世界 + 5 档墨色 + 印章青蓝 + 极方圆角 + 0.5px hairline"*。

**最定义性的一个决策**：**AI 的正文用衬线体，界面外壳用无衬线体。**

```css
/* Chat.module.css:333-336 */
/* 助手回答正文用宋体 */
.messageAssistant :global(.md-content) {
    font-family: var(--font-serif);
}
```

即「**机器说的话像印在纸上，人用的控件像屏幕**」。这是整套设计里最值得抄的一条。

---

## 1. 主题配色体系

### 1.1 双层 token 架构

**这是 HanaAgent 设计系统最关键的结构，也是它主题能做到 61 行的原因。**

| 层 | 位置 | 内容 | 数量 | 主题可否覆盖 |
|---|---|---|---|---|
| **结构层** | `styles.css` 的 `:root` | 间距、圆角、时长、缓动、字号、字体、布局尺寸 | **81 项** | 仅少数（`--radius-*`、`--border-width`、`--font-*`） |
| **颜色层** | `themes/*.css` | 颜色、叠加色、语义色 | **50 项** | ✅ 全部 |

```css
/* styles.css:6-8 —— 明确声明「主题无关」 */
/* ========================================
   设计系统 · 结构 Token（主题无关）
   ======================================== */
:root {
    /* 间距 scale（数字 = px 值；9 档，Tailwind/Radix 4px 网格的真实子集） */
    --space-2: 0.125rem;   --space-4: 0.25rem;   --space-6: 0.375rem;
    --space-8: 0.5rem;     --space-10: 0.625rem; --space-12: 0.75rem;
    --space-16: 1rem;      --space-24: 1.5rem;   --space-32: 2rem;  --space-40: 2.5rem;

    /* 圆角 */
    --radius-xs: 3px;  --radius-sm: 5px;  --radius-md: 8px;  --radius-lg: 12px;

    /* 动效 · 时长（三档：所有 transition / 短动画归到这三档） */
    --duration-instant: 0.1s;   /* 瞬：hover、关闭、退场、撤销 */
    --duration-fast:    0.15s;  /* 快：默认（按钮、面板、focus、状态切换）*/
    --duration-slow:    0.25s;  /* 慢：模态、大块进场、强调动作 */

    /* 动效 · 缓动 */
    --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in:       cubic-bezier(0.7, 0, 0.84, 0);
    --ease-standard: cubic-bezier(0.2, 0, 0, 1);
    --ease-smooth:   cubic-bezier(0.22, 0.68, 0, 1);

    /* 字号层级（6 档，2026-07-07 收编 micro） */
    --fs-title:   1rem;     /* 区块标题、卡片标题 */
    --fs-body:    0.9rem;   /* 正文、label */
    --fs-ui:      0.82rem;  /* 次级 UI 文字、描述 */
    --fs-caption: 0.78rem;  /* 控件文字、小号正文 */
    --fs-hint:    0.7rem;   /* 提示、元数据、tag、badge */
    --fs-micro:   0.62rem;  /* 极小注记：角标计数、时间戳、键位标 */
}
```

**关键设计**：结构 token 里有三个"抽象层"允许主题覆盖圆角 —— 这是 theme 能改变**形状语言**的接口：

```css
/* styles.css:38-46 —— 主题可覆盖的抽象 token（默认值和现有视觉一致） */
--radius-input: 6px;          /* input / select / textarea / ghost button */
--radius-chat-surface: 16px;  /* 聊天输入框外壳 */
--radius-card: 8px;           /* SettingsSection body / skill-list-item 首尾 */
--radius-chat-card: 8px;      /* in-message chat cards */
--radius-chat-card-inner: max(2px, calc(var(--radius-chat-card) - 2px));  /* ← 嵌套圆角 */
--border-width: 1px;          /* 表单控件 / section body 边框粗细 */
```

> `--radius-chat-card-inner` 用 `calc()` 派生「**嵌套圆角 = 外圆角 − 内边距**」，这是让相邻不同圆角的卡片看起来不"抽搐"的标准手法。

**动效 token 的实际纪律**（全仓消费次数统计）：

| token | 用量 |
|---|---|
| `--duration-fast` | **460** |
| `--ease-out` | **267** |
| `--duration-slow` | 85 |
| `--duration-instant` | 84 |
| `--ease-in` / `--ease-standard` / `--ease-smooth` | 2 / 1 / 1 |

**"所有 transition 都归到三档时长"这条规则是被真实执行的** —— 没有散落的 `0.2s`、`0.3s`。

### 1.2 主题注册、切换与校验

**(a) 元数据集中在 JSON，代码不镜像常量**

```ts
// shared/theme-registry.ts:1-16
import data from './theme-registry-data.json';

export interface ThemeEntry {
  cssPath: string;        // 主题 CSS 路径
  backgroundColor: string; // 6 位 hex，用于窗口底色/闪屏
  i18nName: string;        // i18n key，不是字面量
  i18nMode: string;        // 白天/夜间 之类的副标题 key
}
export type ThemeId = keyof typeof data.themes;
export type StoredThemeSelection = ThemeId | 'auto';
```

```jsonc
// shared/theme-registry-data.json
{
  "storageKey": "hana-theme",
  "defaultTheme": "warm-paper",
  "autoLightDefault": "warm-paper",
  "autoDarkDefault": "midnight",
  "legacyThemeAliases": { "claude-design": "new-warm-paper" },
  "paperTextureBlockedThemeIds": ["midnight", "midnight-contrast"],
  "autoOption": { "id": "auto", "i18nName": "settings.appearance.auto", ... }
}
```

**(b) 启动即强校验（fail fast）**

```ts
// shared/theme-registry.ts:40-49
for (const [id, entry] of Object.entries(THEMES)) {
  if (!entry.cssPath || !entry.backgroundColor || !entry.i18nName || !entry.i18nMode) {
    throw new Error(`theme-registry: theme "${id}" is missing required fields (cssPath / backgroundColor / i18nName / i18nMode)`);
  }
  if (!/^#[0-9A-F]{6}$/i.test(entry.backgroundColor)) {
    throw new Error(`theme-registry: theme "${id}" has invalid backgroundColor "..." (must be 6-digit hex)`);
  }
}
```

**三个约束都被代码强制**：字段完整性、颜色格式、以及**主题名走 i18n key 而非字面量**。

**(c) 切换机制：属性 + 换 `<link>`**

```ts
// shared/theme.ts:19-27
function applyConcreteTheme(concrete: string): void {
  const entry = registry.THEMES[concrete as ThemeId];
  if (!entry) return;
  document.documentElement.setAttribute('data-theme', concrete);
  if (themeSheet) themeSheet.href = entry.cssPath;   // <link id="themeSheet">
  loadPaperTexturePreference();
  window.hana?.syncWindowTheme?.(concrete);          // 同步 Electron 原生窗口
}
```

要点：
- 主题作用域是 **`html[data-theme="…"]`**（不是 body），所以主题文件里写 `[data-theme="warm-paper"]`。
- **只加载激活的那一套主题 CSS**（换 href），不是全部注入再靠优先级竞争 —— 这也是主题能保持 61 行的原因。
- 默认主题同时兜底无属性场景：`[data-theme="warm-paper"], :root:not([data-theme])`。
- `auto` 模式监听 `matchMedia('(prefers-color-scheme: dark)')`，亮暗各映射到一个具体主题（warm-paper / midnight）。

**(d) 迁移机制**

```ts
export function migrateSavedTheme(raw: unknown): StoredThemeSelection {
  if (raw === 'auto') return 'auto';
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_THEME;
  if (LEGACY_THEME_ALIASES[raw]) return LEGACY_THEME_ALIASES[raw];  // claude-design → new-warm-paper
  return raw in THEMES ? raw as ThemeId : DEFAULT_THEME;            // 未知 id 静默回落默认
}
```

**旧 id → 别名表 → 未知回落默认**，三级降级，永不抛错。重命名主题时这是标准做法。

### 1.3 11 套主题完整对比矩阵

> 以下是**脚本从 11 个主题文件直接提取**的真实值（非人工整理）。空单元格 = 该主题未覆盖此 token（继承 `:root` 或其它默认）。

| token | warm-paper | new-warm-paper | coral | grass-aroma | absolutely | contemplation | delve | deep-think | high-contrast | midnight | midnight-contrast |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `--bg` | `#F8F4ED` | `#F5EFE4` | `#FDF6EC` | `#F5F8F3` | `#F4F3EE` | `#F3F5F7` | `#FFFFFF` | `#FCFCFD` | `#FAF8F7` | `#3B4A54` | `#26343D` |
| `--bg-card` | `#FCFAF5` | `#FBF7EE` | `#FFFBF3` | `#F9FBF7` | `#FAF9F5` | `#F8F9FB` | `#F7F7F8` | `#F8F8FA` | `#FDFBFA` | `#445560` | `#30414B` |
| `--sidebar-bg` | `#F4F0EA` | `#EFE8DB` | `#FCF1E4` | `#EFF3EC` | `#EDEAE2` | `#ECEFF2` | `#F0F0F0` | `#F0F0F2` | `#F3F1F0` | `#34424B` | `#202C34` |
| `--accent` | `#537D96` | `#537D96` | `#1A3049` | `#5BA88C` | `#B5846E` | `#7E99A8` | `#1A1A1A` | `#636AE8` | `#3A6B85` | `#C99AAF` | `#E6B1C4` |
| `--accent-hover` | `#456A80` | `#3F6179` | `#243A55` | `#4D9179` | `#A27460` | `#6B8594` | `#000000` | `#5158D4` | `#2E5870` | `#D8AFC0` | `#F0C4D3` |
| `--text` | `#3B3D3F` | `#2A2622` | `#1A3049` | `#2E3832` | `#2D2B28` | `#2C3238` | `#1A1A1A` | `#1D1D1F` | `#1A1C1E` | `#E1EAF0` | `#F0F6FA` |
| `--text-light` | `#6B6F73` | `#4A433C` | `#314153` | `#5E6B63` | `#6B6864` | `#5A6570` | `#6E6E6E` | `#65656B` | `#4A4E52` | `#B7C5CE` | `#D3E0E8` |
| `--text-muted` | `#8E9196` | `#6B6158` | `#727F89` | `#8A9490` | `#9B9793` | `#869098` | `#999999` | `#95959C` | `#6B6F73` | `#A3B5C0` | `#B7C8D3` |
| `--border` | `rgba(122,96,88,.18)` | `#D8CFBE` | `rgba(243,126,99,·)` | `rgba(91,168,140,·)` | `rgba(177,173,·)` | `rgba(126,153,·)` | `rgba(0,0,0,·)` | `rgba(0,0,0,·)` | `rgba(92,75,·)` | `rgba(170,121,141,.16)` | `rgba(230,177,·)` |
| `--shadow` | `rgba(59,61,63,.09)` | `rgba(42,38,34,.04)` | … | … | … | … | `rgba(0,0,0,·)` | `rgba(0,0,0,·)` | … | `rgba(0,0,0,.36)` | `rgba(0,0,0,·)` |
| `--green` | `#7BAE7F` | `#4A6B4A` | `#6E8C7A` | `#7BAE7F` | `#7BAE7F` | `#6FA87E` | `#5CB85C` | `#34A853` | `#5A9A5E` | `#8CC790` | `#A8DDAA` |
| `--coral` | `#EC8F8D` | `#8B2C1F` | `#F37E63` | `#D4887A` | `#C4917E` | `#C4827C` | `#D9746C` | `#D9746C` | `#D4716F` | `#EAB2A0` | `#F1BEAD` |
| `--danger` | `#8B3A3A` | `#8B2C1F` | `#A3483B` | `#8B4A3A` | `#8B3A3A` | `#8B4040` | `#8B3A3A` | `#8B3A3A` | `#7A3030` | `#C77070` | `#E28B8B` |
| `--hana-text` | `#2B3A4E` | `#2A2622` | `#1A3049` | `#1E3328` | `#2D2B28` | `#1C2830` | `#1A1A1A` | `#1D1D1F` | `#1A2A3A` | `#DCE6EC` | `#E8F1F6` |
| `--overlay-subtle` | `rgba(0,0,0,.03)` | `rgba(42,38,34,.03)` | `rgba(26,48,·)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | **`rgba(255,255,255,.03)`** | **`rgba(255,255,255,.·)`** |
| `--tool-bg` | `rgba(0,0,0,.03)` | `rgba(42,38,34,.03)` | `rgba(26,48,·)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | `rgba(0,0,0,.03)` | **`rgba(255,255,255,.03)`** | **`rgba(255,255,255,.·)`** |
| `--mood-text` | `#7D1C4A` | `#3F6179` | `#C86F4A` | `#6A5040` | `#8C6A58` | `#7D5A6A` | `#4A4A4A` | `#5158D4` | `#6A1540` | `#EAB2A0` | `#F1BEAD` |
| `--jian-note-bg` | `#FAF5E9` | `#FBF7EE` | `#FFF6E6` | `#FAF5E9` | `#FAF5E9` | `#FAF5E9` | `#FAFAF8` | `#FAFAF8` | `#FAF5E9` | `#4B5A63` | `#354852` |
| `--link` / `--link-hover` / `--link-rgb` | — | — | — | — | — | — | — | — | — | **`#B9E2FF`/`#D7F0FF`** | **`#B9E2FF`/`#D7F0FF`** |
| `--sidebar-bridge-card-text` | — | — | — | — | — | — | — | — | — | **`#26323A`** | **`#26323A`** |
| `--tab-slider-bg` / `--tab-slider-shadow` | — | — | — | — | — | — | — | — | — | **`var(--overlay-strong)` / `none`** | 同 |
| `--radius-*`（全部 5 项）+ `--border-width` | — | **`2/3/4px` + `0.5px`** | — | — | — | — | — | — | — | — | — |
| `--bg-texture` | **44 KB base64（死代码，见 §5）** | — | — | — | — | — | — | — | — | — | — |
| `--select-arrow` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**从矩阵能读出的设计规律**：

1. **只有 2 套暗色主题**（midnight / midnight-contrast），其余 9 套都是亮色 —— 但暗色主题**多覆盖 6 个 token**（见 §1.4）。
2. **`--overlay-*` / `--tool-bg` / `--attach-bg` 在暗色主题里极性反转**（黑→白）。
3. **`delve` 的强调色是 `#1A1A1A`（近黑）** —— 一套纯无彩色主题；`deep-think` 是唯一的靛蓝 `#636AE8`，最"科技感"。
4. **`new-warm-paper` 是唯一改变形状语言的**（全圆角降到 2/3/4px + 0.5px 发丝线）。
5. **亮色主题的 `--coral` 普遍是柔和的**（`#EC8F8D`、`#D4887A`），`new-warm-paper` 却用 `#8B2C1F`（深朱）—— 它的自我定位是*"墨染，极克制"*。
6. **主题命名是"角色化"的**，不是描述性的：

   | id | 显示名 | 副标题 |
   |---|---|---|
   | warm-paper | 暖纸 | 白天 |
   | new-warm-paper | 新暖纸 | 纸本 |
   | midnight | 青夜 | 夜间 |
   | high-contrast | 素白 | 高对比 |
   | grass-aroma | 草香 | **Butter** |
   | contemplation | 沉思 | **Ming** |
   | absolutely | Absolutely | 有一点点熟悉 |
   | delve | 随时准备接住你 | 探究一下 |
   | deep-think | **用户彻底怒了** | 小鲸鱼 |
   | coral | 珊瑚 | 春日和纸 |

   （副标题是**人格名**，对应 §1 提到的多角色 Agent 系统。）**这种"有性格的命名"本身是设计语言的一部分**，与 DSH 社区主题的"初音未来 · 电子歌姬"式命名是两种不同的声音。

### 1.4 亮/暗对比逻辑（最值得学的一节）

#### (a) 核心机制：`--overlay-*` 极性反转

```css
/* warm-paper.css（亮） */
--overlay-subtle: rgba(0, 0, 0, 0.03);
--overlay-light:  rgba(0, 0, 0, 0.05);
--overlay-medium: rgba(0, 0, 0, 0.08);
--overlay-strong: rgba(0, 0, 0, 0.15);

/* midnight.css（暗）—— 全部翻成白色 */
--overlay-subtle: rgba(255, 255, 255, 0.03);
--overlay-light:  rgba(255, 255, 255, 0.05);
--overlay-medium: rgba(255, 255, 255, 0.08);
--overlay-strong: rgba(255, 255, 255, 0.15);
```

**语义是"在背景上叠一层"，因此亮色下是压暗、暗色下是提亮。**

#### (b) 由此引出的立法：`--overlay-*` 禁止用于 box-shadow

```css
/* styles.css:58-59 —— 原文照抄 */
/* scrim 遮罩分档（样式立法⑤ 任务 B）：overlay/backdrop 压暗背景专用，
   禁止用于 box-shadow（overlay 语境在暗主题会翻白，见 --overlay-* 同类事故） */
--scrim-15: rgba(0, 0, 0, 0.15);
--scrim-30: rgba(0, 0, 0, 0.3);
--scrim-35: rgba(0, 0, 0, 0.35);
--scrim-45: rgba(0, 0, 0, 0.45);
```

**这是整份设计系统里最有价值的一条经验**：

- `--overlay-*` 是**主题可覆盖**的，极性随亮暗反转。
- 阴影需要一个**永远是黑色**的透明度档 → 因此单独设 `--scrim-*`，且**放在 `:root`（结构层）里，不受主题影响**。
- 事故现场：把 `--overlay-*` 用在 `box-shadow` 上，暗色主题下阴影变成**白色发光**（"翻白"）。

> 这一条直接解释了为什么 HanaAgent 的结构层里有 `--scrim-*` 这个看起来"和 overlay 重复"的 token —— **它存在的唯一理由就是防止一个具体的事故复现**。这是"立法式 token"的范例。

#### (c) 暗色主题多需要的 token（亮色主题不需要）

| token | 亮色从哪来 | 暗色为何必须覆盖 |
|---|---|---|
| `--link` / `--link-hover` / `--link-rgb` | `:root` 里派生：`--link: var(--accent, #537D96)` | 暗色强调色是**粉**（`#C99AAF`），当链接色不可读 → 换成浅蓝 `#B9E2FF` |
| `--sidebar-bridge-card-text` | 未定义（走组件默认） | 侧栏卡片上的深色文字 |
| `--tab-slider-bg` / `--tab-slider-shadow` | 未定义 | 暗色下 tab 滑块不能用白底阴影 |
| `--overlay-*` / `--tool-bg` / `--attach-bg` | `rgba(0,0,0,α)` | **极性反转** |
| `--paper-texture-card-blend-mode` | `lighten` | 改成 `normal`（见 §3.1） |

**可复用的规则**：**凡是"半透明叠加色"和"依赖背景明暗推导出来的色"，暗色主题都必须重新给值，而不能沿用。** 亮色主题则可以大量继承 `:root` 派生值。

#### (d) 一个聪明的默认值技巧

```css
/* styles.css:45-48 —— 链接色默认跟随强调色 */
--link:       var(--accent, #537D96);
--link-hover: var(--accent-hover, var(--link));
--link-rgb:   var(--accent-rgb, 83, 125, 150);
```

**三层向后兼容**：主题给了 `--accent` → 链接自动跟随；没给 → 用硬编码兜底；给了 `--link-hover` → 覆盖派生。这样**9 套亮色主题一行链接色都不用写**。

### 1.5 形状语言也能被主题覆盖

`new-warm-paper` 是唯一这么做的主题 —— 说明这是被刻意保留的能力：

```css
/* new-warm-paper.css:60-69 —— 注释原文 */
/* ─── 主题级 override：圆角与边框（规范强约束："controls are seals, 方") ───
 * 同时覆盖 :root 定义的全局 radius token，让整个应用（不止设置页）统一为方 */
--radius-sm:     2px;   /* 规范 --r-sm：input/button/chip */
--radius-md:     3px;   /* 规范 --r-md：card / list block / dropzone */
--radius-lg:     4px;   /* 规范 --r-lg：modal */
--radius-input:  2px;
--radius-card:   3px;
--radius-chat-surface: 6px;   /* 聊天输入框：比方角主题其他元素略圆，保留一点柔和 */
--radius-chat-card:    4px;
--border-width:  0.5px;       /* 规范：0.5px hairline */
```

**三个可学的点**：
1. **一个主题 = 一套形状语言 + 一套配色**，不只是换色。
2. `--border-width: 0.5px` 做发丝线 —— 印刷品质感的关键。
3. 注释明确写出"规范强约束"，说明圆角不是任意值而是**有设计规范来源的**。
4. 例外处理得当：全局方角，但**输入框保留 6px**（"保留一点柔和"）—— 不做教条主义。

---

## 2. Markdown 渲染设计

### 2.1 总览与排版哲学

Markdown 渲染样式集中在 `styles.css` 的 **943–1344 行**（约 400 行），全部以 `.md-content` 为根作用域。

**核心排版参数**：

| 项 | 值 | 说明 |
|---|---|---|
| 行高 | **1.75** | 明显比常见聊天界面（1.5–1.6）松，是"阅读"取向而非"信息密度"取向 |
| 段间距 | `0 0 0.5em 0` | **紧**；靠行高而不是段距拉开呼吸 |
| 正文家族 | `--font-serif`（助手）/ `--font-ui`（其它） | 见 §0 |
| 图片 | `max-height: min(520px, 70vh)` + `object-fit: contain` | 防止长截图把聊天区撑爆 |
| h1 | **`text-align: center`** | 唯一一个居中的 markdown 元素 —— 编辑/印刷传统 |

**h1 居中**是一个很有意思的细节：它让"文档标题"和"章节标题"在视觉上区分开，是印刷排版的习惯搬进聊天界面。

标题字号刻意做得很小（1.2em / 1.1em / 1.05em），注释写明：*"标题（助手消息里偶尔用到）"* —— **承认聊天场景里标题是次要元素**，不抢正文的阅读权重。

### 2.2 完整规则表

| 元素 | 关键声明 | 设计意图 |
|---|---|---|
| `.md-content` | `line-height: 1.75` | 阅读行高 |
| `p` | `margin: 0 0 0.5em 0`；`:last-child` 归零 | 紧凑段距 |
| `img` | `display:block; max-width:100%; max-height:min(520px,70vh); object-fit:contain; border-radius:var(--radius-sm)` | **收进正文列**（注释：*"避免大图撑宽聊天区"*） |
| `code`（行内） | `font-family:var(--font-mono); font-size:0.85em; background:var(--overlay-light); padding:.15em .35em; border-radius:4px` | 极轻底色 |
| `pre` | `background:var(--overlay-subtle); border:1px solid var(--border); border-radius:var(--radius-md); padding:var(--space-8) var(--space-16); line-height:1.5` | 边框比底色更明显 |
| `pre code` | `background:none; padding:0; border-radius:0; font-size:0.82em` | 嵌套时清空内层 |
| `blockquote` | `border-left:2px solid var(--border); padding-left:var(--space-16); color:var(--text-light); font-style:italic` | 斜体 + 次级色 |
| `a` | `color:var(--link); text-decoration:none; border-bottom:1px solid rgba(var(--link-rgb),.35)` | **用下边框代替 text-decoration**（可单独调透明度/颜色，且 hover 可只改边框） |
| `a:hover` | `color:var(--link-hover); border-color:var(--link-hover)` | |
| `h1..h6` | `font-weight:600; margin:.6em 0 .3em 0; line-height:1.4`；h1 居中 | 收敛的标题层级 |
| `hr` | `border-top:1px solid var(--border); margin:var(--space-8) 0` | |
| `ul, ol` | `padding-inline-start:2em; list-style-position:outside` | 用逻辑属性（RTL 友好） |
| `li` | `margin:.15em 0` | 极紧 |
| `li.task-list-item` | `list-style:none; margin-left:-1.2em`（checkbox 再 `margin-right:.4em; top:-1px`） | **抵消列表缩进让 checkbox 对齐** |
| `table` | `border-collapse:collapse; width:100%; font-size:.9em` | |
| `th,td` | `border:1px solid var(--border); padding:.3em .6em; overflow-wrap:anywhere; word-break:break-word` | |
| `th` | `background:var(--overlay-subtle); font-weight:600` | 表头靠极轻底色 |
| `.markdown-table-scroll > table` | `table-layout:fixed; margin:0` | 滚动容器内固定布局 |
| `.katex` / `.katex-block` | `color:var(--text)`；`overflow-x:auto; overflow-y:hidden` | KaTeX 块级横向滚动 |
| `.mermaid-diagram` | 卡片化：`border:var(--panel-card-border); border-radius:var(--radius-chat-card); background:var(--panel-card-bg)` + 源码切换工具栏 | 图表当卡片对待 |
| `strong` / `em` | `600` / `italic` | |

> 注意：**代码块没有语法高亮 token**（不像 DSH 有 `--shiki-*`）。高亮由 markdown 渲染库自带，主题不管。这对迁移是个简化点（见 §6）。

### 2.3 代码块与工具栏

这是一个**独立于 markdown 内容的组件级设计**，值得单独看。

```css
/* styles.css:1047-1058 —— 注释是整段最值钱的 */
/* 代码块 wrapper：非滚动定位祖先，让复制按钮锚在可视区右上角不随横滚漂移 */
.md-content .code-block-wrap {
    --code-block-toolbar-size: 1.7rem;
    position: relative;
    margin: var(--space-16) 0;
}
/* wrapper 内的 pre 外边距归零，由 wrapper 接管；顶部按工具栏高度留位 */
.md-content .code-block-wrap > pre {
    margin: 0;
    padding-top: calc(var(--code-block-toolbar-size) + var(--space-4));
}
```

**这个技巧值得抄**：`pre` 自己是 `overflow-x: auto`（一个滚动容器）。如果把按钮 `position: absolute` 锚在 `pre` 上，**横向滚动时按钮会跟着代码一起滑走**。解法是：
1. 外面加一层 `.code-block-wrap` 作**非滚动的定位祖先**；
2. `pre` 的 `margin` 归零，位置完全由 wrapper 接管；
3. `pre` 的 `padding-top` 按工具栏高度预留，按钮浮在那块留白上。

**工具栏本身的克制**：

```css
.md-content .code-block-wrap .code-block-toolbar-btn {
    color: var(--text-muted);
    width/height: var(--code-block-toolbar-size);
    cursor: default;
    opacity: 0.35;                                    /* ← 静息时几乎隐形 */
    transition: opacity var(--duration-fast), color var(--duration-fast);
}
.code-block-toolbar-btn:hover, :focus-visible { color: var(--accent); opacity: 1; }
.code-block-toolbar-btn[data-active="true"] { color: var(--accent); opacity: 0.7; }
```

- 静息 `opacity: 0.35` —— 不干扰阅读，hover 才"亮起来"。
- `cursor: default`（不是 `pointer`）—— 刻意的"这不是主要内容"信号。
- 用 **`data-*` 属性做状态**（`data-active` / `data-copied` / `data-wrap`），CSS 不参与逻辑。

**"已复制"反馈用属性内容，天然支持 i18n**：

```css
.code-block-toolbar-btn[data-copied="true"]::after {
    content: attr(data-copied-label);     /* ← 文案由 JS 按语言塞进属性 */
    position: absolute; top: 50%; right: calc(100% + var(--space-4));
    transform: translateY(-50%);
    background: var(--bg-glass, var(--bg-card));
    color: var(--accent);
    font-size: var(--fs-hint);
    white-space: nowrap; pointer-events: none;
}
```

**自动换行开关**只需一个属性：

```css
.code-block-wrap[data-wrap="true"] > pre {
    white-space: pre-wrap; word-break: break-all; overflow-x: hidden;
}
```

### 2.4 Callout 系统

**8 种语义 callout 只靠一个局部变量区分**，这是全篇最优雅的实现：

```css
.md-content .markdown-callout {
    --callout-rgb: var(--accent-rgb, 83, 125, 150);     /* ← 局部变量，默认跟随 accent */
    margin: 0.65em 0;
    padding: 0.55em 0.8em 0.6em 0.9em;
    border-left: 2px solid rgba(var(--callout-rgb), 0.58);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;   /* 左侧直角贴住竖线 */
    background: rgba(var(--callout-rgb), 0.055);            /* 极淡 */
    color: var(--text);
    font-style: normal;                                     /* 覆盖 blockquote 的 italic */
}
.md-content .markdown-callout-title {
    color: rgb(var(--callout-rgb));
    font-size: 0.88em; font-weight: 600;
}

/* 8 个变体：每个只改一行 */
.markdown-callout-abstract, -info, -todo, -question, -example { --callout-rgb: var(--accent-rgb, 83,125,150); }
.markdown-callout-tip, -success                              { --callout-rgb: 92, 137, 106; }   /* 绿 */
.markdown-callout-warning                                    { --callout-rgb: 166, 113, 57; }   /* 琥珀 */
.markdown-callout-failure, -danger, -bug                     { --callout-rgb: var(--coral-rgb, 139,44,31); }
.markdown-callout-quote                                      { --callout-rgb: 116, 111, 104; }  /* 中性 */
```

**可学之处**：
1. **一个 alpha 化的 RGB 三元组驱动"边框 0.58 / 底色 0.055 / 标题 1.0"三个层次** —— 保证任意色相下三个层次的相对关系恒定。
2. **变体只覆盖一行变量**，不重复整个规则块。
3. **`--callout-rgb` 是局部作用域**（定义在 `.markdown-callout` 上），不污染全局，也不需要在主题里声明。
4. 用 `--accent-rgb` 兜底：**主题不给 callout 配色时自动跟随强调色**。
5. 注释点明了设计意图：*"Callout：正文里的轻提示，和工具调用卡片保持视觉区分"* —— 即**同类元素必须有可辨的视觉层级**。
6. 同时支持 `div` 与 `<details>`（`details.markdown-callout { cursor: default }` + `summary.markdown-callout-title`）。

### 2.5 两个可直接复用的技巧

**(a) 用 `border-bottom` 代替 `text-decoration` 做链接下划线**

```css
.md-content a {
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--link-rgb), 0.35);
    transition: color var(--duration-fast), border-color var(--duration-fast);
}
.md-content a:hover { color: var(--link-hover); border-color: var(--link-hover); }
```

好处：下划线颜色/透明度可独立控制（`text-decoration-color` 兼容性和继承更麻烦）；hover 时能**只改下划线不动文字颜色**；不会在换行时出现难看的下划线断裂。要加 `padding-bottom` 还可以做"下划线离字更远"的效果。

**(b) 用户消息气泡的"尾巴"用嵌套圆角实现**

```css
/* Chat.module.css:98-105 */
.messageUser {
    background: rgba(0, 0, 0, 0.045);
    padding: var(--space-8) var(--space-16);
    border-radius: var(--radius-chat-card) var(--radius-chat-card)
                   var(--radius-chat-card-inner)   /* ← 右下角收小 = 尾巴 */
                   var(--radius-chat-card);
}
```
配合 `:root` 的 `--radius-chat-card-inner: max(2px, calc(var(--radius-chat-card) - 2px))`。**一个不对称的四角圆角 + 一个 calc 派生的内圆角**就做出了气泡指向感，不需要伪元素三角形。

---

## 3. 可容纳的修饰

### 3.1 纸质纹理：三层模型

整个功能在 `styles.css` **120–176 行**（56 行），注释自带结构说明：

```css
/* ========================================
   纸质纹理系统
   开关：body.paper-texture 显式开启全部纹理
   三层：surface → card → surface 亮度补偿
   新增 card 元素只需往 Card 层追加选择器
   ======================================== */

/* ① Surface 层：铺底元素直接叠纹理 */
body.paper-texture,
body.paper-texture .titlebar,
body.paper-texture .sidebar {
    background-image: url(./assets/textures/rice-paper.png);
    background-repeat: repeat;
    background-size: 160px;
    background-attachment: fixed;
}

/* ② Card 层：bg-card 元素用 lighten 混合，纹理暗部被背景色提亮 */
body.paper-texture .universal-card,
body.paper-texture .jian-card,
body.paper-texture .msg-card,
body.paper-texture .input-wrapper,
body.paper-texture .hana-warning-box,
body.paper-texture .browser-floating-card,
body.paper-texture .hana-toast,
body.paper-texture .ob-input,
body.paper-texture .provider-card,
body.paper-texture .ob-provider-trigger,
body.paper-texture .ob-provider-menu,
body.paper-texture .model-list,
body.paper-texture .tutorial-card,
body.paper-texture .yuan-chip {
    background-image: url(./assets/textures/rice-paper.png);
    background-size: 160px;
    background-attachment: fixed;
    background-blend-mode: var(--paper-texture-card-blend-mode);
}

/* ③ 亮度补偿：暖白叠层抵消纹理变暗（暗色主题跳过） */
html:not([data-theme="midnight"]):not([data-theme="midnight-contrast"]) body.paper-texture::before {
    content: '';
    position: fixed; inset: 0;
    z-index: -1;
    pointer-events: none;
    background: rgba(255, 253, 247, 0.35);
}
```

**四个设计要点**：

1. **开关是一个 body class**（`body.paper-texture`），不是组件状态 —— 所以纹理能穿透到任何容器，且**新增卡片只需往 ② 的选择器列表追加一行**（注释明确写了这条维护约定）。
2. **`background-attachment: fixed`** 是关键：纹理相对于**视口**固定，滚动时纸纹不跟着滚 —— 这才是"纸在界面下面"而不是"纸贴在每个元素上"。
3. **`background-blend-mode: var(--paper-texture-card-blend-mode)`** 把"卡片上的纸纹效果"变成主题变量：
   - 亮色主题默认 `lighten`：*"纹理暗部被背景色提亮"* —— 卡片保持干净。
   - **两套暗色主题改成 `normal`**（`styles.css:127-134`）。原因：暗色底上 `lighten` 会让纹理不可见或发灰。**这是一个"混合模式也需要按亮暗切换"的真实案例。**
4. **第 ③ 层的存在本身就是一条经验**：纹理叠加会让整体变暗，所以补一层 0.35 的暖白（`rgba(255,253,247,.35)`）在 `z-index: -1` 上抵消；并用 `:not([data-theme="midnight"])…` 让暗色主题跳过（暗色不需要补偿，会过曝）。

### 3.2 晴天模式：视频叠层

这是一个**非常"有个性"的装饰功能**，i18n 文案是：

```
leavesOverlay:      "晴天模式"
leavesOverlayHint:  "去摸摸草（和阳光）"
```

实现只有 75 行（`react/components/LeavesOverlay.tsx`）：

```tsx
/**
 * LeavesOverlay — 树阴光影叠层
 *
 * 循环播放 leaves-overlay.mp4（正放+倒放拼接，无缝循环），
 * mix-blend-mode: multiply 让白色区域透明，阴影叠在界面上。
 * 通过 body class toggle 控制开关（和纸质纹理同一模式）。
 */
export const LeavesOverlay = memo(function LeavesOverlay() {
  ...
  if (!enabled) return null;

  return (
    <>
      {/* 亮度补偿（抵消 multiply 视频变暗） */}
      <div style={{ position:'fixed', inset:0, zIndex:139, pointerEvents:'none',
                    background:'rgba(255, 253, 247, 0.12)' }} />
      <video ref={videoRef} autoPlay loop muted playsInline
        style={{ position:'fixed', inset:0, width:'100%', height:'100%',
                 objectFit:'cover', mixBlendMode:'multiply',
                 opacity:0.28, pointerEvents:'none', zIndex:140 }}>
        <source src={leavesSrc} type="video/mp4" />
      </video>
    </>
  );
});
```

**六个可复用的技术点**：

| 技术 | 说明 |
|---|---|
| **`mix-blend-mode: multiply`** | 视频白区自然透明，**只有阴影落在界面上** —— 不用做任何 alpha 抠像 |
| **正放+倒放拼接的 mp4** | "无缝循环"在**素材里预烘焙**，代码里只用 `loop` —— 零 JS 循环逻辑 |
| **亮度补偿层** | `zIndex: 139` + 视频 `140`；`rgba(255,253,247,0.12)` 抵消 multiply 变暗（**与纸质纹理第 ③ 层同一母题**） |
| **`pointerEvents: 'none'`** | 两个层都不拦点击（否则整个应用点不动） |
| **`muted` + `playsInline` + `.play().catch(()=>{})`** | 绕过自动播放限制且不弹错 |
| **`localStorage` + `CustomEvent` on `window`** | 跨窗口（主窗/设置窗）实时同步，无需 IPC |

> ⚠️ **注意这个装饰没有处理 `prefers-reduced-motion`** —— 一个全屏循环播放的视频对前庭敏感用户是不友好的。你迁移时应当补上（`§5` 详述）。

**素材清单**（`desktop/src/assets/textures/`，共 2.8 MB）：

| 文件 | 大小 | 用途 |
|---|---|---|
| `rice-paper.png` | 132 KB | 纸质纹理（实际使用） |
| `rice-paper-2.png` | 313 KB | 备用 |
| `rice-paper-3.png` | 33 KB | 备用 |
| `leaves-overlay.mp4` | **2.38 MB** | 晴天模式 |

### 3.3 「亮度补偿」是一个共同的母题

把前面两处放在一起看，会发现**同一个设计原则被用了两次**：

| 装饰 | 副作用 | 补偿方式 |
|---|---|---|
| 纸质纹理（`multiply`/`lighten` 叠加） | 整体变暗 | `body.paper-texture::before` 铺 `rgba(255,253,247,.35)`，`z-index:-1` |
| 晴天视频（`multiply` 混合） | 整体变暗 | 独立 `<div>` 铺 `rgba(255,253,247,.12)`，`zIndex:139`（视频下一层） |

**原则**：**任何"叠加式"装饰都会改变整体明度，必须显式补一层反向的纯色层把它校准回来，而不是去调纹理本身的透明度。** 对暗色主题还要判断是否需要跳过（纸质纹理就跳过了）。

这个原则可以直接用到 DSH 主题上：如果你做背景图/纹理叠加，一定要检查文字对比度是否被整体拉低。

### 3.4 动效语言

`desktop/src/animations.css` —— **195 行，25 个 `@keyframes`**，文件头第一句就是它的定位：

```css
/* 所有 @keyframes 的唯一真相来源（single source of truth）。 */
```

**25 个关键帧全部以 `hana-` 前缀命名**，按用途成组：

| 组 | 关键帧 |
|---|---|
| 加载 | `hana-spin`、`hana-globe-spin`、`hana-cycling-dots`、`hana-typewriter-dots` |
| 淡入淡出 | `hana-fade-in`、`hana-fade-out`、`hana-fade-up`、`hana-fade-down` |
| 方向位移 | `hana-slide-in-left`/`-out-left`、`hana-slide-in-top`/`-out-top`、`hana-card-slide-down`、`hana-folder-history-in` |
| 聊天专用 | `hana-stream-tail-in`（流式尾块）、`hana-chat-soft-down-in`、`hana-chat-soft-up-in` |
| 强调 | `hana-scale-in`、`hana-popout`、`hana-pulse`、`hana-expand` |
| 展开/收起 | `hana-rise`、`hana-retract` |
| 其它 | `hana-hint-fade` |

**参数化用 CSS 自定义属性传入**：

```css
/* Chat.module.css:9-14 */
.messageGroup {
    display: flex; flex-direction: column;
    --slide-y: 8px;                                        /* 位移量由使用方给 */
    animation: hana-fade-up var(--duration-slow) var(--ease-out);
}
```

**时长与缓动一律引用 token**（`--duration-slow` / `--ease-out`），不写字面量 —— 见 §1.1 的用量统计。

#### ⚠️ `prefers-reduced-motion` 的处理方式是这套系统的一个缺陷

**`animations.css` 里没有任何 `prefers-reduced-motion`**。降低动效是在**消费点**逐个手写白名单：

```css
/* Chat.module.css:2266-2278 */
@media (prefers-reduced-motion: reduce) {
    .streamTailChunk,
    .streamMarkdownBlockEnter,
    .moodWrapper,
    .interludeRow,
    .toolGroup,
    .thinkingBlock,
    .cronConfirmCard,
    .settingsConfirmCard,
    .settingsUpdateCard,
    .mediaGenerationCard,
    .legacyArtifactCard,
    .browserScreenshot { ... }
}
```

全仓只有 17 个文件提到 `prefers-reduced-motion`。

**问题**：每新增一个带动画的 class，都必须**记得**手工加进某个白名单 —— 这是一个会持续腐化的模式（对比 endfield 的做法：`contourWantsAnim()` 在 JS 里统一判断，外加设置页显式提示用户"系统已启用减少动效"）。

**迁移建议**：在 DSH 主题里改成**在 `animations` 的源头统一处理**：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

（或用 `:where()` 降低特异性，方便个别元素例外。）

---

## 4. 字体系统

### 4.1 四个角色，而不是一个"字体"

```css
/* styles.css:84-90 —— 字体默认值：主题 CSS 可 override */
--font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue',
           'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-serif: 'EB Garamond', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', serif;
/* 正文阅读衬线：markdown 预览/编辑正文专用，西文 PT Serif；
   与 --font-serif（标题/装饰衬线，EB Garamond）区分为 text face vs display face */
--font-serif-text: 'PT Serif', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

**这是专业的字体分工**：

| token | 家族 | 角色 | 用在哪 |
|---|---|---|---|
| `--font-ui` | Inter | 界面无衬线 | 控件、按钮、label、tooltip、思考块 |
| `--font-serif` | **EB Garamond** | **Display face**（大字号/标题用的衬线） | **助手回答正文**、标题 |
| `--font-serif-text` | **PT Serif** | **Text face**（长文阅读用的衬线） | markdown 编辑器/预览正文 |
| `--font-mono` | JetBrains Mono | 等宽 | 行内 code、代码块 |

注释里明确写出 **"text face vs display face"** —— 这是印刷排版的术语：display face 笔画对比强、适合大字号；text face 笔画更均匀、适合小字号长文。

**一个值得注意的不一致**：`Chat.module.css:334-336` 里助手回答用的是 `--font-serif`（EB Garamond，display face）而不是 `--font-serif-text`（PT Serif，text face）—— 而后者才是长文阅读的专用脸。这可能是**有意的**（助手回答字号较大、且要"有存在感"），也可能是遗留的疏漏。迁移时你可以自己选：**想要"书感"用 Garamond，想要"耐读"用 PT Serif**。

**中文字体的 fallback 链是完整的**：`Noto Serif SC` → `Source Han Serif SC` → `Songti SC` → `STSong` —— 覆盖了开源思源宋体、macOS 宋体、Windows 宋体（STSong 实际是华文宋体，在 macOS 上）。

### 4.2 衬线/无衬线可切换

```css
/* styles.css:178-182 —— 无衬线模式：覆盖 --font-serif 为当前 UI 字体 */
body.font-sans {
    --font-serif: var(--font-ui);
    --font-serif-text: var(--font-ui);
}
```

```ts
// shared/theme.ts —— 衬线体 / 无衬线体切换
function setSerifFont(enabled: boolean): void {
  document.body.classList.toggle('font-sans', !enabled);
}
```

**一个 class 同时关掉两个衬线变量** —— 因为所有消费点都引用变量，不需要改任何组件。

### 4.3 字体离线打包

**`themes/new-warm-paper-fonts.css`：4200 行，被 `styles.css` 第一行 `@import`。**

```css
/* styles.css:1-2 */
@import url('./themes/new-warm-paper-fonts.css');
@import url('./animations.css');
```

**它是一份完整的自托管 `@font-face` 表**：

| 项 | 值 |
|---|---|
| 家族数 | **5**：`EB Garamond`、`PT Serif`、`Inter`、`JetBrains Mono`、`Noto Serif SC` |
| 字重 | 300 / 400 / 450 / 500 / 600 / 700 |
| 文件 | `themes/fonts/` 共 **111 个 woff2，6.5 MB** |
| `font-display` | 全部 `swap` |
| `unicode-range` 声明 | **521 条**（按子集切片） |
| 无 CDN 引用 | ✅ 完全离线 |

**按家族的体积分布**（关键发现）：

| 家族 | 文件数 | 体积 |
|---|---|---|
| `notoserifsc`（中文宋体） | **99** | **6.0 MB** |
| `ebgaramond` | 4 | 232 KB |
| `inter` | 2 | 132 KB |
| `jetbrainsmono` | 2 | 44 KB |
| `pt-serif-v11-latin` | 4 | — |

**结论：6.5 MB 里 6.0 MB 是中文。** 拉丁字体按 regular/italic/bold/bolditalic 四份切片（每个家族 4 文件），中文则切成 **99 份 unicode-range 子集**按需加载 —— 这正是 `unicode-range` 的 521 条声明的来源，也是**中文 Web 字体唯一可行的做法**（否则用户要下载 10 MB+）。

> 文件名叫 `new-warm-paper-fonts.css` 但由全局 `styles.css` 引入，注释也说明了：*"字体离线打包由全局 styles.css 引入；当前主题使用全局默认字体"* —— **命名是个历史遗留，实际是全主题共享的字体层**。迁移时不要被名字误导。

### 4.4 编辑器排版阶梯

```css
/* styles.css:92-103 —— 编辑器默认排版：用户设置写入同名变量，主题仍可覆盖初始值 */
--editor-markdown-font-family: var(--font-serif-text);
--editor-markdown-font-size: 16px;
--editor-markdown-h1-font-size: 28px;
--editor-markdown-h2-font-size: 21px;
--editor-markdown-h3-font-size: 18px;
--editor-markdown-h4-font-size: 16px;
--editor-markdown-h5-font-size: 15px;
--editor-markdown-h6-font-size: 14px;
--editor-markdown-line-height: 1.5;
--editor-markdown-content-padding-x: var(--space-24);
--editor-markdown-content-width: 720px;
```

**注释里有一句至关重要**：*"用户设置写入同名变量，主题仍可覆盖初始值"* —— 即**同一组变量有三层优先级**：

```
主题 CSS 初始值  →  用户设置（写入同一个变量）  →  最高
```

这是一个很干净的做法：不需要"用户设置 vs 主题"的冲突解决逻辑，**后写的行内样式自然胜出**。

**注意聊天区的行高是 1.75，编辑器是 1.5** —— 有意区分：聊天要"读得舒服"，编辑器要"写得紧凑"。

**h1(28) → h2(21) → h3(18) → h4(16) → h5(15) → h6(14)** 的阶梯递减幅度逐渐变小（−7 / −3 / −2 / −1 / −1），符合"越深的标题越靠拢正文"的排版直觉。

### 4.5 唯一的 CSS 变通：`--select-arrow`

```css
/* warm-paper.css:61-62 —— 原文注释 */
/* Select 下拉箭头（SVG 内联必须硬编码颜色，跟随 text-muted） */
--select-arrow: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6'
  xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238E9196'
  fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
```

**它想解决的问题**：原生 `<select>` 的下拉箭头**无法用 CSS 单独改颜色**，只能整块替换 `background-image`；而 `data:` URI 里的 SVG **不能读 CSS 变量** → 颜色必须**硬编码在 URI 里** → 因此每套主题都得重新声明一次，且改色时要**同步改 `--text-muted` 和 URI 里的 stroke**。

**但审计结论是：这个 token 已经废弃了 —— 11 套主题全都定义了它，却没有任何代码读它。**

实际的下拉箭头机制已经换成了**自定义 listbox 组件 + `▾` 文字字符**：

```tsx
// packages/plugin-components/src/controls.tsx:225 —— 不是原生 <select>
<button type="button" aria-haspopup="listbox" aria-expanded={open}
        className="hana-plugin-select-trigger" onClick={() => setOpen((next) => !next)}>
  <span className="hana-plugin-select-value">{displayText}</span>
  <span className="hana-plugin-select-arrow" aria-hidden>▾</span>
</button>
```
```css
/* packages/plugin-components/styles.css:263-266 */
.hana-plugin-select-arrow {
  color: var(--hana-plugin-text-muted);   /* ← 用普通文字色，不需要任何变通 */
  margin-left: var(--space-sm, 0.5rem);
}
```

**完整故事**：token 是为**原生 `<select>`** 写的；应用后来迁到**自定义 listbox + `▾` 字符**（这个方案下箭头就是普通文字，可以用 `color` 直接控制，变通完全不需要了）；但 **11 处 token 声明没人删**。

> 这是一个很好的教训：**"CSS 变通"会因为组件重构而失效，但死掉的变通代码往往不会被清理。** 你迁移时不要照抄 `--select-arrow`——DSH 的下拉也是组件实现，直接用 `--dsw-alias-label-tertiary` 之类即可。

（顺带：如果将来真的需要给原生 `<select>` 上色，现代做法是用 `appearance: none` + 伪元素/`background-image` + `currentColor`，或干脆用 `color-scheme` 让浏览器给出匹配的箭头，都比硬编码 URI 好。）

---

## 5. 设计系统健康度审计

我用脚本做了**全量 token 交叉审计**（定义 vs `var()` 消费）：**50 个主题颜色 token + 81 个结构 token**，结果如下。

### 5.1 死 token（定义了但从未被消费）

| token | 定义位置 | 问题 |
|---|---|---|
| **`--bg-texture`** | 仅 `warm-paper.css` | **44,500 字符的 base64 PNG，占该主题文件 96% 的字节，完全未被消费**（真正的纹理走 `styles.css` 里的 `url(./assets/textures/rice-paper.png)`）→ **默认主题白白多背 44 KB** |
| **`--user-bg`** | **11 套主题全部定义** | 从未被 `var()` 消费。用户气泡实际硬编码 `rgba(0, 0, 0, 0.045)`（`Chat.module.css:99`）→ **11 个主题里改了它都以为生效了，其实完全没有** |
| **`--select-arrow`** | 11 套主题全部定义 | 也从未被 `var()` 消费。**它原本是给原生 `<select>` 的变通，但应用已迁到自定义 listbox + `▾` 字符**，11 处声明成了遗留（详见 §4.5） |
| `--scrim-15` / `--scrim-45` | `styles.css` `:root` | 只用了 `--scrim-30` / `--scrim-35`（`Overlay.module.css:19,23`） |

**这是本次调研最有操作价值的发现之一**：`--user-bg` 被 11 套主题认真定义了 11 次（每套都按亮暗细调过 `rgba(83,125,150,.08)` / `rgba(170,121,141,.10)`…），结果**没有任何代码读它**。用户气泡实际用的是与主题无关的固定灰。

> **对你迁移的直接意义**：不要照抄 token 清单。抄之前先反查消费点，否则会把 5 个死 token 一起搬进新主题。

### 5.2 其它不一致

| 项 | 情况 |
|---|---|
| `--font-ui` 被绕过 | 26 处用 `var(--font-ui)`，**6 处硬编码** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`（`Chat.module.css`、`InputArea.module.css`、`styles.css`）→ **主题改字体时这 6 处不变** |
| `--font-serif` vs `--font-serif-text` | 助手正文用 display face（Garamond）而非 text face（PT Serif），与注释声明的分工不符（可能有意） |
| `--select-arrow` 的 `stroke-width` | `new-warm-paper` 是 `1.25`，其余主题是 `1.5` |
| `prefers-reduced-motion` | 只在动效消费点手写白名单（全仓 17 处），`animations.css` 无兜底 → 新增动画容易漏 |
| 晴天模式 | 全屏循环视频**未处理** `prefers-reduced-motion` |
| `--overlay-*` 的命名 | 与 `--scrim-*` 并存且语义相近，靠注释区分（注释很完整，但命名本身有歧义风险） |

**结论：这是一个设计水准很高但维护上有真实债务的系统。** 它的**架构**（结构/颜色分层、fail-fast 校验、迁移别名、立法式注释）非常值得抄；它的**token 清单**需要先审计再用。

---

## 6. 迁移到 DSH：token 映射方案

把 HanaAgent 的设计语言落到 DSH 上，需要一份 token 对照表。以下是**基于本报告已确立的双方契约**给出的映射。

### 6.1 配色映射

| HanaAgent | DSH | 说明 |
|---|---|---|
| `--bg` | `--dsw-alias-bg-base` | 纸底 |
| `--bg-card` | `--dsw-alias-bg-layer-1` | 浮起卡片 |
| （侧栏更深一层） | `--dsw-alias-bg-layer-2`、`--dsw-specific-sidebar-fill` | |
| `--bg-glass` | `--dsw-alias-bg-overlay` | 浮层 |
| `--sidebar-bg` | `--dsw-specific-sidebar-fill` | |
| `--text` | `--dsw-alias-label-primary` | 浓墨 |
| `--text-light` | `--dsw-alias-label-secondary` | 二级 |
| `--text-muted` | `--dsw-alias-label-tertiary` / `-caption` | 三级 |
| `--border` | `--dsw-alias-border-l1` | 主分割线 |
| （更重的线） | `--dsw-alias-border-l2` | |
| `--accent` | `--dsw-alias-brand-primary` + `--dsw-alias-state-business-primary` | **注意 2 个槽位** |
| `--accent-hover` | `--dsw-alias-button-info-hover`、`--dsw-alias-interactive-bg-active` | |
| `--accent-light` | `--dsw-alias-interactive-bg-hover`、`--dsw-alias-state-business-tertiary` | |
| `--green` | `--dsw-alias-state-success-primary` | |
| `--coral` / `--danger` | `--dsw-alias-state-error-primary`、`--dsw-alias-label-error` | |
| `--overlay-subtle` | `--dsw-alias-interactive-bg-hover` | ⚠️ **注意极性**（见下） |
| `--overlay-light` | `--dsw-alias-markdown-inline-code`、`--dsw-alias-fill-l2` | |
| `--hana-text` | `--dsw-alias-label-primary`（助手正文用） | |
| `--tool-bg` | `--dsw-alias-bg-layer-2` | 工具卡片 |
| `--user-bg` | **`--dsw-specific-bubble`** | ⚠️ **这才是 DSH 里真正生效的气泡色**（HanaAgent 里它是死 token） |
| `--shadow` | `--dsw-shadow-lv2` | |
| `--select-arrow` | 无对应 | DSH 的 select 用组件实现，不需要这个变通 |

**关键差异**：HanaAgent 的 `--overlay-*` 是**黑/白两种极性的叠加色**；DSH 的 `--dsw-alias-*` 是**语义色 + 独立 alpha**。映射时**不要**把 `--overlay-subtle` 直译成某个固定 token —— 应当根据"它叠在什么上面、要压暗还是提亮"选择 DSH 的语义令牌。

### 6.2 Markdown 映射

DSH 的 markdown 走**专用令牌组**，所以映射比逐一改选择器干净得多：

| HanaAgent 的 markdown 规则 | DSH 对应 |
|---|---|
| `.md-content { line-height: 1.75 }` | 无 token，需覆盖（或用 `--dsh-content-font-delta` 派生阶梯） |
| 助手正文 `font-family: var(--font-serif)` | **`--dsw-font-family`** —— DSH 所有 markdown 字体简写都引用它（见前一阶段报告 §5.1） |
| `code` / `pre` 家族 | **`--ds-font-family-code`** |
| `code { background: var(--overlay-light) }` | **`--dsw-alias-markdown-inline-code`** |
| `pre { background: var(--overlay-subtle); border: 1px solid var(--border) }` | **`--dsw-alias-markdown-code-block`** + `--dsw-alias-border-l1` |
| `blockquote { color: var(--text-light) }` | `--dsw-alias-label-secondary` |
| `a`（`--link` / `--link-rgb`） | **`--dsw-alias-state-business-primary`**（DSH 的链接色令牌） |
| `th { background: var(--overlay-subtle) }` | `--dsw-alias-fill-l2` 或 `--dsw-alias-bg-layer-2` |
| `hr { border-top: 1px solid var(--border) }` | `--dsw-alias-border-l2`（DSH 官方 hr 用的就是它） |
| **Callout 系统** | **DSH 没有** → 需要自建，建议照抄 `--callout-rgb` 局部变量法 |
| **代码块工具栏** | DSH 自带（`--dsw-alias-markdown-code-block-banner`） |
| **语法高亮** | DSH 有 `--shiki-*`（11 项），HanaAgent 不接管 —— 你可以选择接管 |

**迁移时最值得保留的三个 HanaAgent markdown 设计**：

1. **`line-height: 1.75` + 紧段距**（阅读取向的呼吸感）
2. **h1 居中**（印刷传统的标题识别）
3. **Callout 的 `--callout-rgb` 单变量多层级配色法**（8 变体各一行）

### 6.3 修饰映射

| HanaAgent 修饰 | DSH 迁移方案 |
|---|---|
| **纸质纹理三层模型** | 完全可迁移。DSH 里用 `body[data-my-theme]` 作开关，`::before` 做亮度补偿层（DSH 的令牌在 body 行内样式上，`::before` 需要 `z-index` 谨慎处理） |
| **纹理 + `background-attachment: fixed`** | ✅ 直接可用 |
| **`--paper-texture-card-blend-mode` 按亮暗切换** | ✅ 建议照抄（`body[data-ds-dark-theme]` 下改 `normal`） |
| **晴天模式（视频 multiply）** | ⚠️ 可行但需注意：DSH 有 `backdrop-filter` 的图层（denia 的玻璃卡片），`mix-blend-mode` 与 `backdrop-filter` 的交互可能异常。**并且必须补 `prefers-reduced-motion`** |
| **亮度补偿层** | ✅ **强烈建议保留这个概念** —— 任何叠加式装饰都要校准明度 |
| **25 个 `hana-*` 关键帧** | 可整体迁移，但建议补**全局** `prefers-reduced-motion` 兜底（修正 HanaAgent 的白名单模式） |
| **`--radius-chat-card-inner: calc(外 − 2px)`** | ✅ 直接可用于 DSH 的消息气泡（`--dsw-specific-bubble` 是圆角 22px 的 pill，可改成这种不对称方形气泡） |
| **0.5px 发丝线** | ✅ 直接可用（endfield 也用这个手法） |

### 6.4 迁移后建议的形态

```
my-paper-theme/
├── package.json                       # dsh.bundle.patch + dsh.client{platform:'web', inject:['theme']}
├── cordis.patch.yml                   # - insert: [{id: ui-skin-paper, name: <包名>}]
├── lib/
│   ├── index.js                       # Host: ctx.settings.register(ns, schema, {applies:'live'})
│   └── client.js                      # Client: theme.overrideTokens(...) + 样式表 + 设置页
├── styles/
│   ├── tokens-paper.css               # 借鉴 HanaAgent：结构 token 与颜色 token 分离
│   ├── markdown.css                   # .md-content 规则 + Callout 系统
│   └── ornaments.css                  # 纸质纹理三层 + 亮度补偿
└── docs/design-language.md            # 照 endfield 的规范文档体例
```

**技术选型**（结合前一阶段结论）：

| 决策 | 选择 | 理由 |
|---|---|---|
| 令牌通道 | `ctx.theme.overrideTokens()` | 与 StyleVault 共存（前一阶段 §2.2） |
| 自定义变量声明位置 | 引用 `--dsw-*` 的放 **`body`**；纯色值可放 `:root` | 前一阶段 §2.2 的 guaranteed-invalid 陷阱 |
| 选择器策略 | **禁用 hash 前缀**，用 `data-*` / `[class$='_centerCol']` / `[role=...]` | 前一阶段 §2.3（2.0.5 上 hash 已全部失效） |
| 持久化 | `ctx.settings.register`（**不用 localStorage**） | DSH Desktop 随机端口 |
| 明暗双模式 | 每个令牌 `{light, dark}` 双值；**注意 overlay 类令牌的极性反转** | 本文 §1.4 |
| 无障碍 | **全局** `prefers-reduced-motion` 兜底 + 设置页提示 | 修正 HanaAgent 的缺陷 |
| 语法高亮 | 可先不接管（endfield 也没接管） | 收益低风险高 |

---

## 附录

### A. 关键文件清单

| 文件 | 行数 | 内容 |
|---|---|---|
| `desktop/src/styles.css` | **4216** | 结构 token `:root`、纸质纹理系统、基础重置、布局、侧栏、**Markdown 渲染（943–1344）**、输入区、滚动条、频道视图、Onboarding |
| `desktop/src/themes/*.css` | 61–73 × 11 | 11 套主题（纯颜色 token） |
| `desktop/src/themes/new-warm-paper-fonts.css` | **4200** | 自托管 `@font-face`（5 家族 / 111 文件 / 521 条 unicode-range） |
| `desktop/src/animations.css` | 195 | 25 个 `hana-*` 关键帧（**唯一真相来源**） |
| `desktop/src/shared/theme-registry.ts` | 93 | 主题注册 + fail-fast 校验 + 迁移 |
| `desktop/src/shared/theme-registry-data.json` | — | 主题元数据（唯一来源，代码不镜像） |
| `desktop/src/shared/theme.ts` | 92 | 切换实现（`data-theme` + 换 `<link>`） |
| `desktop/src/react/components/chat/Chat.module.css` | **2312** | 消息气泡、MOOD、工具卡片、思考块 |
| `desktop/src/react/components/LeavesOverlay.tsx` | **75** | 晴天模式视频叠层 |
| `desktop/src/react/ui/Overlay.module.css` | — | `--scrim-*` 的唯一消费者 |
| `desktop/src/assets/textures/` | 2.8 MB | rice-paper × 3 + leaves-overlay.mp4 |

### B. 本报告的关键数字

| 指标 | 值 |
|---|---|
| 结构 token（`:root`，主题无关） | **81** |
| 颜色 token（每套主题） | **50** |
| 主题数 | **11**（9 亮 + 2 暗） |
| 主题文件体积 | 61–73 行 |
| 死 token | **5**（`--bg-texture`、`--user-bg`、`--select-arrow`、`--scrim-15`、`--scrim-45`） |
| **死 base64 载荷** | **44.5 KB（占 warm-paper.css 的 96%）** |
| 字体载荷 | 6.5 MB / 111 文件（其中中文 6.0 MB / 99 文件） |
| Markdown 样式 | ~400 行（`styles.css:943–1344`） |
| 关键帧 | 25 个，全部 `hana-` 前缀 |
| `--duration-fast` / `--ease-out` 用量 | 460 / 267 |
| `prefers-reduced-motion` 覆盖 | 17 个文件（**均无全局兜底**） |

### C. 三条最值得带走的设计原则

1. **AI 说的话用衬线，人用的控件用无衬线。** —— 一条 CSS 规则定下整个产品的声音。
2. **亮/暗不是"换一套色值"，而是"极性反转"。** 叠加色在亮色下压暗、暗色下提亮；因此阴影需要**独立于主题的纯黑 `--scrim-*`**，绝不能复用 `--overlay-*`。
3. **装饰必须自带亮度补偿。** 纸质纹理和晴天视频都用了同一个手法：叠一层反向的暖白把被拉低的明度校准回来。

### D. 参考链接

- [liliMozi/openhanako](https://github.com/liliMozi/openhanako)（HanaAgent，Apache-2.0）
- 前置报告：[`research_community-themes.md`](./research_community-themes.md) —— DSH 三社区主题 + 官方令牌契约
