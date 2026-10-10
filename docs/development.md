# 开发与自定义

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
| `docs/` | 规则（[pricing-rule.md](pricing-rule.md)）、本文、验证记录（[verification.md](verification.md)） |

## 设计取舍

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
- **生成物入库**。`client.js` 是被服务端直接下发的文件，所以提交进仓库并配 `--check` 守门，
  这样 tarball / GitHub 安装无需任何构建步骤。

## 自定义规则

时段规则、节假日日历和价目表都在 **`src/policy.js`** 一处定义，改完必须重新生成 `client.js`：

```sh
node scripts/build-client.mjs            # 重新生成 client.js
node --test test/                        # 全部测试
node scripts/build-client.mjs --check    # 只校验 client.js 是否为最新（提交前/CI 用）
```

以本地目录方式安装时，该目录是以 `link:` 挂进配置档的（`node_modules/dsh-price-tip` 是指向本目录的
软链），所以改完重建 `client.js` 后刷新页面即可看到新规则，不必重装。

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

## 测试覆盖

`node --test test/` 共 18 项，重点在容易写错的地方：

- **边界**：08:59:59 / 09:00:00 / 11:59:59 / 12:00:00 / 13:59:59 / 14:00:00 / 17:59:59 / 18:00:00。
- **日历**：周末全天空闲、调休上班的周末仍空闲、7 个节假日的工作日时段。
- **不变量扫描**：连续 30 天每 7 分钟采样一次，断言「当前时刻到下次切换之间时段不变、且切换点两侧状态相反」。
- **价格**：空闲价恰为高峰价的一半。
- **生成物**：`client.js` 与 `src/` 一致、只 `require('react')`、槽位注册参数、`t()` 用到的键与字典键**双向**一一对应、
  清单的 `dsh.client` / 补丁行 / `files` 字段完整。
