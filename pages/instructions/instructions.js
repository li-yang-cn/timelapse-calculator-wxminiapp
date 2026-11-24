var log = require('../../utils/logs/logs')
const { trackPage } = require('../../utils/events');

function getPageTopPadding() {
    try {
        const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const statusBarHeight = windowInfo.statusBarHeight || 0;
        return statusBarHeight + 18;
    } catch (e) {
        return 36;
    }
}

Page({
    data: {
        pageTopPadding: 36
    },

    onLoad() {
        this.setData({
            pageTopPadding: getPageTopPadding()
        });
    },

    onShow() {
        trackPage(this, 'instructions');
    },

    onReady() {
        log.info(`[TIME]Instraction page is Ready`);
    },
})
