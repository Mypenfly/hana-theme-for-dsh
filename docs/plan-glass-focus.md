# 玻璃层 · 焦点 — 方案与实施记录

> **状态:已实施(2026-09-11)。** 两份方案里被实测推翻的判断都留在原文位置并标出结论,
> 读者可以对照"当时以为"和"实际是"。两项都**没有开关以外的默认变化**:
> 玻璃层无条件生效,焦点是**新开关 `data-hana-focus`,默认 `accent`**。

> **宗旨(用户 2026-09-11 定):尽量复刻参考设计。**
> 偏离需要记录,复刻不需要。

本文覆盖 `docs/plan-square-geometry.md` §7 的第 3、4 项。两项合写,因为它们共享同一份
证据:参考主题的**浮起面**和**焦点标记**是同一套"非页面本身"的语汇,而 DSH 里两者都
只能靠**选择元素**够到 —— 类和构建哈希绑定,判据 5/16 禁止命名。

---

## 0. 结论先放在前面

| | 参考的做法 | DSH 的事实 | 落点 |
|---|---|---|---|
| **玻璃层** | `--bg-glass`:卡色 @ **.92**,对照色变体 **.94**,花在**浮在内容之上的小片**上 | 没有任何令牌专职"浮片";`--dsw-alias-button-floating-fill` 是唯一被消费的浮片 | 浮片令牌拿到玻璃值;菜单**保持不透明** |
| **焦点** | 全局杀掉**默认**焦点框,再按组件画 `1px/2px solid var(--accent)` | 31 条非 `none` 的 outline 规则,**全部**哈希键,色分五族 | **只改颜色**:换成参考的 `--accent` |

两项各有一处"方案原文是错的",记在 §1.3 和 §2.3。

---

## 1. 玻璃层

### 1.1 参考的机制(逐条实测)

`--bg-glass` 在 11 个主题里都有,值如下(第二列是来源文件):

| 主题 | `--bg` | `--bg-card` | `--bg-glass` | 等于 |
|---|---|---|---|---|
| new-warm-paper | #F5EFE4 | #FBF7EE | `rgba(251,247,238,.92)` | 卡 |
| coral | #FDF6EC | #FFFBF3 | `rgba(255,251,243,.92)` | 卡 |
| high-contrast | #FAF8F7 | #FDFBFA | `rgba(253,251,250,.94)` | 卡 |
| contemplation | #F3F5F7 | #F8F9FB | `rgba(248,249,251,.92)` | 卡 |
| grass-aroma | #F5F8F3 | #F9FBF7 | `rgba(249,251,247,.92)` | 卡 |
| **midnight** | #3B4A54 | #445560 | `rgba(59,74,84,.92)` | **底** |
| **midnight-contrast** | #26343D | #30414B | `rgba(38,52,61,.94)` | **底** |
| absolutely | #F4F3EE | #FAF9F5 | `rgba(244,243,238,.92)` | **底** |
| deep-think | #FCFCFD | #F8F8FA | `rgba(252,252,253,.92)` | **底** |
| delve | #FFFFFF | #F7F7F8 | `rgba(255,255,255,.92)` | **底** |
| warm-paper | #F8F4ED | #FCFAF5 | `rgba(250,248,242,.92)` | **都不是** |

**颜色没有规律** —— 5 个取卡、5 个取底、1 个两头不沾。它是每个主题**手挑**的。
所以这里**不能推导,只能转抄**:四个配色各抄自己源主题的那一行。

**唯一有规律的是 alpha**:9 个 `.92`,**2 个 `.94`,而那 2 个正好是两套对照色变体**
(`high-contrast`、`midnight-contrast`)。玻璃越不透明,内容透上来越少 —— 对照色的
意义就在这里。所以我们的 **斑斓 = `.94`**,其余三套 `.92`。

**花在哪**(全部消费者,共 4 处):

| 消费者 | 定位 | 背景 | `backdrop-filter` |
|---|---|---|---|
| `ClassicFindBox .findBox` | absolute, z-12, 覆在正文上 | `--bg-glass` | **blur(16px)** |
| `MarkdownChrome .diagnosticsBadge` | absolute, z-5 | `--bg-glass` | **blur(12px)** |
| `Preview` 浮起提示 | absolute, z-5 | `--bg-glass` | **blur(12px)** |
| 代码块"已复制"气泡 | absolute `::after` | `--bg-glass` | **无** |

四处的共同点不是"菜单"也不是"面板",而是**一小片东西浮在会滚动的内容上面**。
模糊只给大片的正文提示,**最小的那个气泡不模糊** —— 所以模糊是逐片的判断,
不是这个令牌的一部分。**透过率才是。**

### 1.2 DSH 的事实

用 `--dsw-alias-*` 描的所有 `background` 里,凡是规则自己把元素**移出文档流**
(`position: absolute|fixed|sticky`,或带 `z-index`)的,涉及的令牌是:

| 令牌 | 浮起规则数 | 是什么 | 参考怎么做 |
|---|---|---|---|
| `--dsw-specific-menu` | **11** | 弹出层:`.panel` fixed z=1100、`.card` absolute z=100…… | **不透明 `--bg-card`** |
| `--dsw-alias-bg-layer-1` | 4 | 粘性轨道工具栏、TurnNavigator 预览片 | 但它是**每一张卡**的令牌,不专属 |
| `--dsw-alias-bg-layer-2` | 3 | 目录浏览 loadingFloat、时间线 earlierHistory | 同上 |
| `--dsw-alias-button-floating-fill` | 1 | **「回到底部」按钮**,`position: sticky`,34×34,浮在消息列表上 | —— |
| `--dsw-alias-button-tool-bar-fill` | 规则有,调用点 0 | 设计系统自己的 `.toolbar` 按钮变体 | —— |
| `--dsw-alias-bg-base` | 7 | `:after` 流光、粘性输入座 | 底色,不能动 |

**关键否证(方案原文错了的地方,见 §1.3):参考的菜单不透明。** 11 个源主题里,
`.context-menu` / `.slash-menu` / `.mention-menu` / `.model-dropdown` / `.popup` /
`.dropdown` / `.floatingPanelInner` / `.cwdCtxMenu` …… **无一例外是 `var(--bg-card)`**。
所以 `--dsw-specific-menu` **保持镜像 `bg-layer-1`**,那已经是对的。

**于是玻璃层落在一个令牌上**:`--dsw-alias-button-floating-fill` ——
它是唯一一个**既浮在内容上、又不与文档流内的面共用**的令牌。
另外 `--dsw-alias-button-tool-bar-fill` / `-hover` / `-fill-invisible` 是设计系统里
**语义上就是"半透明浮片"** 的一族(DSH 出厂值 `#54555780` = 50% / `#54555799` = 60%),
我们把它做成了不透明的 —— 一并接上。

**这一族要小心说清楚,因为第一版说错了。** 我第一次查的是各插件包的 `lib/client.js`,
结论是"没有任何已安装插件画它"。**错了**:规则在 `dsh-web-frontend` 的
`dist/assets/index-*.css` 里(`._toolbar_cfgyt_65{background:var(--dsw-alias-button-tool-bar-fill)}`),
而且 `dsh-client-ui-primitives` 还带着源码 `lib/Button.module.css`。
**真正的结论是:规则在,调用点不在** —— 整个 web 前端包里 `_toolbar_cfgyt_65`
只出现**一次**,在 class map 的导出里。`scan-surface-roles` 扫的是 CSS 而不是使用情况,
这是保守的那一侧:一个被声明过的面,仍然是本主题必须正确供给的面。

### 1.3 方案原文错在哪

方案写的是:

> **玻璃层** | 待做 — `rgba(bg-card, 0.92)`

**错了两处,而且是两个方向:**

1. **只抄了一半机制。** 参考的浮片是 `background: var(--bg-glass)` **加**
   `backdrop-filter: blur(12–16px)`。模糊够不到(选择器只有哈希),
   而在 `.92` 上它本来也只作用在那 8% 上 —— 这一条记在这里,不假装做到。
2. **`bg-card` 不是四套的答案。** 暗色的两套取的是**底**(`--bg`),不是卡。
   这不是笔误:5 个主题取卡、5 个取底,没有规律。**转抄源主题,不要推导。**

### 1.4 改了什么

`--dsw-alias-button-floating-fill` / `-hover`、`--dsw-alias-button-tool-bar-fill` /
`-hover` / `-fill-invisible`。

**转抄的是"取哪张面",颜色取自本配色自己的令牌。**
参考是**手挑**的(5 个取卡、5 个取底、1 个两头不沾),所以那个**选择**才是要记下来的事实;
triple 则从 `bg-layer-1` 或 `bg-base` 现取 —— 和薄染梯级的做法一样(阶梯转抄,色相推导)。
**第一版是连 triple 一起抄的**,于是纸本的浮片落在 `#FBF7EE` 上 —— 一个在本主题里
哪儿都不出现的颜色,因为纸本的卡是**推导**出来的 `#FDF8EF` 而不是抄来的。

| 配色 | 源 | 取哪张面 | 玻璃值 | hover |
|---|---|---|---|---|
| 纸本 | `new-warm-paper.css:12` | 卡 | `rgba(253,248,239,0.92)` | `rgba(245,240,231,0.92)` |
| 青夜 | `midnight.css:10` | **底** | `rgba(59,74,84,0.92)` | `rgba(69,83,93,0.92)` |
| 珊瑚 | `coral.css:10` | 卡 | `rgba(255,251,243,0.92)` | `rgba(244,241,235,0.92)` |
| 斑斓 | `midnight-contrast.css:10` | **底** | `rgba(38,52,61,0.94)` | `rgba(53,66,75,0.94)` |

- **`-invisible` 取同一个颜色的 alpha 0**,于是这一族读成一条梯级:
  `0` → `.92`(或 `.94`)→ 不透明的本色。
- **暗色的两套取"底"意味着浮片和页面是同一个颜色**:青夜与斑斓的玻璃**叠在底上
  dE = 0.0000**,只靠发丝线与阴影分辨。那是参考自己的选择,记在这里,
  也正因为如此 §3 说没有"浮片必须读得出"这条门。
- **hover 为什么不照 DSH 的 +0.10?** DSH 出厂是 `.50 → .60`。照搬到 `.92` 上是
  `1.02`,截断成 `1.00`,而 `.92 → 1.00` 在纸面上的合成差只有约 **1/255** ——
  一个看不见的 hover,而且这是**实测然后被自己的门抓回来的**(见 §4.1)。
  参考自己的做法不同:它给浮片的 hover **叠一层墨**
  (`.findBox button:hover { background: var(--overlay-subtle) }`,
  `.bridgeAgentMenuItem:hover { background: rgba(0,0,0,0.04) }`)。
  所以 hover = **玻璃本色按本配色自己的 hover 档(薄染梯级的 `light`)往墨色走一步,
  alpha 不变** —— 纸本 `.04`、青夜 `.05`、珊瑚 `.05`、斑斓 `.07`。
  阶梯不在本文里写第二遍,由 `tools/derive-glass.mjs` 从 `tools/derive-wash.mjs` 读。

### 1.5 量过、想过、**故意没动**的

`--dsw-alias-bg-skeleton` 是本主题**压平过的第三个半透明面**(DSH 出厂
`#0000000a` / `#ffffff14`,一个 4% / 8% 的染色;我们给的是不透明的
`#EBE5DA` / `#303E47` / `#EEE8E1` / `#1C2830`)。

**没动,理由是参考这里没有可复刻的东西**:11 个源主题里没有骨架令牌,
参考的加载态是 `styles.css:894` 的 `hana-toggle-loading-pulse`(改 opacity,不改底色)。
而且全 DSH 只有**一条**规则画它(`.iRJKyq_skeletonBar`,20px 高的占位条,
自带 2s 的 opacity 脉冲),染色或有色都读作"占位条"。**为了一个没有来源的值去改一个
看不见差别的地方,是漂移,不是复刻。**

---

## 2. 焦点

### 2.1 参考的机制

参考有一条**全局**规则,并且**自己的 vitest 在守它**
(`react/__tests__/styles/focus-ring.test.ts`):

```css
:focus,
:focus-visible { outline: none !important; }
```

`styles.css:288` 和 `mobile-entry.css` 各一份。那个测试还断言**不存在**
`outline: 2px solid var(--accent)` —— 即"不要那种环"。

但参考**并不是一个没有焦点框的应用**。它杀掉的是**浏览器默认环**,然后按组件把框
画回来,或者用别的语言替代。实测全部 `:focus` 规则(7 条 outline、29 条 border-color、
21 条 background、17 条 box-shadow):

- **主流替代是 `border-color: var(--accent)`**(29 条)——有边就暖边。
- 其次是 `color: var(--accent); background: var(--accent-light)`(无边的 chip / 行)。
- 真的画环时,规格是 **`1px` 或 `2px solid var(--accent)`**,`outline-offset` ±2px:
  `ui/Button.module.css` 的 `.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`
  (整个 UI 的按钮基元)、表格单元格 `2px solid var(--accent); outline-offset: -2px`、
  浮起卡片 `1px solid var(--accent)`。

**全应用只有一个焦点色:`--accent`。** 而且四套源主题的 `--accent` 在各自底上都过
非文本对比 3:1:

| 源主题 | `--accent` | 对底 |
|---|---|---|
| new-warm-paper | `#537D96` | 3.87 |
| coral | `#1A3049` | **12.52** |
| midnight | `#C99AAF` | 3.80 |
| midnight-contrast | `#E6B1C4` | 6.98 |

### 2.2 DSH 的事实

`tools/scan-geometry.mjs` 的同族扫描(本文用的是一次性探针,结论记在这里):
**63 条 outline 声明,31 条非 `none`,其中哈希键的 31/31 —— 可达的 0 条。**
**没有一条带 `!important`**,所以在选择器上赢是可能的。它们的颜色分五族:

| 值 | 条数 |
|---|---|
| `1px solid var(--dsw-alias-state-business-primary)` | 13 |
| `2px solid var(--dsw-alias-state-business-primary)` | 8 |
| `2px solid var(--dsw-alias-brand-primary)` | 5 |
| `2px solid var(--dsw-alias-label-tertiary)` | 2 |
| `1.5px solid var(--dsw-alias-button-info-fill)` | 1 |
| `2px solid var(--dsw-alias-state-warn-label)` | 1 |

**橙框的来源就在这张表里。** 珊瑚配色下:`state-business-primary` = `#A8432A`
(深朱,5.59:1),`brand-primary` = `#F37E63`(珊瑚朱,**2.45:1**,连 3:1 都不过)。
21 条规则用前者、5 条用后者 —— 而**参考的珊瑚主题里 `--accent` 是墨蓝 `#1A3049`**,
珊瑚朱在那里是 `--coral`,只做线与染,从不做标记。

### 2.3 方案原文错在哪

方案写的是:

> **焦点** | 待做 — `accent-light` + `outline:none`,就是那个橙框

**"杀掉焦点框"是误读。** 参考杀的是**浏览器默认环**(`styles.css:288`),
并且**自己又把框画回来** —— 它整个 UI 的按钮基元就是 `2px solid var(--accent)`。
一个忠实的移植如果只抄那条全局 `outline: none`,结果不是"参考的样子",
而是**一个没有焦点提示的界面**:DSH 的 31 条环是设计好的,不是默认样式。

**而 DSH 的环几何本来就是参考的几何**:都是 `1px`/`2px`,`outline-offset` 都是 ±2px。
唯一的差别是**颜色**。所以这一项是**改色,不是改形**。

### 2.4 改了什么

一个新开关 `data-hana-focus`,值 `accent`(默认)/ `native`:

```css
body[data-hana-theme][data-hana-focus='accent'] {
  --hana-ring: var(--dsw-alias-brand-primary);
}
body[data-hana-theme='coral'][data-hana-focus='accent'] {
  --hana-ring: var(--dsw-alias-button-primary-fill);
}
body[data-hana-theme][data-hana-focus='accent'] :focus-visible,
body[data-hana-theme][data-hana-focus='accent'] :focus-visible * {
  outline-color: var(--hana-ring);
}
```

三处值得说明:

1. **只写 `outline-color`,不写 `outline`。** 于是**没有环的元素不会凭空长出环**
   (`outline-style: none` 时 `outline-color` 是惰性的),有环的元素换色。
2. **`--hana-ring` 不抄字面量,读令牌。** 纸本的 `brand-primary` **就是**参考的
   `#537D96`,青夜 **就是** `#C99AAF`,斑斓 **就是** `#E6B1C4` —— 逐位相同。
   只有珊瑚对不上:它的 `brand-primary` 是**珊瑚朱**(参考的 `--coral`),
   而参考的 `--accent` 是墨蓝;珊瑚的 `button-primary-fill` 和 `label-primary`
   都**是** `#1A3049`,取前者(它语义上就是"强调色板")。
   这条例外由 `tools/derive-focus.mjs` 把参考的 `--accent` 与**规则点名的那枚令牌**
   绑在一起核对,所以改 `brand-primary` 会让门失败,而不是让焦点悄悄变色。
3. **`:focus-visible *`** 不是顺手加的:全 DSH 有**一条**规则把环画在
   *被聚焦元素的后代* 上(`._6nu5Ca_memberButton:focus-visible ._6nu5Ca_memberLabelWrap`),
   `:focus-visible` 自己够不到它。少一个后代选择器,那条环会留在旧色上。

**特异性是算过的,不是猜的。** 判据 1 禁止 `!important`,所以必须在选择器上赢:
焦点环的实测上限是 `(0,3,0)`,上面的选择器带两个属性 + 一个伪类 + `body` = `(0,3,1)`。
其余 30 条都是 `(0,2,0)`,即使没有第三个属性也已经赢,第三个属性是为那一条付的。

### 2.5 没做的:`border-color: var(--accent)`

参考最常见的一招(29 条)是"有边就暖边"。**没有全局套用**,理由是它在参考里是
**逐组件的判断**:29 条规则各自长在作者知道"这个控件有边"的地方。全局写下去会
把**承载状态的边**一起改色 —— 校验失败的红边、危险行的左侧粗线 —— 而那正是
DSH 用 `:focus` 之外的规则在表达的语义。DSH 的输入框也已经有了自己的焦点语汇
(32 条 `outline: none` + 各自的 `:focus` 规则)。**参考的那一招在这里没有全局形态,
所以不移植,而不是移植一半。**

---

## 3. 门

| 门 | 守什么 |
|---|---|
| `tools/derive-glass.mjs --check` | 四套的玻璃色**取自本配色自己的令牌**(不是抄来的字面量)、alpha 与源主题的对照色变体一致、**出货的** hover 相对 fill 至少走 0.015 dE |
| `tools/derive-focus.mjs --check` | 参考 `--accent` ↔ 规则点名的令牌逐位相同;环色对**底与卡**都 ≥ 3:1 |
| `test/check.js` | 玻璃族带 alpha 且 ≤ .95;焦点块有 `(0,3,1)`、有 `:focus-visible *`、不写 `outline` 简写、属性真的被写到 DOM 也真的被摘掉 |
| `test/contrast.test.js` #36 | 玻璃浮片:alpha ∈ [0, .95],不透明部分必须是本配色的面,或从面往墨色走的一步 |
| `test/runtime.test.js` | 默认值是 `accent`;开关真的走到 DOM 上;detach 之后不残留 |
| `test/selftest.js` | 8 条新变异体,每条新判据都有一个能让它红的 |
| `test/verify/focus-check.mjs` | 真 Firefox:把**安装包里的真规则**取出来,渲染,读回 `outline-color`;accent 档 12 个环全部是参考的 `--accent`,native 档全部回到 DSH 自己的颜色 |

**为什么 #36 不写在 `test/contrast.test.js` 里而环色的 3:1 也不写**:环色的 3:1 已经由
`derive-focus --check` 对**底和卡两张面**各测一遍,再写一遍就是把同一个判据存两份 ——
这个项目反复在防的正是这个。

**为什么 `test/contrast.test.js` 里没有"玻璃浮片叠在底上仍读得出"这一条**:
**量过了,不成立**。参考的暗色主题取的是 `--bg`(= 底),所以青夜与斑斓的玻璃
**叠在底上 dE = 0.0000**,浮片只靠它的发丝线与阴影分辨。那是参考自己的选择,
不是缺陷 —— 所以工具打印这个数,而不对它设门。

---

## 4. 实施记录:三处被自己的门抓回来的地方

1. **`derive-glass` 的 hover 判据在拿推导结果和自己比。**
   第一版比较的是"推导出来的 hover"和"推导出来的 fill",所以**出货值**无论多离谱
   它都绿。`glass-hover-as-an-alpha-step` 变异体(把 DSH 的 `.50→.60` 照搬到 `.92` 上,
   截断成 1.00)在值判据上红了、在这个判据上**没红**,因为变异根本没进那个算式。
   现在读的是 `palette.tokens` 里的出货值。

2. **`test/verify/focus-check.mjs` 报了一个"看起来很对"的错诊断。**
   它在珊瑚上算出 `#F37E63`,于是断言"环色输掉了特异性之争"。**真实原因是页面被贴错了标签** ——
   `attr` 挂在 resolution 上,却被从 palette 上读,于是 body 渲染成
   `data-hana-theme="undefined"`,珊瑚那条按配色键的规则根本没匹配,回落到通用规则。
   现在探针把 `data-hana-theme` / `data-hana-focus` / `--hana-ring` 一起读回来核对,
   标签贴错会报"这一页这个配色的规则从没匹配过",而不是报一个假的层叠失败。

3. **judgement 8 的判据本身是错的。**
   它测的是字面前缀 `body[data-hana-theme]`,那是"已限定"的**代理**而不是这件事本身:
   它拒绝了正确的按配色键的规则,却对 `body[data-hana-theme='不存在的配色']` 一路放行。
   现在把值解析到**实际出货的配色 id** 上,拼错会被抓住。

另外顺手修掉一处**先前就存在**的路径错误:`test/verify/seal-check.mjs` 的 `ROOT`
比仓库根少一层,于是 `--keep` 的截图落在 `test/test/verify/` 里,而 `.gitignore`
护的是它们从没被写到过的那个路径。同目录的 `surface-check.mjs` 一直是对的。

---

## 5. 全绿读数

```
check        166 条静态判据(45 条 scoped 规则、549 行 CSS)
tokens        98 × 4
surfaces     195 张面(103 自带 / 82 harness / 6 不可达)
contrast     352 条断言(含 #36 16 条玻璃形状)
derive       shiki 44 · surfaces 52 · ink-ramp 16 · wash 20 · glass 20 · focus 4
scan-geometry 256 个圆角位点
runtime       98 条断言
selftest      43/43 变异体(7 个 suite)
verify:focus  真引擎 12 个环 × 2 档
```

**默认开关**:玻璃层无条件生效;`data-hana-focus` 默认 `accent`,设置页第二行是
「焦点墨环」。**想要 DSH 原来的五种焦点色,把它关掉即可。**
