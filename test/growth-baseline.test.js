const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildBaseline } = require('../scripts/growth-baseline.cjs');

test('28 日基线保留真实零值，并区分快照缺失和累计缺失', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-baseline-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    for (let date = 1; date <= 28; date += 1) {
        const day = `2026-11-${String(date).padStart(2, '0')}`;
        fs.writeFileSync(path.join(directory, `${day}.json`), JSON.stringify({
            report_date: day,
            summary: { visit_uv: date === 1 ? 0 : 1_040, visit_uv_new: date === 1 ? 0 : 100 },
            endpoints: {
                daily_summary_trend: {
                    list: [{ ref_date: day.replaceAll('-', ''), visit_total: 100_000 }],
                },
            },
        }));
    }

    const full = buildBaseline(directory);
    assert.equal(full.cumulativeUsers, 100_000);
    assert.equal(full.newUsers, 2_700);
    assert.equal(full.averageDau, 27 * 1_040 / 28);
    assert.equal(full.zeroDauDays, 1);
    assert.equal(full.snapshotThresholdMet, true);
    assert.throws(() => buildBaseline(directory, '2026-02-30'), /YYYY-MM-DD/);

    fs.unlinkSync(path.join(directory, '2026-11-01.json'));
    const incomplete = buildBaseline(directory, '2026-11-28');
    assert.deepEqual(incomplete.missingDates, ['2026-11-01']);
    assert.equal(incomplete.averageDau, null);
    assert.equal(incomplete.snapshotThresholdMet, null);
});
