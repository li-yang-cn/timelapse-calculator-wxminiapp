import argparse
from collections import Counter
from contextlib import closing, contextmanager
from datetime import date, timedelta
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import stat


EVENT_PREFIX = '[EVENT] '
EVENT_NAME = re.compile(r'[a-z][a-z0-9_]{0,63}')
EVENT_ID = re.compile(r'evt_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+')
APP_VERSION = re.compile(r'[0-9]{1,8}(?:\.[0-9]{1,8}){2}')
ENVIRONMENTS = ('develop', 'trial', 'release', 'unknown')
LEGACY_FIELDS = ('timestamp', 'level', 'url', 'traceid', 'event', 'sessionId',
                 'page', 'appVersion', 'payload')


def parse_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', value):
        raise ValueError('日期须为 YYYY-MM-DD')
    return date.fromisoformat(value)


def parse_json(line):
    def reject_constant(_):
        raise ValueError('无效 JSON 数值')

    value = json.loads(line.decode('utf-8') if isinstance(line, bytes) else line,
                       parse_constant=reject_constant)
    if not isinstance(value, dict):
        raise ValueError('JSON 须为对象')
    return value


def event_from_row(row):
    if 'message' not in row:
        return row
    message = row['message']
    if not isinstance(message, str):
        raise ValueError('无效日志消息')
    if message.startswith(EVENT_PREFIX):
        return parse_json(message[len(EVENT_PREFIX):])
    if row.get('marker') == 'EVENT' or message.startswith('[EVENT]'):
        raise ValueError('无效事件消息')
    return None


def digest(key):
    canonical = json.dumps(key, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('ascii')).hexdigest()


def event_key(row, event, event_date, version):
    if version == 1:
        event_id = event.get('eventId')
        if not isinstance(event_id, str) or len(event_id) > 48 or not EVENT_ID.fullmatch(event_id):
            raise ValueError('无效新版事件 ID')
        return digest(event_id)
    if 'eventId' in event:
        raise ValueError('事件 ID 缺少版本')
    # Match the old warehouse projection so both exports share the same legacy key.
    projection = {field: row.get(field) for field in LEGACY_FIELDS[:4]}
    projection.update({field: event.get(field) for field in LEGACY_FIELDS[4:]})
    return digest([event_date, projection])


def read_rows(path, counts):
    with path.open('rb') as source:
        for line in source:
            if not line.strip():
                continue
            try:
                yield parse_json(line)
            except (ValueError, RecursionError):
                counts['badLines'] += 1


@contextmanager
def event_rows(path, counts, start, end, monitor_sqlite):
    if not monitor_sqlite:
        yield read_rows(path, counts)
        return
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as source:
        source.row_factory = sqlite3.Row
        rows = source.execute('''SELECT report_date, timestamp, level, url, traceid,
            marker, message, openid FROM realtime_log_messages
            WHERE report_date BETWEEN ? AND ? ORDER BY report_date, message_id''',
                              (start.isoformat(), end.isoformat()))
        yield map(dict, rows)


def identity_digest(key, value):
    if (not isinstance(value, str) or not 1 <= len(value) <= 256 or
            any(not ('!' <= char <= '~') for char in value)):
        return None
    return hmac.digest(key, b'growth-log-identity-v1\0' + value.encode('ascii'), 'sha256')


def save_identity(db, version, key, day, subject):
    # D05 keeps the first event date. A replay on another date cannot change its identity.
    db.execute('''INSERT INTO event_identities (event_version, event_key, subject_digest)
        SELECT event_version, event_key, ? FROM events
        WHERE event_version = ? AND event_key = ? AND report_date = ?
        ON CONFLICT(event_version, event_key) DO UPDATE SET subject_digest = NULL
        WHERE event_identities.subject_digest IS NOT excluded.subject_digest''',
               (subject, version, key, day))


def import_events(db, rows, counts, start, end, identity_key):
    unsupported = Counter()
    for row in rows:
        try:
            event_date = parse_date(row.get('report_date'))
            if not start <= event_date <= end:
                counts['outsideWindow'] += 1
                continue
            event = event_from_row(row)
            if event is None:
                counts['otherLogs'] += 1
                continue
            name = event.get('event')
            version = event.get('eventVersion', 0)
            if (not isinstance(name, str) or not EVENT_NAME.fullmatch(name) or
                    type(version) is not int or version < 0 or
                    (version == 0 and 'eventVersion' in event)):
                raise ValueError('无效事件标头')
            if version > 1:
                unsupported[str(version)] += 1
                continue
            day = event_date.isoformat()
            key = event_key(row, event, day, version)
        except (ValueError, RecursionError):
            counts['badLines'] += 1
            continue

        app_version = event.get('appVersion')
        if not isinstance(app_version, str) or not APP_VERSION.fullmatch(app_version):
            app_version = None
        environment = event.get('environment')
        if environment not in ENVIRONMENTS or version == 0:
            environment = None
        cursor = db.execute('''INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)
                               ON CONFLICT(event_version, event_key) DO NOTHING''',
                            (version, key, day, name, app_version, environment))
        counts['inserted' if cursor.rowcount else 'duplicates'] += 1
        if identity_key is not None:
            subject = identity_digest(identity_key, row.get('openid'))
            if subject is not None:
                save_identity(db, version, key, day, subject)
    return {**counts, 'unsupportedVersions': dict(unsupported)}


def import_runs(db, path, start, end):
    counts = Counter(badLines=0)
    if path is None:
        return counts['badLines']
    for row in read_rows(path, counts):
        try:
            day = parse_date(row.get('report_date'))
            total = row['realtime_log_total']
            if total is not None and (type(total) is not int or total < 0):
                raise ValueError('无效日志计数')
        except (KeyError, ValueError):
            counts['badLines'] += 1
            continue
        # Missing collection data cannot erase a known successful run.
        if start <= day <= end and total is not None:
            db.execute('''INSERT INTO collection_days VALUES (?, ?)
                          ON CONFLICT(report_date) DO UPDATE SET has_logs = excluded.has_logs''',
                       (day.isoformat(), int(total > 0)))
    return counts['badLines']


def build_report(db, start, end):
    bounds = (start.isoformat(), end.isoformat())
    version_counts = {'legacy': 0, '1': 0}
    days_with_events = set()
    totals_by_day = Counter()
    covered_by_day = Counter()
    for day, version, count, covered in db.execute('''SELECT report_date, events.event_version,
            COUNT(*), COUNT(subject_digest) FROM events
            LEFT JOIN event_identities USING (event_version, event_key)
            WHERE report_date BETWEEN ? AND ? GROUP BY report_date, events.event_version''', bounds):
        days_with_events.add(day)
        version_counts['legacy' if version == 0 else str(version)] += count
        totals_by_day[day] += count
        covered_by_day[day] += covered
    collection = dict(db.execute('SELECT * FROM collection_days WHERE report_date BETWEEN ? AND ?', bounds))
    dates = [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]
    return {
        'startDate': bounds[0], 'endDate': bounds[1], 'timezone': 'Asia/Shanghai',
        'missingDates': [day for day in dates if day not in collection and day not in days_with_events],
        'zeroLogDates': [day for day in dates if collection.get(day) == 0 and day not in days_with_events],
        'eventOnlyDates': sorted(days_with_events.difference(collection)),
        'eventCount': sum(version_counts.values()),
        'eventVersions': version_counts,
        'identityCoverage': {
            **coverage(sum(totals_by_day.values()), sum(covered_by_day.values())),
            'byDate': {day: coverage(totals_by_day[day], covered_by_day[day]) for day in dates},
        },
    }


def coverage(total, covered):
    status = 'unavailable'
    if covered:
        status = 'complete' if covered == total else 'partial'
    return {'eventCount': total, 'withDigest': covered, 'withoutDigest': total - covered,
            'ratio': covered / total if total else None, 'status': status}


def load_identity_key():
    value = os.environ.get('GROWTH_IDENTITY_KEY', '')
    if not re.fullmatch(r'[0-9a-fA-F]{64}', value):
        raise ValueError('身份导入需要通过 GROWTH_IDENTITY_KEY 提供 32 字节十六进制密钥')
    return bytes.fromhex(value)


def init_identity_tables(db, key):
    db.execute('''CREATE TABLE IF NOT EXISTS event_identities (
        event_version INTEGER NOT NULL, event_key TEXT NOT NULL, subject_digest BLOB,
        PRIMARY KEY (event_version, event_key))''')
    if key is None:
        return
    db.execute('''CREATE TABLE IF NOT EXISTS identity_key_check (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1), verifier BLOB NOT NULL)''')
    verifier = hmac.digest(key, b'growth-log-identity-key-check-v1', 'sha256')
    db.execute('INSERT OR IGNORE INTO identity_key_check VALUES (1, ?)', (verifier,))
    stored, = db.execute('SELECT verifier FROM identity_key_check WHERE singleton = 1').fetchone()
    if not hmac.compare_digest(stored, verifier):
        raise ValueError('身份密钥与该 SQLite 库不匹配，请使用原密钥或新的输出库')


def prepare_database(path, identity_key):
    try:
        os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600))
    except FileExistsError:
        if identity_key is not None:
            info = path.stat()
            if (not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or
                    info.st_uid != os.geteuid()):
                raise ValueError('身份输出须为当前用户所有且仅当前用户可访问的 SQLite 文件')


def run(args, start, end):
    db_path = args.database.resolve()
    for source in (args.input, args.runs):
        if source is not None and (source.resolve() == db_path or
                                  (db_path.exists() and source.samefile(db_path))):
            raise ValueError('SQLite 输出与输入文件须使用不同路径')
    identity_key = load_identity_key() if args.monitor_sqlite else None
    prepare_database(db_path, identity_key)
    with closing(sqlite3.connect(db_path)) as db, db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('''CREATE TABLE IF NOT EXISTS events (
            event_version INTEGER NOT NULL, event_key TEXT NOT NULL, report_date TEXT NOT NULL,
            event TEXT NOT NULL, app_version TEXT, environment TEXT,
            PRIMARY KEY (event_version, event_key))''')
        db.execute('CREATE INDEX IF NOT EXISTS events_by_date ON events (report_date, event_version)')
        db.execute('''CREATE TABLE IF NOT EXISTS collection_days (
            report_date TEXT PRIMARY KEY NOT NULL, has_logs INTEGER NOT NULL)''')
        init_identity_tables(db, identity_key)
        counts = Counter(inserted=0, duplicates=0, badLines=0, otherLogs=0, outsideWindow=0)
        with event_rows(args.input, counts, start, end, args.monitor_sqlite) as rows:
            stats = import_events(db, rows, counts, start, end, identity_key)
        stats['badRunLines'] = import_runs(db, args.runs, start, end)
        return {**build_report(db, start, end), 'import': stats}


def main():
    parser = argparse.ArgumentParser(description='导入监控事件并输出日期、版本及身份摘要覆盖。')
    parser.add_argument('input', type=Path, help='监控 JSONL 导出或配合 --monitor-sqlite 使用的监控 SQLite')
    parser.add_argument('database', type=Path, help='独立的输出 SQLite 路径')
    parser.add_argument('start_date', help='起始日期 YYYY-MM-DD，含当日')
    parser.add_argument('end_date', help='结束日期 YYYY-MM-DD，含当日')
    parser.add_argument('--runs', type=Path, help='可选的 runs.jsonl，用于识别已采集的无事件日期')
    parser.add_argument('--monitor-sqlite', action='store_true',
                        help='只读监控 SQLite 消息表，使用服务端 GROWTH_IDENTITY_KEY 生成身份摘要')
    args = parser.parse_args()
    try:
        start, end = parse_date(args.start_date), parse_date(args.end_date)
        if start > end:
            raise ValueError('起始日期须早于或等于结束日期')
        print(json.dumps(run(args, start, end), ensure_ascii=False, indent=2))
    except ValueError as error:
        parser.error(str(error))
    except (OSError, sqlite3.Error):
        parser.exit(1, '读取输入或写入 SQLite 失败，请检查文件和输出路径。\n')


if __name__ == '__main__':
    main()
