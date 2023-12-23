const BaseAccessory = require('./base_accessory')
//import { lampProtocol } from '@tuya/tuya-panel-protocols';
//const { ColorProtocol } = lampProtocol;
//const ColorProtocol = require('@tuya/tuya-panel-protocols/lampProtocol');
//const { ColorProtocol } = require('@tuya/tuya-panel-protocols/lampProtocol')
const {lampProtocol} = require('@tuya/tuya-panel-protocols')
const {ColorProtocol} = lampProtocol;

let Accessory;
let Service;
let Characteristic;
let UUIDGen;

// Adjust light style : color, brightness
class StripLightAccessory extends BaseAccessory {
    constructor(platform, homebridgeAccessory, deviceConfig) {
        ({Accessory, Characteristic, Service} = platform.api.hap);
        super(
            platform,
            homebridgeAccessory,
            deviceConfig,
            Accessory.Categories.LIGHTBULB,
            Service.Lightbulb
        );
        this.statusArr = deviceConfig.status ? deviceConfig.status : [];
        this.functionArr = deviceConfig.functions ? deviceConfig.functions : [];
        //Distinguish Tuya different devices under the same HomeBridge Service
        this.deviceCategorie = deviceConfig.category;

        //get Lightbulb dp range
        this.function_dp_range = this.getDefaultDPRange()

        // if (this.functionArr.length != 0) {
        //   this.function_dp_range = this.getFunctionsDPRange()
        // }else{
        //   this.function_dp_range = this.getDefaultDPRange()
        // }

        this.refreshAccessoryServiceIfNeed(this.statusArr, false);
    }

    //init Or refresh AccessoryService
    refreshAccessoryServiceIfNeed(statusArr, isRefresh) {
        this.isRefresh = isRefresh;
        var led_status;

        console.log(JSON.stringify(statusArr))

        for (var statusMap of statusArr) {
            if (statusMap.code === 'work_mode') {
                this.workMode = statusMap;
            }
            if (statusMap.code === 'switch_led' || statusMap.code === 'switch_led_1') {
                this.switchLed = statusMap;
                this.normalAsync(Characteristic.On, this.switchLed.value)
                this.setCachedState(Characteristic.On, this.switchLed.value);

                console.log("------------------")
                console.log(this.switchLed.value)
                console.log("------------------")

                // set global led_status
                led_status = this.switchLed.value;
            }

            // ignore brightness if led is off
            if ((statusMap.code === 'bright_value' || statusMap.code === 'bright_value_v2' || statusMap.code === 'bright_value_1') && led_status) {
                // handle brightness adjust
                this.brightValue = statusMap;
                var rawValue;
                var percentage;
                rawValue = this.brightValue.value;
                percentage = Math.floor((rawValue - this.function_dp_range.bright_range.min) * 100 / (this.function_dp_range.bright_range.max - this.function_dp_range.bright_range.min)); //    $
                this.normalAsync(Characteristic.Brightness, percentage > 100 ? 100 : percentage);

            } else if((statusMap.code === 'bright_value' || statusMap.code === 'bright_value_v2' || statusMap.code === 'bright_value_1') && !led_status){
                // handle switch is off, then set brightness to 0
                this.normalAsync(Characteristic.Brightness, 0)

            } else if(led_status){
                // handle switch is on, but brightness to exist cache
                // convert brightness to percentage
                this.normalAsync(Characteristic.Brightness, this.getCachedState(Characteristic.Brightness)/1000*100)
            }

            if (statusMap.code === 'temp_value' || statusMap.code === 'temp_value_v2') {
                this.tempValue = statusMap;
                var rawValue;
                var temperature;
                rawValue = this.tempValue.value;
                temperature = Math.floor((rawValue - this.function_dp_range.temp_range.min) * 360 / (this.function_dp_range.temp_range.max - this.function_dp_range.temp_range.min) + 140); // ra$
                if (temperature > 500) {
                    temperature = 500
                }
                if (temperature < 140) {
                    temperature = 140
                }
                this.normalAsync(Characteristic.ColorTemperature, temperature)
            }

            if (statusMap.code === 'colour_data' || statusMap.code === 'colour_data_v2') {


                this.colourData = statusMap;
                this.colourDecoded = ColorProtocol.decodeColorData(this.colourData.value);
                this.colourObj = this.colourData.value === "" ? {
                    "h": 100.0,
                    "s": 100.0,
                    "v": 100.0
                } : {"h": this.colourDecoded[0], "s": this.colourDecoded[1], "v": this.colourDecoded[2]};


                if (!this._isHaveDPCodeOfBrightValue()) {
                    var percentage;

                    //percentage = Math.floor((this.colourObj.v - this.function_dp_range.bright_range.min) * 100 / (this.function_dp_range.bright_range.max - this.function_dp_range.bright_range.min));
                    //min:0, max: 1000
                    percentage = Math.floor((this.colourObj.v - 0) * 100 / (1000 - 0))
                    this.normalAsync(Characteristic.Brightness, percentage > 100 ? 100 : percentage)

                    // set cached value
                    this.setCachedState(Characteristic.Brightness, this.colourObj.v);
                }


                const hue = this.colourObj.h; // 0-359
                this.normalAsync(Characteristic.Hue, hue)
                // set cached value
                this.setCachedState(Characteristic.Hue, this.colourObj.h);


                var saturation;
                //saturation = Math.floor((this.colourObj.s - this.function_dp_range.saturation_range.min) * 100 / (this.function_dp_range.saturation_range.max - this.function_dp_range.saturation_range.min));  // saturation 0-100
                //min:0, max: 1000
                saturation = Math.floor((this.colourObj.s - 0) * 100 / (1000 - 0));
                this.normalAsync(Characteristic.Saturation, saturation > 100 ? 100 : saturation)
                // set cached value
                this.setCachedState(Characteristic.Saturation, this.colourObj.s);

            }
        }
    }

    normalAsync(name, hbValue) {
        // this.setCachedState(name, hbValue);
        if (this.isRefresh) {
            this.service
                .getCharacteristic(name)
                .updateValue(hbValue);
        } else {
            this.getAccessoryCharacteristic(name);
        }
    }

    getAccessoryCharacteristic(name) {
        //set  Accessory service Characteristic
        this.service.getCharacteristic(name)
            .on('get', callback => {
                if (this.hasValidCache()) {
                    callback(null, this.getCachedState(name));
                }
            })
            .on('set', (value, callback) => {
                //Switching colors will trigger both hue and saturation to avoid the color command being sent repeatedly.
                //So the saturation is saved and is sent with the hue
                // if (name == Characteristic.Saturation) {
                //     this.setCachedState(name, value / 100 * 1000);
                //     callback();
                //     return;
                // }
                var param = this.getSendParam(name, value)
                this.platform.tuyaOpenApi.sendCommand(this.deviceId, param).then(() => {
                    // this.setCachedState(name, value);
                    callback();
                }).catch((error) => {
                    this.log.error('[SET][%s] Characteristic Error: %s', this.homebridgeAccessory.displayName, error);
                    this.invalidateCache();
                    callback(error);
                });
            });
    }

    //get Command SendData
    getSendParam(name, value) {
        var code;
        var value;

        // get store cached value
        console.log("store: " + this.getCachedState(Characteristic.Hue), this.getCachedState(Characteristic.Saturation), this.getCachedState(Characteristic.Brightness))

        switch (name) {
            case Characteristic.On:
                const isOn = value ? true : false;
                code = this.switchLed.code;
                value = isOn;
                this.setCachedState(Characteristic.On, value);
                break;

            case Characteristic.Saturation:
                // var temperature;
                // temperature = Math.floor((value - 140) * (this.function_dp_range.temp_range.max - this.function_dp_range.temp_range.min) / 360 + this.function_dp_range.temp_range.min); // value 140~500
                code = "colour_data";
                value = {
                    "h": this.getCachedState(Characteristic.Hue),
                    "s": value / 100 * 1000, // convert homekit percentage to hex
                    "v": this.getCachedState(Characteristic.Brightness)
                };

                // console.log("------------------")
                // console.log(this.getCachedState(Characteristic.Brightness))
                // console.log(this.getCachedState(Characteristic.Brightness) > 100)
                // console.log("------------------")

                break;

            case Characteristic.Brightness:
                code = "colour_data"
                value = {
                    "h": this.getCachedState(Characteristic.Hue),
                    "s": this.getCachedState(Characteristic.Saturation),
                    "v": value / 100 * 1000 // convert homekit percentage to hex
                }
                break;

            case Characteristic.Hue:
                code = "colour_data";
                value = {
                    "h": value,
                    "s": this.getCachedState(Characteristic.Saturation),
                    "v": this.getCachedState(Characteristic.Brightness)
                };
                break;



            default:
                break;
        }


        switch (name) {
            case Characteristic.Hue:
            case Characteristic.Saturation:
            case Characteristic.Brightness:
                console.log("HSV: " + value.h + " " + value.s + " " + value.v)
                // the relationship of led_status and brightness
                var led_status;

                if(value.v === 0){
                    // led status off
                    this.setCachedState(Characteristic.On, false);
                    led_status = false;

                } else {
                    // led status on
                    this.setCachedState(Characteristic.On, true);
                    led_status = true;
                }


                // store to cache
                this.setCachedState(Characteristic.Hue, value.h);
                this.setCachedState(Characteristic.Saturation, value.s);
                this.setCachedState(Characteristic.Brightness, value.v);

                return {
                    "commands": [
                        {
                            "code": "colour_data",
                            "value": ColorProtocol.encodeColorData(value.h, value.s, value.v)
                        },
                        {
                            "code": "video_mode",
                            "value": "multiple_colour"
                        },
                        {
                            "code": "work_mode",
                            "value": "colour"
                        },
                        {
                            "code": "switch_led",
                            "value": led_status
                        }
                    ]
                }
            // default:
            //     return {
            //         "commands": [
            //             {
            //                 "code": code,
            //                 "value": value
            //             },
            //             {
            //                 "code": "video_mode",
            //                 "value": "multiple_colour"
            //             },
            //             {
            //                 "code": "work_mode",
            //                 "value": "colour"
            //             }
            //         ]
            //     }
        }
    }

    // deviceConfig.functions is null, return defaultdpRange
    getDefaultDPRange() {
        let defaultBrightRange
        let defaultTempRange
        let defaultSaturationRange
        for (var statusMap of this.statusArr) {
            switch (statusMap.code) {
                case 'bright_value':
                    if (this.deviceCategorie == 'dj' || this.deviceCategorie == 'dc') {
                        defaultBrightRange = {'min': 25, 'max': 255}
                    } else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd' || this.deviceCategorie == 'tgq' || this.deviceCategorie == 'dd' || this.deviceCategorie == 'tgkg') {
                        defaultBrightRange = {'min': 10, 'max': 1000}
                    }
                    break;
                case 'bright_value_1':
                case 'bright_value_v2':
                    defaultBrightRange = {'min': 10, 'max': 1000}
                    break;
                case 'temp_value':
                    if (this.deviceCategorie == 'dj' || this.deviceCategorie == 'dc') {
                        defaultTempRange = {'min': 0, 'max': 255}
                    } else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd' || this.deviceCategorie == 'dd') {
                        defaultTempRange = {'min': 0, 'max': 1000}
                    }
                    break;
                case 'temp_value_v2':
                    defaultTempRange = {'min': 0, 'max': 1000}
                    break;
                case 'colour_data':
                    if (this.deviceCategorie == 'dj' || this.deviceCategorie == 'dc') {
                        defaultSaturationRange = {'min': 0, 'max': 255}
                        defaultBrightRange = {'min': 25, 'max': 255}
                    } else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd' || this.deviceCategorie == 'dd') {
                        defaultSaturationRange = {'min': 0, 'max': 1000}
                        defaultBrightRange = {'min': 10, 'max': 1000}
                    }
                    break;
                case 'colour_data_v2':
                    defaultSaturationRange = {'min': 0, 'max': 1000}
                    defaultBrightRange = {'min': 10, 'max': 1000}
                    break;
                default:
                    break;
            }
        }
        return {
            bright_range: defaultBrightRange,
            temp_range: defaultTempRange,
            saturation_range: defaultSaturationRange,
        }
    }

    //Check whether the device supports bright_value dp code to control brightness
    _isHaveDPCodeOfBrightValue() {
        const brightDic = this.statusArr.find((item, index) => {
            return item.code.indexOf("bright_value") != -1
        });
        if (brightDic) {
            return true;
        } else {
            return false;
        }
    }

    // //return functionsdpRange
    // getFunctionsDPRange() {
    //   let bright_range
    //   let temp_range
    //   let saturation_range
    //   for (const funcDic of this.functionArr) {
    //     let valueRange = JSON.parse(funcDic.values)
    //     let isnull = (JSON.stringify(valueRange) == "{}")
    //     switch (funcDic.code) {
    //       case 'bright_value':
    //         let defaultBrightRange
    //         if (this.deviceCategorie == 'dj') {
    //           defaultBrightRange = { 'min': 25, 'max': 255 }
    //         }else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd') {
    //           defaultBrightRange = { 'min': 10, 'max': 1000 }
    //         }
    //         bright_range = isnull ? defaultBrightRange: { 'min': parseInt(valueRange.min), 'max': parseInt(valueRange.max) }
    //         break;
    //       case 'bright_value_v2':
    //         bright_range = isnull ? { 'min': 10, 'max': 1000 }: { 'min': parseInt(valueRange.min), 'max': parseInt(valueRange.max) }
    //         break;
    //       case 'temp_value':
    //         let defaultTempRange
    //         if (this.deviceCategorie == 'dj') {
    //           defaultTempRange = { 'min': 0, 'max': 255 }
    //         }else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd') {
    //           defaultTempRange = { 'min': 0, 'max': 1000 }
    //         }
    //         temp_range = isnull ? defaultTempRange: { 'min': parseInt(valueRange.min), 'max': parseInt(valueRange.max) }
    //         break;
    //       case 'temp_value_v2':
    //         temp_range = isnull ? { 'min': 0, 'max': 1000 }: { 'min': parseInt(valueRange.min), 'max': parseInt(valueRange.max) }
    //         break;
    //       case 'colour_data':
    //         let defaultSaturationRange
    //         if (this.deviceCategorie == 'dj') {
    //           defaultSaturationRange = { 'min': 0, 'max': 255 }
    //         }else if (this.deviceCategorie == 'xdd' || this.deviceCategorie == 'fwd') {
    //           defaultSaturationRange = { 'min': 0, 'max': 1000 }
    //         }
    //         saturation_range = isnull ? defaultSaturationRange: { 'min': parseInt(valueRange.s.min), 'max': parseInt(valueRange.s.max) }
    //         break;
    //       case 'colour_data_v2':
    //         saturation_range = isnull ? { 'min': 0, 'max': 1000 }: { 'min': parseInt(valueRange.s.min), 'max': parseInt(valueRange.s.max) }
    //         break;
    //       default:
    //         break;
    //     }
    //   }
    //   return {
    //     bright_range: bright_range,
    //     temp_range: temp_range,
    //     saturation_range: saturation_range,
    //   }
    // }

    //update device status
    updateState(data) {

        console.log("updateState2:HEREHEREHERE")

        this.refreshAccessoryServiceIfNeed(data.status, true);
    }
}

module.exports = StripLightAccessory;
