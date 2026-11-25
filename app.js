const { trackEvent } = require('./utils/events');
const { createRuntimeId, normalizeEntry, externalEntryKey } = require('./utils/entry');
const { UNKNOWN_SOURCE, normalizeSource, createFirstSourceTracker } = require('./utils/attribution');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

App({
    onLaunch(options) {
        this.backgroundedAt = null;
        this.getFirstSource = createFirstSourceTracker();
        const entry = normalizeEntry(options);
        this.lastExternalEntryKey = externalEntryKey(entry);
        this.openEntry({ ...entry, path: entry.path || 'pages/index/index' }, 'cold_start');

        try {
            const storedLogs = wx.getStorageSync('logs');
            const logs = Array.isArray(storedLogs) ? storedLogs : [];
            logs.unshift(Date.now());
            wx.setStorageSync('logs', logs);
        } catch {
            // 本地存储不可用时仍可启动小程序。
        }

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
        const currentSource = normalizeSource(entry.params) || UNKNOWN_SOURCE;
        const firstSource = this.getFirstSource(currentSource);
        this.globalData.sessionId = sessionId;
        this.globalData.entry = { ...entry, entryId, reason };
        trackEvent('entry_open', 'app', this.globalData, {
            reason,
            path: entry.path,
            platformScene: entry.platformScene,
            currentSource,
            firstSource
        });
    },
    globalData: {
        userInfo: null,
        sessionId: '',
        entry: null
    }
})
