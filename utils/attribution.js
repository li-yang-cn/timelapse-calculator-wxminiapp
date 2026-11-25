const FIRST_SOURCE_KEY = 'growthFirstSource';
const CHANNEL_CAMPAIGNS = new Map([
    ['tutorial', ['sunset']],
    ['photo_club', ['sunset_walk']],
    ['unknown', []]
]);
const UNKNOWN_SOURCE = Object.freeze({ channel: 'unknown' });

function normalizeSource(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        !Object.prototype.hasOwnProperty.call(value, 'channel')) return;

    const { channel } = value;
    const campaigns = CHANNEL_CAMPAIGNS.get(channel);
    if (!campaigns) return;
    if (!Object.prototype.hasOwnProperty.call(value, 'campaign')) return { channel };
    if (campaigns.includes(value.campaign)) return { channel, campaign: value.campaign };
}

function createFirstSourceTracker() {
    let firstObserved;
    let confirmed;
    return (currentSource) => {
        if (confirmed) return confirmed;
        if (!firstObserved) firstObserved = currentSource;

        try {
            confirmed = normalizeSource(wx.getStorageSync(FIRST_SOURCE_KEY));
        } catch {
            // 无法确认是否已有首次来源，下次新入口再读。
            return UNKNOWN_SOURCE;
        }
        if (confirmed) return confirmed;

        try {
            wx.setStorageSync(FIRST_SOURCE_KEY, firstObserved);
            confirmed = firstObserved;
        } catch {
            // 保留本进程首次观测到的来源，下次新入口重试。
        }
        return firstObserved;
    };
}

module.exports = { UNKNOWN_SOURCE, normalizeSource, createFirstSourceTracker };
