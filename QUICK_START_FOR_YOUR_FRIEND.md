# 🚀 Quick Start Guide - LaundryFresh Android App

**For Your Friend** - Complete step-by-step guide to get the APK file ready!

## ✅ Code is Already on GitHub!

Repository: **https://github.com/anushatechnologies/Laundry_Android_App**

Your friend can now:
1. Clone the repository
2. Build the APK
3. Install on their Android device

---

## 📦 Option 1: Get Pre-Built APK (Easiest - Using EAS Build)

### Step 1: Install Required Tools

```bash
# Install Node.js (download from: https://nodejs.org/)
node --version  # Should show v18 or higher

# Install Expo CLI
npm install -g expo-cli eas-cli
```

### Step 2: Clone the Repository

```bash
git clone https://github.com/anushatechnologies/Laundry_Android_App.git
cd Laundry_Android_App
```

### Step 3: Install Dependencies

```bash
npm install
```

This will take 2-5 minutes to download all packages.

### Step 4: Login to Expo (Free Account)

```bash
# Create free account at: https://expo.dev/signup
eas login
```

### Step 5: Build APK

```bash
# Build APK for testing (takes 10-20 minutes)
eas build --platform android --profile preview
```

**During build, if asked:**
- "Generate a new Android Keystore?" → **Yes**
- EAS will handle everything automatically!

### Step 6: Download APK

After build completes, you'll get a download link like:
```
✔ Build finished
https://expo.dev/artifacts/eas/abc123.apk
```

**Download this APK file!**

### Step 7: Install on Android Phone

1. Transfer APK to phone via USB, email, or cloud
2. Open APK file on phone
3. Allow "Install from Unknown Sources" if prompted
4. Tap Install
5. Open LaundryFresh app!

**DONE!** ✨

---

## 🔧 Option 2: Build Locally (For Advanced Users)

### Step 1-3: Same as Option 1

### Step 4: Generate Android Project

```bash
npx expo prebuild --platform android
```

### Step 5: Build APK with Gradle

```bash
# On Windows
cd android
gradlew.bat assembleRelease

# On Mac/Linux
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🎨 Customization Before Building

### Change App Name
Edit `app.json`:
```json
{
  "expo": {
    "name": "LaundryFresh",
    "slug": "laundryfresh-customer"
  }
}
```

### Change Backend URL
Edit `src/lib/config.ts`:
```typescript
export const API_BASE_URL = 'https://your-backend-api.com/api';
```

### Change App Icon
Replace these files in `assets/` folder:
- `icon.png` (1024x1024 pixels)
- `adaptive-icon.png` (1024x1024 pixels)
- `splash.png` (1284x2778 pixels)

### Change App Colors
Edit `src/ui/theme.ts`:
```typescript
export const COLORS = {
  primary: '#F97316',  // Orange
  secondary: '#1C0B18', // Dark
};
```

---

## 📱 Features Your Friend Will See

### Customer App Features:
- ✅ Login/Signup with phone OTP
- ✅ Browse laundry services
- ✅ Add clothes to cart
- ✅ Select pickup address
- ✅ Choose time slot
- ✅ Make payment (Razorpay)
- ✅ Track order in real-time
- ✅ **Live chat with support agents**
- ✅ View order history
- ✅ Apply coupons
- ✅ Subscribe to monthly plans
- ✅ Add to wishlist
- ✅ Push notifications

### Live Chat Support:
- Real-time messaging
- Typing indicators
- Read receipts  
- Message history
- Quick reply buttons
- WhatsApp escalation

---

## 🔐 Android Keystore Information

### If You Built with EAS:
Expo automatically manages your keystore. You can download it from:
```bash
eas credentials
```

### If You Built Locally:
Your keystore is at: `android/app/laundryfresh-release.keystore`

**IMPORTANT:** 
- **Backup this keystore file!**
- **Save the passwords in a password manager!**
- **Without it, you cannot update the app on Play Store!**

Keystore details:
- File: `laundryfresh-release.keystore`
- Alias: `laundryfresh`
- Store Password: [You created this during keytool]
- Key Password: [You created this during keytool]

---

## 📤 Sharing the APK

### Method 1: Google Drive
1. Upload APK to Google Drive
2. Right-click → Get link → Anyone with link
3. Send link to your friend

### Method 2: Email
1. Compress APK to ZIP if too large
2. Email the file

### Method 3: Direct Transfer
1. Connect phone via USB
2. Copy APK to phone
3. Open APK and install

---

## ⚙️ Configuration Required

### Before Your Friend Uses the App:

1. **Backend API:** Must be running and accessible
   - Update `src/lib/config.ts` with backend URL
   - Default: `http://localhost:5000/api`
   - For production: `https://api.yourdomain.com/api`

2. **Firebase:** For authentication
   - Add `google-services.json` to `android/app/`
   - Get from: Firebase Console → Project Settings

3. **Razorpay:** For payments
   - Update Razorpay key in code
   - Get from: Razorpay Dashboard

---

## 🧪 Testing the App

### Test Checklist:
- [ ] App installs without errors
- [ ] Login with phone number works
- [ ] Can browse services
- [ ] Can add items to cart
- [ ] Can select delivery address
- [ ] Can choose time slot
- [ ] Payment screen opens (test mode)
- [ ] Live chat connects
- [ ] Notifications arrive
- [ ] App doesn't crash on back button

### Test Accounts:
Create a test customer account:
- Phone: +91 9876543210
- OTP: 123456 (if using test mode)

---

## 🏪 Publishing to Play Store (Optional)

### Requirements:
1. Google Play Developer Account ($25 one-time)
2. App icon (512x512 PNG)
3. Feature graphic (1024x500 PNG)
4. Screenshots (at least 2)
5. Privacy policy URL
6. App description

### Build AAB for Play Store:
```bash
# Instead of APK, build AAB
eas build --platform android --profile production

# Or locally:
cd android && ./gradlew bundleRelease
```

AAB file is smaller and Play Store optimizes it for different devices.

### Upload to Play Store:
1. Go to: https://play.google.com/console
2. Create app listing
3. Upload AAB file
4. Add screenshots and description
5. Submit for review

Review takes 1-7 days.

---

## 🐛 Common Issues & Solutions

### Issue: "Unable to find package"
**Solution:**
```bash
npm install
```

### Issue: "ANDROID_HOME not set"
**Solution:** Install Android Studio and set environment variable:
```bash
# Windows
set ANDROID_HOME=C:\Users\YourName\AppData\Local\Android\Sdk

# Mac/Linux
export ANDROID_HOME=$HOME/Library/Android/sdk
```

### Issue: "Build failed - out of memory"
**Solution:** Increase Node memory:
```bash
export NODE_OPTIONS=--max_old_space_size=4096
```

### Issue: "Keystore not found"
**Solution:** Generate new keystore:
```bash
keytool -genkey -v -keystore laundryfresh-release.keystore -alias laundryfresh -keyalg RSA -keysize 2048 -validity 10000
```

### Issue: "APK not installing"
**Solution:**
1. Enable "Install from Unknown Sources" in Android settings
2. Make sure APK is signed (it will be if built with EAS or release mode)
3. Try uninstalling old version first

---

## 📞 Support & Help

### Documentation:
- **README.md** - Complete app documentation
- **BUILD_GUIDE.md** - Detailed build instructions
- **LIVE_CHAT_SYSTEM_COMPLETE_GUIDE.md** - Chat system documentation

### Need Help?
- Check GitHub Issues
- Email: support@anushatechnologies.com
- Expo Forums: https://forums.expo.dev/

### Common Commands:
```bash
# Clone repository
git clone https://github.com/anushatechnologies/Laundry_Android_App.git

# Install dependencies
npm install

# Start development server
npm start

# Build APK with EAS
eas build --platform android --profile preview

# Build APK locally
cd android && ./gradlew assembleRelease

# Build AAB for Play Store
cd android && ./gradlew bundleRelease

# Install APK via ADB
adb install app-release.apk

# Check TypeScript
npm run typecheck
```

---

## 🎯 What Your Friend Gets

A complete, professional laundry service mobile app with:

- ✨ Modern, beautiful UI
- 🚀 Fast and responsive
- 💳 Integrated payments
- 📍 GPS tracking
- 💬 **Live chat support**
- 🔔 Push notifications
- 🎟️ Coupons & subscriptions
- 📱 Works on Android 8+

**All code is on GitHub and ready to build!** 🎊

---

## 🎁 Bonus: Update the App

When you make changes and want to send new APK:

1. Update version in `app.json`:
```json
{
  "version": "1.0.1",
  "android": {
    "versionCode": 2
  }
}
```

2. Commit changes to GitHub:
```bash
git add .
git commit -m "Update to version 1.0.1"
git push
```

3. Build new APK:
```bash
eas build --platform android --profile preview
```

4. Send new APK to your friend!

---

**Your friend now has everything they need to build and run the LaundryFresh app!** 🧺✨

**Good luck!** 🚀
