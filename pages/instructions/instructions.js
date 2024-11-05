var log = require('../../utils/logs/logs')
Page({
    onReady() {
        log.info(`[TIME]Instraction page is Ready`);
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
    }
})