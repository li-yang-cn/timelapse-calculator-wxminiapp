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
        history: [],
        lastResult: null,
        calculatedFields: {
            duration: false,
            finalDuration: false,
            interval: false,
            totalFrames: false
        },
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
        const id = e.currentTarget.id;
        const patch = this.getEditPatch(id);
        this.setData(Object.assign(patch, {
            [id]: e.detail.value,
            [`userInputs.${id}`]: true
        }));
    },

    pickerChange(e) {
        const patch = this.getEditPatch('frameRate');
        this.setData(Object.assign(patch, {
            frameRate: this.data.frameRates[e.detail.value],
            frameRateIndex: e.detail.value,
            'userInputs.frameRate': true
        }));
    },

    calculate() {
        const parsed = this.getParsedInputs();
        if (!parsed.isValid) {
            wx.showToast({
                title: parsed.message,
                icon: 'none'
            });
            log.error(`[ERROR] ${parsed.message}`);
            return;
        }

        const result = this.resolveCalculation(parsed.values);
        if (!result.isValid) {
            wx.showToast({
                title: result.message,
                icon: 'none'
            });
            log.error(`[ERROR] ${result.message}`);
            return;
        }

        const {
            duration,
            finalDuration,
            frameRate,
            interval,
            totalFrames
        } = result.values;
        const calculatedFields = this.getCalculatedFields(parsed.values.providedFields);
        const resultRecord = Object.assign({}, result.values, {
            calculatedFields
        });
        this.storeCalculationResult(resultRecord);
        log.info(`[CALC]
            Duration: ${duration},
            FinalDuration: ${finalDuration},
            FrameRate: ${frameRate},
            Interval: ${interval},
            TotalFrames: ${totalFrames}`);
        this.setData({
            duration: duration.toFixed(2),
            finalDuration: finalDuration.toFixed(2),
            frameRate: Math.round(frameRate),
            interval: interval.toFixed(2),
            totalFrames: Math.round(totalFrames),
            lastResult: resultRecord,
            calculatedFields,
            isCalculated: true, // 已生成可复制的计算结果
            showResetButton: true // 显示重置按钮
        });
        this.resetUserInputs();
    },

    getEditPatch(editedField) {
        if (!this.data.isCalculated) {
            return {};
        }

        const patch = {
            isCalculated: false,
            showResetButton: false,
            lastResult: null,
            calculatedFields: {
                duration: false,
                finalDuration: false,
                interval: false,
                totalFrames: false
            }
        };

        const calculatedFields = this.data.calculatedFields || {};
        const isEditingCalculatedField = !!calculatedFields[editedField];
        Object.keys(calculatedFields).forEach((field) => {
            if (calculatedFields[field] && field !== editedField) {
                patch[field] = '';
            }
        });
        if (isEditingCalculatedField) {
            const staleField = editedField === 'duration' || editedField === 'finalDuration' ?
                'interval' : 'finalDuration';
            if (staleField !== editedField) {
                patch[staleField] = '';
            }
        }

        return patch;
    },

    getCalculatedFields(providedFields) {
        const fieldMap = {
            duration: false,
            finalDuration: false,
            interval: false,
            totalFrames: false
        };
        Object.keys(fieldMap).forEach((field) => {
            fieldMap[field] = providedFields.indexOf(field) === -1;
        });
        return fieldMap;
    },

    getParsedInputs() {
        const rules = {
            duration: {
                label: '拍摄时长'
            },
            finalDuration: {
                label: '成片时长'
            },
            interval: {
                label: '拍摄间隔'
            },
            totalFrames: {
                label: '总张数',
                integer: true
            }
        };
        const values = {
            frameRate: Number(this.data.frameRate)
        };
        const providedFields = [];

        if (!Number.isFinite(values.frameRate) || values.frameRate <= 0) {
            return {
                isValid: false,
                message: '请选择有效帧速率'
            };
        }

        for (let field in rules) {
            const rawValue = this.data[field];
            const hasValue = rawValue !== '' && rawValue !== null && rawValue !== undefined;
            if (!hasValue) {
                values[field] = null;
                continue;
            }

            const value = Number(rawValue);
            if (!Number.isFinite(value) || value <= 0) {
                return {
                    isValid: false,
                    message: `${rules[field].label}必须大于0`
                };
            }
            if (rules[field].integer && !Number.isInteger(value)) {
                return {
                    isValid: false,
                    message: `${rules[field].label}必须是整数`
                };
            }

            values[field] = value;
            providedFields.push(field);
        }

        if (providedFields.length < 2) {
            return {
                isValid: false,
                message: '至少输入两个参数'
            };
        }

        values.providedFields = providedFields;
        return {
            isValid: true,
            values
        };
    },

    resolveCalculation(values) {
        const fpsTotalFrames = values.finalDuration !== null ?
            Math.round(values.finalDuration * values.frameRate) : null;
        const captureTotalFrames = values.duration !== null && values.interval !== null ?
            Math.round((values.duration * 60) / values.interval) : null;
        let totalFrames = values.totalFrames;

        if (totalFrames !== null && fpsTotalFrames !== null && totalFrames !== fpsTotalFrames) {
            return {
                isValid: false,
                message: '总张数与成片时长冲突'
            };
        }
        if (totalFrames !== null && captureTotalFrames !== null && totalFrames !== captureTotalFrames) {
            return {
                isValid: false,
                message: '总张数与拍摄时长/间隔冲突'
            };
        }
        if (fpsTotalFrames !== null && captureTotalFrames !== null && fpsTotalFrames !== captureTotalFrames) {
            return {
                isValid: false,
                message: '成片时长与拍摄参数冲突'
            };
        }

        if (totalFrames === null) {
            totalFrames = fpsTotalFrames !== null ? fpsTotalFrames : captureTotalFrames;
        }
        if (totalFrames === null || totalFrames <= 0) {
            return {
                isValid: false,
                message: '参数不足，无法计算总张数'
            };
        }

        let duration = values.duration;
        let finalDuration = values.finalDuration;
        let interval = values.interval;

        if (finalDuration === null) {
            finalDuration = totalFrames / values.frameRate;
        }

        if (duration === null && interval !== null) {
            duration = (totalFrames * interval) / 60;
        } else if (interval === null && duration !== null) {
            interval = (duration * 60) / totalFrames;
        } else if (duration === null && interval === null) {
            return {
                isValid: false,
                message: '还需输入拍摄时长或间隔'
            };
        }

        return {
            isValid: true,
            values: {
                duration: Number(duration.toFixed(2)),
                finalDuration: Number(finalDuration.toFixed(2)),
                frameRate: values.frameRate,
                interval: Number(interval.toFixed(2)),
                totalFrames: Math.round(totalFrames)
            }
        };
    },

    storeCalculationResult(result) {
        // 获取现有的历史记录
        let history = [];
        try {
            history = wx.getStorageSync('calculationHistory') || []
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
            lastResult: null,
            calculatedFields: {
                duration: false,
                finalDuration: false,
                interval: false,
                totalFrames: false
            },
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
        if (!this.data.history || this.data.history.length === 0) {
            wx.showToast({
                title: '暂无历史记录',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '清空历史记录',
            content: '确认清空最近10条计算历史？',
            confirmText: '清空',
            success: (res) => {
                if (!res.confirm) {
                    return;
                }
                try {
                    wx.removeStorageSync('calculationHistory')
                } catch (e) {
                    log.error(e)
                }
                this.setData({
                    history: []
                });
                log.info("[ClearCache]")
            }
        });
    },

    loadHistory(e) {
        const index = e.currentTarget.dataset.index;
        const item = this.data.history[index];
        if (!item) {
            return;
        }

        this.setData({
            duration: Number(item.duration).toFixed(2),
            finalDuration: Number(item.finalDuration).toFixed(2),
            frameRate: Number(item.frameRate),
            frameRateIndex: this.getFrameRateIndex(Number(item.frameRate)),
            interval: Number(item.interval).toFixed(2),
            totalFrames: Math.round(Number(item.totalFrames)),
            lastResult: item,
            calculatedFields: item.calculatedFields || this.getDefaultHistoryCalculatedFields(),
            isCalculated: true,
            showResetButton: true
        });
        this.resetUserInputs();
        wx.showToast({
            title: '已回填历史记录',
            icon: 'none'
        });
    },

    getFrameRateIndex(frameRate) {
        const index = this.data.frameRates.indexOf(frameRate);
        return index === -1 ? this.data.frameRateIndex : index;
    },

    getDefaultHistoryCalculatedFields() {
        return {
            duration: false,
            finalDuration: false,
            interval: true,
            totalFrames: true
        };
    },

    copyResult(e) {
        const index = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.index : undefined;
        const result = index !== undefined ? this.data.history[index] : this.data.lastResult;
        if (!result) {
            wx.showToast({
                title: '暂无可复制结果',
                icon: 'none'
            });
            return;
        }

        wx.setClipboardData({
            data: this.formatResult(result),
            success: () => {
                wx.showToast({
                    title: '已复制结果',
                    icon: 'success'
                });
            }
        });
    },

    formatResult(result) {
        return `延时摄影方案：拍摄时长 ${result.duration} 分钟，成片时长 ${result.finalDuration} 秒，帧速率 ${result.frameRate} fps，拍摄间隔 ${result.interval} 秒，总张数 ${result.totalFrames} 张。`;
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
