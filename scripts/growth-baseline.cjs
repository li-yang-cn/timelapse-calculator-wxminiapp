// Run with node scripts/growth-baseline.cjs <snapshot-directory> [end-date].
const fs = require('node:fs');
const path = require('node:path');

const WINDOW = 28;
const DAY_MS = 86_400_000;

function buildBaseline(directory, endDate) {
    const dates = fs.readdirSync(directory)
        .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
        .map((name) => name.slice(0, -5));
    const end = endDate ?? dates.sort().at(-1);
    const endTime = Date.parse(end);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(endTime) ||
        new Date(endTime).toISOString().slice(0, 10) !== end) {
        throw new Error('请提供有效的 YYYY-MM-DD 日期，或使用含有日期快照的目录。');
    }

    const days = Array.from({ length: WINDOW }, (_, index) =>
        new Date(endTime - (WINDOW - 1 - index) * DAY_MS).toISOString().slice(0, 10));
    const visits = [];
    const additions = [];
    const missing = [];
    let cumulativeUsers = null;

    for (const day of days) {
        if (!dates.includes(day)) {
            missing.push(day);
            continue;
        }
        const snapshot = JSON.parse(fs.readFileSync(path.join(directory, `${day}.json`), 'utf8'));
        if (snapshot.report_date !== day) {
            missing.push(day);
            continue;
        }

        if (day === end) {
            const overview = snapshot.endpoints?.daily_summary_trend?.list
                ?.find(({ ref_date }) => String(ref_date) === day.replaceAll('-', ''));
            if (isCount(overview?.visit_total)) {
                cumulativeUsers = overview.visit_total;
            }
        }

        const { visit_uv: active, visit_uv_new: added } = snapshot.summary ?? {};
        if (!isCount(active) || !isCount(added) || added > active) {
            missing.push(day);
            continue;
        }
        visits.push(active);
        additions.push(added);
    }

    const complete = missing.length === 0;
    const sum = (values) => values.reduce((total, value) => total + value, 0);
    const userDays = complete ? sum(visits) : null;
    const averageDau = complete ? userDays / WINDOW : null;
    return {
        startDate: days[0],
        endDate: end,
        timezone: 'Asia/Shanghai',
        cumulativeUsers,
        userDays,
        newUsers: complete ? sum(additions) : null,
        averageDau,
        zeroDauDays: complete ? visits.filter((daily) => daily === 0).length : null,
        missingDates: missing,
        snapshotThresholdMet: complete && cumulativeUsers !== null
            ? cumulativeUsers >= 100_000 && averageDau >= 1_000
            : null,
    };
}

function isCount(value) {
    return Number.isSafeInteger(value) && value >= 0;
}

if (require.main === module) {
    const [directory, endDate] = process.argv.slice(2);
    try {
        if (!directory) {
            throw new Error('用法：node scripts/growth-baseline.cjs <微信日快照目录> [YYYY-MM-DD]');
        }
        console.log(JSON.stringify(buildBaseline(directory, endDate), null, 2));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { buildBaseline };
