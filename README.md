# dsh-price-tip — DeepSeek 价格时段提醒

一个 DSH（DeepSeek Harness）插件：在 Web 界面的**侧栏底部**常驻一个价格时段标记，随时告诉你
DeepSeek API 当前处于**空闲时段**还是**高峰时段**、距离下次切换还有多久，点开后是规则说明和当前生效的价目表。

![侧栏底部的价格时段标记](docs/screenshot-app.png)

*真实运行截图（2026-10-10，浅色主题，侧栏底部即为本插件）。侧栏底部放大：*

![空闲时段标记放大](docs/screenshot-sidebar.png)

*截图时为周六空闲时段：绿色月牙 + 文案 + 距下次切换（周一 09:00）的倒计时。*

点击标记展开后的面板：

![展开后的详情面板](docs/screenshot-panel.png)

*面板内容：状态与 5 折标记、实时倒计时、切换时刻（本机时区，且跟随界面语言——中文界面下是 `10 月 12 日 09:00`）、
规则说明、价目表（加粗为当前时段价、划线为高峰价）、两条口径说明，以及价目表生效日期与官方来源链接。
这张图摄于「面板改为不透明底」之前，因此背后的正文会隐隐透出；当前版本已不再透出。*

## 特性

- **常驻标记**：侧栏底部一行，空闲时段是绿色月牙、高峰时段是琥珀色太阳，右侧是距下次切换的倒计时（按秒刷新）。
- **详情面板**：当前时段、切换时刻（显示为本机时区）、倒计时、完整规则、两个模型的三档价格（空闲价加粗、高峰价划线）、数据来源与核对日期。
- **规则随日历走**：周末与中国法定节假日整天空闲；内置 2026 年落在工作日的 19 个节假日，日历未覆盖的年份会标注「按工作日估算」而不是假装准确。
- **中英双语**：文案走 Harness 的 locale 命名空间，跟随界面语言切换。
- **零依赖、免构建**：`client.js` 已提交进仓库，装上即用；Host 半边不注册任何工具或会话状态。

## 它提醒什么

| 时段 | 时间 | 价格 |
| --- | --- | --- |
| 高峰 | 北京时间 周一至周五 09:00–12:00、14:00–18:00（不含中国法定节假日） | 标准价 |
| 空闲 | 其余全部时间，含周末与法定节假日全天 | 高峰价的 50% |

> ⚠️ 2025 年那套「北京时间 00:30–08:30 错峰优惠」已于 2025-09-05 取消，**不是**现行规则；
> `deepseek-chat` / `deepseek-reasoner` 也已在 2026-07-24 下线，本插件不含这两个模型。

完整规则表、价目表、来源与历史沿革见 [docs/pricing-rule.md](docs/pricing-rule.md)。

## 如何安装

插件零依赖、无生命周期脚本，且**已把浏览器侧的 `client.js` 提交进仓库**，所以安装时不需要任何构建步骤。
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
选入该配置档的 `dsh.profile.bundles`。仓库当前**匿名 HTTPS 可读**，无需 GitHub 账号。

### 2. 从 tarball 安装（离线 / 内网 / 需要固定版本）

```sh
pnpm pack                      # 生成 dsh-price-tip-1.0.0.tgz（约 16 KB，含全部运行时文件）
```

把 `.tgz`（自己打的或别人给的）放到任意位置，在安装框里粘贴其绝对路径，或：

```sh
dsh plugin --profile <profile> add /path/to/dsh-price-tip-1.0.0.tgz
```

### 3. 从本地目录安装（要改代码时）

```sh
git clone https://github.com/hojas/dsh-price-tip
```

然后在安装框里粘贴该目录的绝对路径（如 `/path/to/dsh-price-tip`）。这样装的是 `link:`（软链到仓库），改完
`node scripts/build-client.mjs` 刷新页面即可生效，不必重装。

### 分发须知

- **安装包只含运行时文件与文档**：`package.json` 的 `files` 字段列出运行时文件
  （`index.js`、`client.js`、`cordis.patch.yml`、`icon.svg`、`locale/*.json`）以及 `README.md`、`docs/`。
  GitHub / tarball 安装拿到的就是这些，足够直接运行，但不含 `src/`、`scripts/`、`test/`——
  想改规则的人请用路径 3 克隆完整仓库。
- **桌面版只能走界面**：`desktop` 配置档由 Electron 应用独占，命令行会拒绝写入
  （`error: profile "desktop" is managed exclusively by the Electron application`）。
- **装完刷新页面**。客户端 bundle 由 HMR 追加进引导图，刷新可确保生效。
- **版本耦合**：样式只用 `--dsw-alias-*` 主题 token，槽位是 `sidebar.footer.action`，
  并由 `dsh.client.inject` 依赖 DSH 自带的 `@deepseek-ai/dsh-client-ui-sidebar` 与
  `@deepseek-ai/dsh-client-locale`。DSH 若改槽位名或 locale API，需要跟着调整。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/pricing-rule.md](docs/pricing-rule.md) | 当前规则、价目表、官方来源、历史沿革、边界假设与维护方式 |
| [docs/development.md](docs/development.md) | 文件结构、设计取舍、自定义规则、构建命令与测试覆盖 |
| [docs/verification.md](docs/verification.md) | 验证状态：实测通过项、未验证项与验证方法 |
