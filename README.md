# dsh-price-tip — DeepSeek 价格时段提醒

一个 DSH（DeepSeek Harness）插件：在 Web 界面的**侧栏底部**常驻一个价格时段标记，随时告诉你
DeepSeek API 当前处于**空闲时段**还是**高峰时段**、距离下次切换还有多久，点开后是规则说明和当前生效的价目表。

```
┌ 侧栏底部 ────────────────────────────┐
│  ☾  空闲时段                    3:12 │   ← 常驻标记（空闲=绿色月牙，高峰=琥珀色太阳）
└──────────────────────────────────────┘
         │ 点击
         ▼
┌ DeepSeek 价格时段 ──────────────── ✕ ┐
│ ● 空闲时段                    5折    │
│ 距进入高峰时段                        │
│ 3小时12分45秒                         │
│ 切换时刻 09:00                        │
│ ─────────────────────────────────── │
│ 高峰：北京时间 周一至周五 09:00–12:00、14:00–18:00 │
│ 其余时段（含周末与中国法定节假日）为空闲时段，价格为高峰的 50% │
│ ─────────────────────────────────── │
│ 单位：元 / 百万 tokens。划线价格为高峰时段价格。 │
│ 模型               缓存命中  缓存未命中  输出 │
│ DeepSeek-V4.1-Flash  0.02     1      4  │
│                      0.04     2      8  │
│ DeepSeek-V4-Pro      0.15     4.5   13.5│
│                      0.30     9     27  │
│ 价目表生效 2026-09-10 · 核对 2026-10-10   官方价格页 ↗ │
└───────────────────────────────────────┘
```

## 当前规则（2026-10-10 核对官方价格页）

| 项目 | 值 | 来源 |
| --- | --- | --- |
| 高峰时段 | 北京时间 周一至周五 09:00–12:00、14:00–18:00，**不含中国法定节假日** | [官方价格页（中文）](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) |
| 空闲时段 | 其余全部时间，**含周末与法定节假日全天** | 同上 |
| 空闲折扣 | 高峰价格的 **50%**（5 折） | 同上 |
| 计价时刻 | 取请求**完成**时间（官方在旧错峰方案下的口径） | 见下文「已记录的假设」 |
| 价目表生效 | 2026-09-10 12:00（北京时间） | [news260910](https://api-docs.deepseek.com/zh-cn/news/news260910) |

价格（元 / 百万 tokens，高峰价；空闲价 = 高峰价 × 50%）：

| 模型 | 缓存命中 | 缓存未命中 | 输出 |
| --- | --- | --- | --- |
| `deepseek-flash`（V4.1-Flash） | 0.04 → 0.02 | 2 → 1 | 8 → 4 |
| `deepseek-v4-pro` | 0.30 → 0.15 | 9 → 4.5 | 27 → 13.5 |

> ⚠️ 2025 年那套「北京时间 00:30–08:30 错峰优惠」已于 2025-09-05 16:00 UTC 取消，**不是**现行规则；
> `deepseek-chat` / `deepseek-reasoner` 也已在 2026-07-24 15:59 UTC 下线。本插件不含这两个模型。

## 安装

插件是一个零依赖的本地 bundle 目录，两种装法二选一。

**A. 从界面安装（推荐，走 Harness 自带的插件管理器）**

1. 打开 **设置 → 插件**（Settings → Plugins）。
2. 在安装输入框里粘贴本地目录路径：
   `/Users/chenyx/projects/dsh-price-tip`
3. 安装后刷新页面（新客户端 bundle 由 HMR 载入；刷新可确保生效）。

**B. 命令行安装（仅适用于非 `desktop` 配置档）**

```sh
dsh plugin --profile <profile> add /Users/chenyx/projects/dsh-price-tip
```

`desktop` 配置档由 Electron 应用独占管理，命令行会拒绝写入：

```
error: profile "desktop" is managed exclusively by the Electron application
```

安装动作会把该目录装成依赖，并**自动把 `dsh-price-tip` 加入该配置档的 `dsh.profile.bundles`**
（`pnpm` 安装后由 `reconcile` 选择 bundle），随后 bundle 的 `cordis.patch.yml` 插入 `price-tip` 行。

## 其他人如何安装

插件零依赖、无生命周期脚本，且**已把浏览器侧的 `client.js` 提交进仓库**，所以别人安装时不需要任何构建步骤。
（下面三条路径都在 DSH `0.2.0-rc.2` 上实测过。）

### 1. 从 GitHub 安装（推荐）

**设置 → 插件** → 粘贴：

```
https://github.com/hojas/dsh-price-tip
```

命令行等价写法（仅限非 `desktop` 配置档）：

```sh
dsh plugin --profile <profile> add https://github.com/hojas/dsh-price-tip
```

pnpm 会从 `codeload.github.com` 拉取 `main` 的 tarball，装好后自动写入依赖并把 `dsh-price-tip`
选入该配置档的 `dsh.profile.bundles`。仓库当前**匿名 HTTPS 可读**，对方无需 GitHub 账号。

### 2. 从 tarball 安装（离线 / 内网 / 需要固定版本）

```sh
pnpm pack                      # 生成 dsh-price-tip-1.0.0.tgz（约 16 KB，含全部运行时文件）
```

把 `.tgz` 给对方，粘贴其绝对路径安装，或：

```sh
dsh plugin --profile <profile> add /path/to/dsh-price-tip-1.0.0.tgz
```

### 3. 从本地目录安装（要改代码时）

```sh
git clone https://github.com/hojas/dsh-price-tip
```

然后安装框里粘贴该目录路径。这样装的是 `link:`（软链到仓库），改完
`node scripts/build-client.mjs` 刷新页面即可生效，不必重装。

### 分发须知

- **安装包只含运行时文件**：`package.json` 的 `files` 字段列出 8 个文件
  （`index.js`、`client.js`、`cordis.patch.yml`、`icon.svg`、`locale/*.json`、`README.md`、`package.json`）。
  GitHub / tarball 安装拿到的就是这些，足够直接运行，但不含 `src/`、`scripts/`、`test/`——
  想改规则的人请用路径 3 克隆完整仓库。
- **桌面版只能走界面**：`desktop` 配置档由 Electron 应用独占，命令行会拒绝写入
  （`error: profile "desktop" is managed exclusively by the Electron application`）。
- **装完刷新页面**。客户端 bundle 由 HMR 追加进引导图，刷新可确保生效。
- **版本耦合**：样式只用 `--dsw-alias-*` 主题 token，槽位是 `sidebar.footer.action`，
  并由 `dsh.client.inject` 依赖 DSH 自带的 `@deepseek-ai/dsh-client-ui-sidebar` 与
  `@deepseek-ai/dsh-client-locale`。DSH 若改槽位名或 locale API，需要跟着调整。

## 自定义

时段规则、节假日日历和价目表都在 **`src/policy.js`** 一处定义；改完必须重新生成被服务端读取的 `client.js`：

```sh
node scripts/build-client.mjs      # 重新生成 client.js
node --test test/                  # 全部测试
node scripts/build-client.mjs --check   # 只校验 client.js 是否为最新（CI 用）
```

安装时该目录是以 `link:` 形式挂进配置档的（`node_modules/dsh-price-tip` 是指向本目录的软链），
所以改完重建 `client.js` 后，刷新页面即可看到新规则，不必重装。

规则是纯数据，例如把高峰窗口改成三段时间：

```js
schedule: {
  utcOffsetMinutes: 480,
  peakWindows: [[9 * 60, 12 * 60], [14 * 60, 18 * 60]],  // [起, 止) 分钟
  weekendOffPeak: true,
  holidays: HOLIDAYS_2026,
  calendarYears: [2026],
}
```

## 结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | bundle 清单：`dsh.bundle.patch`、`dsh.client`（web / immediately / inject）、图标与展示元数据 |
| `cordis.patch.yml` | bundle 补丁层：插入 `price-tip` 行 |
| `index.js` | Host 半边。**刻意留空**：规则是挂钟的纯函数，不需要会话状态、Remote 调用或定时器 |
| `src/policy.js` | 唯一事实来源：时段规则、节假日日历、价目表、纯函数 |
| `src/client.js` | 客户端半边模板（槽位注册 + React 组件 + 主题 token 样式 + zh/en 文案） |
| `client.js` | **生成物**，由 Host 原样服务给浏览器 |
| `scripts/build-client.mjs` | 生成器：注入包名、内联 `policy.js`、用 `node:vm` 语法校验 |
| `test/policy.test.mjs` | 时段/边界/切换/价格/格式化测试 |
| `test/bundle.test.mjs` | 生成物与源一致、模块 id、`require` 白名单、槽位注册参数、字典键、清单一致性 |

设计取舍：

- **纯客户端插件**。提醒不依赖会话、日志或远端数据，因此不注册 Host 侧工具/投影，也不写
  `system-prompt`；Host 半边留空可把激活失败面压到最小。
- **样式只用主题 token**（`--dsw-alias-*`），几何尺寸照抄 Host 侧栏底部行
  （`height:42px`、`border-radius:var(--dsw-radius-md)`、`--dsw-alias-interactive-bg-hover`），
  因此明暗主题与折叠（rail）模式都能自然融入。不 `require` 任何 Harness 客户端包。
- **文案全部走 locale 命名空间**（`ctx.locale.register('price-tip', { zh, en })`），组件通过槽位的
  `locale: NS` 拿到 `t`，中文/英文键集完全一致（测试强制校验）。
- **槽位**：`sidebar.footer.action`（`list`、`scope: root`，Host 渲染时传 `wide`）。用
  `ctx.slots.inject(...)` 注册，父级声明消失时自动卸载；`setTimeout` 链与 `useEffect`、
  `<style>` 元素都随组件卸载清理。

## 已记录的假设（官方文档未明确处）

1. **区间半开**：`[09:00, 12:00)`。官方只写「9:00 - 12:00」，整点那一秒归属未定义；本插件让
   窗口起点算高峰、终点算空闲。
2. **计价时刻取请求完成时间**：2025 年官方在旧错峰方案下明确写过「请求的计价时间为该请求完成的时间」，
   现行文档未重申，本插件沿用该口径，标记显示的是「现在」。
3. **节假日日历**：官方规则排除中国法定节假日，而该日历每年由国务院办公厅另行发布、并非静态。
   插件内置 2026 年**落在周一至周五的 19 个节假日**（周末本身全天空闲，6 个调休上班日全在周末，
   因此无需特殊处理）。日历未覆盖的年份，面板会标注「按工作日估算」而不是假装准确。
4. **`deepseek-v4-pro` 计价存疑**：官方价格页与 2026-09-10 发布说明口径不一致，面板与 README 均标注以
   官方价格页为准。

## 验证状态（诚实记录）

已实测：

- `node --test test/` — 18 项全绿（含「任意时刻到下次切换之间时段不变」的不变量扫描）。
- `node scripts/build-client.mjs --check` — 生成物与源一致；`node --check client.js` 语法通过。
- **真实安装与启动**：在隔离的 `DSH_HOME=/tmp/...` 里用 `dsh plugin --profile web add <目录>`
  安装 → 依赖写入、`dsh-price-tip` 自动进入 `dsh.profile.bundles` → `--dump-config` 中出现
  `- id: price-tip / name: dsh-price-tip`（未禁用）。
- **真实服务端下发**：启动该配置档的 Web 服务后，引导图里出现
  `{"id":"dsh-price-tip","url":"plugins/??dsh-price-tip/client.js&rev=…","inject":["@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-sidebar"],"immediately":true}`；
  请求该 URL 返回 `200 text/javascript`，内容与工作区 `client.js` 一致（仅多一行 Host 追加的 sourceMappingURL）。
- **与真实 desktop 配置层组合**：把 `~/.dsh/profiles/desktop` 的清单/补丁复制到隔离配置档并加入本 bundle 后，
  `--dump-config` 正常组合出 `price-tip` 行，无冲突。
- **远端安装（模拟其他人）**：`dsh plugin --profile web add https://github.com/hojas/dsh-price-tip`
  → pnpm 从 codeload 取 tarball、依赖记为 `github:hojas/dsh-price-tip`、8 个运行时文件齐全（含 `client.js`）、
  自动选入 `dsh.profile.bundles`；启动该配置档后引导图含该客户端行，下发 bundle 与仓库 `client.js`
  前 30127 字节**完全一致**（`200 text/javascript`，仅多一行 Host 追加的 sourceMappingURL）。
- **tarball 安装**：`pnpm pack` 产物安装后依赖记为 `file:/…/dsh-price-tip-1.0.0.tgz`，
  同样自动选入 bundles 并组合出 `price-tip` 行。

未验证（本会话没有浏览器控制能力）：

- **像素级渲染**。组件未在真实浏览器里截图核对，浅色/深色主题下的观感、弹层定位、
  折叠（rail）态横向对齐均只经过代码审阅与结构测试。若与预期不符，请告知具体现象。
- 安装进**正在运行的 desktop 配置档**后的实际显示（见「安装」一节，需要你选择装法）。

## 后续可做

- 2027 年节假日安排（预计 2026 年 11 月初发布）→ 追加 `HOLIDAYS_2027` 与 `calendarYears: [2026, 2027]`。
- V4.1-Pro 正式发布后刷新价目表。
- 如需要，可再加一个 Host 侧 `system-prompt` 小节，让模型自己也知道当前时段（本版本刻意不做）。
