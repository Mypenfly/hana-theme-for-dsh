# 字距寄存器 · 链接细线 — 方案与实施记录

> **状态:已实施(2026-09-11)。** `docs/plan-square-geometry.md` §7 的最后两项。
> 两项都是**先量参考、再决定能抄多少**:一项的结论比方案原文窄得多,
> 另一项的结论**推翻了本仓库先前记下的一条理由**。

---

## 1. 字距寄存器

### 1.1 参考的寄存器,整数量一遍

参考全仓 **76 条 `letter-spacing`**,值分布:

| 值 | 条数 | 落在什么上 |
|---|---|---|
| `.02em` | 19 | 小号灰标签:badge、导航项、模型胶囊、头像名、主题卡名 |
| `.03em` | 12 | `--fs-title` 级标题、分组标签、`.theme-card-name` |
| **`0`** | **12** | **可搜索/可输入的文本与标题**:`.settings-search-input`、`.settings-search-result-title`、`.settings-tab-title`、`.jianTitle`、`.sessionSectionTitle` |
| `.08em` | 7 | `.sidebar-title`(**大写**)、`.usage-eyebrow`(**大写**)、**`thead th`**、打字指示器 |
| `.06em` | 7 | 日期标签、分组标签、欢迎语 |
| `.04em` | 7 | **`text-transform: uppercase`** 的分组标题、浮层标题 |
| `.05em` | 6 | 节标题、编辑器标签 |
| `.1em` | 2 | 工具省略号(衬线,装饰) |
| `.12 / .15 / .18em` | 3 | 设置节标题、mono 用户码、中文字卡面标签 |
| `.5px` | 1 | 大写的媒体标签 |

**规律是"文本种类",不是"字号":**

- **`0` 给"用户输入、可搜索、当作数据读"的东西** —— 而且参考是**显式写 0**,
  不是靠继承(`.settings-search-input { letter-spacing: 0 }`)。
- **正字距给短标签**,而字距**随"离正文多远"上升**:正文级标题 `.03em`、
  分组标题 `.04–.06em`、**大写**标签 `.06–.08em`、装饰性中文 `.15–.18em`。
  大写拉丁是一整块,所以要拉开;**中文不需要**,所以那三处 `.12–.18em` 各自只有一个。

### 1.2 参考的**阅读面**里只有一个

把范围缩到 markdown:`md-content` / `preview-markdown` / `md-*` 上,
**全仓只有一条**:

```css
/* Preview.module.css */
.previewPanelBody .preview-markdown thead th {
    background: color-mix(in srgb, var(--text) 9%, transparent);
    font-weight: 600; font-size: 0.85em;
    letter-spacing: 0.08em;
}
```

也就是说:**那 76 条寄存器是应用外壳(chrome)的,不是阅读面的。** 阅读面只给表头一个字距。

### 1.3 DSH 自己的寄存器已经存在,而且我们没碰它

实测已安装 harness:**9 条** `letter-spacing`。

| 值 | 位置 |
|---|---|
| `.04em` ×4 | 分组标题、节标签、**品牌名**、说明标题 |
| `.06em` | 一个分组头 |
| `.035em` | 轨迹里的 kind tag |
| `.08em` | 官方 wordmark |
| **`0` ×2** | 侧栏的 fallback 品牌名与本地构建标题(**显式清零**) |

**同一条规律,同一段区间。** 而本主题**故意不重绘外壳排版**(L3 的注释写着:
"UI chrome is deliberately NOT restyled: body's `--dsw-font-family` stays the sans
stack, so buttons, sidebar and labels keep their own voice and only reading text
becomes a book")。所以:

- 参考那 76 条**全部挂在类名上**,DSH 的对应元素全是构建哈希 —— 与几何那一项同一个墙;
- 即便够得到,**那也是外壳的字距,不是主题的字距** —— DSH 已经有一份,而且是对的。

### 1.4 所以实施的是哪一半

**阅读面唯一的那一条**,加上它成对的那条零点:

```css
body[data-hana-theme] {
  --hana-track-label: 0.08em;   /* 短标签:表头。参考阅读面唯一的一个 tracking */
  --hana-track-data: 0;         /* 数据:必须为 0 —— 参考显式清零的正是这一类 */
}
body[…][data-chat-flow-kind='assistant-step'] th { letter-spacing: var(--hana-track-label); }
body[…][data-chat-flow-kind='assistant-step'] td { letter-spacing: var(--hana-track-data); }
```

`td` 那条今天**不改变任何像素**(没人给它字距),它是一条**写下来的不变量**:
数据列不被跟踪。这在这个仓库里是常规做法 —— 一条能被变异打破的判据,
好过一句注释。

**没做的部分,理由写在上面:** 76 条外壳寄存器不移植。不是"够不到所以算了",
是**够得到也不该** —— 外壳的字距属于宿主,DSH 已经有一份,而主题重绘它会
把"只有阅读文本变成书"这条边界拆掉。

---

## 2. 链接细线 —— 并推翻了本仓库先前记下的一条理由

### 2.1 参考怎么做

```css
/* styles.css「链接」 */
.md-content a {
    color: var(--link);
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--link-rgb), 0.35);
    transition: color var(--duration-fast), border-color var(--duration-fast);
}
.md-content a:hover { color: var(--link-hover); border-color: var(--link-hover); }
```

**一条 1px 的、本色 35% 的细线,没有 `text-decoration`;hover 时线变实。**

### 2.2 我们先前记下的理由是**错的**

`docs/design_hana-theme-for-dsh.md` 的规格偏差表里写着:

> | 链接用 `border-bottom` | 改用 `text-decoration-color` | harness 给 markdown 链接画了**透明 2px 下边框 + 负边距**作为放大点击区;覆盖它会缩小点击目标。颜色属于主题,几何不属于 |

前半句是**真的**,而且现在有源码为证(`MarkdownText.module.css`):

```css
.markdown a {
    text-decoration: none;
    /* Transparent hit-area padding; literal zero-alpha only (no painted color). */
    border-left: 3px solid rgb(255 255 255 / 0);
    border-right: 3px solid rgb(255 255 255 / 0);
    border-top: 2px solid rgb(255 255 255 / 0);
    border-bottom: 2px solid rgb(255 255 255 / 0);
    margin-left: -3px; margin-right: -3px;
}
```

**后半句是错的。** 那圈透明边框是**命中区**,而命中区由**盒子的几何**决定,
**与颜色无关** —— 给一个已经存在的边框**上色**,不会把它变窄,也不会缩小点击目标。
"覆盖它会缩小点击目标"把**改宽度**和**上色**当成了一件事,而它们是两件。

### 2.3 于是做什么

**给已有的下边框上色**,照参考的值:

```css
body[data-hana-theme] {
  --hana-link-rule: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);
  --hana-link-rule-hover: var(--dsw-alias-state-business-primary);
}
body[…][data-chat-flow-kind='assistant-step'] a {
  text-decoration: none;
  border-bottom: 1px solid var(--hana-link-rule);
}
body[…][data-chat-flow-kind='assistant-step'] a:hover,
body[…][data-chat-flow-kind='assistant-step'] a:focus {
  text-decoration: none;             /* harness 的 hover 是加一条下划线,我们必须撤掉它 */
  border-bottom-color: var(--hana-link-rule-hover);
}
```

四处要说明:

1. **宽度取参考的 1px,不保留 harness 的 2px。** 代价是命中区**底部少 1px**
   (左右各 3px 的横向放大区**原样保留**,而横向才是文本链接真正被点的地方)。
   换来的是与「极方圆角 + 0.5px hairline」同一套语言里的**发丝线** —— 2px 在
   14–16px 的衬线正文下是一条可见的杠,不是发丝。**这一条是本仓库先前记反了的
   那一条的代价,所以写在这里,而不是悄悄改掉。**
2. **hover 必须显式撤掉 `text-decoration`**,否则 harness 的下划线会和我们那条线
   叠成两条。
3. **参考的 hover 还会把墨色换成 `--link-hover`。** 我们**没有这个令牌**:
   参考的 `--link`/`--link-hover` 只存在于它两套暗色主题里,珊瑚的链接走的是
   `--accent`。所以这里的 hover 阶梯**由线承担**:35% → 100%。这是**偏离**,
   记在这里。
4. **作用域仍是 `[data-chat-flow-kind='assistant-step']`。** harness 给链接上色的
   选择器是 `._markdown_177e0_5 a` —— **构建哈希,够不到**。所以助理正文之外的
   markdown 链接(工具输出等)保持 harness 原本的"只在 hover 下有下划线"。
   这一点**今天就是这样**,本次改动没有让它变差,但它是一处**已知的不一致**。

### 2.4 `#32` 到底缓解了多少 —— 说清楚

`#32` 记的是**链接墨色与错误墨色分不开**:珊瑚 ΔE **0.019**、青夜 **0.030**
(纸本 0.208、斑斓 0.228)。参考这套处理**不改变墨色**,所以**没有让那两个数变大**。

它加的是**一条非颜色的通道**:链接底下有一条线,错误文本底下没有。
读者在两种墨色无法分辨时,仍然能靠"有没有那条线"分辨。这正是 WCAG 1.4.1
"不要只用颜色传达信息"的意思。

**能测的是线的可见度,不是那两个 ΔE:**

| 配色 | 链接墨 | 线(35% 复合后) | 对底对比 | 对底 ΔE |
|---|---|---|---|---|
| 纸本 | `#4C7289` | `#BAC3C4` | 1.567 | 0.1447 |
| 青夜 | `#D2ACBD` | `#706C79` | 1.796 | 0.1417 |
| 珊瑚 | `#A8432A` | `#DFB7A8` | 1.700 | 0.1689 |
| 斑斓 | `#B9E2FF` | `#597181` | 2.500 | 0.2195 |

门就用这张表:**线对底必须 ≥ 1.4**(最低实测 1.567),这条会抓住"alpha 被调没了"
这一类改动 —— 而**不会**假装它修好了 `#32` 的那两个数。

---

## 3. 门

| 门 | 守什么 |
|---|---|
| `test/check.js` | 寄存器两个值都被读、`th`/`td` 成对且方向相反;链接块 `text-decoration: none`、`border-bottom` 是 1px、hover 撤掉下划线;**那三条透明命中边框一条都没被碰** |
| `test/contrast.test.js` #37 | 四套配色的链接线铺在底上之后对底对比 ≥ 1.4,并把实测值记进 `--verbose` |
| `test/selftest.js` | 5 条变异体 |
| `test/verify/link-check.mjs` | **真引擎**:渲染真实 harness 的 markdown 锚点规则 + 本主题样式,读回 `border-bottom-width/color` 与那三条透明边框,证明**上色没有动几何** |

---

## 4. 实施记录:门抓到了三处

1. **本仓库自己写过一条错的理由。** §2.2:它写在"规格偏差表"里,读起来像一条
   已经查过的结论。这次能推翻它,是因为去读了 harness 的**源码注释**
   ("Transparent hit-area padding"),而不是复述当年的结论。
2. **#37 第一版自己抄了一份 alpha。** 它把 `0.35` 写在测试里,于是
   `link-rule-faded-to-nothing` 变异体(把出货值改成 4%)**完全没被抓到** ——
   门和交付物成了同一个事实的两份副本,而这个仓库存在的意义就是防这个。
   现在 alpha 从**出货的样式表**里解析出来,解析不到就报"这条断言已经测不了它"。
3. **hairline 判据漏了一档。** 它只知道 0.5px 与 2px,于是**拒绝了一次忠实的移植**
   —— 参考自己的链接细线就是 1px。判据补上了这条例外,而且**例外写得很窄**:
   1px、只在下边、只在链接规则上。同一处还暴露出它扫的是**带注释**的样式表,
   于是把注释里引用的参考代码当成了本主题的声明;改为扫去注释的版本。

另外两处小的,记着因为它们都是"看起来对":

- 探针里 `.markdown` 是 **CSS-module 的局部名**,编译进 bundle 后是
  `._markdown_177e0_5`。探针按局部名声明规则、也必须按局部名写标记,
  否则锚点根本匹配不上,页面回退成浏览器默认链接(`rgb(0,0,238)`)——
  而**第一条报错信息看起来像"主题弄坏了命中区"**。
- "透明"是 **alpha** 的问题,不是颜色的问题:harness 写的是
  `rgb(255 255 255 / 0)`,引擎算出 `rgba(255, 255, 255, 0)`。探针第一版拿
  `rgba(0,0,0,0)` 去比,把 harness 自己的命中区报成了"被上色"。

`td` 与 `th` 是**成对**的:只有 `th` 会被读成"我们加了字距",
而 `td` 那条**今天不改变任何像素** —— 它是一条写下来的不变量,由变异测试守。
这与 `UNCONSUMED` 那几处同一个做法:没有消费者的东西,要么写明理由,要么别放。

## 5. 全绿读数

```
check        186 条静态判据(50 条 scoped 规则、646 行 CSS)
contrast     356 条断言(含 #37 链接线可见度 4 条)
runtime      107 条断言
selftest      54/54 变异体(8 个 suite)
verify:link   真引擎 3 个场景 × 四条边框
verify:texture · verify:focus · verify:seal · verify:render 全过
```

**§7 到此全部结清。**
