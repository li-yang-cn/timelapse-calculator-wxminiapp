var log = require('../../utils/logs/logs')

Page({
    data: {
        duration: '', // 拍摄时长（分钟）
        finalDuration: '', // 成片时长（秒）
        frameRate: 25, // 帧速率（fps），默认为24
        interval: '', // 拍摄间隔（秒）
        totalFrames: '', // 总张数
        frameRates: [24, 25, 30, 60], // 可选帧速率
        frameRateIndex: 1, // 默认帧速率索引
        userInputs: {
            duration: false,
            finalDuration: false,
            interval: false,
            totalFrames: false,
            frameRate: false,
        },
        isCalculated: false, // 是否已经计算
        showResetButton: false // 是否显示重置按钮
    },
    onReady() {
        log.info(`[TIME]Index page is Ready`);
    },
    inputChange(e) {
        if (this.data.isCalculated) {
            wx.showToast({
                title: '请点击重置按钮后重新计算',
                icon: 'none'
            });
            return; // 如果已经计算，禁用输入
        }
        const id = e.currentTarget.id;
        this.setData({
            [id]: e.detail.value,
            [`userInputs.${id}`]: true
        });
    },

    pickerChange(e) {
        if (this.data.isCalculated) {
            wx.showToast({
                title: '请点击重置按钮后重新计算',
                icon: 'none'
            });
            return; // 如果已经计算，禁用选择器
        }
        this.setData({
            frameRate: this.data.frameRates[e.detail.value],
            frameRateIndex: e.detail.value,
            'userInputs.frameRate': true
        });
    },

    calculate() {
        let {
            duration,
            finalDuration,
            frameRate,
            interval,
            totalFrames,
            userInputs
        } = this.data;
        duration = parseFloat(duration);
        finalDuration = parseFloat(finalDuration);
        frameRate = parseFloat(frameRate);
        interval = parseFloat(interval);
        totalFrames = parseFloat(totalFrames);

        if (!isNaN(duration) && !isNaN(finalDuration) && !isNaN(frameRate) && !userInputs.totalFrames && !userInputs.interval) {
            totalFrames = Math.round(finalDuration * frameRate);
            interval = parseFloat(((duration * 60) / totalFrames).toFixed(2));
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-1 
                Duration: ${duration}, 
                FinalDuration: ${finalDuration}, 
                FrameRate: ${frameRate}, 
                Result-TotalFrames: ${totalFrames}, 
                Result-Interval: ${interval}`)
        } else if (!isNaN(duration) && !isNaN(frameRate) && !isNaN(interval) && !userInputs.totalFrames && !userInputs.finalDuration) {
            totalFrames = Math.round((duration * 60) / interval);
            finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-2
                Interval: ${interval},
                Duration: ${duration},
                FrameRate: ${frameRate}, 
                Result-TotalFrames: ${totalFrames}, 
                Result-FinalDuration: ${finalDuration},`)
        } else if (!isNaN(finalDuration) && !isNaN(frameRate) && !isNaN(interval) && !userInputs.totalFrames && !userInputs.duration) {
            totalFrames = Math.round(finalDuration * frameRate);
            duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-3
                Interval: ${interval},
                FinalDuration: ${finalDuration}, 
                FrameRate: ${frameRate}, 
                Result-TotalFrames: ${totalFrames}, 
                Result-Duration: ${duration}`)
        } else if (!isNaN(duration) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.finalDuration && !userInputs.frameRate) {
            finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
            frameRate = Math.round(totalFrames / finalDuration);
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-4
                Interval: ${interval},
                TotalFrames: ${totalFrames}, 
                Duration: ${duration},
                Result-FinalDuration: ${finalDuration}, 
                Result-FrameRate: ${frameRate} `)
        } else if (!isNaN(finalDuration) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.duration && !userInputs.frameRate) {
            duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
            frameRate = Math.round(totalFrames / finalDuration);
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-5
                Interval: ${interval},
                TotalFrames: ${totalFrames}, 
                FinalDuration: ${finalDuration}, 
                Result-Duration: ${duration},
                Result-FrameRate: ${frameRate} `)
        } else if (!isNaN(frameRate) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.duration && !userInputs.finalDuration) {
            duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
            finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-6
            Interval: ${interval},
            TotalFrames: ${totalFrames}, 
            FrameRate: ${frameRate},
            Result-FinalDuration: ${finalDuration}, 
            Result-Duration: ${duration}`)
        } else if (!isNaN(duration) && !isNaN(frameRate) && !isNaN(totalFrames) && !userInputs.interval && !userInputs.finalDuration) {
            finalDuration = parseFloat(totalFrames / frameRate);
            interval = parseFloat(duration * 60 / 250);
            // 存储计算结果
            this.storeCalculationResult({
                duration,
                finalDuration,
                frameRate,
                interval,
                totalFrames
            });
            log.info(`[CALC] FLOW-7
            Interval: ${interval},
            TotalFrames: ${totalFrames}, 
            FrameRate: ${frameRate},
            Result-FinalDuration: ${finalDuration}, 
            Result-Duration: ${duration}`)
        } else if ((!isNaN(totalFrames) && !isNaN(finalDuration)) && (totalFrames != finalDuration * frameRate)) {
            wx.showToast({
                title: '总张数和成片时长冲突只输入其中一个即可',
                icon: 'none'
            });
            log.info(`[ERROR1] Conflict:
            Interval: ${interval},
            TotalFrames: ${totalFrames}, 
            FrameRate: ${frameRate},
            Result-FinalDuration: ${finalDuration}, 
            Result-Duration: ${duration}`)
        } else {
            wx.showToast({
                title: '输入必要的参数进行计算',
                icon: 'none'
            });
            console.log(`[ERROR2] User input:
            Interval: ${interval},
            TotalFrames: ${totalFrames}, 
            FrameRate: ${frameRate},
            FinalDuration: ${finalDuration}, 
            Duration: ${duration}`);
            log.error(`[ERROR] User input:
            Interval: ${interval},
            TotalFrames: ${totalFrames}, 
            FrameRate: ${frameRate},
            FinalDuration: ${finalDuration}, 
            Duration: ${duration}`)
        }

        this.setData({
            duration: userInputs.duration ? duration : (isNaN(duration) ? '' : duration.toFixed(2)),
            finalDuration: userInputs.finalDuration ? finalDuration : (isNaN(finalDuration) ? '' : finalDuration.toFixed(2)),
            frameRate: userInputs.frameRate ? frameRate : (isNaN(frameRate) ? 24 : Math.round(frameRate)),
            interval: userInputs.interval ? interval : (isNaN(interval) ? '' : interval.toFixed(2)),
            totalFrames: userInputs.totalFrames ? totalFrames : (isNaN(totalFrames) ? '' : Math.round(totalFrames)),
            isCalculated: true, // 计算完成后锁定输入
            showResetButton: true // 显示重置按钮
        });
        this.resetUserInputs();
    },

    storeCalculationResult(result) {
        // 获取现有的历史记录
        try {
            let history = wx.getStorageSync('calculationHistory') || []
        } catch (e) {
            log.error(e)
        };
        // 添加新的计算结果
        if (!Array.isArray(history)) {
            history = []; // 确保 history 是一个数组
        };
        history.unshift(result);
        // 只保留最近10条
        if (history.length > 10) {
            history = history.slice(0, 10);
        }
        // 将更新后的历史记录存储回本地
        try {
            wx.setStorageSync('calculationHistory', history)
        } catch (e) {
            log.error(e)
        };
        // 更新页面的数据
        this.setData({
            history
        });
    },
    resetUserInputs() {
        this.setData({
            userInputs: {
                duration: false,
                finalDuration: false,
                interval: false,
                totalFrames: false,
                frameRate: false,
            }
        });
    },

    reset() {
        log.info("[REST]");
        this.setData({
            duration: '',
            finalDuration: '',
            frameRate: 25,
            interval: '',
            totalFrames: '',
            userInputs: {
                duration: false,
                finalDuration: false,
                interval: false,
                totalFrames: false,
                frameRate: false,
            },
            frameRateIndex: 1, // 重置帧速率索引
            isCalculated: false, // 重置状态
            showResetButton: false // 隐藏重置按钮
        });
    },
    clearcache() {
        try {
            wx.clearStorageSync()
        } catch (e) {
            log.error(e)
        }
        try {
            let history = wx.getStorageSync('calculationHistory') || [];
            this.setData({
                history
            })
        } catch (e) {
            log.error(e)
        }
    },

    onLoad() {
        this.setData({
            frameRate: this.data.frameRates[1] // 默认设置为25fps
        });
        // 获取现有的历史记录
        try {
            let history = wx.getStorageSync('calculationHistory') || [];
            this.setData({
                history
            })
        } catch (e) {
            log.error(e)
        }
    }
});
