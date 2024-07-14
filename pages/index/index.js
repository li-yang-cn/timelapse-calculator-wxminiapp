Page({
    data: {
      duration: '',         // 拍摄时长（分钟）
      finalDuration: '',    // 成片时长（秒）
      frameRate: 25,        // 帧速率（fps），默认为24
      interval: '',         // 拍摄间隔（秒）
      totalFrames: '',      // 总张数
      frameRates: [24, 25, 30, 60], // 可选帧速率
      frameRateIndex: 1,    // 默认帧速率索引
      userInputs: {
        duration: false,
        finalDuration: false,
        interval: false,
        totalFrames: false,
        frameRate: false,
      },
      isCalculated: false,  // 是否已经计算
      showResetButton: false // 是否显示重置按钮
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
      let { duration, finalDuration, frameRate, interval, totalFrames, userInputs } = this.data;
      duration = parseFloat(duration);
      finalDuration = parseFloat(finalDuration);
      frameRate = parseFloat(frameRate);
      interval = parseFloat(interval);
      totalFrames = parseFloat(totalFrames);
  
      if (!isNaN(duration) && !isNaN(finalDuration) && !isNaN(frameRate) && !userInputs.totalFrames && !userInputs.interval) {
        totalFrames = Math.round(finalDuration * frameRate);
        interval = parseFloat(((duration * 60) / totalFrames).toFixed(2));
      } else if (!isNaN(duration) && !isNaN(frameRate) && !isNaN(interval) && !userInputs.totalFrames && !userInputs.finalDuration) {
        totalFrames = Math.round((duration * 60) / interval);
        finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
      } else if (!isNaN(finalDuration) && !isNaN(frameRate) && !isNaN(interval) && !userInputs.totalFrames && !userInputs.duration) {
        totalFrames = Math.round(finalDuration * frameRate);
        duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
      } else if (!isNaN(duration) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.finalDuration && !userInputs.frameRate) {
        finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
        frameRate = Math.round(totalFrames / finalDuration);
      } else if (!isNaN(finalDuration) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.duration && !userInputs.frameRate) {
        duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
        frameRate = Math.round(totalFrames / finalDuration);
      } else if (!isNaN(frameRate) && !isNaN(interval) && !isNaN(totalFrames) && !userInputs.duration && !userInputs.finalDuration) {
        duration = parseFloat(((totalFrames * interval) / 60).toFixed(2));
        finalDuration = parseFloat((totalFrames / frameRate).toFixed(2));
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
  
    onLoad() {
      this.setData({
        frameRate: this.data.frameRates[1] // 默认设置为25fps
      });
    }
  });