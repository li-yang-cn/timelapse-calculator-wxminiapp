var log = require('../../utils/logs/logs')
Page({
    onLoad() {
        this.setData({
            startTime: Date.now()
        })
    },
    onShow() {
        const endTime = Date.now();
        const loadTime = endTime - this.data.startTime;
        log.info(`[TIME]Instruction page loaded in ${loadTime} ms`);
    },
})