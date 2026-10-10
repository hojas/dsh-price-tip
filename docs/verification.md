# 验证状态

验证环境：DSH `0.2.0-rc.2`（macOS 桌面版自带的运行时），全部安装类验证都在**隔离的
`DSH_HOME=/tmp/...`** 里进行，用后连同临时配置档与进程一并删除，未触碰在用的 `desktop` 配置档。

## 已实测

- `node --test test/` — 18 项全绿（含「任意时刻到下次切换之间时段不变」的不变量扫描）。
- `node scripts/build-client.mjs --check` — 生成物与源一致；`node --check client.js` 语法通过。
- **真实安装与启动**：在隔离配置档里用 `dsh plugin --profile web add <目录>` 安装 → 依赖写入、
  `dsh-price-tip` 自动进入 `dsh.profile.bundles` → `--dump-config` 中出现
  `- id: price-tip / name: dsh-price-tip`（未禁用）。
- **真实服务端下发**：启动该配置档的 Web 服务后，引导图里出现
  `{"id":"dsh-price-tip","url":"plugins/??dsh-price-tip/client.js&rev=…","inject":["@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-sidebar"],"immediately":true}`；
  请求该 URL 返回 `200 text/javascript`，内容与工作区 `client.js` 一致（仅多一行 Host 追加的 sourceMappingURL）。
- **与真实 desktop 配置层组合**：把 `~/.dsh/profiles/desktop` 的清单/补丁复制到隔离配置档并加入本 bundle 后，
  `--dump-config` 正常组合出 `price-tip` 行，无冲突。
- **远端安装（模拟其他人）**：`dsh plugin --profile web add https://github.com/hojas/dsh-price-tip`
  → pnpm 从 codeload 取 tarball、依赖记为 `github:hojas/dsh-price-tip`、运行时文件齐全（含 `client.js`）、
  自动选入 `dsh.profile.bundles`；启动该配置档后引导图含该客户端行，下发 bundle 与仓库 `client.js`
  前 30127 字节**完全一致**（`200 text/javascript`，仅多一行 Host 追加的 sourceMappingURL）。
- **tarball 安装**：`pnpm pack` 产物安装后依赖记为 `file:/…/dsh-price-tip-1.0.0.tgz`，
  同样自动选入 bundles 并组合出 `price-tip` 行。

## 未验证

本会话没有浏览器控制能力，因此以下两项只经过代码审阅与结构测试，**没有**真实渲染核对：

- **像素级渲染**。浅色/深色主题下的观感、详情面板的定位、侧栏折叠（rail）态的横向对齐，
  都未在真实页面里截图确认。
- 安装进**正在运行的 desktop 配置档**后的实际显示（装法见 README 的「如何安装」）。

若实际观感与预期不符（位置、配色、宽度、弹层遮挡等），把现象告知即可修正。

## 方法说明

- 客户端渲染断言只做到「模块包装 + 插件生命周期 + 清单」这一层：不模拟 React、不构造 DOM、
  不做截图，避免用假渲染替代真实验证。
- 价格与规则不是靠记忆写死的：读的是官方价格页与其存档、官方发布说明，节假日日历核对的是
  国务院办公厅通知原文（逐条用 `date` 复核星期），来源与置信度见
  [pricing-rule.md](pricing-rule.md)。
