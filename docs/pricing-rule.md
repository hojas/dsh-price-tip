# 价格时段规则

> 本插件提醒的规则**全部来自官方价格页**，核对于 **2026-10-10**。
> 规则是纯挂钟函数：不依赖会话、请求量或账号，只看时刻。

## 现行规则

| 项目 | 值 | 来源 |
| --- | --- | --- |
| 高峰时段 | 北京时间 周一至周五 09:00–12:00、14:00–18:00，**不含中国法定节假日** | [官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) |
| 空闲时段 | 其余全部时间，**含周末与法定节假日全天** | 同上 |
| 空闲折扣 | 高峰价格的 **50%**（5 折） | 同上 |
| 计价时刻 | 取请求**完成**时间（官方在旧错峰方案下的口径） | 见「边界与假设」 |
| 价目表生效 | 2026-09-10 12:00（北京时间） | [news260910](https://api-docs.deepseek.com/zh-cn/news/news260910) |

价格（元 / 百万 tokens，高峰价；空闲价 = 高峰价 × 50%）：

| 模型 | 缓存命中 | 缓存未命中 | 输出 |
| --- | --- | --- | --- |
| `deepseek-flash`（V4.1-Flash） | 0.04 → 0.02 | 2 → 1 | 8 → 4 |
| `deepseek-v4-pro` | 0.30 → 0.15 | 9 → 4.5 | 27 → 13.5 |

> ⚠️ 「北京时间 00:30–08:30 错峰优惠」已于 2025-09-05 16:00 UTC 取消。照它实现会把工作日 09:00–18:00
> 的高峰当成空闲、成本低估一半；`deepseek-chat` / `deepseek-reasoner` 亦已于 2026-07-24 15:59 UTC 下线。

## 历史沿革

| 时间 | 变化 | 来源 |
| --- | --- | --- |
| 2025-02-26 | 首次引入错峰优惠：北京时间 00:30–08:30，V3 5 折、R1 2.5 折 | [证券时报](https://stcn.com/article/detail/1548559.html) |
| 2025-09-05 16:00 UTC | **取消**夜间折扣，改为统一价目表 | [价格页存档](http://web.archive.org/web/20250901000000/https://api-docs.deepseek.com/quick_start/pricing) |
| 2025-09-29 | V3.2-Exp 发布，降价 50%+，仍无时段差异 | [news250929](https://api-docs.deepseek.com/zh-cn/news/news250929) |
| 2026-07-24 15:59 UTC | `deepseek-chat` / `deepseek-reasoner` 下线 | [updates](https://api-docs.deepseek.com/updates) |
| 2026-08-16 16:00 UTC | V4 GA，**重新引入**高峰/空闲定价（价格同时上调） | [news260813](https://api-docs.deepseek.com/news/news260813) |
| 2026-08-23 | 周末整日计为空闲（媒体报道，官方更新日志未单列） | [证券时报](https://www.stcn.com/article/detail/4103775.html) |
| 2026-09-10 04:00 UTC | V4.1-Flash 降价，现行价目表生效 | [news260910](https://api-docs.deepseek.com/zh-cn/news/news260910) |

## 边界与假设

官方文档未明确、但插件必须做决定的地方：

| # | 假设 | 依据 / 处理 |
| --- | --- | --- |
| 1 | 窗口**半开**：`[09:00, 12:00)` | 官方只写「9:00 - 12:00」，起点算高峰、终点算空闲 |
| 2 | 计价时刻取请求**完成**时间 | 2025 年官方在旧错峰方案下如此规定；现行文档未重申，标记显示的是「现在」 |
| 3 | 节假日日历按年内置 | 该日历由国务院办公厅每年另行[发布](https://www.gov.cn/zhengce/content/202511/content_7047090.htm)；已内置 2026 年落在工作日的 19 个节假日（周末本已全天空闲，6 个调休上班日全在周末，无需特殊处理）；未覆盖年份标注「按工作日估算」 |
| 4 | `deepseek-v4-pro` 以官方价格页为准 | 价格页与 2026-09-10 发布说明口径不一致 |

## 维护

规则与价格都在 `src/policy.js` 一处定义，改完必须重建 `client.js`（见 [development.md](development.md)）：

- **每年 11 月**：国务院办公厅发布次年安排后，追加 `HOLIDAYS_<年>`，并扩展 `schedule.calendarYears`。
- **每次价格变动**：更新 `POLICY.models`、`POLICY.effectiveFrom` 与 `POLICY.verifiedAt`（面板底部的日期随之变化）。
- 官方价格页带有「价格可能变动」的免责声明，本插件不对未来变更作保证。
