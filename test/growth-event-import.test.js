const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes, createHash, createHmac } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI = path.join(__dirname, '../scripts/growth-event-import.py');
const START = '2026-10-29';
const END = '2026-11-04';

function makeWorkspace(t, env = process.env) {
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
            return runPython(directory, [CLI, input, database, START, END, ...options], env);
        }
    };
}

function runPython(directory, args, env, input = '') {
    const stdin = path.join(directory, 'stdin.txt');
    const stdout = path.join(directory, 'stdout.json');
    const stderr = path.join(directory, 'stderr.txt');
    fs.writeFileSync(stdin, input);
    const fds = [fs.openSync(stdin, 'r'), fs.openSync(stdout, 'w'), fs.openSync(stderr, 'w')];
    try {
        const result = spawnSync('python3', args, { env, stdio: fds, timeout: 10000 });
        assert.ifError(result.error);
        return {
            status: result.status,
            stdout: fs.readFileSync(stdout, 'utf8'),
            stderr: fs.readFileSync(stderr, 'utf8')
        };
    } finally {
        for (const fd of fds) fs.closeSync(fd);
    }
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
    const { import: firstImport, identityCoverage, ...coverage } = JSON.parse(first.stdout);
    const { import: secondImport, identityCoverage: repeatedIdentity, ...repeatedCoverage } = JSON.parse(second.stdout);
    assert.deepEqual(coverage, {
        startDate: START, endDate: END, timezone: 'Asia/Shanghai',
        missingDates: ['2026-10-30', '2026-11-03', '2026-11-04'],
        zeroLogDates: ['2026-10-31'], eventOnlyDates: ['2026-11-01'],
        eventCount: 3, eventVersions: { legacy: 1, 1: 2 }
    });
    assert.deepEqual(repeatedCoverage, coverage);
    assert.deepEqual(repeatedIdentity, identityCoverage);
    assert.equal(identityCoverage.status, 'unavailable');
    assert.equal(identityCoverage.withoutDigest, 3);
    assert.deepEqual(firstImport, {
        inserted: 2, duplicates: 3, badLines: 4, otherLogs: 1, outsideWindow: 1,
        unsupportedVersions: { 2: 1 }, badRunLines: 1
    });
    assert.deepEqual(secondImport, { ...firstImport, inserted: 0, duplicates: 5 });
    assert.doesNotMatch(first.stdout, /mock-|mock_|evt_/);
    assert.doesNotMatch(fs.readFileSync(database).toString('utf8'), /mock-|mock_|evt_|日落/);
});

function python(source, file, input) {
    const result = runPython(path.dirname(file), ['-c', source, file], process.env, input);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
}

test('D06 imports monitor SQLite via the CLI and reports coverage without exposing identities', (t) => {
    const env = { ...process.env };
    delete env.GROWTH_IDENTITY_KEY;
    const { write, run, database } = makeWorkspace(t, env);
    const key = randomBytes(32).toString('hex');
    const accountA = 'synthetic-subject-A';
    const accountB = 'synthetic-subject-B';
    const nextDay = '2026-10-30';
    const unknownDay = '2026-10-31';
    const event = (id) => ({
        event: 'page_view', eventVersion: 1, eventId: `evt_demo_event_${id}`,
        payload: { openid: 'untrusted-payload-field' }
    });
    const message = (id) => `[EVENT] ${JSON.stringify(event(id))}`;
    const projection = write('realtime_log_messages.jsonl', JSON.stringify({
        report_date: START, message: message(1), openid: 'untrusted-export-field'
    }));
    const monitor = path.join(path.dirname(database), 'mock monitor #.sqlite');
    python(`
import json, sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    db.execute("""CREATE TABLE realtime_log_messages (
        report_date TEXT, message_id TEXT, timestamp INTEGER, level INTEGER, url TEXT,
        traceid TEXT, openid TEXT, filter_msg TEXT, marker TEXT, message TEXT,
        PRIMARY KEY (report_date, message_id))""")
    db.executemany("""INSERT INTO realtime_log_messages
        (report_date, message_id, openid, message) VALUES (?, ?, ?, ?)""", json.load(sys.stdin))
`, monitor, JSON.stringify([
        [START, '01', accountA, message(1)],
        [START, '02', accountA, message(1)],
        [nextDay, '03', accountA, message(2)],
        [nextDay, '04', accountB, message(3)],
        [nextDay, '05', null, message(4)],
        [nextDay, '06', accountB, message(1)],
        [unknownDay, '07', '   ', message(5)],
        [unknownDay, '08', accountA, message(6)],
        [unknownDay, '09', accountB, message(6)],
        [unknownDay, '10', accountA, '[EVENT] {']
    ]));
    const sourceBefore = fs.readFileSync(monitor);
    const initial = run(projection);
    assert.equal(initial.status, 0, initial.stderr);
    assert.equal(JSON.parse(initial.stdout).identityCoverage.status, 'unavailable');
    const unkeyed = run(monitor, '--monitor-sqlite');
    assert.equal(unkeyed.status, 2);
    assert.match(unkeyed.stderr, /GROWTH_IDENTITY_KEY/);

    env.GROWTH_IDENTITY_KEY = key;
    const first = run(monitor, '--monitor-sqlite');
    assert.equal(first.status, 0, first.stderr);
    const report = JSON.parse(first.stdout);
    assert.equal(report.import.inserted, 5);
    assert.equal(report.import.duplicates, 4);
    assert.equal(report.import.badLines, 1);
    const { byDate, ...overall } = report.identityCoverage;
    assert.deepEqual(overall, {
        eventCount: 6, withDigest: 3, withoutDigest: 3, ratio: 0.5, status: 'partial'
    });
    assert.deepEqual(byDate[START], {
        eventCount: 1, withDigest: 1, withoutDigest: 0, ratio: 1, status: 'complete'
    });
    assert.deepEqual(byDate[nextDay], {
        eventCount: 3, withDigest: 2, withoutDigest: 1, ratio: 2 / 3, status: 'partial'
    });
    assert.deepEqual(byDate[unknownDay], {
        eventCount: 2, withDigest: 0, withoutDigest: 2, ratio: 0, status: 'unavailable'
    });
    assert.deepEqual(byDate[END], {
        eventCount: 0, withDigest: 0, withoutDigest: 0, ratio: null, status: 'unavailable'
    });
    const replay = run(monitor, '--monitor-sqlite');
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).import.inserted, 0);
    assert.deepEqual(JSON.parse(replay.stdout).identityCoverage, report.identityCoverage);

    const output = JSON.parse(python(`
import json, sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    print(json.dumps(dict(db.execute("SELECT event_key, hex(subject_digest) FROM event_identities"))))
`, database));
    const subject = (id) => output[createHash('sha256')
        .update(JSON.stringify(event(id).eventId)).digest('hex')];
    const expected = createHmac('sha256', Buffer.from(key, 'hex'))
        .update('growth-log-identity-v1\0').update(accountA).digest('hex');
    assert.equal(subject(1), expected.toUpperCase());
    assert.equal(subject(1), subject(2));
    assert.notEqual(subject(1), subject(3));
    assert.equal(subject(4), undefined);
    assert.equal(subject(6), '');
    assert.equal(fs.statSync(database).mode & 0o777, 0o600);
    for (const privateValue of [accountA, accountB, key, 'untrusted-', subject(1)]) {
        assert.ok(!first.stdout.toUpperCase().includes(privateValue.toUpperCase()));
        assert.ok(!fs.readFileSync(database).includes(privateValue));
    }
    assert.ok(!fs.readFileSync(database).includes(Buffer.from(key, 'hex')));
    assert.deepEqual(fs.readFileSync(monitor), sourceBefore);

    env.GROWTH_IDENTITY_KEY = randomBytes(32).toString('hex');
    const wrongKey = run(monitor, '--monitor-sqlite');
    assert.equal(wrongKey.status, 2);
    assert.match(wrongKey.stderr, /密钥与该 SQLite 库不匹配/);
    assert.equal(wrongKey.stdout, '');
    env.GROWTH_IDENTITY_KEY = key;
    fs.chmodSync(database, 0o644);
    const publicOutput = run(monitor, '--monitor-sqlite');
    assert.equal(publicOutput.status, 2);
    assert.match(publicOutput.stderr, /仅当前用户可访问/);
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
