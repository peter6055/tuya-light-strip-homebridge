const BaseAccessory = require('./base_accessory')

let Accessory;
let Service;
let Characteristic;
let UUIDGen;


// adjust light mode: music or colour
class StripLightModeSwitchAccessory extends BaseAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig, deviceData) {
    ({ Accessory, Characteristic, Service } = platform.api.hap);
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Accessory.Categories.SWITCH,
      Service.Switch,
      deviceData.subType
    );


    this.statusArr = deviceConfig.status;
    this.subTypeArr = deviceData.subType;

    this.refreshAccessoryServiceIfNeed(this.statusArr, false);
  }

  //init Or refresh AccessoryService
  refreshAccessoryServiceIfNeed(statusArr, isRefresh) {
    this.isRefresh = isRefresh;
    if (!statusArr) {
      return;
    }

    for (var subType of this.subTypeArr) {
      var status = statusArr.find(item => item.code === "work_mode")
      if (!status) {
        continue;
      }

      var value = status.value === "music" ? true : false
      let service


      if (this.subTypeArr.length == 1) {
        service = this.service;
        this.switchValue = status;
      }else{
        service = this.homebridgeAccessory.getService(subType);
      }
      this.setCachedState(service.displayName, value);
      if (this.isRefresh) {
        service
          .getCharacteristic(Characteristic.On)
          .updateValue(value);
      } else {
        this.getAccessoryCharacteristic(service, Characteristic.On);
      }
    }
  }

  getAccessoryCharacteristic(service, name) {
    //set  Accessory service Characteristic
    service.getCharacteristic(name)
      .on('get', callback => {
        // console.log("get:HEREHEREHERE")

        // this.platform.tuyaOpenApi.getDeviceStatus(this.deviceId).then((data) => {
        //   // find code === "work_mode"
        //   var status = data.find(item => item.code === "work_mode")
        //
        //   // console.log(status)
        //
        //   if(this.hasValidCache() && this.getCachedState(service.displayName) ===  status.value){
        //     callback(null, this.getCachedState(service.displayName));
        //   } else {
        //     this.updateState(data);
        //     callback(null, this.getCachedState(service.displayName));
        //   }
        // })

        if (this.hasValidCache()) {
          callback(null, this.getCachedState(service.displayName));
        }
      })
      .on('set', (value, callback) => {
        var param = this.getSendParam(service.displayName, value)
        this.platform.tuyaOpenApi.sendCommand(this.deviceId, param).then(() => {
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
    var code;
    var value;

    const isOn = value ? "music" : "colour";
    if (this.subTypeArr.length == 1) {
      code = this.switchValue.code;
    }else{
      code = name;
    }
    value = isOn;
    return {
      "commands": [
        {
          "code": "work_mode",
          "value": value
        },
        {
          "code": "video_mode",
          "value": "multiple_colour"
        },
      ]
    };
  }

  //update device status
  updateState(data) {

    console.log("updateState1:HEREHEREHERE")

    this.refreshAccessoryServiceIfNeed(data.status, true);
  }
}

module.exports = StripLightModeSwitchAccessory;
