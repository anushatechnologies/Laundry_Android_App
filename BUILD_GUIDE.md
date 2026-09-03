# 🏗️ LaundryFresh Android APK Build Guide

Complete step-by-step guide to build production-ready APK files for your friend.

## 📋 Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   
2. **Git**
   - Download: https://git-scm.com/

3. **Expo CLI**
   ```bash
   npm install -g expo-cli eas-cli
   ```

4. **Android Studio** (Optional, for local builds)
   - Download: https://developer.android.com/studio

## 🚀 Method 1: Build with Expo EAS (Recommended)

### Step 1: Setup EAS Account

1. **Create Expo account:**
   - Go to: https://expo.dev/signup
   - Sign up with email

2. **Login to EAS CLI:**
   ```bash
   eas login
   ```

### Step 2: Configure Project

1. **Initialize EAS:**
   ```bash
   cd Laundry_Android_App
   eas build:configure
   ```

2. **Update app.json:**
   ```json
   {
     "expo": {
       "name": "LaundryFresh",
       "slug": "laundryfresh-customer",
       "version": "1.0.0",
       "android": {
         "package": "com.anushatechnologies.laundryfresh",
         "versionCode": 1,
         "adaptiveIcon": {
           "foregroundImage": "./assets/adaptive-icon.png",
           "backgroundColor": "#F97316"
         },
         "permissions": [
           "ACCESS_FINE_LOCATION",
           "CAMERA",
           "READ_EXTERNAL_STORAGE"
         ]
       }
     }
   }
   ```

### Step 3: Build APK (Development/Testing)

```bash
# For internal testing (generates APK)
eas build --platform android --profile preview
```

**Build will take 10-20 minutes.** You'll get a download link when done.

### Step 4: Build AAB (Google Play Store)

```bash
# For Play Store submission (generates AAB)
eas build --platform android --profile production
```

### Step 5: Download APK

After build completes:
1. EAS will provide a download URL
2. Download the APK file
3. Transfer to your friend's Android device
4. Install and test

## 🔧 Method 2: Local Build (Without EAS)

### Step 1: Generate Android Project

```bash
npx expo prebuild --platform android
```

This creates the `android/` folder.

### Step 2: Create Signing Keystore

```bash
# Navigate to android/app
cd android/app

# Generate keystore
keytool -genkey -v -keystore laundryfresh-release.keystore -alias laundryfresh -keyalg RSA -keysize 2048 -validity 10000
```

**Save these details securely:**
- Keystore password: [YOUR_PASSWORD]
- Alias: laundryfresh
- Key password: [YOUR_PASSWORD]

### Step 3: Configure Signing

Create `android/gradle.properties` and add:
```properties
MYAPP_UPLOAD_STORE_FILE=laundryfresh-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=laundryfresh
MYAPP_UPLOAD_STORE_PASSWORD=YOUR_STORE_PASSWORD
MYAPP_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

Update `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 4: Build APK

```bash
cd android
./gradlew assembleRelease
```

**APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

### Step 5: Build AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

**AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`

## 📱 Installing APK on Android Device

### Method 1: Direct Install

1. Copy APK to device via USB or cloud
2. Open APK file on device
3. Allow "Install from Unknown Sources" if prompted
4. Click Install
5. Open LaundryFresh app

### Method 2: ADB Install

```bash
adb install app-release.apk
```

## 🎨 Customizing App Before Build

### 1. Change App Name
Edit `app.json`:
```json
{
  "expo": {
    "name": "LaundryFresh Customer"
  }
}
```

### 2. Change App Icon
Replace files in `assets/`:
- `icon.png` (1024x1024)
- `adaptive-icon.png` (1024x1024)
- `splash.png` (1284x2778)

### 3. Change Package Name
Edit `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.laundryfresh"
    }
  }
}
```

### 4. Update Backend URL
Edit `src/lib/config.ts`:
```typescript
export const API_BASE_URL = 'https://your-backend.com/api';
```

### 5. Update Colors/Theme
Edit `src/ui/theme.ts`:
```typescript
export const COLORS = {
  primary: '#F97316',
  secondary: '#1C0B18',
  // ... other colors
};
```

## 🔐 Managing Signing Certificates

### Backup Keystore (CRITICAL!)

```bash
# Backup your keystore file
cp android/app/laundryfresh-release.keystore ~/Backups/

# Store passwords in password manager:
# - Keystore password
# - Key alias
# - Key password
```

**⚠️ WARNING:** If you lose your keystore, you cannot update your app on Play Store!

### Generate New Keystore (if lost)

```bash
keytool -genkey -v -keystore new-keystore.keystore -alias laundryfresh -keyalg RSA -keysize 2048 -validity 10000
```

You'll need to upload as a new app to Play Store.

## 📦 File Sizes

Typical build sizes:
- **APK:** 40-60 MB
- **AAB:** 35-50 MB (smaller, Google Play optimizes)

To reduce size:
- Enable ProGuard (already configured)
- Remove unused dependencies
- Optimize images
- Use AAB instead of APK

## 🐛 Common Build Issues

### Issue: "Unable to locate Android SDK"
**Solution:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### Issue: "Keystore not found"
**Solution:** Verify keystore path in `android/app/build.gradle`

### Issue: "Build failed - out of memory"
**Solution:** Increase Gradle memory in `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=1024m
```

### Issue: "APK too large"
**Solution:** Use AAB format instead:
```bash
./gradlew bundleRelease
```

### Issue: "Duplicate class error"
**Solution:** Clean build:
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

## 📤 Sharing APK with Your Friend

### Option 1: Google Drive
1. Upload APK to Google Drive
2. Set sharing to "Anyone with link"
3. Share link with friend

### Option 2: Direct Transfer
1. Connect device via USB
2. Copy APK to phone's Download folder
3. Friend opens Downloads → taps APK → installs

### Option 3: Firebase App Distribution
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Upload to Firebase
firebase appdistribution:distribute app-release.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups testers
```

## 🏪 Publishing to Google Play Store

### Step 1: Create Play Console Account
- Go to: https://play.google.com/console
- Pay $25 one-time fee
- Complete developer profile

### Step 2: Create App Listing
- App name: LaundryFresh
- Category: Lifestyle
- Content rating: Everyone
- Privacy policy URL

### Step 3: Upload AAB
1. Production → Create new release
2. Upload `app-release.aab`
3. Add release notes
4. Submit for review

### Step 4: Store Listing Assets
Required:
- Icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Screenshots: At least 2 (16:9 or 9:16)
- Short description: 80 chars max
- Full description: 4000 chars max

### Step 5: Pricing & Distribution
- Free or Paid
- Select countries
- Content rating questionnaire
- Target age groups

### Step 6: Submit for Review
Review takes 1-7 days typically.

## 🧪 Testing Checklist

Before sending APK to friend:

- [ ] App installs successfully
- [ ] Login/signup works
- [ ] Can browse services
- [ ] Can add items to cart
- [ ] Can place order (test mode)
- [ ] Payment gateway works
- [ ] Live chat connects
- [ ] Notifications work
- [ ] Location permissions work
- [ ] No crashes on back button
- [ ] Works on Android 8+ devices

## 🔄 Updating the App

### Version Update
1. Update `app.json`:
   ```json
   {
     "version": "1.0.1",
     "android": {
       "versionCode": 2
     }
   }
   ```

2. Rebuild APK/AAB

3. Upload to Play Store as update

Users will be notified of update automatically.

## 📊 Analytics & Monitoring

### Add Firebase Analytics
```bash
npm install @react-native-firebase/analytics
```

Track events:
```typescript
import analytics from '@react-native-firebase/analytics';

await analytics().logEvent('order_placed', {
  orderId: 'ORDER123',
  amount: 500
});
```

### Add Crashlytics
```bash
npm install @react-native-firebase/crashlytics
```

Automatically reports crashes.

## 🎯 Build Commands Quick Reference

```bash
# EAS Builds
eas build --platform android --profile preview     # APK (testing)
eas build --platform android --profile production  # AAB (Play Store)

# Local Builds
cd android && ./gradlew assembleRelease           # APK
cd android && ./gradlew bundleRelease             # AAB
cd android && ./gradlew clean                      # Clean build

# Install
adb install app-release.apk                       # Install via ADB
adb uninstall com.anushatechnologies.laundryfresh # Uninstall

# Check
keytool -list -v -keystore laundryfresh-release.keystore  # Verify keystore
```

## 📧 Support

If you encounter issues:
1. Check build logs for errors
2. Search error message on Google
3. Check Expo forums: https://forums.expo.dev/
4. Contact: support@anushatechnologies.com

---

**Good luck with your build!** 🚀

Your friend will love the LaundryFresh app! 🧺✨
