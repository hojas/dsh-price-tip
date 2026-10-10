# 开发与自定义

> 一个零依赖的 DSH bundle：Host 半边刻意留空，全部逻辑是 `src/policy.js`（价格规则）、`src/balance.js`（账户余额）两个纯模块 + `src/client.js`（浏览器侧）。

## 结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | bundle 清单：`dsh.bundle.patch`、`dsh.client`（web / immediately / inject）、图标与展示元数据；`version` 同时是账户请求里的 `x-client-version` |
| `cordis.patch.yml` | bundle 补丁层：插入 `price-tip` 行 |
| `index.js` | Host 半边，**刻意留空**：规则是挂钟的纯函数，余额走 DSH 账户自身的 Remote，不需要会话状态、Remote 注册或定时器 |
| `src/policy.js` | 价格规则的唯一事实来源：时段、节假日日历、价目表、纯函数 |
| `src/balance.js` | 余额的唯一事实来源：金额格式化（与开放平台同口径）与余额 store 状态机，纯函数 |
| `src/client.js` | 客户端半边模板：槽位注册 + React 组件 + 主题 token 样式 + zh/en 文案 + 可选账户接线 |
| `client.js` | **生成物**，由 Host 原样下发给浏览器（不要手改） |
| `scripts/build-client.mjs` | 生成器：注入包名与版本、内联 `policy.js` 与 `balance.js`、用 `node:vm` 做语法校验，支持 `--check` |
| `test/` | 规则单测（边界、切换、价格、格式化）、余额单测（金额口径、store 状态机）与 bundle 结构/清单一致性测试 |
| `docs/` | 本文 · [验证记录](verification.md) |

## 自定义规则

规则、节假日与价目表都在 **`src/policy.js`** 一处，余额口径在 **`src/balance.js`**，改完必须重建 `client.js`：

```sh
node scripts/build-client.mjs            # 重建 client.js
node --test test/                        # 全部测试
node scripts/build-client.mjs --check    # 只校验产物是否为最新（提交前 / CI 用）
```

以本地目录方式安装时，该目录是 `link:` 挂进配置档的，所以重建后刷新页面即可生效，不必重装。

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

## 规则来源与维护

规则的唯一权威来源是 [DeepSeek 官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
（核对于 2026-10-10）；当前价目表硬编码在 `POLICY.models`，字段含义与该页一一对应。

官方文档未明确、但插件必须做决定的地方：

| # | 假设 | 依据 / 处理 |
| --- | --- | --- |
| 1 | 窗口**半开**：`[09:00, 12:00)` | 官方只写「9:00 - 12:00」，起点算高峰、终点算空闲 |
| 2 | 计价时刻取请求**完成**时间 | 2025 年官方在旧错峰方案下如此规定；现行文档未重申，标记显示的是「现在」 |
| 3 | 节假日日历按年内置 | 该日历由国务院办公厅每年另行[发布](https://www.gov.cn/zhengce/content/202511/content_7047090.htm)；已内置 2026 年落在工作日的 19 个节假日（周末本已全天空闲，6 个调休上班日全在周末，无需特殊处理）；未覆盖年份标注「按工作日估算」 |
| 4 | `deepseek-v4-pro` 以官方价格页为准 | 价格页与 2026-09-10 发布说明口径不一致 |

维护节奏：

- **每年 11 月**：国务院办公厅发布次年安排后，追加 `HOLIDAYS_<年>`，并扩展 `schedule.calendarYears`。
- **每次价格变动**：更新 `POLICY.models`、`POLICY.effectiveFrom` 与 `POLICY.verifiedAt`（面板底部的日期随之变化）。
- 官方价格页带有「价格可能变动」的免责声明，本插件不对未来变更作保证。

## 余额（账户数据）

余额不是公开价目表，而是**当前登录账户**的数据，因此插件不自己读凭据、也不直接请求开放平台：

- 数据来自 DSH 自带的账户子系统，客户端只调用 `remote.account` 命名空间：
  `getState()` 取登录状态与 `topUpUrl`，`getBalance(clientMetadata)` 取钱包。
- Host 侧只投影 `normal_wallets` / `bonus_wallets` 的 `currency` 与 `balance` 字符串，
  token、手机号等一律不出现在返回值里，插件也就无从接触。
- 该命名空间是**可选依赖**：用 `ctx.inject(['remote', 'remote.account'], …)` 泊车等待，
  没有账户控制器的配置档从不执行回调，面板里连区块都不渲染。
- 读取时机只有三个：面板首次打开、手动点「刷新」、以及已读过的 store 收到
  `credentials/record-updated`（登录/登出/换号）。**不做轮询**。
- 金额按开放平台 Web 客户端口径格式化（两位小数、千分位、正数截断到分、正数不足一分显示 `<0.01`、
  负数四舍五入且最小显示 0.01），但用十进制字符串自己实现，不引入 big.js——插件保持零依赖。
- **未登录 / 读取失败 / 没有账户服务**分别映射为一行提示、一行提示、整块隐藏；
  读取失败时保留上一次成功的结果并标注「刷新失败」，不会凭空显示 0。

已知边界：

| # | 事项 | 处理 |
| --- | --- | --- |
| 1 | 账户请求需要客户端身份（`x-client-version` 等） | 内联 `package.json` 的 `version` 作为 `x-client-version`；独立 bundle 无法在运行时读到 DSH 自身版本，这是唯一能诚实声明的构建身份 |
| 2 | 余额只在已登录且账户 Provider 已装载时可读 | 其余情况见上面的降级行为 |
| 3 | 多币种 | 每个钱包按各自币种符号逐行显示；赠送余额为 0 时不显示该行（与「设置 → 账户」一致） |

## 设计取舍

- **纯客户端插件**：提醒不依赖会话、日志或远端数据，因此不注册 Host 侧工具/投影，也不写 `system-prompt`；
  Host 半边留空把激活失败面压到最小。余额走既有账户 Remote，同样不需要 Host 半边。
- **生成物入库**：`client.js` 是被服务端直接下发的文件，提交进仓库并用 `--check` 守门，
  于是 tarball / GitHub 安装无需任何构建步骤。
- **样式只用主题 token**：`--dsw-alias-*` + 照抄侧栏底部行的几何尺寸（`height:42px`、`--dsw-radius-md`、
  `--dsw-alias-interactive-bg-hover`），明暗主题与折叠（rail）态都能自然融入；不 `require` 任何 Harness 客户端包。
- **弹层不透明**：宿主菜单色 `--dsw-specific-menu` 只有 94% 不透明，直接用会让面板背后的正文隐隐透出；
  因此在面板自身垫一层 `var(--dsw-alias-bg-base)`、菜单色仍叠在其上，色调不变而表面为实，
  随之失效的 `backdrop-filter` 一并去掉。
- **文案全走 locale 命名空间**：`ctx.locale.register('price-tip', { zh, en })`，组件通过槽位的 `locale: NS`
  拿到 `t`；中英键集完全一致（测试双向校验）。
- **切换时刻跟随界面语言**：注册时经 `inject` 的 `hooks.activeLocale` 暴露 `ctx.locale` 的活动语言
  （渲染器把 `hooks.<name>` 绑定成 `use<Name>` 选择器 Hook），再用 `Intl.DateTimeFormat(语言, …)` 格式化——
  中文界面 `10月12日 09:00`、英文界面 `Oct 12, 09:00 AM`，不会出现中文界面里冒出 `09:00 AM` 的混搭。
- **槽位**：`sidebar.footer.action`（`list`、`scope: root`，Host 渲染时传 `wide`）。用 `ctx.slots.inject(...)`
  注册，父级声明消失时自动卸载；`setTimeout` 链、`useEffect`、`<style>` 元素都随组件卸载清理。
- **余额只在面板里出现**：侧栏那一行宽约 200px、还要放下状态、口号与倒计时，再加金额必然被省略号截断；
  余额是「偶尔看一眼」的信息，因此放在展开面板里，侧栏保持现状。

## 测试

`node --test test/` 覆盖以下方面，重点在容易写错的地方：

- **边界**：`08:59:59 / 09:00:00 / 11:59:59 / 12:00:00 / 13:59:59 / 14:00:00 / 17:59:59 / 18:00:00`。
- **日历**：周末全天空闲、调休上班的周末仍空闲、7 个节假日的工作日时段。
- **不变量扫描**：连续 30 天每 7 分钟采样，断言「到下次切换之前时段不变，且切换点两侧状态相反」。
- **价格与格式化**：空闲价恰为高峰价的一半；时长、紧凑倒计时、价格去尾零。
- **余额**：平台实际会给出的字符串（`0E-16`、`5.0000000000000000`）、千分位、正数截断、`<0.01`、
  负数进位（`-0.999` → `-¥1.00`）、非法输入；store 的 `unavailable → idle → loading → ready` 状态机、
  并发去重、失败保留上次结果并标 stale、登出、dispose。
- **产物与清单**：`client.js` 与 `src/` 一致、只 `require('react')`、槽位注册参数与 hook 接线、
  可选账户注入的接线与读取、`t()` 用到的键与字典键双向一一对应、
  `dsh.client` / 补丁行 / `files` 字段完整、README 链接的本地文件存在。
