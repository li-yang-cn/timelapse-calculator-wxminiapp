const assert = require('node:assert/strict');
const test = require('node:test');

const INDEX = 'pages/index/index';
const CHECKLIST = 'pages/checklist/checklist';
const INSTRUCTIONS = 'pages/instructions/instructions';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function launchApp(t) {
  const events = [];
  const storage = new Map();
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
      info(tag, json) {
        if (tag === '[EVENT]') events.push(JSON.parse(json));
      }
    }),
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    getWindowInfo: () => ({ statusBarHeight: 18 }),
    showToast() {},
    login() {}
  };

  delete require.cache[require.resolve('../utils/logs/logs')];
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
    app, events, storage, loadPage,
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
    platformScene: 1001
  });

  loadPage(INDEX);
  loadPage(CHECKLIST);
  loadPage(INSTRUCTIONS);
  loadPage(INDEX);
  assert.equal(entries().length, 1);
  const views = events.filter(({ event }) => event === 'page_view');
  assert.equal(views.length, 2);
  assert.equal(views[0].sessionId, entry.sessionId);
  assert.equal(views[1].sessionId, entry.sessionId);
  assert.equal(views[1].entryId, entry.payload.entryId);
  assert.ok(views[0].pageInstanceId && views[1].pageInstanceId);
  assert.notEqual(views[0].pageInstanceId, views[1].pageInstanceId);
});

test('new hot entry rotates the session of an existing calculator and deduplicates repeats', (t) => {
  const { app, events, entries, loadPage, storage } = launchApp(t);
  app.onLaunch();
  app.onShow();
  const page = loadPage(INDEX);
  const view = events.at(-1);

  app.onHide();
  app.onShow({ path: CHECKLIST, scene: 1089 });
  assert.equal(entries().length, 1);

  app.onHide();
  app.onShow({ path: INDEX, scene: 1007, query: {
    shareBatch: 'demo-batch', channel: 'demo', campaign: 'x'.repeat(65), planId: [], ignored: 'private-value'
  }, shareTicket: 'test-ticket' });
  assert.deepEqual(app.globalData.entry.params, { channel: 'demo', shareBatch: 'demo-batch' });
  const warm = entries().at(-1);
  assert.equal(warm.payload.reason, 'external_entry');
  assert.notEqual(warm.sessionId, view.sessionId);
  assert.notEqual(warm.payload.entryId, view.entryId);

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
  assert.deepEqual([...storage.keys()].sort(), ['calculationHistory', 'logs']);

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
