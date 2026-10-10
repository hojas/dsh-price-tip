# 验证状态

> 环境 DSH `0.2.0-rc.2`（macOS 桌面版自带运行时）。安装类验证全部在**隔离的 `DSH_HOME=/tmp/…`** 中进行，
> 用后连同临时配置档与进程一并删除；未触碰在用的 `desktop` 配置档。

## 实测

| 项 | 结论 |
| --- | --- |
| 渲染 | 标记与面板均按设计渲染（截图见下），客户端 bundle 经 HMR 生效，槽位注册成功 |
| 数值 | 截图倒计时 `41:14` 与 `src/policy.js` 的计算**逐字吻合**（周六 15:46 → 周一 09:00 恰为 41 小时 14 分） |
| 界面语言 | 切换时刻显示 `10 月 12 日 09:00`（中文日期 + 24 小时制）；修正前是 `10/12, 09:00 AM` |
| 弹层背景 | 同参数对比度拉伸下：改动前能还原出背后的正文碎片，改动后只剩纯色背景 |
| 测试 | `node --test test/` — 20 项全绿 |
| 构建产物 | `--check` 与源一致；`node --check client.js` 语法通过 |
| 安装 · 本地目录 | 依赖写入 → 自动选入 `dsh.profile.bundles` → `--dump-config` 出现 `- id: price-tip`（未禁用） |
| 安装 · GitHub | 依赖记为 `github:hojas/dsh-price-tip`，运行时文件齐全，无需构建 |
| 安装 · tarball | 依赖记为 `file:…/dsh-price-tip-1.0.0.tgz`，同样自动选入 bundles |
| 服务端下发 | 引导图含该客户端行（见下），请求返回 `200 text/javascript`，内容与仓库 `client.js` 一致（仅多一行 Host 追加的 sourceMappingURL） |
| desktop 组合 | 把 `~/.dsh/profiles/desktop` 的清单/补丁复制到隔离配置档后，`price-tip` 行正常组合、无冲突 |

```json
// 引导图（window.__DSH_BOOT__）里的客户端行
{ "id": "dsh-price-tip", "url": "plugins/??dsh-price-tip/client.js&rev=…", "immediately": true,
  "inject": ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-sidebar"] }
```

## 截图

侧栏底部的标记（绿色月牙 = 空闲时段，右侧为距下次切换的倒计时）：

![侧栏底部的标记](screenshot-sidebar.png)

完整窗口（侧栏底部即本插件；已裁掉底部账号区）：

![完整窗口](screenshot-app.png)

点击标记展开的面板：

![展开后的详情面板](screenshot-panel.png)

## 未验证

截图核对的是**浅色主题 + 侧栏展开态**；以下仍只有代码审阅与结构测试：

- **深色主题**观感——配色走同一批 `--dsw-alias-*` token，但未实拍。
- **侧栏折叠（rail）态**——宽度小于约 240px 时改走 36×36 的图标样式，未实拍。
- **交互行为**——Escape / 点击空白关闭、跨过切换时刻时文案翻转；静态截图无法证明。

若实际观感与预期不符（位置、配色、宽度、弹层遮挡等），把现象告知即可修正。

## 方法

- 客户端断言只做到「模块包装 + 插件生命周期 + 清单」一层：不模拟 React、不构造 DOM、不做截图，
  不用假渲染替代真实验证。
- 规则与价格读自 [官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)及其存档、官方发布说明；
  节假日逐条用 `date` 复核星期。官方文档未明确处的假设见 [development.md](development.md)。
