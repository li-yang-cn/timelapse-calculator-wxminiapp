var log = require('../../utils/logs/logs')

const APP_VERSION = '1.2.0';
const FRAME_CONSISTENCY_TOLERANCE = 1;

Page({
    data: {
        duration: '', // 拍摄时长（分钟）
        finalDuration: '', // 成片时长（秒）
        frameRate: 25, // 帧速率（fps），默认为24
        interval: '', // 拍摄间隔（秒）
        totalFrames: '', // 总张数
        frameRates: [24, 25, 30, 60], // 可选帧速率
        frameRateIndex: 1, // 默认帧速率索引
        presets: [{
                emoji: '☁️',
                name: '云流动',
                duration: 60,
                finalDuration: 12,
                frameRate: 25,
                intervalRange: '8-15秒',
                note: '适合云层移动明显的白天场景'
            },
            {
                emoji: '🌇',
                name: '日落',
                duration: 90,
                finalDuration: 15,
                frameRate: 25,
                intervalRange: '10-20秒',
                note: '适合太阳落山前后光线变化'
            },
            {
                emoji: '🌌',
                name: '星空',
                duration: 180,
                finalDuration: 12,
                frameRate: 25,
                intervalRange: '30-40秒',
                note: '建议手动对焦并准备外接供电'
            },
            {
                emoji: '🚗',
                name: '车流',
                duration: 10,
                finalDuration: 10,
                frameRate: 25,
                intervalRange: '1-3秒',
                note: '适合城市道路和高架夜景'
            },
            {
                emoji: '🚶',
                name: '人群',
                duration: 15,
                finalDuration: 10,
                frameRate: 25,
                intervalRange: '2-5秒',
                note: '适合广场、展会和街区流动'
            },
            {
                emoji: '🌱',
                name: '植物',
                duration: 720,
                finalDuration: 12,
                frameRate: 25,
                intervalRange: '60-300秒',
                note: '适合长周期固定机位拍摄'
            }
        ],
        selectedPresetIndex: null,
        selectedPreset: null,
        history: [],
        historyIsEmpty: true,
        historyExpanded: false,
        lastResult: null,
        shareImageGenerating: false,
        riskWarnings: [],
        sessionId: '',
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
    track(event, payload) {
        log.info('[EVENT]', JSON.stringify({
            event,
            ts: Date.now(),
            page: 'index',
            appVersion: APP_VERSION,
            sessionId: this.data.sessionId,
            payload: payload || {}
        }));
    },

    createSessionId() {
        return `s_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    },

    getCurrentProvidedFields() {
        const fields = ['duration', 'finalDuration', 'interval', 'totalFrames'];
        return fields.filter((field) => {
            const value = this.data[field];
            return value !== '' && value !== null && value !== undefined;
        });
    },

    showResetForFailedCalculation() {
        if (this.getCurrentProvidedFields().length > 0) {
            this.setData({
                showResetButton: true
            });
        }
    },

    reportCalculationFailure(failure, options) {
        const settings = options || {};
        if (failure.resolution) {
            this.offerConflictResolution(failure, settings);
            return;
        }
        wx.showToast({
            title: failure.message,
            icon: 'none'
        });
        if (settings.source === 'manual') {
            this.showResetForFailedCalculation();
        }
        this.track('calculate_failed', Object.assign({
            source: settings.source,
            reason: failure.code || 'validation_failed',
            message: failure.message,
            providedFields: settings.providedFields || []
        }, settings.context || {}));
    },

    offerConflictResolution(failure, settings) {
        const resolution = failure.resolution;
        const eventPayload = Object.assign({
            source: settings.source,
            reason: failure.code,
            message: failure.message,
            providedFields: settings.providedFields || [],
            basisFields: resolution.basisFields,
            suggestion: resolution.description
        }, settings.context || {});
        this.track('calculate_conflict_prompt', eventPayload);
        wx.showModal({
            title: '参数冲突',
            content: `${failure.message}\n\n建议：${resolution.description}`,
            confirmText: '接受',
            cancelText: '拒绝',
            success: (res) => {
                const action = res.confirm ? 'accept' : 'reject';
                this.track('calculate_conflict_resolution', Object.assign({}, eventPayload, {
                    action
                }));
                if (res.confirm) {
                    this.applyConflictResolution(resolution);
                } else {
                    this.showResetForFailedCalculation();
                }
            }
        });
    },

    applyConflictResolution(resolution) {
        const fields = ['duration', 'finalDuration', 'interval', 'totalFrames'];
        const patch = {
            selectedPresetIndex: null,
            selectedPreset: null,
            lastResult: null,
            riskWarnings: [],
            calculatedFields: {
                duration: false,
                finalDuration: false,
                interval: false,
                totalFrames: false
            },
            isCalculated: false,
            showResetButton: true
        };
        fields.forEach((field) => {
            if (resolution.basisFields.indexOf(field) === -1) {
                patch[field] = '';
            }
        });
        this.setData(patch, () => {
            this.calculate();
        });
    },

    getCalculatedFieldNames(calculatedFields) {
        return Object.keys(calculatedFields || {}).filter((field) => {
            return calculatedFields[field];
        });
    },

    getCalculationPayload(options) {
        const result = options.result;
        return {
            source: options.source,
            providedFields: options.providedFields,
            calculatedFields: this.getCalculatedFieldNames(options.calculatedFields),
            duration: result.duration,
            finalDuration: result.finalDuration,
            frameRate: result.frameRate,
            interval: result.interval,
            totalFrames: result.totalFrames,
            riskWarningCount: options.riskWarnings.length,
            riskWarningTypes: this.getRiskWarningTypes(result)
        };
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

    applyPreset(e) {
        const index = Number(e.currentTarget.dataset.index);
        const preset = this.data.presets[index];
        if (!preset) {
            return;
        }

        const providedFields = ['duration', 'finalDuration'];
        const result = this.resolveCalculation({
            duration: preset.duration,
            finalDuration: preset.finalDuration,
            frameRate: preset.frameRate,
            interval: null,
            totalFrames: null,
            providedFields
        });
        if (!result.isValid) {
            this.reportCalculationFailure(result, {
                source: 'preset',
                providedFields,
                context: {
                    presetName: preset.name,
                    presetIndex: index
                }
            });
            return;
        }

        const {
            duration,
            finalDuration,
            frameRate,
            interval,
            totalFrames
        } = result.values;
        const calculatedFields = this.getCalculatedFields(providedFields);
        const resultRecord = Object.assign({}, result.values, {
            calculatedFields
        });
        const riskWarnings = this.getRiskWarnings(result.values);
        this.storeCalculationResult(resultRecord);

        this.setData({
            duration: duration.toFixed(2),
            finalDuration: finalDuration.toFixed(2),
            frameRate: Math.round(frameRate),
            frameRateIndex: this.getFrameRateIndex(preset.frameRate),
            interval: interval.toFixed(2),
            totalFrames: Math.round(totalFrames),
            selectedPresetIndex: index,
            selectedPreset: preset,
            lastResult: resultRecord,
            riskWarnings,
            calculatedFields,
            isCalculated: true,
            showResetButton: true
        });
        this.resetUserInputs();
        const calculationPayload = this.getCalculationPayload({
            source: 'preset',
            result: result.values,
            providedFields,
            calculatedFields,
            riskWarnings
        });
        calculationPayload.presetName = preset.name;
        calculationPayload.presetIndex = index;
        this.track('calculate_success', calculationPayload);

        wx.showToast({
            title: `已生成${preset.name}`,
            icon: 'none'
        });
    },

    calculate() {
        const parsed = this.getParsedInputs();
        if (!parsed.isValid) {
            this.reportCalculationFailure(parsed, {
                source: 'manual',
                providedFields: this.getCurrentProvidedFields()
            });
            return;
        }

        const result = this.resolveCalculation(parsed.values);
        if (!result.isValid) {
            this.reportCalculationFailure(result, {
                source: 'manual',
                providedFields: parsed.values.providedFields
            });
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
        const riskWarnings = this.getRiskWarnings(result.values);
        this.storeCalculationResult(resultRecord);
        this.setData({
            duration: duration.toFixed(2),
            finalDuration: finalDuration.toFixed(2),
            frameRate: Math.round(frameRate),
            interval: interval.toFixed(2),
            totalFrames: Math.round(totalFrames),
            lastResult: resultRecord,
            riskWarnings,
            calculatedFields,
            isCalculated: true, // 已生成可复制的计算结果
            showResetButton: true // 显示重置按钮
        });
        this.resetUserInputs();
        this.track('calculate_success', this.getCalculationPayload({
            source: 'manual',
            result: result.values,
            providedFields: parsed.values.providedFields,
            calculatedFields,
            riskWarnings
        }));
    },

    getEditPatch(editedField) {
        if (!this.data.isCalculated) {
            return {};
        }

        const patch = {
            isCalculated: false,
            showResetButton: false,
            lastResult: null,
            riskWarnings: [],
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
                code: 'invalid_frame_rate',
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
                    code: 'invalid_value',
                    message: `${rules[field].label}必须大于0`
                };
            }
            if (rules[field].integer && !Number.isInteger(value)) {
                return {
                    isValid: false,
                    code: 'invalid_total_frames',
                    message: `${rules[field].label}必须是整数`
                };
            }

            values[field] = value;
            providedFields.push(field);
        }

        if (providedFields.length < 2) {
            return {
                isValid: false,
                code: 'insufficient_parameters',
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
        const framesMatch = (left, right) => {
            return Math.abs(left - right) <= FRAME_CONSISTENCY_TOLERANCE;
        };

        if (totalFrames !== null && fpsTotalFrames !== null && !framesMatch(totalFrames, fpsTotalFrames)) {
            const resolution = values.duration !== null ? {
                basisFields: ['duration', 'finalDuration'],
                description: '以拍摄时长和成片时长为准，自动调整间隔和总张数'
            } : values.interval !== null ? {
                basisFields: ['finalDuration', 'interval'],
                description: '以成片时长和拍摄间隔为准，自动调整拍摄时长和总张数'
            } : null;
            return {
                isValid: false,
                code: 'total_frames_final_duration_conflict',
                message: `按成片时长应为${fpsTotalFrames}张`,
                resolution
            };
        }
        if (totalFrames !== null && captureTotalFrames !== null && !framesMatch(totalFrames, captureTotalFrames)) {
            return {
                isValid: false,
                code: 'total_frames_capture_conflict',
                message: `按拍摄参数应为${captureTotalFrames}张`,
                resolution: {
                    basisFields: ['duration', 'interval'],
                    description: '以拍摄时长和拍摄间隔为准，自动调整成片时长和总张数'
                }
            };
        }
        if (fpsTotalFrames !== null && captureTotalFrames !== null && !framesMatch(fpsTotalFrames, captureTotalFrames)) {
            const expectedFinalDuration = Number((captureTotalFrames / values.frameRate).toFixed(2));
            return {
                isValid: false,
                code: 'final_duration_capture_conflict',
                message: `按拍摄参数成片约${expectedFinalDuration}秒`,
                resolution: {
                    basisFields: ['duration', 'interval'],
                    description: '以拍摄时长和拍摄间隔为准，自动调整成片时长和总张数'
                }
            };
        }

        if (totalFrames === null) {
            totalFrames = fpsTotalFrames !== null ? fpsTotalFrames : captureTotalFrames;
        }
        if (totalFrames === null || totalFrames <= 0) {
            return {
                isValid: false,
                code: 'insufficient_total_frames',
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
                code: 'missing_capture_parameter',
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

    getRiskWarningTypes(result) {
        const warningTypes = [];
        const duration = Number(result.duration);
        const interval = Number(result.interval);
        const totalFrames = Number(result.totalFrames);

        if (Number.isFinite(totalFrames) && totalFrames >= 1000) {
            warningTypes.push('high_total_frames');
        }
        if (Number.isFinite(interval) && interval <= 1) {
            warningTypes.push('short_interval');
        }
        if (Number.isFinite(duration) && duration >= 180) {
            warningTypes.push('long_duration');
        }

        return warningTypes;
    },

    getRiskWarnings(result) {
        const warningMessages = {
            high_total_frames: '总张数较高，请提前确认存储空间、电量和设备稳定性',
            short_interval: '拍摄间隔很短，请确认快门速度、写入速度和缓存能力',
            long_duration: '拍摄时长较长，建议使用三脚架、外接供电并锁定构图'
        };

        return this.getRiskWarningTypes(result).map((type) => {
            return warningMessages[type];
        }).filter((message) => {
            return !!message;
        });
    },

    storeCalculationResult(result) {
        // 获取现有的历史记录
        let history = [];
        try {
            history = wx.getStorageSync('calculationHistory') || []
        } catch (e) {
            log.error(e)
        };
        history = this.normalizeHistory(history);
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
            history,
            historyIsEmpty: history.length === 0
        });
    },

    normalizeHistory(history) {
        if (!Array.isArray(history)) {
            return [];
        }

        return history.filter((item) => {
            return item && typeof item === 'object';
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
        this.setData({
            duration: '',
            finalDuration: '',
            frameRate: 25,
            interval: '',
            totalFrames: '',
            selectedPresetIndex: null,
            selectedPreset: null,
            lastResult: null,
            riskWarnings: [],
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
                const historyCount = this.data.history.length;
                try {
                    wx.removeStorageSync('calculationHistory')
                } catch (e) {
                    log.error(e)
                }
                this.setData({
                    history: [],
                    historyIsEmpty: true
                });
                this.track('history_clear', {
                    historyCount
                });
                log.info("[ClearCache]")
            }
        });
    },

    loadHistory(e) {
        const index = e.currentTarget.dataset.index;
        const history = Array.isArray(this.data.history) ? this.data.history : [];
        const item = history[index];
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
            riskWarnings: this.getRiskWarnings(item),
            calculatedFields: item.calculatedFields || this.getDefaultHistoryCalculatedFields(),
            isCalculated: true,
            showResetButton: true
        });
        this.resetUserInputs();
        this.track('history_load', {
            index,
            duration: Number(item.duration),
            finalDuration: Number(item.finalDuration),
            frameRate: Number(item.frameRate),
            interval: Number(item.interval),
            totalFrames: Number(item.totalFrames)
        });
        wx.showToast({
            title: '已回填历史记录',
            icon: 'none'
        });
    },

    getFrameRateIndex(frameRate) {
        const index = this.data.frameRates.indexOf(frameRate);
        return index === -1 ? this.data.frameRateIndex : index;
    },

    toggleHistory() {
        const nextExpanded = !this.data.historyExpanded;
        const history = Array.isArray(this.data.history) ? this.data.history : [];
        this.setData({
            historyExpanded: nextExpanded,
            historyIsEmpty: history.length === 0
        });
        this.track(nextExpanded ? 'history_expand' : 'history_collapse', {
            historyCount: history.length
        });
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
        const history = Array.isArray(this.data.history) ? this.data.history : [];
        const result = index !== undefined ? history[index] : this.data.lastResult;
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
                this.track('copy_result', {
                    source: index !== undefined ? 'history' : 'current',
                    hasRiskWarnings: this.getRiskWarningTypes(result).length > 0
                });
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

    getSharePosterModel(result) {
        return {
            title: '延时摄影拍摄方案',
            rows: [{
                    label: '拍摄时长',
                    value: `${result.duration} 分钟`
                },
                {
                    label: '成片时长',
                    value: `${result.finalDuration} 秒`
                },
                {
                    label: '帧速率',
                    value: `${result.frameRate} fps`
                },
                {
                    label: '拍摄间隔',
                    value: `${result.interval} 秒`
                },
                {
                    label: '总张数',
                    value: `${result.totalFrames} 张`
                }
            ],
            reminder: this.getRiskWarnings(result)[0] || '拍摄前请确认电量、存储空间和设备稳定性'
        };
    },

    openShareImageActions() {
        const result = this.data.lastResult;
        if (!result || this.data.shareImageGenerating) {
            return Promise.resolve();
        }
        this.setData({
            shareImageGenerating: true
        });
        return this.generateShareImage(result).then((filePath) => {
            this.setData({
                shareImageGenerating: false
            });
            this.track('share_image_generated', {
                hasRiskWarnings: this.getRiskWarningTypes(result).length > 0
            });
            this.showShareImageActions(filePath);
            return filePath;
        }).catch((error) => {
            this.setData({
                shareImageGenerating: false
            });
            this.track('share_image_failed', {
                stage: 'generate',
                message: error && error.message ? error.message : String(error)
            });
            wx.showToast({
                title: '分享图生成失败',
                icon: 'none'
            });
        });
    },

    showShareImageActions(filePath) {
        wx.showActionSheet({
            itemList: ['分享给好友', '保存到相册', '预览图片'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    this.shareGeneratedImage(filePath);
                } else if (res.tapIndex === 1) {
                    this.saveGeneratedImage(filePath);
                } else if (res.tapIndex === 2) {
                    this.previewGeneratedImage(filePath);
                }
            }
        });
    },

    shareGeneratedImage(filePath) {
        if (typeof wx.showShareImageMenu !== 'function') {
            this.previewGeneratedImage(filePath);
            wx.showToast({
                title: '请长按图片分享',
                icon: 'none'
            });
            return;
        }
        wx.showShareImageMenu({
            path: filePath,
            success: () => {
                this.track('share_image_action', {
                    action: 'share',
                    result: 'success'
                });
            },
            fail: (error) => {
                if (!this.isUserCancelled(error)) {
                    this.track('share_image_action', {
                        action: 'share',
                        result: 'failed'
                    });
                    this.previewGeneratedImage(filePath);
                    wx.showToast({
                        title: '请长按图片分享',
                        icon: 'none'
                    });
                }
            }
        });
    },

    saveGeneratedImage(filePath) {
        wx.saveImageToPhotosAlbum({
            filePath,
            success: () => {
                this.track('share_image_action', {
                    action: 'save',
                    result: 'success'
                });
                wx.showToast({
                    title: '已保存到相册',
                    icon: 'success'
                });
            },
            fail: (error) => {
                if (this.isUserCancelled(error)) {
                    return;
                }
                this.track('share_image_action', {
                    action: 'save',
                    result: 'failed'
                });
                if (error && /auth|authorize|permission|deny/i.test(error.errMsg || '')) {
                    this.showAlbumPermissionGuide();
                    return;
                }
                wx.showToast({
                    title: '保存图片失败',
                    icon: 'none'
                });
            }
        });
    },

    previewGeneratedImage(filePath) {
        this.track('share_image_action', {
            action: 'preview'
        });
        wx.previewImage({
            current: filePath,
            urls: [filePath]
        });
    },

    showAlbumPermissionGuide() {
        wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册。',
            confirmText: '去设置',
            success: (res) => {
                if (res.confirm && typeof wx.openSetting === 'function') {
                    wx.openSetting();
                }
            }
        });
    },

    isUserCancelled(error) {
        return !!(error && /cancel/i.test(error.errMsg || error.message || ''));
    },

    getShareCanvasNode() {
        return new Promise((resolve, reject) => {
            if (typeof wx.createSelectorQuery !== 'function') {
                reject(new Error('Canvas API unavailable'));
                return;
            }
            wx.createSelectorQuery().in(this).select('#shareCanvas').fields({
                node: true,
                size: true
            }).exec((result) => {
                const canvasInfo = Array.isArray(result) ? result[0] : null;
                if (!canvasInfo || !canvasInfo.node) {
                    reject(new Error('Share canvas unavailable'));
                    return;
                }
                resolve(canvasInfo);
            });
        });
    },

    loadCanvasImage(canvas, src) {
        return new Promise((resolve, reject) => {
            const image = canvas.createImage();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Image load failed: ${src}`));
            image.src = src;
        });
    },

    drawRoundedRect(context, x, y, width, height, radius, fillStyle) {
        const right = x + width;
        const bottom = y + height;
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(right - radius, y);
        context.quadraticCurveTo(right, y, right, y + radius);
        context.lineTo(right, bottom - radius);
        context.quadraticCurveTo(right, bottom, right - radius, bottom);
        context.lineTo(x + radius, bottom);
        context.quadraticCurveTo(x, bottom, x, bottom - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
        context.fillStyle = fillStyle;
        context.fill();
    },

    renderSharePoster(canvasInfo, qrCodeImage, result) {
        const width = 375;
        const height = 500;
        const pixelRatio = 2;
        const canvas = canvasInfo.node;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('2D canvas context unavailable');
        }
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        context.scale(pixelRatio, pixelRatio);

        const poster = this.getSharePosterModel(result);
        context.fillStyle = '#222222';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#ffffff';
        context.font = '600 24px sans-serif';
        context.fillText(poster.title, 20, 42);
        context.fillStyle = '#999999';
        context.font = '13px sans-serif';
        context.fillText('保存这份方案，按参数开始拍摄', 20, 64);

        this.drawRoundedRect(context, 20, 84, 335, 224, 8, '#2d2d2d');
        poster.rows.forEach((row, index) => {
            const y = 118 + index * 38;
            context.fillStyle = '#aaaaaa';
            context.font = '14px sans-serif';
            context.textAlign = 'left';
            context.fillText(row.label, 40, y);
            context.fillStyle = '#ffffff';
            context.font = '600 16px sans-serif';
            context.textAlign = 'right';
            context.fillText(row.value, 335, y);
            if (index < poster.rows.length - 1) {
                context.strokeStyle = '#3a3a3a';
                context.beginPath();
                context.moveTo(40, y + 14);
                context.lineTo(335, y + 14);
                context.stroke();
            }
        });

        context.textAlign = 'left';
        context.fillStyle = '#cccccc';
        context.font = '12px sans-serif';
        context.fillText(`拍摄提醒：${poster.reminder}`.slice(0, 29), 24, 331);

        this.drawRoundedRect(context, 20, 350, 335, 126, 8, '#ffffff');
        context.drawImage(qrCodeImage, 34, 363, 100, 100);
        context.fillStyle = '#333333';
        context.font = '600 17px sans-serif';
        context.fillText('扫码打开延时摄影计算器', 152, 399);
        context.fillStyle = '#777777';
        context.font = '13px sans-serif';
        context.fillText('重新计算、保存历史与拍摄清单', 152, 424);
        context.fillStyle = '#999999';
        context.font = '11px sans-serif';
        context.fillText(`延时摄影计算器 · v${APP_VERSION}`, 152, 450);

        return {
            canvas,
            width,
            height,
            pixelRatio
        };
    },

    exportSharePoster(rendered) {
        return new Promise((resolve, reject) => {
            wx.canvasToTempFilePath({
                canvas: rendered.canvas,
                x: 0,
                y: 0,
                width: rendered.width,
                height: rendered.height,
                destWidth: rendered.width * rendered.pixelRatio,
                destHeight: rendered.height * rendered.pixelRatio,
                fileType: 'png',
                quality: 1,
                success: (res) => resolve(res.tempFilePath),
                fail: (error) => reject(new Error(error.errMsg || 'Canvas export failed'))
            });
        });
    },

    generateShareImage(result) {
        let canvasInfo;
        return this.getShareCanvasNode().then((info) => {
            canvasInfo = info;
            return this.loadCanvasImage(info.node, '/images/qr_code.jpg');
        }).then((qrCodeImage) => {
            return this.renderSharePoster(canvasInfo, qrCodeImage, result);
        }).then((rendered) => {
            return this.exportSharePoster(rendered);
        });
    },

    onLoad() {
        const sessionId = this.createSessionId();
        let history = [];
        // 获取现有的历史记录
        try {
            history = wx.getStorageSync('calculationHistory') || [];
            history = this.normalizeHistory(history);
            wx.setStorageSync('calculationHistory', history);
        } catch (e) {
            log.error(e)
        }
        this.setData({
            frameRate: this.data.frameRates[1], // 默认设置为25fps
            sessionId,
            history,
            historyIsEmpty: history.length === 0
        });
        this.track('page_view', {
            page: 'index'
        });
    }
});
