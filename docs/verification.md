# 验证状态

验证环境：DSH `0.2.0-rc.2`（macOS 桌面版自带的运行时），全部安装类验证都在**隔离的
`DSH_HOME=/tmp/...`** 里进行，用后连同临时配置档与进程一并删除，未触碰在用的 `desktop` 配置档。

## 已实测

- **真实渲染（本机 desktop 实例截图）**：在装有本插件的 desktop 配置档里，标记实际渲染在侧栏底部——
  绿色月牙图标（空闲时段配色）、文案「空闲时段」、右对齐倒计时 `41:14`，与 `src/policy.js` 的计算**逐字吻合**
  （周六 15:46 到周一 09:00 恰为 41 小时 14 分）。这一张同时证明了：客户端 bundle 经 HMR 生效、
  `sidebar.footer.action` 槽位注册成功、locale 文案与主题 token 都按预期生效。

  ![侧栏底部的标记](screenshot-sidebar.png)

  完整窗口（侧栏底部即本插件；已裁掉底部账号区）：
  ![完整窗口](screenshot-app.png)

- **详情面板（真实渲染截图）**：点击标记展开的面板实拍——状态行与 5 折标签、实时倒计时（`40 小时 59 分 27 秒`）、
  切换时刻、规则文案、价目表（加粗空闲价 + 划线高峰价）、两条口径说明、页脚生效/核对日期与来源链接全部按设计渲染；
  说明槽位注册后的 React 组件、主题 token、locale 文案与价格推导在真实页面里都成立。
  这张同时确认了「切换时刻跟随界面语言」的修正：中文界面显示 `10 月 12 日 09:00`（中文日期 + 24 小时制），
  而不是修正前跟随浏览器区域设置的 `10/12, 09:00 AM`。（浏览器 ICU 会在「月/日」两侧留空格，与 Node ICU 的
  `10月12日` 有细微差异，属正常渲染差异。）

  ![展开后的详情面板](screenshot-panel.png)

  注意：静态截图能证明**布局与内容**，不能证明交互行为（Escape / 点击空白关闭）——那部分仍只有代码审阅。

- `node --test test/` — 20 项全绿（含「任意时刻到下次切换之间时段不变」的不变量扫描）。
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

上面的截图核对的是**浅色主题 + 侧栏展开态**。以下情形仍只经过代码审阅与结构测试，没有截图核对：

- **深色主题**下的观感（配色走同一批 `--dsw-alias-*` token，但未实拍）。
- **侧栏折叠（rail）态**：宽度 < 约 240px 时走 36×36 的图标样式，未实拍。
- **交互行为**：Escape 关闭、点击空白关闭、按秒刷新之外的状态切换（如跨过切换时刻时文案翻转）——
  静态截图无法证明，只有代码层面的实现与卸载清理。

若实际观感与预期不符（位置、配色、宽度、弹层遮挡等），把现象告知即可修正。

## 方法说明

- 客户端渲染断言只做到「模块包装 + 插件生命周期 + 清单」这一层：不模拟 React、不构造 DOM、
  不做截图，避免用假渲染替代真实验证。
- 价格与规则不是靠记忆写死的：读的是官方价格页与其存档、官方发布说明，节假日日历核对的是
  国务院办公厅通知原文（逐条用 `date` 复核星期），来源与置信度见
  [pricing-rule.md](pricing-rule.md)。
