# Strip Light Homebridge Plugin
This is a Homebridge plugin for the Tuya Strip Light. It is based on the Tuya Homebridge Plugin.
The instructions for is based on install homebrdige on docker on a Synology NAS.

## Update
### 2023-12-22 v1.0.1
- Fixed issue: When you adjust the colour and brightness on the left panel, the mode on the right panel will not reset to "Colour" mode. You will need to click the switch twice to turn on the music(tv) mode.
- Fixed issue: If there are error message when adding the device/gateway to homekit, please comment the following line in index.js, and remove the comment after adding the device/gateway to homekit. This was because the UUID conflicts.

### 2023-12-23 v1.0.2
- Fixed issue: You are not able to adjust white light (Saturation isn't return from homekit) on Homekit using this plugin.
- Fixed issue: The relationship between the brightness and led status

## Product
https://m.tb.cn/h.5mpecxX?tk=epnBW56D6sZ CZ0001 「电视氛围灯同步声光电视机氛围灯带随屏同步变色背景智能同步灯带」


## Features
- LEFT PANEL: Color adjustment, brightness adjustment (colour mode)
- RIGHT PANEL: Mode adjustment (colour, music(tv))
<br/>
<img alt="image1.jpeg" src="image1.jpeg" width="200"/>


## Installation
1. Install Tuya Homebridge Plugin as per instructions: https://developer.tuya.com/en/docs/iot/Tuya_Homebridge_Plugin?id=Kamcldj76lhzt
2. Make a new share folder called "docker" on Synology Nas.
3. Make a new folder inside folder "docker" called "homebridge" and upload the entire folder from this repo to the new folder.
4. Configure the volume mapping in the docker container as follows and keeps the permission as READ and WRITE
    ```
    /docker/homebridge/tuya-light-strip/lib/strip_light_mode_switch_accessory.js:/var/lib/homebridge/node_modules/homebridge-tuya-platform/lib/strip_light_mode_switch_accessory.js
    /docker/homebridge/tuya-light-strip/lib/strip_light_accessory.js:/var/lib/homebridge/node_modules/homebridge-tuya-platform/lib/strip_light_accessory.js
    /docker/homebridge/tuya-light-strip/index.js:/var/lib/homebridge/node_modules/homebridge-tuya-platform/index.js
    ```
5. Go to the docker container terminal and run the following command to install the dependencies
    ```
    cd /var/lib/homebridge/node_modules/homebridge-tuya-platform
    npm install @tuya/tuya-panel-protocols
    ```
5. Restart the docker container.


## Development
1. You can connect IDE to the synology nas using FTP.
2. After editing file, you can restart homebridge to see the changes.


## Acknowledgements
- 照明协议工具 https://developer.tuya.com/cn/docs/iot/lampProtocol?id=Kaljp68841zwl
- 开发 Homebridge 硬件驱动 https://developer.tuya.com/cn/docs/iot/add-category?id=Kavr81qw3t4p8
- 如何安装涂鸦 Homebridge 插件 https://developer.tuya.com/cn/docs/iot/Tuya_Homebridge_Plugin?id=Kamcldj76lhzt
- Tuya Homebridge Plugin https://github.com/tuya/tuya-homebridge
- Homebridge API https://developers.homebridge.io/