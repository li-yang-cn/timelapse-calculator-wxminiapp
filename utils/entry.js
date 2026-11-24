const PAGE_PATHS = new Set([
    'pages/index/index',
    'pages/checklist/checklist',
    'pages/instructions/instructions'
]);
const RESUME_SCENES = new Set([1000, 1001, 1038, 1089, 1090, 1103, 1104]);
const ENTRY_KEYS = ['channel', 'campaign', 'sceneKey', 'planId', 'shareBatch'];
const ENTRY_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
let idSequence = 0;

function createRuntimeId(prefix) {
    idSequence += 1;
    const random = Math.floor(Math.random() * 0x100000000).toString(36);
    return `${prefix}_${Date.now().toString(36)}_${random}_${idSequence.toString(36)}`;
}

function normalizeEntry(options = {}) {
    const { path, scene, query } = options || {};
    const route = typeof path === 'string' ? path.trim().replace(/^\//, '') : '';
    const sceneValue = typeof scene === 'string' && /^\d{4}$/.test(scene) ? Number(scene) : scene;
    const params = {};
    for (const key of ENTRY_KEYS) {
        const value = query && Object.prototype.hasOwnProperty.call(query, key) ? query[key] : undefined;
        if (typeof value === 'string' && ENTRY_TOKEN.test(value)) {
            params[key] = value;
        }
    }
    return {
        path: PAGE_PATHS.has(route) ? route : null,
        platformScene: Number.isInteger(sceneValue) && sceneValue >= 1000 && sceneValue <= 9999 ? sceneValue : null,
        params
    };
}

function externalEntryKey(entry) {
    const hasParams = Object.keys(entry.params).length > 0;
    // 普通返回的场景无法单凭路径区分新入口，允许显式的入口参数提供区分依据。
    const hasExternalScene = entry.platformScene !== null && !RESUME_SCENES.has(entry.platformScene);
    return hasParams || hasExternalScene ? JSON.stringify(entry) : null;
}

module.exports = { createRuntimeId, normalizeEntry, externalEntryKey, PAGE_PATHS };
