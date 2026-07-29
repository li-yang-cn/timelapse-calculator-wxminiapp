const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '../pages/index/index.js');
const logsPath = path.resolve(__dirname, '../utils/logs/logs.js');

function loadIndexPage() {
  delete require.cache[pagePath];
  delete require.cache[logsPath];

  let pageConfig;
  const storage = {};
  const toastCalls = [];

  global.wx = {
    getRealtimeLogManager: () => null,
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
    showModal: () => {},
    setClipboardData: () => {}
  };
  global.Page = (config) => {
    pageConfig = config;
  };

  require(pagePath);

  const page = Object.assign({}, pageConfig, {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(patch) {
      Object.keys(patch).forEach((key) => {
        const pathParts = key.split('.');
        let target = this.data;
        for (let index = 0; index < pathParts.length - 1; index += 1) {
          const part = pathParts[index];
          target[part] = target[part] || {};
          target = target[part];
        }
        target[pathParts[pathParts.length - 1]] = patch[key];
      });
    },
    _toastCalls: toastCalls,
    _storage: storage
  });

  return page;
}

test('resolveCalculation calculates interval and total frames from duration and final duration', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: 10,
    frameRate: 25,
    interval: null,
    totalFrames: null
  });

  assert.deepEqual(result, {
    isValid: true,
    values: {
      duration: 10,
      finalDuration: 10,
      frameRate: 25,
      interval: 2.4,
      totalFrames: 250
    }
  });
});

test('resolveCalculation calculates final duration and total frames from duration and interval', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: null,
    frameRate: 25,
    interval: 2,
    totalFrames: null
  });

  assert.deepEqual(result, {
    isValid: true,
    values: {
      duration: 10,
      finalDuration: 12,
      frameRate: 25,
      interval: 2,
      totalFrames: 300
    }
  });
});

test('resolveCalculation calculates duration when interval and final duration are provided', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: null,
    finalDuration: 10,
    frameRate: 25,
    interval: 2,
    totalFrames: null
  });

  assert.deepEqual(result, {
    isValid: true,
    values: {
      duration: 8.33,
      finalDuration: 10,
      frameRate: 25,
      interval: 2,
      totalFrames: 250
    }
  });
});

test('resolveCalculation uses provided total frames to calculate final duration', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 12,
    finalDuration: null,
    frameRate: 24,
    interval: null,
    totalFrames: 144
  });

  assert.deepEqual(result, {
    isValid: true,
    values: {
      duration: 12,
      finalDuration: 6,
      frameRate: 24,
      interval: 5,
      totalFrames: 144
    }
  });
});

test('resolveCalculation rejects total frames that conflict with final duration', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: null,
    finalDuration: 10,
    frameRate: 25,
    interval: null,
    totalFrames: 200
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'total_frames_final_duration_conflict',
    message: '按成片时长应为250张'
  });
});

test('resolveCalculation accepts a one-frame rounding difference', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: null,
    frameRate: 25,
    interval: 2,
    totalFrames: 301
  });

  assert.deepEqual(result, {
    isValid: true,
    values: {
      duration: 10,
      finalDuration: 12.04,
      frameRate: 25,
      interval: 2,
      totalFrames: 301
    }
  });
});

test('resolveCalculation rejects capture frame differences greater than rounding tolerance', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: null,
    frameRate: 25,
    interval: 2,
    totalFrames: 302
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'total_frames_capture_conflict',
    message: '按拍摄参数应为300张'
  });
});

test('resolveCalculation rejects final duration that conflicts with capture settings', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: 10,
    frameRate: 25,
    interval: 2,
    totalFrames: null
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'final_duration_capture_conflict',
    message: '按拍摄参数成片约12秒'
  });
});

test('resolveCalculation rejects missing total frame inputs', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: null,
    frameRate: 25,
    interval: null,
    totalFrames: null
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'insufficient_total_frames',
    message: '参数不足，无法计算总张数'
  });
});

test('resolveCalculation rejects non-positive resolved total frames', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: 10,
    finalDuration: null,
    frameRate: 25,
    interval: null,
    totalFrames: 0
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'insufficient_total_frames',
    message: '参数不足，无法计算总张数'
  });
});

test('resolveCalculation rejects final duration and total frames without capture duration or interval', () => {
  const page = loadIndexPage();

  const result = page.resolveCalculation({
    duration: null,
    finalDuration: 10,
    frameRate: 25,
    interval: null,
    totalFrames: 250
  });

  assert.deepEqual(result, {
    isValid: false,
    code: 'missing_capture_parameter',
    message: '还需输入拍摄时长或间隔'
  });
});

test('getParsedInputs validates frame rate before calculation', () => {
  const page = loadIndexPage();
  page.data.frameRate = 0;
  page.data.duration = '10';
  page.data.finalDuration = '10';

  assert.deepEqual(page.getParsedInputs(), {
    isValid: false,
    code: 'invalid_frame_rate',
    message: '请选择有效帧速率'
  });
});

test('getParsedInputs rejects non-positive numeric fields', () => {
  const page = loadIndexPage();
  page.data.duration = '-1';
  page.data.finalDuration = '10';

  assert.deepEqual(page.getParsedInputs(), {
    isValid: false,
    code: 'invalid_value',
    message: '拍摄时长必须大于0'
  });
});

test('getParsedInputs rejects decimal total frames', () => {
  const page = loadIndexPage();
  page.data.duration = '10';
  page.data.totalFrames = '100.5';

  assert.deepEqual(page.getParsedInputs(), {
    isValid: false,
    code: 'invalid_total_frames',
    message: '总张数必须是整数'
  });
});

test('calculate stores formatted results and marks calculated fields for manual input', () => {
  const page = loadIndexPage();
  page.data.duration = '10';
  page.data.finalDuration = '10';
  page.data.frameRate = 25;

  page.calculate();

  assert.equal(page.data.duration, '10.00');
  assert.equal(page.data.finalDuration, '10.00');
  assert.equal(page.data.interval, '2.40');
  assert.equal(page.data.totalFrames, 250);
  assert.equal(page.data.isCalculated, true);
  assert.equal(page.data.showResetButton, true);
  assert.deepEqual(page.data.calculatedFields, {
    duration: false,
    finalDuration: false,
    interval: true,
    totalFrames: true
  });
  assert.equal(page.data.history.length, 1);
  assert.deepEqual(page.data.history[0].calculatedFields, page.data.calculatedFields);
});

test('preset calculation emits one consolidated success event', () => {
  const page = loadIndexPage();
  const events = [];
  page.track = (event, payload) => {
    events.push({ event, payload });
  };

  page.applyPreset({
    currentTarget: {
      dataset: {
        index: 2
      }
    }
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'calculate_success');
  assert.equal(events[0].payload.source, 'preset');
  assert.equal(events[0].payload.presetName, '星空');
  assert.deepEqual(events[0].payload.riskWarningTypes, ['long_duration']);
});

test('calculate reports resolveCalculation conflicts from valid parsed inputs', () => {
  const page = loadIndexPage();
  page.data.duration = '10';
  page.data.finalDuration = '10';
  page.data.interval = '2';

  page.calculate();

  assert.equal(page.data.isCalculated, false);
  assert.equal(page.data.showResetButton, true);
  assert.deepEqual(page._toastCalls.at(-1), {
    title: '按拍摄参数成片约12秒',
    icon: 'none'
  });
});

test('calculate shows a reset affordance when validation fails after partial input', () => {
  const page = loadIndexPage();
  page.data.duration = '10';

  page.calculate();

  assert.equal(page.data.showResetButton, true);
  assert.deepEqual(page._toastCalls.at(-1), {
    title: '至少输入两个参数',
    icon: 'none'
  });
});
