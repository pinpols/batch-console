# 日期时间契约

## 字段语义

| 语义     | 后端类型 / OpenAPI      | 前端传输                     | 展示 / 输入                              |
| -------- | ----------------------- | ---------------------------- | ---------------------------------------- |
| 时间点   | `Instant` / `date-time` | 带 `Z` 或显式偏移的 ISO-8601 | 按当前展示时区显示 `YYYY-MM-DD HH:mm:ss` |
| 业务日期 | `LocalDate` / `date`    | `YYYY-MM-DD`                 | 保留原日期，不按时区换算                 |
| 本地时刻 | `LocalTime` / `time`    | `HH:mm:ss`                   | 不附加日期或时区                         |
| 持续时长 | 毫秒数等数值            | 原数值                       | `fmtDuration`，不当作时间点解析          |

后端权威定义见 [`BatchDateTimeSupport.java`](../../../file-batch-system/batch-common/src/main/java/io/github/pinpols/batch/common/time/BatchDateTimeSupport.java) 和 [`console-api.openapi.yaml`](../../../file-batch-system/docs/api/console-api.openapi.yaml)。时间点存储和 API 响应以 UTC `Instant` 为准；业务日期按平台业务时区计算。前端部署的 `VITE_DISPLAY_TIMEZONE` 必须与后端默认业务时区一致（当前为 `Asia/Shanghai`）；用户切换展示时区只影响时间点展示和输入，不改变业务日期。

## 前端入口

- 普通文本使用 `src/components/common/DatetimeText.vue`；表格列使用 `DatetimeColumn.vue`。相对时间和紧凑时间也由 `DatetimeText` 的 `mode` 选择。
- 单个 `Instant` 输入使用 `InstantPicker.vue`；范围输入使用 `InstantRangePicker.vue`。需要预设时使用 `DateRangePresetPicker.vue`，其 `datetimerange` 值为 ISO `Instant` 元组，`daterange` 值为 `LocalDate` 元组。页面不再自行拼接无偏移时间字符串。
- 通用转换集中在 `src/utils/datetime.ts`：`todayBusinessDate()`、`recentBusinessDateRange()` 和 `businessCalendarDate()` 处理业务日；`fmtClockTime()` 与 `fmtTodayOrDatetime()` 处理紧凑展示。禁止用 UTC 日期截取或浏览器本地年月日推导业务日。
- 无效日期和夏令时跳时期间不存在的本地时刻不会提交；重复的回拨时刻由时区库解析为其中一个时间点，如需精确区分，应由后端字段明确接收偏移。

Cron 下次执行预览使用后端返回的 IANA 计算时区，并将该时区标在结果旁；它不跟随用户的展示时区。业务日历控件内部保留本地 `Date` 作为选中月份模型，传输仍仅用 `LocalDate` 字符串。持续时长、倒计时和容量时间桶可在 epoch 毫秒上计算，不应先按本地时区转成墙上时间。本规范不改变定时表达式和本地营业窗口的语义。

修改后端字段类型时先更新 OpenAPI，再重新生成 `src/types/api.generated.ts` 并补跨时区测试。
