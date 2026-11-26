const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI = path.join(__dirname, '../scripts/growth-event-import.py');
const START = '2026-10-29';
const END = '2026-11-04';

function makeWorkspace(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-event-import-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const database = path.join(directory, 'events.sqlite');
    return {
        database,
        write(name, content) {
            const file = path.join(directory, name);
            fs.writeFileSync(file, content);
            return file;
        },
        run(input, ...options) {
            const stdout = path.join(directory, 'stdout.json');
            const stderr = path.join(directory, 'stderr.txt');
            const stdoutFd = fs.openSync(stdout, 'w');
            const stderrFd = fs.openSync(stderr, 'w');
            try {
                const result = spawnSync('python3', [CLI, input, database, START, END, ...options], {
                    stdio: ['ignore', stdoutFd, stderrFd]
                });
                assert.ifError(result.error);
                return {
                    status: result.status,
                    stdout: fs.readFileSync(stdout, 'utf8'),
                    stderr: fs.readFileSync(stderr, 'utf8')
                };
            } finally {
                fs.closeSync(stdoutFd);
                fs.closeSync(stderrFd);
            }
        }
    };
}

function logFromApp(t) {
    const messages = [];
    globalThis.wx = {
        getRealtimeLogManager: () => ({ info: (message) => messages.push(message) }),
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } })
    };
    t.after(() => { delete globalThis.wx; });
    t.mock.method(console, 'info', () => {});
    const { trackEvent } = require('../utils/events');
    const { createRuntimeId } = require('../utils/entry');
    trackEvent('page_view', 'index', {
        sessionId: createRuntimeId('s'), entry: { entryId: createRuntimeId('e') }
    }, {}, createRuntimeId('p'));
    assert.equal(messages.length, 1);
    return messages[0];
}

test('D05 imports monitor exports and real serializer output idempotently, with coverage and bad-line counts', (t) => {
    const { write, run, database } = makeWorkspace(t);
    const legacy = {
        event: 'calculate_success', page: 'index', appVersion: '1.2.0', sessionId: 'mock-session',
        payload: { source: 'preset', presetName: '日落' }
    };
    const legacyMetadata = {
        report_date: START, timestamp: 100, traceid: 'mock-trace', url: 'pages/index/index', level: 2
    };
    const legacyExport = write('realtime_events.jsonl', JSON.stringify({ ...legacyMetadata, ...legacy }) + '\n');
    const next = logFromApp(t);
    const nextFields = JSON.parse(next.slice('[EVENT] '.length));
    const input = write('realtime_log_messages.jsonl', [
        JSON.stringify({ ...legacyMetadata, marker: 'EVENT', message: `[EVENT] ${JSON.stringify(legacy)}` }),
        JSON.stringify({ report_date: START, message: next }),
        JSON.stringify({ report_date: START, timestamp: 102, message: next }),
        JSON.stringify({ report_date: '2026-10-30', message: next }),
        JSON.stringify({ report_date: '2026-11-01', message: `[EVENT] ${JSON.stringify({
            ...nextFields, eventId: 'evt_mock_trial_2'
        })}` }),
        JSON.stringify({ report_date: START, message: '[DEBUG] mock-log' }),
        JSON.stringify({ report_date: START, message: '[EVENT] {mock-broken' }),
        JSON.stringify({ report_date: START, ...nextFields, eventId: null }),
        JSON.stringify({ report_date: '2026-02-30', ...legacy }),
        JSON.stringify({ report_date: '2026-10-28', ...legacy }),
        JSON.stringify({ report_date: START, event: 'page_view', eventVersion: 2 }),
        '{mock-broken',
        ''
    ].join('\n'));
    const runs = write('runs.jsonl', [
        JSON.stringify({ report_date: START, status: 'complete', realtime_log_total: 3 }),
        JSON.stringify({ report_date: '2026-10-30', status: 'partial', realtime_log_total: null }),
        JSON.stringify({ report_date: '2026-10-31', status: 'complete', realtime_log_total: 0 }),
        JSON.stringify({ report_date: '2026-11-02', status: 'complete', realtime_log_total: 2 }),
        JSON.stringify({ report_date: '2026-11-04', realtime_log_total: false }),
        ''
    ].join('\n'));

    const projected = run(legacyExport);
    assert.equal(projected.status, 0, projected.stderr);
    assert.deepEqual(JSON.parse(projected.stdout).eventVersions, { legacy: 1, 1: 0 });

    const first = run(input, '--runs', runs);
    const second = run(input, '--runs', runs);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const { import: firstImport, ...coverage } = JSON.parse(first.stdout);
    const { import: secondImport, ...repeatedCoverage } = JSON.parse(second.stdout);
    assert.deepEqual(coverage, {
        startDate: START, endDate: END, timezone: 'Asia/Shanghai',
        missingDates: ['2026-10-30', '2026-11-03', '2026-11-04'],
        zeroLogDates: ['2026-10-31'], eventOnlyDates: ['2026-11-01'],
        eventCount: 3, eventVersions: { legacy: 1, 1: 2 }
    });
    assert.deepEqual(repeatedCoverage, coverage);
    assert.deepEqual(firstImport, {
        inserted: 2, duplicates: 3, badLines: 4, otherLogs: 1, outsideWindow: 1,
        unsupportedVersions: { 2: 1 }, badRunLines: 1
    });
    assert.deepEqual(secondImport, { ...firstImport, inserted: 0, duplicates: 5 });
    assert.doesNotMatch(first.stdout, /mock-|mock_|evt_/);
    assert.doesNotMatch(fs.readFileSync(database).toString('utf8'), /mock-|mock_|evt_|日落/);
});

test('D05 rolls back the entire import if a source fails to read', (t) => {
    const { write, run } = makeWorkspace(t);
    const input = write('realtime_events.jsonl', JSON.stringify({ report_date: START, event: 'page_view' }));
    const failed = run(input, '--runs', path.dirname(input));
    assert.equal(failed.status, 1);
    assert.equal(failed.stdout, '');
    const retry = run(input);
    assert.equal(retry.status, 0, retry.stderr);
    assert.equal(JSON.parse(retry.stdout).import.inserted, 1);
});
