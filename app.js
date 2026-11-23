const log = require('./utils/logs/logs');
const { APP_VERSION } = require('./utils/util');
const { createRuntimeId, normalizeEntry, externalEntryKey } = require('./utils/entry');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

App({
    onLaunch(options) {
        this.backgroundedAt = null;
        const entry = normalizeEntry(options);
        this.lastExternalEntryKey = externalEntryKey(entry);
        this.openEntry({ ...entry, path: entry.path || 'pages/index/index' }, 'cold_start');

        // 展示本地存储能力
        let logs = wx.getStorageSync('logs') || []
        if (!Array.isArray(logs)) {
            logs = []
        }
        logs.unshift(Date.now())
        wx.setStorageSync('logs', logs)

        // 登录
        wx.login({
            success: res => {
                // 发送 res.code 到后台换取 openId, sessionKey, unionId
            }
        })
    },
    onShow(options) {
        // 冷启动后的首次 onShow 和连续前台回调都没有经过 onHide。
        if (this.backgroundedAt === null) return;

        const elapsed = Date.now() - this.backgroundedAt;
        this.backgroundedAt = null;
        const entry = normalizeEntry(options);
        const key = externalEntryKey(entry);
        const newExternalEntry = key !== null && key !== this.lastExternalEntryKey;
        this.lastExternalEntryKey = key;

        if (newExternalEntry) {
            this.openEntry(entry, 'external_entry');
        } else if (elapsed >= SESSION_TIMEOUT_MS) {
            this.openEntry({ ...entry, params: {} }, 'background_timeout');
        }
    },
    onHide() {
        if (this.backgroundedAt === null) this.backgroundedAt = Date.now();
    },
    openEntry(entry, reason) {
        const sessionId = createRuntimeId('s');
        const entryId = createRuntimeId('e');
        this.globalData.sessionId = sessionId;
        this.globalData.entry = { ...entry, entryId, reason };
        log.info('[EVENT]', JSON.stringify({
            event: 'entry_open',
            ts: Date.now(),
            page: 'app',
            appVersion: APP_VERSION,
            sessionId,
            payload: { entryId, reason, path: entry.path, platformScene: entry.platformScene }
        }));
    },
    globalData: {
        userInfo: null,
        sessionId: '',
        entry: null
    }
})
