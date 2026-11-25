const assert = require('node:assert/strict');
const test = require('node:test');
const appConfig = require('../app.json');

const INDEX = 'pages/index/index';
const CHECKLIST = 'pages/checklist/checklist';
const INSTRUCTIONS = 'pages/instructions/instructions';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FIRST_SOURCE_KEY = 'growthFirstSource';
const TUTORIAL = { channel: 'tutorial', campaign: 'sunset' };
const PHOTO_CLUB = { channel: 'photo_club', campaign: 'sunset_walk' };
const UNKNOWN = { channel: 'unknown' };

// miniapp-minitor 通过固定前缀取出 JSON，不要求新字段。
function parseMonitorEvent(message) {
  const prefix = '[EVENT] ';
  return message.startsWith(prefix) ? JSON.parse(message.slice(prefix.length)) : null;
}

function launchApp(t, { envVersion, onLog, storage = new Map() } = {}) {
  const events = [];
  const messages = [];
  let app;
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(console, 'info', () => {});
  t.after(() => {
    for (const key of ['App', 'Page', 'getApp', 'wx']) delete globalThis[key];
  });
  globalThis.App = (definition) => { app = definition; };
  globalThis.getApp = () => app;
  globalThis.wx = {
    getRealtimeLogManager: () => ({
      info(...args) {
        const event = parseMonitorEvent(args.join(' '));
        if (!event) return;
        assert.equal(args.length, 1);
        if (onLog) onLog();
        messages.push(args[0]);
        events.push(event);
      }
    }),
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    getWindowInfo: () => ({ statusBarHeight: 18 }),
    showToast() {},
    login() {}
  };
  if (envVersion !== undefined) {
    wx.getAccountInfoSync = () => ({ miniProgram: { envVersion } });
  }

  delete require.cache[require.resolve('../utils/logs/logs')];
  delete require.cache[require.resolve('../utils/events')];
  delete require.cache[require.resolve('../app')];
  require('../app');

  function loadPage(route) {
    let page;
    globalThis.Page = (definition) => {
      page = {
        ...definition,
        data: JSON.parse(JSON.stringify(definition.data)),
        setData(patch) { Object.assign(this.data, patch); }
      };
    };
    const file = `../${route}`;
    delete require.cache[require.resolve(file)];
    require(file);
    page.onLoad();
    if (page.onReady) page.onReady();
    return page;
  }

  return {
    app, events, messages, storage, loadPage,
    entries: () => events.filter(({ event }) => event === 'entry_open'),
    advance: (ms) => { now += ms; }
  };
}

test('cold launch and first foreground emit one entry and pages use the App session', (t) => {
  const { app, events, entries, loadPage } = launchApp(t);
  app.onLaunch({ path: `/${INDEX}`, scene: '1001' });
  app.onShow({ path: INDEX, scene: 1001 });
  assert.equal(entries().length, 1);
  const [entry] = entries();
  assert.deepEqual(entry.payload, {
    entryId: app.globalData.entry.entryId,
    reason: 'cold_start',
    path: INDEX,
    platformScene: 1001,
    firstSource: UNKNOWN,
    currentSource: UNKNOWN
  });

  const index = loadPage(INDEX);
  assert.equal(events.length, 1);
  index.onShow();
  loadPage(CHECKLIST).onShow();
  loadPage(INSTRUCTIONS).onShow();
  index.onShow();
  assert.equal(entries().length, 1);
  const views = events.filter(({ event }) => event === 'page_view');
  assert.deepEqual(views.map(({ page }) => page), ['index', 'checklist', 'instructions', 'index']);
  assert.ok(views.every((view) => view.sessionId === entry.sessionId && view.entryId === entry.payload.entryId));
  assert.ok(views.every((view) => view.pageInstanceId));
  assert.equal(new Set(views.map(({ pageInstanceId }) => pageInstanceId)).size, 3);
  assert.equal(views[0].pageInstanceId, views[3].pageInstanceId);
});

test('new hot entry rotates the session of an existing calculator and deduplicates repeats', (t) => {
  const { app, events, entries, loadPage, storage } = launchApp(t);
  app.onLaunch();
  app.onShow();
  const page = loadPage(INDEX);
  page.onShow();
  const view = events.at(-1);

  app.onHide();
  app.onShow({ path: CHECKLIST, scene: 1089 });
  assert.equal(entries().length, 1);

  app.onHide();
  app.onShow({ path: INDEX, scene: 1007, query: {
    shareBatch: 'demo-batch', channel: 'demo', campaign: 'x'.repeat(65), planId: [], ignored: 'private-value'
  }, shareTicket: 'test-ticket' });
  assert.deepEqual(app.globalData.entry.params, { shareBatch: 'demo-batch' });
  const warm = entries().at(-1);
  assert.equal(warm.payload.reason, 'external_entry');
  assert.notEqual(warm.sessionId, view.sessionId);
  assert.notEqual(warm.payload.entryId, view.entryId);
  page.onShow();
  assert.equal(events.at(-1).event, 'page_view');
  assert.equal(events.at(-1).sessionId, warm.sessionId);
  assert.equal(events.at(-1).pageInstanceId, view.pageInstanceId);

  const sameEntry = { path: `/${INDEX}`, scene: '1007', query: { shareBatch: 'demo-batch', channel: 'demo' } };
  app.onShow(sameEntry);
  app.onHide();
  app.onShow(sameEntry);
  assert.equal(entries().length, 2);

  page.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  const calculation = events.at(-1);
  assert.equal(calculation.event, 'calculate_success');
  assert.equal(calculation.sessionId, warm.sessionId);
  assert.equal(calculation.entryId, warm.payload.entryId);
  assert.equal(calculation.pageInstanceId, view.pageInstanceId);
  assert.doesNotMatch(JSON.stringify(events), /demo-batch|private-value|test-ticket/);
  assert.deepEqual([...storage.keys()].sort(), ['calculationHistory', FIRST_SOURCE_KEY, 'logs']);

  app.onHide();
  app.onShow({ ...sameEntry, query: { ...sameEntry.query, shareBatch: 'another-batch' } });
  assert.equal(entries().length, 3);
  assert.notEqual(entries().at(-1).sessionId, warm.sessionId);

  app.onHide();
  app.onShow({ scene: 1005 });
  assert.equal(entries().length, 4);
  assert.equal(entries().at(-1).payload.platformScene, 1005);
  assert.equal(entries().at(-1).payload.path, null);
});

test('registered pages and calculator actions emit unique versioned events within the UTF-8 budget', async (t) => {
  const { app, events, messages, loadPage } = launchApp(t, { envVersion: 'trial' });
  const { MAX_EVENT_BYTES } = require('../utils/events');
  app.onLaunch({ path: INDEX, scene: 1001 });
  app.onShow();
  const pages = appConfig.pages.map((path) => {
    const page = loadPage(path);
    page.onShow();
    return page;
  });
  const [index] = pages;
  index.onShow();
  index.calculate();
  index.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  index.generateShareImage = () => Promise.reject(new Error('模拟错误文本'.repeat(2000)));
  await index.openShareImageActions();

  assert.deepEqual(events.map(({ event }) => event), [
    'entry_open', 'page_view', 'page_view', 'page_view', 'page_view',
    'calculate_failed', 'calculate_success', 'share_image_failed'
  ]);
  assert.equal(new Set(events.map(({ eventId }) => eventId)).size, events.length);
  for (const event of events) {
    assert.match(event.eventId, /^evt_/);
    assert.equal(event.eventVersion, 1);
    assert.equal(event.ts, 0);
    assert.equal(event.appVersion, '1.2.0');
    assert.equal(event.environment, 'trial');
    assert.equal(event.sessionId, app.globalData.sessionId);
    assert.equal(event.entryId, app.globalData.entry.entryId);
  }
  assert.deepEqual(events[5].payload, {
    source: 'manual', providedFields: [], reason: 'insufficient_parameters'
  });
  assert.deepEqual(events[6].payload, {
    source: 'preset', sceneKey: 'sunset', presetIndex: 1,
    providedFields: ['duration', 'finalDuration'], calculatedFields: ['interval', 'totalFrames'],
    riskWarningCount: 0, riskWarningTypes: []
  });
  assert.deepEqual(events[7].payload, { stage: 'generate' });

  index.track('calculate_conflict_resolution', {
    source: 'manual', action: 'accept', reason: 'total_frames_final_duration_conflict',
    providedFields: ['duration', 'totalFrames', 'finalDuration', 'interval', ...Array(1000).fill('totalFrames')],
    basisFields: ['duration', 'finalDuration', '模拟自由文本'.repeat(1000)],
    suggestion: '模拟自由文本'.repeat(1000),
    entryId: 'mock-injected-entry-id'
  });
  index.track('mock_unknown_event', { source: 'manual' });
  assert.equal(events.length, 9);
  assert.deepEqual(events[8].payload, {
    source: 'manual', action: 'accept', reason: 'total_frames_final_duration_conflict',
    providedFields: ['duration', 'finalDuration', 'interval', 'totalFrames'],
    basisFields: ['duration', 'finalDuration']
  });
  assert.ok(messages.every((message) => Buffer.byteLength(message, 'utf8') <= MAX_EVENT_BYTES));
  assert.doesNotMatch(messages.join('\n'), /模拟|mock-injected-entry-id/);
});

test('the monitor reads legacy and versioned event lines through the same prefix and fields', (t) => {
  const { app, events, messages, loadPage } = launchApp(t);
  app.onLaunch();
  const index = loadPage(INDEX);
  index.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  const legacy = '[EVENT] {"event":"calculate_success","ts":0,"page":"index","appVersion":"1.2.0","sessionId":"mock-legacy","payload":{"source":"preset","presetName":"日落","riskWarningTypes":[]}}';
  const [oldEvent, newEvent] = [legacy, messages.at(-1)].map(parseMonitorEvent);
  assert.equal(oldEvent.eventVersion, undefined);
  assert.equal(oldEvent.payload.presetName, '日落');
  assert.equal(newEvent.eventVersion, 1);
  for (const field of ['event', 'ts', 'page', 'appVersion']) assert.equal(newEvent[field], oldEvent[field]);
  for (const field of ['source', 'riskWarningTypes']) assert.deepEqual(newEvent.payload[field], oldEvent.payload[field]);
  assert.equal(events[0].environment, 'unknown');
});

test('a realtime logger error does not interrupt the calculator or prevent later logging', (t) => {
  let unavailable = true;
  const { app, events, loadPage } = launchApp(t, {
    onLog() { if (unavailable) throw new Error('logger unavailable'); }
  });
  app.onLaunch();
  const index = loadPage(INDEX);
  index.onShow();
  index.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(index.data.lastResult.totalFrames, 375);
  assert.equal(events.length, 0);
  unavailable = false;
  index.onShow();
  assert.equal(events[0].event, 'page_view');
  assert.equal(events[0].sessionId, app.globalData.sessionId);
});

test('ordinary return starts a fresh session at 30 minutes of background time', (t) => {
  const { app, entries, advance } = launchApp(t);
  const options = { path: INDEX, scene: 1007, query: { shareBatch: 'demo-batch' } };
  app.onLaunch(options);
  app.onShow(options);
  advance(SESSION_TIMEOUT_MS);

  app.onHide();
  advance(SESSION_TIMEOUT_MS - 1);
  app.onShow(options);
  assert.equal(entries().length, 1);

  app.onHide();
  advance(SESSION_TIMEOUT_MS - 1);
  app.onHide();
  advance(1);
  app.onShow(options);
  app.onShow(options);
  assert.equal(entries().length, 2);
  const [cold, resumed] = entries();
  assert.equal(resumed.payload.reason, 'background_timeout');
  assert.notEqual(resumed.sessionId, cold.sessionId);
  assert.notEqual(resumed.payload.entryId, cold.payload.entryId);
  assert.deepEqual(app.globalData.entry.params, {});
});

test('two channel paths keep first source across hot entries, natural returns and cold restarts', (t) => {
  const { app, entries, events, storage, advance, loadPage } = launchApp(t, { envVersion: 'develop' });
  const tutorial = { path: INDEX, scene: 1007, query: TUTORIAL };
  const club = { path: INDEX, scene: 1007, query: PHOTO_CLUB };
  app.onLaunch(tutorial);
  app.onShow(tutorial);
  assert.equal(entries().length, 1);
  assert.deepEqual(entries()[0].payload.firstSource, TUTORIAL);
  assert.deepEqual(entries()[0].payload.currentSource, TUTORIAL);
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), TUTORIAL);

  const page = loadPage(INDEX);
  app.onHide();
  app.onShow(club);
  page.onShow();
  page.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(entries().length, 2);
  const hot = entries().at(-1);
  assert.equal(hot.payload.reason, 'external_entry');
  assert.deepEqual(hot.payload.firstSource, TUTORIAL);
  assert.deepEqual(hot.payload.currentSource, PHOTO_CLUB);
  assert.equal(events.at(-1).event, 'calculate_success');
  assert.equal(events.at(-1).entryId, hot.entryId);

  app.onHide();
  app.onShow(club);
  app.onHide();
  app.onShow({ scene: 1089 });
  assert.equal(entries().length, 2);
  app.onHide();
  advance(SESSION_TIMEOUT_MS);
  app.onShow({ scene: 1089 });
  assert.equal(entries().at(-1).payload.reason, 'background_timeout');
  assert.deepEqual(entries().at(-1).payload.firstSource, TUTORIAL);
  assert.deepEqual(entries().at(-1).payload.currentSource, UNKNOWN);

  app.onLaunch({ path: INDEX, scene: 1001 });
  assert.equal(entries().at(-1).payload.reason, 'cold_start');
  assert.deepEqual(entries().at(-1).payload.firstSource, TUTORIAL);
  assert.deepEqual(entries().at(-1).payload.currentSource, UNKNOWN);
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), TUTORIAL);
});

test('bad channel parameters are unknown and an unknown first source stays recorded', (t) => {
  const { app, entries, messages, storage } = launchApp(t);
  const badQueries = [
    { channel: 'unregistered_channel', campaign: 'sunset' },
    { channel: 'tutorial', campaign: 'sunset_walk' },
    { channel: 'tutorial', campaign: 'x'.repeat(65) },
    { channel: 'tutorial', campaign: ['sunset'] },
    { channel: 'tutorial', campaign: '' },
    { channel: 'tutorial', campaign: '测试' },
    { campaign: 'sunset' },
    Object.create(TUTORIAL)
  ];
  storage.set(FIRST_SOURCE_KEY, { channel: 'tutorial', campaign: 'invalid_saved_campaign' });
  for (const query of badQueries) {
    app.onLaunch({ path: INDEX, scene: 1007, query });
    assert.deepEqual(entries().at(-1).payload.currentSource, UNKNOWN);
    assert.deepEqual(entries().at(-1).payload.firstSource, UNKNOWN);
  }
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), UNKNOWN);
  assert.doesNotMatch(messages.join('\n'), /unregistered_channel|invalid_saved_campaign|sunset_walk|测试/);

  app.onShow();
  app.onHide();
  app.onShow({ path: INDEX, scene: 1089, query: badQueries[0] });
  assert.equal(entries().length, badQueries.length);

  app.onHide();
  app.onShow({ path: INDEX, scene: 1007, query: PHOTO_CLUB });
  assert.deepEqual(entries().at(-1).payload.firstSource, UNKNOWN);
  assert.deepEqual(entries().at(-1).payload.currentSource, PHOTO_CLUB);
});

test('a source write failure preserves the earliest source in memory and retries on a new entry', (t) => {
  const { app, entries, storage, loadPage } = launchApp(t);
  const write = wx.setStorageSync;
  wx.setStorageSync = (key, value) => {
    if (key === FIRST_SOURCE_KEY) throw new Error('storage full');
    write(key, value);
  };
  app.onLaunch({ path: INDEX, scene: 1007, query: TUTORIAL });
  assert.deepEqual(entries()[0].payload.firstSource, TUTORIAL);
  assert.equal(storage.has(FIRST_SOURCE_KEY), false);
  const page = loadPage(INDEX);
  page.applyPreset({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(page.data.lastResult.totalFrames, 375);

  wx.setStorageSync = write;
  app.onShow();
  app.onHide();
  app.onShow({ path: INDEX, scene: 1007, query: PHOTO_CLUB });
  assert.deepEqual(entries().at(-1).payload.firstSource, TUTORIAL);
  assert.deepEqual(entries().at(-1).payload.currentSource, PHOTO_CLUB);
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), TUTORIAL);
});

test('a source read failure reports an unknown first source without overwriting storage', (t) => {
  const storage = new Map([[FIRST_SOURCE_KEY, PHOTO_CLUB]]);
  const { app, entries } = launchApp(t, { storage });
  const read = wx.getStorageSync;
  wx.getStorageSync = () => { throw new Error('storage unavailable'); };
  app.onLaunch({ path: INDEX, scene: 1007, query: TUTORIAL });
  assert.deepEqual(entries()[0].payload.firstSource, UNKNOWN);
  assert.deepEqual(entries()[0].payload.currentSource, TUTORIAL);
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), PHOTO_CLUB);

  wx.getStorageSync = read;
  app.onShow();
  app.onHide();
  app.onShow({ path: INDEX, scene: 1007, query: { channel: 'tutorial' } });
  assert.deepEqual(entries().at(-1).payload.firstSource, PHOTO_CLUB);
  assert.deepEqual(entries().at(-1).payload.currentSource, { channel: 'tutorial' });
  assert.deepEqual(storage.get(FIRST_SOURCE_KEY), PHOTO_CLUB);
});
