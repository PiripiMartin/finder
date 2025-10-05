# Share Extension Setup Guide

## Overview
This guide will help you add a Share Extension to your iOS app so it appears in the share sheet when users share content from other apps like TikTok.

## Prerequisites
- Xcode is open with the `lai.xcworkspace` file
- The project has been prebuilt with `npx expo prebuild --clean`
- CocoaPods have been installed with `pod install`

## Step 1: Create Share Extension Target in Xcode

1. In Xcode, click on the project name in the navigator (lai)
2. Click the "+" button at the bottom of the targets list
3. Choose "Share Extension" from the templates
4. Set the following:
   - Product Name: `ShareExtension`
   - Team: Your development team
   - Bundle Identifier: `com.piripimartin.dew.ShareExtension`
   - Language: Swift
5. Click "Finish"
6. When asked "Activate ShareExtension scheme?", click "Activate"

## Step 2: Configure Share Extension Info.plist

In the ShareExtension folder, open `Info.plist` and replace the NSExtension section with:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>NSExtensionActivationRule</key>
        <dict>
            <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
            <integer>1</integer>
            <key>NSExtensionActivationSupportsText</key>
            <true/>
        </dict>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>ShareViewController</string>
</dict>
```

## Step 3: Replace ShareViewController.swift

Replace the contents of `ShareViewController.swift` with the code from `ShareViewController.swift` in the project root.

## Step 3.1: Add Native Bridge Files

Add these files to your main app target (lai):

1. Copy `ShareExtensionBridge.swift` to the `ios/lai/` directory
2. Copy `ShareExtensionBridge.m` to the `ios/lai/` directory
3. In Xcode, right-click on the lai folder and select "Add Files to lai"
4. Select both files and make sure they're added to the lai target (not the ShareExtension target)

## Step 4: Add App Groups (Optional but Recommended)

1. Select the main app target (lai)
2. Go to "Signing & Capabilities"
3. Click "+ Capability" and add "App Groups"
4. Add an app group: `group.com.piripimartin.dew`
5. Repeat for the ShareExtension target

## Step 5: Build and Test

1. Select the ShareExtension scheme
2. Build and run on a device (not simulator for share extension testing)
3. Open TikTok or any app with a share button
4. Tap share and look for your app in the share sheet

## Troubleshooting

- If the app doesn't appear in share sheet, check the Info.plist configuration
- Make sure both targets have the same team and certificates
- Share extensions only work on physical devices, not simulators
- Check that the bundle identifier follows the pattern: `main.app.bundle.id.ShareExtension`

## Testing the Integration

1. Share a TikTok URL from the TikTok app
2. Select your app from the share sheet
3. Your app should open and display the shared content notification
4. The shared content should be available in the ShareContext
