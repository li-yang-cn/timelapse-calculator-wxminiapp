var log = require('../../utils/logs/logs')

const STORAGE_KEY = 'plannedEventChecklist';

const DEFAULT_CHECKLIST = [{
        type: '拍摄设备',
        items: [{
                text: '主相机或主手机已充电并可正常拍摄',
                checked: false
            },
            {
                text: '备用相机或备用手机已准备',
                checked: false
            },
            {
                text: '已清洁镜头、传感器或手机摄像头',
                checked: false
            },
            {
                text: '已关闭不必要的通知、自动锁屏和省电限制',
                checked: false
            }
        ]
    },
    {
        type: '镜头与滤镜',
        items: [{
                text: '已选择适合构图的镜头或手机焦段',
                checked: false
            },
            {
                text: 'ND 滤镜、CPL 滤镜或转接环已带齐',
                checked: false
            },
            {
                text: '镜头盖、遮光罩、清洁布和气吹已准备',
                checked: false
            }
        ]
    },
    {
        type: '支撑设备',
        items: [{
                text: '三脚架、云台或手机夹已检查锁紧',
                checked: false
            },
            {
                text: '快装板、螺丝、转接头已带齐',
                checked: false
            },
            {
                text: '沙袋、配重或防风固定方案已准备',
                checked: false
            }
        ]
    },
    {
        type: '运动控制设备',
        items: [{
                text: '滑轨、云台电机或稳定器已充电',
                checked: false
            },
            {
                text: '运动控制轨迹、速度和方向已预设',
                checked: false
            },
            {
                text: '控制器、连接线和遥控器已测试',
                checked: false
            }
        ]
    },
    {
        type: '供电设备',
        items: [{
                text: '相机电池、手机移动电源和充电线已带齐',
                checked: false
            },
            {
                text: '外接供电方案已测试并可持续覆盖拍摄时长',
                checked: false
            },
            {
                text: '低温或长时间拍摄的保温、防水措施已准备',
                checked: false
            }
        ]
    },
    {
        type: '存储设备',
        items: [{
                text: '存储卡或手机剩余空间足够',
                checked: false
            },
            {
                text: '备用存储卡、读卡器或移动硬盘已准备',
                checked: false
            },
            {
                text: '重要素材已提前备份，存储卡可安全格式化',
                checked: false
            }
        ]
    },
    {
        type: '现场辅助设备',
        items: [{
                text: '头灯、手电、雨具、防晒或保暖用品已准备',
                checked: false
            },
            {
                text: '拍摄点位、天气、日出日落或银河时间已确认',
                checked: false
            },
            {
                text: '必要许可、交通路线和现场安全风险已确认',
                checked: false
            }
        ]
    }
];

function cloneChecklist(checklist) {
    return JSON.parse(JSON.stringify(checklist));
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPageTopPadding() {
    try {
        const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const statusBarHeight = windowInfo.statusBarHeight || 0;
        return statusBarHeight + 18;
    } catch (e) {
        return 36;
    }
}

function normalizeChecklist(checklist) {
    if (!Array.isArray(checklist)) {
        return cloneChecklist(DEFAULT_CHECKLIST);
    }

    return checklist.map((group, groupIndex) => {
        const safeGroup = isPlainObject(group) ? group : {};
        const fallback = DEFAULT_CHECKLIST[groupIndex] || {
            type: '其他设备',
            items: []
        };
        const items = Array.isArray(safeGroup.items) ? safeGroup.items : [];
        return {
            type: safeGroup.type || fallback.type,
            items: items.filter((item) => {
                return item && typeof item.text === 'string' && item.text.trim();
            }).map((item) => {
                return {
                    text: item.text.trim(),
                    checked: !!item.checked
                };
            })
        };
    }).filter((group) => {
        return group.type && group.items;
    });
}

function normalizeStoredData(stored) {
    return isPlainObject(stored) ? stored : {};
}

function getSelectedCategoryName(categoryNames, selectedCategoryIndex) {
    if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
        return '选择分类';
    }

    return categoryNames[selectedCategoryIndex] || categoryNames[0];
}

Page({
    data: {
        storageNotice: '隐私提醒：本小程序不收集个人信息，清单仅保存在微信本地缓存中。清理缓存、删除小程序或更换设备后，数据可能丢失。',
        eventName: '',
        eventDate: '',
        checklist: cloneChecklist(DEFAULT_CHECKLIST),
        categoryNames: DEFAULT_CHECKLIST.map((group) => group.type),
        selectedCategoryName: DEFAULT_CHECKLIST[0].type,
        selectedCategoryIndex: 0,
        newItemText: '',
        pageTopPadding: 36
    },

    onReady() {
        log.info(`[TIME]Checklist page is Ready`);
    },

    onLoad() {
        this.setData({
            pageTopPadding: getPageTopPadding()
        });
        this.loadChecklist();
    },

    loadChecklist() {
        try {
            const stored = normalizeStoredData(wx.getStorageSync(STORAGE_KEY));
            const checklist = normalizeChecklist(stored.checklist);
            const categoryNames = checklist.map((group) => group.type);
            const selectedCategoryIndex = 0;
            this.setData({
                eventName: stored.eventName || '',
                eventDate: stored.eventDate || '',
                checklist,
                categoryNames,
                selectedCategoryIndex,
                selectedCategoryName: getSelectedCategoryName(categoryNames, selectedCategoryIndex)
            });
        } catch (e) {
            log.error(e);
        }
    },

    saveChecklist() {
        try {
            wx.setStorageSync(STORAGE_KEY, {
                eventName: this.data.eventName,
                eventDate: this.data.eventDate,
                checklist: this.data.checklist
            });
        } catch (e) {
            log.error(e);
            wx.showToast({
                title: '保存失败，请稍后重试',
                icon: 'none'
            });
        }
    },

    eventNameChange(e) {
        this.setData({
            eventName: e.detail.value
        }, () => {
            this.saveChecklist();
        });
    },

    eventDateChange(e) {
        this.setData({
            eventDate: e.detail.value
        }, () => {
            this.saveChecklist();
        });
    },

    categoryChange(e) {
        const selectedCategoryIndex = Number(e.detail.value);
        this.setData({
            selectedCategoryIndex,
            selectedCategoryName: getSelectedCategoryName(this.data.categoryNames, selectedCategoryIndex)
        });
    },

    newItemChange(e) {
        this.setData({
            newItemText: e.detail.value
        });
    },

    addItem() {
        const text = (this.data.newItemText || '').trim();
        if (!text) {
            wx.showToast({
                title: '请先输入检查项',
                icon: 'none'
            });
            return;
        }

        const groupIndex = this.data.selectedCategoryIndex;
        const group = this.data.checklist[groupIndex];
        if (!group || !Array.isArray(group.items)) {
            wx.showToast({
                title: '请选择有效分类',
                icon: 'none'
            });
            return;
        }

        const path = `checklist[${groupIndex}].items`;
        const items = group.items.concat({
            text,
            checked: false
        });
        this.setData({
            [path]: items,
            newItemText: ''
        }, () => {
            this.saveChecklist();
        });
    },

    toggleItem(e) {
        const groupIndex = Number(e.currentTarget.dataset.groupIndex);
        const itemIndex = Number(e.currentTarget.dataset.itemIndex);
        const item = this.data.checklist[groupIndex] && this.data.checklist[groupIndex].items[itemIndex];
        if (!item) {
            return;
        }

        this.setData({
            [`checklist[${groupIndex}].items[${itemIndex}].checked`]: !item.checked
        }, () => {
            this.saveChecklist();
        });
    },

    deleteItem(e) {
        const groupIndex = Number(e.currentTarget.dataset.groupIndex);
        const itemIndex = Number(e.currentTarget.dataset.itemIndex);
        const group = this.data.checklist[groupIndex];
        if (!group || !group.items[itemIndex]) {
            return;
        }

        wx.showModal({
            title: '删除检查项',
            content: `确认删除“${group.items[itemIndex].text}”？`,
            confirmText: '删除',
            success: (res) => {
                if (!res.confirm) {
                    return;
                }
                const items = group.items.filter((item, index) => index !== itemIndex);
                this.setData({
                    [`checklist[${groupIndex}].items`]: items
                }, () => {
                    this.saveChecklist();
                });
            }
        });
    },

    resetChecklist() {
        wx.showModal({
            title: '恢复默认清单',
            content: '会覆盖当前事件清单和勾选状态，是否继续？',
            confirmText: '恢复',
            success: (res) => {
                if (!res.confirm) {
                    return;
                }
                const checklist = cloneChecklist(DEFAULT_CHECKLIST);
                const categoryNames = checklist.map((group) => group.type);
                const selectedCategoryIndex = 0;
                this.setData({
                    checklist,
                    categoryNames,
                    selectedCategoryIndex,
                    selectedCategoryName: getSelectedCategoryName(categoryNames, selectedCategoryIndex),
                    newItemText: ''
                }, () => {
                    this.saveChecklist();
                });
            }
        });
    },

    clearChecklist() {
        wx.showModal({
            title: '删除当前清单',
            content: '会删除本地保存的事件名称、日期和勾选状态，并恢复默认清单，是否继续？',
            confirmText: '删除',
            success: (res) => {
                if (!res.confirm) {
                    return;
                }
                try {
                    wx.removeStorageSync(STORAGE_KEY);
                } catch (e) {
                    log.error(e);
                }
                const checklist = cloneChecklist(DEFAULT_CHECKLIST);
                const categoryNames = checklist.map((group) => group.type);
                const selectedCategoryIndex = 0;
                this.setData({
                    eventName: '',
                    eventDate: '',
                    checklist,
                    categoryNames,
                    selectedCategoryIndex,
                    selectedCategoryName: getSelectedCategoryName(categoryNames, selectedCategoryIndex),
                    newItemText: ''
                });
            }
        });
    }
});
