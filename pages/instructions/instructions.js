var log = require('../../utils/logs/logs')

function getPageTopPadding() {
    try {
        const systemInfo = wx.getSystemInfoSync();
        const statusBarHeight = systemInfo.statusBarHeight || 0;
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

    onReady() {
        log.info(`[TIME]Instraction page is Ready`);
    },
})
