const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '../pages/checklist/checklist.js');
const logsPath = path.resolve(__dirname, '../utils/logs/logs.js');

function loadChecklistPage(initialStorage) {
  delete require.cache[pagePath];
  delete require.cache[logsPath];

  let pageConfig;
  const storage = Object.assign({}, initialStorage);
  const toastCalls = [];

  global.wx = {
    getRealtimeLogManager: () => null,
    getWindowInfo: () => ({ statusBarHeight: 20 }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => {
      storage[key] = value;
    },
    removeStorageSync: (key) => {
      delete storage[key];
    },
    showToast: (options) => {
      toastCalls.push(options);
    },
    showModal: () => {}
  };
  global.Page = (config) => {
    pageConfig = config;
  };

  require(pagePath);

  return Object.assign({}, pageConfig, {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(patch, callback) {
      Object.keys(patch).forEach((key) => {
        this.data[key] = patch[key];
      });
      if (callback) {
        callback();
      }
    },
    _storage: storage,
    _toastCalls: toastCalls
  });
}

test('checklist page falls back to defaults when stored data is null', () => {
  const page = loadChecklistPage({
    plannedEventChecklist: null
  });

  page.onLoad();

  assert.equal(page.data.eventName, '');
  assert.equal(page.data.eventDate, '');
  assert.ok(Array.isArray(page.data.checklist));
  assert.ok(page.data.checklist.length > 0);
  assert.deepEqual(page.data.categoryNames, page.data.checklist.map((group) => group.type));
  assert.equal(page.data.selectedCategoryIndex, 0);
  assert.equal(page.data.selectedCategoryName, page.data.categoryNames[0]);
});

test('checklist page normalizes invalid groups and item arrays from storage', () => {
  const page = loadChecklistPage({
    plannedEventChecklist: {
      eventName: 'Sunset',
      eventDate: '2026-06-01',
      checklist: [
        null,
        {
          type: '自定义',
          items: null
        },
        {
          type: '有效分类',
          items: [
            null,
            { text: '  带三脚架  ', checked: 1 },
            { text: '   ', checked: true }
          ]
        }
      ]
    }
  });

  page.onLoad();

  assert.equal(page.data.eventName, 'Sunset');
  assert.equal(page.data.eventDate, '2026-06-01');
  assert.deepEqual(page.data.checklist[0].items, []);
  assert.deepEqual(page.data.checklist[1], {
    type: '自定义',
    items: [],
    isEmpty: true
  });
  assert.deepEqual(page.data.checklist[2], {
    type: '有效分类',
    items: [
      {
        text: '带三脚架',
        checked: true
      }
    ],
    isEmpty: false
  });
});
