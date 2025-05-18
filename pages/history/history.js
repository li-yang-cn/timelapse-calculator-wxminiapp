var log = require('../../utils/logs/logs')

Page({
    onShow(){
        log.info(`[TIME]Onshow Triggered`);
        try {
            let history = wx.getStorageSync('calculationHistory') || [];
            this.setData({
                history
            })
        } catch (e) {
            log.error(e)
        }
    },
    onReady() {
        log.info(`[TIME]History page is Ready`);
        
    },

    clearcache() {
        try {
            wx.clearStorageSync()
        } catch (e) {
            log.error(e)
        }
        this.setData({
            history: []
        });
        log.info("[ClearCache]")
    },

    onLoad() {
        // 获取现有的历史记录
        try {
            let history = wx.getStorageSync('calculationHistory') || [];
            
            this.setData({
                history
            })
        } catch (e) {
            log.error(e)
        }
    },
    onShareAppMessage() {
        return {
          title: '延时摄影计算器·快速计算拍摄参数'
        };
      },
    onShareTimeline(){
        return {
            title: '延时摄影计算器·快速计算拍摄参数'
        }
    },
});
