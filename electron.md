# Electron Builder

This readme explains how to build an application for the Vuforia Spatial Edge Server using the electron-builder package.

## Read First
The Vuforia Spatial Toolbox and Vuforia Spatial Edge Server make up a shared research platform for exploring spatial computing as a community. This research platform is not an out of the box production-ready enterprise solution. Please read the [MPL 2.0 license](LICENSE) before use.

Join the conversations in our [discourse forum](https://forum.spatialtoolbox.vuforia.com) if you have questions, ideas want to collaborate or just say hi.


## Installation

First, install the [Vuforia Spatial Edge Server](README.md).

Second, switch to branch 'electron-app'

```bash
cd vuforia-spatial-edge-server
git checkout electron-app
```

Install dependencies again:

```bash
npm install
```

Now run the command to build the application:

```bash
yarn dist
```

This command will generate a folder called dist with the application files.


## Notarization and Code Signing

Check out [electron-builder code signing](https://www.electron.build/code-signing).

macOS and Windows code signing is supported. Windows is dual code-signed (SHA1 & SHA256 hashing algorithms).

On a macOS development machine, a valid and appropriate identity from your keychain will be automatically used.

See article [Notarizing your Electron application](https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/).

The file notarize.js is in charge of notarizing your app.
You will have to create an .env file with your apple ID credentials:

APPLEID=abc@abc.com
APPLEIDPASS=xxxxxxxxxxx

This file will be ignored by gitignore when pushing the code.