# 30 天增长功能交付

[增长 HLD](HLD.md) 是设计依据。每天完成下表一个可运行、可独立验收的功能切片。2026-11-22 先交付 D01，D02 起每天北京时间 09:00 运行，计划到 2026-12-21。出现未通过或阻塞时保留原任务和验证结果，下次优先重试，进度以实际通过的交付为准。

- 启动后从 GitHub 最新的 `main` 取代码，优先验证「反馈」中的未解决问题，再做第一项未完成的任务。问题导致当天无法按计划交付时，修复和回归通过后可单独提交，原任务保持待完成。
- 每项需从正常入口可用，有自动测试或可重复验证；已有路径跑 `npm test`，再跑该项验收。记录可拉取的提交、变更、命令和微信开发者工具或真机操作。真机、后台对账或运营结果按实际状态记录。
- 自动测试失败时保留日志，修复并重试。只有通过的完整功能或问题修复进入 `main`。远端出现新提交时不强推，基于最新代码重试。
- 30 天交付工程能力和可验证的渠道实验流程。累计用户、回访和日活用上线后的数据按 HLD 验收。真机、微信账号后台、对外渠道活动按实际可用条件推进。

## 每日交付

| 状态 | 日次 | 完整功能 | 当天验收 |
| --- | --- | --- | --- |
| [x] | D01 | 平台增长基线命令，从本地日快照输出累计、日活、新增及目标状态 | 真实 28 天基线对账；缺日标记不完整，真实 0 计入 |
| [x] | D02 | App 冷热启动归一化入口、会话与前台去重 | 冷启一次、同会话切页、热启新入口、长时间返回测试 |
| [x] | D03 | 全站统一版本化事件及紧凑序列化，接入清单和说明页访问 | 模拟各页切换，检查事件 ID、载荷边界和旧版兼容 |
| [x] | D04 | 渠道入口与首次／本次来源，含未知来源和保存失败回退 | 两条渠道路径、自然回访、热启和坏参数测试 |
| [x] | D05 | 监控用的事件导入与数据质量 CLI，兼容旧仓库日志与新版事件 | 重导保持幂等；输出缺日、坏行和事件版本覆盖 |
| [x] | D06 | 监控端受保护的日志身份摘要及覆盖率报告 | 用模拟身份验证跨日一致、账号区分、缺失降级；真机验证另记 |
| [x] | D07 | 新手首屏场景卡片，带名称、拍摄条件与参考参数 | 日落、云流动、星空和其他现存场景可选择并计算 |
| [ ] | D08 | 手动入门引导，按拍摄和成片时长给出可执行结果 | 新手走通两项输入；高级输入、历史回填仍可用 |
| [ ] | D09 | 按可解参数组合给缺项提示，同时区分校验与求解异常 | 组合、空值、零值、输入错误后恢复测试 |
| [ ] | D10 | 结果卡直显间隔和总张数，主动使用事件连接同一方案 | 精度、预设自动展示与主动使用的区别可验证 |
| [ ] | D11 | 风险展示与处理，以及冲突依据选择和重算 | 先后数值、取消保留输入、两个可行依据的回归 |
| [ ] | D12 | 版本化分享方案参数契约及开发者自测导入入口 | 合法快照回环；非法、过长、未知版本安全回退 |
| [ ] | D13 | 原生好友分享可携带方案，独立验证接收恢复 | 模拟分享路径端到端并提供双设备复测步骤 |
| [ ] | D14 | 热启动接收方案，保留当前编辑直至用户选择 | 重复进入、接受与拒绝、失效和弱网回归 |
| [ ] | D15 | 海报升级，明确场景、拍摄参数及通用码入口 | 日落海报、生成失败、分享保存降级验证 |
| [ ] | D16 | 分享入口到接收者有效使用的分析报表 | 批次归因、7 日成熟窗口、自打开和重复去重 |
| [ ] | D17 | 运营渠道登记及场景入口生成器，产出可试运行链接与试验清单 | 两个渠道进入同一场景后可区分；生成器范围校验 |
| [ ] | D18 | 把当前方案保存为本地命名计划，并从清单页恢复 | 保存、重启恢复、再次使用及存储失败重试 |
| [ ] | D19 | 单清单数据迁移为计划，保留历史与自定义事项 | 旧数据、损坏存储、重复启动、部分写入失败 |
| [ ] | D20 | 多计划列表、名称日期编辑和删除确认 | 两份计划互不覆盖；编辑后重启和删除指定计划 |
| [ ] | D21 | 手机／相机设备清单模板和可编辑检查项 | 模板创建、增删事项、勾选状态与计划隔离 |
| [ ] | D22 | 首页近期计划、复制重拍与重新计算 | 日落计划复制后独立修改、原计划保留 |
| [ ] | D23 | 有效 DAU、首次有效使用及 7/28 日回访报告 | 成熟 cohort、跨日去重、覆盖不足降级 |
| [ ] | D24 | 计划复用和渠道投入周报，输出人数、分母、未知比例与成本 | 复用跨日去重，费用缺失可识别，样本可追溯 |
| [ ] | D25 | 日落、云流动和星空场景教程落地入口 | 三类入口参数恢复、失效回退，教程可直接进入对应场景 |
| [ ] | D26 | 复制场景合作活动模板与带渠道归因的活动入口 | 两次重复活动可独立归因，附微信后台／扫码核验步骤 |
| [ ] | D27 | 小程序内轻量使用反馈入口，可主动复制含场景和版本的反馈 | 用户确认复制、取消及输入上限，反馈内容不进入行为日志 |
| [ ] | D28 | 拍摄计划里的存储估算需求试验入口，记录意愿与原因分类 | 可参与或跳过、重复参与去重、结果可按设备类型汇总 |
| [ ] | D29 | 增长功能兼容与降级入口，提供运营发布前自测命令 | 模拟旧版本、弱网、坏本地数据以及不可用的分享入口 |
| [ ] | D30 | 端到端发布验收命令与总报告，覆盖使用、分享、计划和平台目标 | 从干净检出运行整套检查，给出体验版和双真机检查项、后续需求证据及未验证项 |

D05、D06、D16、D23、D24 使用本仓库可测试的监控工具读取外部快照或导出，线上监控可在获得对应工作目录权限后调用。没有成熟回访数据或真机记录时，报告显示待验证。动态方案码、提醒及天气等按 HLD 的验证门槛决定投入时机。

## 反馈

你可以直接在这个聊天发报错，带上提交号、机型或开发者工具版本、操作步骤和报错文本。收到后优先复现修复。需要自动任务接续时，将可公开复现的信息加入这里再推送，下一次从远端读取。涉及个人信息的日志先脱敏。

- 暂无待验证反馈。

## 交付记录

- 2026-11-22 · D01。已交付平台增长基线命令。运行 `node scripts/growth-baseline.cjs /root/miniapp-minitor/data/wechat 2026-11-21`，输出累计 1,897、28 天用户日 57、新增 47、日活为零 15 天、平均 DAU 2.04。运行 `npm test` 验证真实 0 和缺日边界。微信后台同日累计口径对账待做。
- 2026-11-23 · D02。App 统一归一化入口并管理会话。冷启只记一次 `entry_open`，短时普通返回沿用会话，新的外部入口或后台满 30 分钟返回生成新会话。计算器事件关联 App 的 `sessionId`、`entryId` 和计算器的 `pageInstanceId`。连续两次前台收到相同的外部入口参数时，按同一次入口处理。
  - 自动验收通过。运行 `npm test` 和 `node --test test/app-entry.test.js`。D02 覆盖冷启及首次前台去重、切页、不同参数的外部入口、已加载计算器随热启更新会话，以及后台 30 分钟边界。
  - 微信开发者工具手工复测待做。普通编译后在 AppService 控制台过滤 `[EVENT]`，确认只有一条 `cold_start` 的 `entry_open`。依次切到清单、使用说明、计算器，再点击日落预设，确认没有新增 `entry_open`，`calculate_success` 沿用原 `sessionId`。
  - 在同一控制台模拟热启，执行 `getApp().onHide()`，再执行 `getApp().onShow({ path: 'pages/index/index', scene: 1007, query: { shareBatch: 'd02-demo' } })`。确认新增一条 `external_entry` 的 `entry_open`。重复同一组回调应保持条数。再次点击日落预设，确认 `calculate_success` 使用新会话，`pageInstanceId` 沿用切后台前的值。
  - 在同一控制台模拟长时返回，依次执行 `getApp().onHide()`、`getApp().backgroundedAt -= 30 * 60 * 1000`、`getApp().onShow({ scene: 1089 })`。确认新增一条 `background_timeout` 的 `entry_open`，且会话 ID 更新。真机冷热启动、实际前台回调参数及实时日志到达均待验证。若系统已回收进程，重新打开应记录 `cold_start`。
- 2026-11-24 · D03。App 和已注册页面统一使用 `eventVersion: 1`、独立 `eventId` 和运行环境字段。计算器、清单、使用说明每次 `onShow` 都记录 `page_view`，同一页面实例保留 `pageInstanceId`。单条日志含 `[EVENT] ` 前缀最多 768 个 UTF-8 字节。载荷按事件白名单筛选，预设用 `sceneKey` 表示，计算仅保留字段组合和风险分类。
  - 自动验收通过。运行 `npm test` 和 `node --test test/app-entry.test.js`。覆盖三页切换和重新展示、冷热启动关联、同一时刻生成的事件 ID、超长文本过滤、UTF-8 字节预算、旧版日志和日志接口异常降级。本机监控的现有 `parseEventMessage` 也通过了模拟旧版日志和实际新序列化输出的解析检查。
  - 微信开发者工具手工复测待做。普通编译后，在 AppService 控制台过滤 `[EVENT]`。按计算器 → 清单 → 使用说明 → 计算器切换。确认一条 `entry_open` 和四条 `page_view`，各条 `eventId` 不重复，`sessionId` 和 `entryId` 一致，两条计算器访问的 `pageInstanceId` 相同。
  - 在计算器点击「日落」，确认 `calculate_success` 的 `sceneKey` 为 `sunset`，环境为 `develop`；在清单填写测试名称后切到使用说明，检查访问事件的 `payload` 为空对象。复制完整事件日志行，可在本地 Node 中用 `Buffer.byteLength(line, 'utf8')` 核对 768 字节预算。
  - 真机切页和前后台回调顺序、体验版环境标记及微信实时日志到达均待验证。
- 2026-11-25 · D04。App 启动和新外部入口识别已登记的渠道与活动，在 `entry_open` 记录 `firstSource` 和 `currentSource`。首次来源按本地存储记录，缺失或非法入口归为 `unknown`。读失败时首次来源暂记 `unknown`，已有记录保留；写失败时使用本进程首次观测值，下次新入口重试。计算事件可通过 `entryId` 关联本次来源。首次来源口径为当前小程序本地存储，用户级去重留待后续日次。
  - 自动验收通过。运行 `npm test` 和 `node --test test/app-entry.test.js`。覆盖两条渠道入口、冷热启动、重复前台回调、自然回访、坏参数、损坏的来源记录、读写故障及恢复后的计算事件关联。
  - 微信开发者工具手工复测待做。在测试环境从 AppService 控制台执行 `wx.removeStorageSync('growthFirstSource')`，再自定义编译，启动页面填 `pages/index/index`，启动参数填 `channel=tutorial&campaign=sunset`。过滤 `[EVENT]`，应只有一条 `cold_start`，两个来源都为 `tutorial` / `sunset`。
  - 在同一 AppService 控制台执行 `getApp().onHide()`，再执行 `getApp().onShow({ path: 'pages/index/index', scene: 1007, query: { channel: 'photo_club', campaign: 'sunset_walk' } })`。应新增一条 `external_entry`，本次来源为 `photo_club` / `sunset_walk`，首次仍为 `tutorial` / `sunset`。重复这组回调应保持入口条数；点击「日落」后，`calculate_success` 应沿用该热启的 `entryId`。
  - 保留存储，重新冷编译同一页面，清空启动参数。本次来源应为 `unknown`，首次来源仍为 `tutorial` / `sunset`。再用 `channel=tutorial&campaign=sunset_walk` 自定义编译，确认本次来源为 `unknown`，计算器可正常使用。
  - 真机冷热启动、渠道路径的实际传参及微信实时日志到达均待验证。
- 2026-11-26 · D05。新增 Python 3 监控 CLI `scripts/growth-event-import.py`。按北京时间的 `report_date` 导入指定日期范围，在独立 SQLite 中保存去重键、日期、事件名、版本、应用版本和环境。新版按全局事件 ID 保留首次导入记录，旧版按监控事件投影的稳定摘要去重。JSON 报告给出库内去重后的版本计数和日期覆盖，以及本次导入的坏行、重复和不支持版本计数。可选的 `--runs` 识别已采集且日志总数为零的日期；仅有事件的日期列在 `eventOnlyDates`，两类证据都缺失的日期列在 `missingDates`。
  - 历史数据支持监控的 `realtime_events.jsonl`。新版覆盖统计使用保留 `[EVENT]` 原始字段的 `realtime_log_messages.jsonl` 脱敏副本。现有 `realtime_events.jsonl` 投影省略 `eventVersion` 和 `eventId`，其中的无版本记录归入 `legacy`。涉及新版的日期应只用消息导出，以免同一新版事件从两种导出各计一次。
  - 自动验收通过。运行 `npm test` 和 `node --test test/growth-event-import.test.js`。覆盖旧导出与旧消息去重、小程序实际序列化的新版事件按 ID 去重、重复导入、跨月缺日、真实零日志、坏行、未知版本和读取失败后整批回滚。
  - 终端手工复测通过。在临时目录按下方内容生成合成输入，连续两次使用同一 SQLite 路径。首次 `inserted=2`，重导 `inserted=0`、`duplicates=2`。两次均应有旧版和新版各 1 条、坏行 1 条、11 月 2 日为零日志、11 月 3 日为缺日。

    ```bash
    d05_tmp=$(mktemp -d)
    cat > "$d05_tmp/realtime_log_messages.jsonl" <<'JSONL'
    {"report_date":"2026-11-01","message":"[EVENT] {\"event\":\"page_view\",\"appVersion\":\"1.2.0\"}"}
    {"report_date":"2026-11-01","message":"[EVENT] {\"event\":\"page_view\",\"eventVersion\":1,\"eventId\":\"evt_demo_abc_1\",\"environment\":\"trial\"}"}
    {"report_date":"2026-11-01","message":"[EVENT] {"}
    JSONL
    cat > "$d05_tmp/runs.jsonl" <<'JSONL'
    {"report_date":"2026-11-02","realtime_log_total":0}
    JSONL
    for d05_attempt in 1 2; do
      python3 scripts/growth-event-import.py "$d05_tmp/realtime_log_messages.jsonl" \
        "$d05_tmp/events.sqlite" 2026-11-01 2026-11-03 --runs "$d05_tmp/runs.jsonl"
    done
    ```

  - 真实监控导出对账、微信真机和实时日志到达待验证。

- 2026-11-27 · D06。现有事件导入 CLI 增加 `--monitor-sqlite`。通过只读 SQLite 连接读取监控消息表，以服务端环境变量 `GROWTH_IDENTITY_KEY` 提供的 32 字节十六进制密钥对监控标为 `openid` 的字段生成 HMAC-SHA-256 摘要。每个小程序使用独立密钥，重导使用同一密钥，换密钥时使用新的分析库。输出库须由当前用户独占，新建库权限为 `0600`。原始身份和密钥均不写入分析库，JSON 报告只输出计数和比例。
  - `identityCoverage` 按全窗口和逐日汇总，分母为已接纳的去重事件。缺失、格式无效或同一事件出现冲突的摘要计入 `withoutDigest`。有事件但无摘要时为 `unavailable`、比例为 0，无事件时比例为 `null`。旧 JSONL 继续导入，已有事件可从监控 SQLite 重导补齐摘要。同一日期使用一种消息来源，沿用 D05 的事件去重口径。
  - 自动验收通过。运行 `npm test` 和 `node --test --test-name-pattern='D06' test/growth-event-import.test.js`。覆盖跨日稳定、账号区分、重导补齐、缺失与冲突降级、重导幂等、密钥及输出权限校验。
  - 终端手工复测通过。以下命令使用合成监控库。首次新增 5 条，重导新增 0 条并识别 5 条重复。两次覆盖率均为 3/5，11 月 1 日为 `complete`、2 日为 `partial`、3 日为 `unavailable`、4 日比例为 `null`。末行 `(3, 2)` 表示 3 条事件有摘要、共 2 种摘要。

    ```bash
    (
      set -e
      d06_tmp=$(mktemp -d)
      trap 'rm -rf -- "$d06_tmp"' EXIT
      python3 - "$d06_tmp/monitor.sqlite" <<'PY'
    import json, sqlite3, sys
    with sqlite3.connect(sys.argv[1]) as db:
        db.execute("""CREATE TABLE realtime_log_messages (
            report_date TEXT, message_id TEXT, timestamp INTEGER, level INTEGER,
            url TEXT, traceid TEXT, marker TEXT, message TEXT, openid TEXT)""")
        for index, (day, subject) in enumerate([
            (1, 'synthetic-A'), (2, 'synthetic-A'), (2, 'synthetic-B'), (2, None), (3, None)
        ], 1):
            event = dict(event='page_view', eventVersion=1, eventId=f'evt_demo_event_{index}')
            db.execute("""INSERT INTO realtime_log_messages
                (report_date, message_id, message, openid) VALUES (?, ?, ?, ?)""",
                (f'2026-11-{day:02}', str(index), '[EVENT] ' + json.dumps(event), subject))
    PY
      export GROWTH_IDENTITY_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
      for d06_attempt in 1 2; do
        python3 scripts/growth-event-import.py "$d06_tmp/monitor.sqlite" \
          "$d06_tmp/events.sqlite" 2026-11-01 2026-11-04 --monitor-sqlite
      done
      python3 - "$d06_tmp/events.sqlite" <<'PY'
    import sqlite3, sys
    with sqlite3.connect(sys.argv[1]) as db:
        print(db.execute("SELECT COUNT(*), COUNT(DISTINCT subject_digest) FROM event_identities").fetchone())
    PY
    )
    ```

  - 真实监控覆盖率、平台字段语义及微信真机验证待做。在受限监控环境中，用同一测试账号跨日、跨设备各触发一次事件，再用另一测试账号触发事件。核对同账号摘要一致、不同账号摘要有别，并核对缺失字段的实际比例，只记录核验结果。平台身份语义验证通过前，用户级指标标记为不可用。

- 2026-11-28 · D07。计算器首页直接展示云流动、日落和星空三张场景卡片。「更多场景」可展开车流、人群和植物。每张卡片显示拍摄条件、参考拍摄时长、成片时长、帧速率和间隔范围。点击卡片会运行现有计算器、回填结果并保存历史。
  - 自动验收通过。运行 `npm test` 和 `node --test --test-name-pattern=D07 test/pages-index.test.js`。覆盖首页模板的卡片字段和点击绑定、六个场景的计算和历史保存、更多场景展开与收起，以及编辑、回填历史或重置时清除卡片选中状态。
  - 微信开发者工具手工复测待做。普通编译进入「计算器」，用窄屏模拟器确认首页三张卡片的名称、拍摄条件和参考参数均可读。依次点击云流动、日落和星空，确认卡片标为「已选」，向下查看表单中的拍摄间隔和总张数，预期分别为 12.00 秒／300 张、14.40 秒／375 张和 36.00 秒／300 张。
  - 展开「更多场景」，依次选择车流、人群和植物，预期分别为 2.40 秒／250 张、3.60 秒／250 张和 144.00 秒／300 张。收起后确认当前计算结果仍可查看。点击「重置」，手动输入拍摄 10 分钟和成片 10 秒，用默认 25 fps 计算，预期为 2.40 秒／250 张。展开历史并点击一条记录确认可回填。
  - 微信真机验证待做。在 iOS 和 Android 上分别检查窄屏文字换行、卡片点击及「更多场景」展开后的计算结果。
