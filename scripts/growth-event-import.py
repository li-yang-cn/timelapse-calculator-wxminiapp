import argparse
from collections import Counter
from contextlib import closing
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import re
import sqlite3


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


def import_events(db, path, start, end):
    counts = Counter(inserted=0, duplicates=0, badLines=0, otherLogs=0, outsideWindow=0)
    unsupported = Counter()
    for row in read_rows(path, counts):
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
    for day, version, count in db.execute('''SELECT report_date, event_version, COUNT(*) FROM events
            WHERE report_date BETWEEN ? AND ? GROUP BY report_date, event_version''', bounds):
        days_with_events.add(day)
        version_counts['legacy' if version == 0 else str(version)] += count
    collection = dict(db.execute('SELECT * FROM collection_days WHERE report_date BETWEEN ? AND ?', bounds))
    dates = [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]
    return {
        'startDate': bounds[0], 'endDate': bounds[1], 'timezone': 'Asia/Shanghai',
        'missingDates': [day for day in dates if day not in collection and day not in days_with_events],
        'zeroLogDates': [day for day in dates if collection.get(day) == 0 and day not in days_with_events],
        'eventOnlyDates': sorted(days_with_events.difference(collection)),
        'eventCount': sum(version_counts.values()),
        'eventVersions': version_counts,
    }


def run(args, start, end):
    db_path = args.database.resolve()
    for source in (args.input, args.runs):
        if source is not None and (source.resolve() == db_path or
                                  (db_path.exists() and source.samefile(db_path))):
            raise ValueError('SQLite 输出与输入文件须使用不同路径')
    with closing(sqlite3.connect(db_path)) as db, db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('''CREATE TABLE IF NOT EXISTS events (
            event_version INTEGER NOT NULL, event_key TEXT NOT NULL, report_date TEXT NOT NULL,
            event TEXT NOT NULL, app_version TEXT, environment TEXT,
            PRIMARY KEY (event_version, event_key))''')
        db.execute('CREATE INDEX IF NOT EXISTS events_by_date ON events (report_date, event_version)')
        db.execute('''CREATE TABLE IF NOT EXISTS collection_days (
            report_date TEXT PRIMARY KEY NOT NULL, has_logs INTEGER NOT NULL)''')
        stats = import_events(db, args.input, start, end)
        stats['badRunLines'] = import_runs(db, args.runs, start, end)
        return {**build_report(db, start, end), 'import': stats}


def main():
    parser = argparse.ArgumentParser(description='导入监控 JSONL 事件并输出日期与版本覆盖。')
    parser.add_argument('input', type=Path, help='realtime_events.jsonl 或 realtime_log_messages.jsonl')
    parser.add_argument('database', type=Path, help='独立的输出 SQLite 路径')
    parser.add_argument('start_date', help='起始日期 YYYY-MM-DD，含当日')
    parser.add_argument('end_date', help='结束日期 YYYY-MM-DD，含当日')
    parser.add_argument('--runs', type=Path, help='可选的 runs.jsonl，用于识别已采集的无事件日期')
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
