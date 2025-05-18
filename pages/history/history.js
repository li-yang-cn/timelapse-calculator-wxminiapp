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
    data: {
        showShareImage: false,
        shareImagePath: '',
    },
    onShareRecord(e) {
        const index = e.currentTarget.dataset.index;
        const record = this.data.history[index];
        this.drawShareImage(record);
    },
    closeShareImage() {
        this.setData({ showShareImage: false });
    },
    drawShareImage(record) {
        const ctx = wx.createCanvasContext('shareCanvas', this);
        const width = 600;
        const height = 400;
        const topOffset = 30;
        // 背景
        ctx.setFillStyle('#fff');
        ctx.fillRect(0, 0, width, height);
        // 上半部分表格
        ctx.setFontSize(22);
        ctx.setFillStyle('#222');
        ctx.fillText('拍摄时长', 30, 50 + topOffset);
        ctx.fillText(record.duration + ' 分', 180, 50 + topOffset);
        ctx.fillText('成片时长', 320, 50 + topOffset);
        ctx.fillText(record.finalDuration + ' 秒', 470, 50 + topOffset);
        ctx.fillText('帧速率', 30, 100 + topOffset);
        ctx.fillText(record.frameRate + ' fps', 180, 100 + topOffset);
        ctx.fillText('拍摄间隔', 320, 100 + topOffset);
        ctx.fillText(record.interval + ' 秒', 470, 100 + topOffset);
        ctx.fillText('总张数', 30, 150 + topOffset);
        ctx.fillText(record.totalFrames + ' 张', 180, 150 + topOffset);
        // 下半部分
        ctx.setFontSize(18);
        ctx.setFillStyle('#444');
        ctx.fillText('长按或扫码使用“延时摄影计算器”小程序', 30, 340 + topOffset);
        ctx.fillText('', 30, 280 + topOffset);
        // 绘制二维码
        ctx.drawImage('/images/qr_code.jpg', 400, 200 + topOffset, 160, 160);
        ctx.draw(false, () => {
            wx.canvasToTempFilePath({
                canvasId: 'shareCanvas',
                width,
                height,
                fileType: 'jpg',
                success: (res) => {
                    this.setData({
                        shareImagePath: res.tempFilePath,
                        showShareImage: true
                    });
                },
                fail: (err) => {
                    wx.showToast({ title: '生成图片失败', icon: 'none' });
                }
            }, this);
        });
    },
});
