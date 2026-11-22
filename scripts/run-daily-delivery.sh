#!/usr/bin/env bash
set -euo pipefail
umask 077

export TZ=Asia/Shanghai
APP_REMOTE='git@github.com:li-yang-cn/timelapse-calculator-wxminiapp.git'
CODEX_BIN="$HOME/.local/bin/codex"
STATE_DIR="$HOME/.local/share/timelapse-growth-delivery"
FIRST_DAY=2026-11-23
LAST_DAY=2026-12-21

day=$(date +%F)
if [[ ${1:-} != --check ]]; then
    if [[ "$day" < "$FIRST_DAY" || "$day" > "$LAST_DAY" ]]; then
        exit 0
    fi
fi

mkdir -p "$STATE_DIR/logs"
exec 9>"$STATE_DIR/run.lock"
flock -n 9 || exit 0

if [[ ${1:-} != --check ]]; then
    exec >>"$STATE_DIR/logs/$day.log" 2>&1
    if [[ -f "$STATE_DIR/$day.completed" ]]; then
        exit 0
    fi
fi

export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND='ssh -o BatchMode=yes'
export PATH="$HOME/.local/bin:$PATH"

checkout=$(mktemp -d "$STATE_DIR/checkout.XXXXXXXX")
trap 'rm -rf -- "$checkout"' EXIT
trap 'date "+%F %T %Z" >&2' ERR

git clone --quiet --depth 1 --single-branch --branch main "$APP_REMOTE" "$checkout"
cd "$checkout"

if [[ ${1:-} == --check ]]; then
    npm test
    node scripts/growth-baseline.cjs /root/miniapp-minitor/data/wechat 2026-11-21
    timeout 180 "$CODEX_BIN" --ask-for-approval never exec --sandbox read-only --ephemeral \
        '只读烟测：读取当前仓库 DELIVERY.md，返回第一项未完成的日次。不要修改文件。'
    exit 0
fi

echo "[$day] Starting from $(git rev-parse --short HEAD)"
if ! next_task=$(awk '$2 == "[" && $3 == "]" && $5 ~ /^D[0-9][0-9]$/ { print $5; exit }' DELIVERY.md); then
    echo 'Could not read the delivery plan'
    exit 1
fi
if [[ -z "$next_task" ]]; then
    echo 'All delivery items are complete'
    touch "$STATE_DIR/$day.completed"
    exit 0
fi

timeout --kill-after=30 3600 "$CODEX_BIN" --ask-for-approval never exec \
    --sandbox workspace-write --ephemeral - <<PROMPT
本次目标为 $next_task。先阅读 HLD.md、DELIVERY.md 与仓库指令。只在当前独立检出中工作。
检视 DELIVERY.md 的未解决反馈，优先复现并修复。实现当前日次的一项可通过正常入口独立验证的完整功能。
改动范围限于本仓库，允许读取本机 miniapp-minitor 的项目接口和脱敏统计，不改监控目录或抓取凭证。
执行 npm test 和该日次验收。通过后才将该项标为 [x]，并在 DELIVERY.md 的交付记录写日期、内容、验证命令与手工复测步骤。自动测试与真机状态如实分开。
若只完成了反馈修复，保留日次未完成并在交付记录标出 [修复]，记录复现与通过的回归。若无完整交付，保持日次未完成，直接报告阻塞原因。
只保留交付需要的文件，禁止写入个人数据、凭证或原始运营快照。不要执行 git add、commit、push 或安装定时任务。外层进程负责验证、提交和推送。不要部署微信正式版、对外发消息或更改定时器。不要修改 scripts/run-daily-delivery.sh。
PROMPT

if git diff --quiet -- DELIVERY.md || [[ -z "$(git status --porcelain -- . ':(exclude)DELIVERY.md')" ]]; then
    echo 'No functional delivery with verification record'
    exit 1
fi

if ! rg -q "^\| \[x\] \| $next_task \|" DELIVERY.md &&
    ! git diff -- DELIVERY.md | rg '^\+.*\[修复\]' >/dev/null; then
    echo 'Scheduled slice is incomplete and no feedback fix was recorded'
    exit 1
fi

if ! git diff --quiet -- scripts/run-daily-delivery.sh; then
    echo 'Unexpected scheduler change'
    exit 1
fi

git diff --check
npm test
git add --all
git diff --cached --check
git -c commit.gpgsign=false commit -m "growth: deliver $next_task ($day)"
git push origin HEAD:refs/heads/main
git rev-parse HEAD > "$STATE_DIR/$day.completed"
