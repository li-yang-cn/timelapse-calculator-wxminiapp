const log = require('./logs/logs');
const { APP_VERSION } = require('./util');
const { createRuntimeId, PAGE_PATHS } = require('./entry');
const { normalizeSource } = require('./attribution');

const EVENT_VERSION = 1;
const EVENT_PREFIX = '[EVENT] ';
// 本仓库的单条日志预算，包含前缀。
const MAX_EVENT_BYTES = 768;
const PAGES = ['index', 'checklist', 'instructions'];
const ENVIRONMENTS = ['develop', 'trial', 'release'];
const SCENE_KEYS = ['clouds', 'sunset', 'stars', 'traffic', 'crowd', 'plants'];
const CALCULATION_FIELDS = ['duration', 'finalDuration', 'interval', 'totalFrames'];
const RISK_TYPES = ['high_total_frames', 'short_interval', 'long_duration'];

const oneOf = (...values) => (value) => values.includes(value) ? value : undefined;
const enumList = (values) => (value) => Array.isArray(value) ?
    values.filter((item) => value.includes(item)) : undefined;
const integerIn = (min, max) => (value) =>
    Number.isInteger(value) && value >= min && value <= max ? value : undefined;
const boolean = (value) => typeof value === 'boolean' ? value : undefined;
const platformScene = integerIn(1000, 9999);
const runtimeId = (value, prefix) => typeof value === 'string' && value.length <= 48 &&
    value.startsWith(prefix + '_') && /^[a-z]+_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/.test(value);

const calculation = {
    source: oneOf('manual', 'preset'),
    sceneKey: oneOf(...SCENE_KEYS),
    presetIndex: integerIn(0, SCENE_KEYS.length - 1),
    providedFields: enumList(CALCULATION_FIELDS)
};
const failure = {
    ...calculation,
    reason: oneOf(
        'validation_failed', 'invalid_frame_rate', 'invalid_value', 'invalid_total_frames',
        'insufficient_parameters', 'insufficient_total_frames', 'missing_capture_parameter',
        'total_frames_final_duration_conflict', 'total_frames_capture_conflict', 'final_duration_capture_conflict'
    )
};
const conflict = { ...failure, basisFields: enumList(CALCULATION_FIELDS) };
const historyCount = { historyCount: integerIn(0, Number.MAX_SAFE_INTEGER) };
const riskFlag = { hasRiskWarnings: boolean };
const SCHEMAS = new Map(Object.entries({
    entry_open: {
        reason: oneOf('cold_start', 'external_entry', 'background_timeout'),
        path: (value) => value === null || PAGE_PATHS.has(value) ? value : undefined,
        platformScene: (value) => value === null ? null : platformScene(value),
        currentSource: normalizeSource,
        firstSource: normalizeSource
    },
    page_view: {},
    calculate_success: {
        ...calculation,
        calculatedFields: enumList(CALCULATION_FIELDS),
        riskWarningCount: integerIn(0, RISK_TYPES.length),
        riskWarningTypes: enumList(RISK_TYPES)
    },
    calculate_failed: failure,
    calculate_conflict_prompt: conflict,
    calculate_conflict_resolution: { ...conflict, action: oneOf('accept', 'reject') },
    history_clear: historyCount,
    history_expand: historyCount,
    history_collapse: historyCount,
    history_load: { index: integerIn(0, Number.MAX_SAFE_INTEGER) },
    copy_result: { source: oneOf('history', 'current'), ...riskFlag },
    share_image_generated: riskFlag,
    share_image_failed: { stage: oneOf('generate') },
    share_image_action: { action: oneOf('share', 'save', 'preview'), result: oneOf('success', 'failed') }
}));

function getEnvironment() {
    try {
        const { miniProgram } = wx.getAccountInfoSync();
        if (miniProgram && ENVIRONMENTS.includes(miniProgram.envVersion)) return miniProgram.envVersion;
    } catch {
        // 旧基础库可能没有账号信息接口。
    }
    return 'unknown';
}

function trackEvent(event, page, context, payload = {}, pageInstanceId) {
    const schema = SCHEMAS.get(event);
    const isEntry = event === 'entry_open';
    if (!schema || (isEntry ? page !== 'app' : !PAGES.includes(page)) || !context || !context.entry) return;
    const { sessionId, entry: { entryId } } = context;
    if (!runtimeId(sessionId, 's') || !runtimeId(entryId, 'e')) return;
    if (!isEntry && !runtimeId(pageInstanceId, 'p')) return;

    const safePayload = {};
    for (const [field, validate] of Object.entries(schema)) {
        const value = validate(payload[field]);
        if (value !== undefined) safePayload[field] = value;
    }
    // 保留旧版入口事件的 payload.entryId，便于旧报表继续读取。
    if (isEntry) safePayload.entryId = entryId;
    const message = EVENT_PREFIX + JSON.stringify({
        eventVersion: EVENT_VERSION,
        eventId: createRuntimeId('evt'),
        event,
        ts: Date.now(),
        page,
        appVersion: APP_VERSION,
        environment: getEnvironment(),
        sessionId,
        entryId,
        pageInstanceId: isEntry ? undefined : pageInstanceId,
        payload: safePayload
    });
    // 事件契约仅使用 ASCII，字符数即 UTF-8 字节数。
    if (message.length > MAX_EVENT_BYTES || /[^\x20-\x7e]/.test(message)) return;
    try {
        log.info(message);
    } catch {
        // 日志不可用时继续计算和页面操作。
    }
}

function trackPage(page, name, event = 'page_view', payload) {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (!app) return;
    if (!page.pageInstanceId) page.pageInstanceId = createRuntimeId('p');
    trackEvent(event, name, app.globalData, payload, page.pageInstanceId);
}

module.exports = { trackEvent, trackPage, MAX_EVENT_BYTES };
