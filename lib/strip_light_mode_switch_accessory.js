const BaseAccessory = require('./base_accessory');
const {lampProtocol} = require('@tuya/tuya-panel-protocols');
const {ColorProtocol} = lampProtocol;

let Categories;
let Service;
let Characteristic;

// adjust light mode: music or colour
class StripLightModeSwitchAccessory extends BaseAccessory {
    constructor(platform, homebridgeAccessory, deviceConfig, deviceData) {
        ({Categories, Characteristic, Service} = platform.api.hap);
        super(
            platform,
            homebridgeAccessory,
            deviceConfig,
            Categories.SWITCH,
            Service.Switch,
            deviceData.subType
        );

        this.statusArr = deviceConfig.status || [];
        this.subTypeArr = deviceData.subType || [];
        this.registeredCharacteristics = new Set();

        this.refreshAccessoryServiceIfNeed(this.statusArr, false);
    }

    //init Or refresh AccessoryService
    refreshAccessoryServiceIfNeed(statusArr, isRefresh) {
        this.isRefresh = isRefresh;
        if (!statusArr) {
            return;
        }

        for (const subType of this.subTypeArr) {
            const status = statusArr.find(item => item.code === 'work_mode');
            if (!status) {
                continue;
            }

            const value = status.value === 'music';
            let service;

            if (this.subTypeArr.length === 1) {
                service = this.service;
                this.switchValue = status;
            } else {
                service = this.homebridgeAccessory.getService(subType);
            }

            this.setCachedState(service.displayName, value);
            if (this.isRefresh) {
                service.getCharacteristic(Characteristic.On).updateValue(value);
            } else {
                this.getAccessoryCharacteristic(service, Characteristic.On);
            }
        }
    }

    getAccessoryCharacteristic(service, name) {
        const cacheKey = `${service.displayName}:${name}`;
        if (this.registeredCharacteristics.has(cacheKey)) {
            return;
        }

        this.registeredCharacteristics.add(cacheKey);
        service.getCharacteristic(name)
            .on('get', callback => {
                if (this.hasValidCache()) {
                    callback(null, this.getCachedState(service.displayName));
                }
            })
            .on('set', (value, callback) => {
                const api = this.platform.tuyaOpenApi || this.platform.api?.tuyaOpenApi;
                if (!api) {
                    this.log.error('[SET][%s] Characteristic Error: Tuya API not initialized', this.homebridgeAccessory.displayName);
                    callback(new Error('Tuya API not initialized'));
                    return;
                }

                const param = this.getSendParam(service.displayName, value);
                api.sendCommand(this.deviceId, param).then(() => {
                    this.setCachedState(service.displayName, value);
                    callback();
                }).catch((error) => {
                    this.log.error('[SET][%s] Characteristic.Brightness Error: %s', this.homebridgeAccessory.displayName, error);
                    this.invalidateCache();
                    callback(error);
                });
            });
    }

    //get Command SendData
    getSendParam(name, value) {
        return {
            "commands": [
                {
                    "code": "colour_data",
                    "value": ColorProtocol.encodeColorData(29, 1000, 1000)
                },
                {
                    "code": "work_mode",
                    "value": value ? "music" : "colour"
                },
                {
                    "code": "video_mode",
                    "value": "multiple_colour"
                },
                {
                    "code": "switch_led",
                    "value": true
                }
            ]
        };
    }

    //update device status
    updateState(data) {
        this.refreshAccessoryServiceIfNeed(data.status, true);
    }
}

module.exports = StripLightModeSwitchAccessory;
