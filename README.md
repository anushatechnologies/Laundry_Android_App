# 🧺 LaundryFresh - Customer Mobile App

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~57.0.18-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)

Professional on-demand laundry service mobile application for Android and iOS.

## 📱 Features

### Core Services
- 🏠 **Wash & Fold** - Regular laundry service
- 🔥 **Wash & Iron** - Premium pressing service  
- ⚡ **Express Service** - Same-day delivery
- 👔 **Dry Cleaning** - Professional garment care
- 🏢 **Commercial Laundry** - Bulk orders for businesses

### Customer Features
- ✅ Real-time order tracking with live GPS
- 💳 Multiple payment options (Razorpay integration)
- 📍 Multiple delivery addresses
- 🎟️ Coupon & discount system
- 👑 Monthly subscription plans
- 💬 **Live chat support with agents** (WebSocket-based)
- 📦 Order history & re-ordering
- ⭐ Wishlist & favorites
- 🔔 Push notifications
- 🎯 Smart pricing calculator
- 🗺️ Hub locator with distance calculation

### Live Chat Support
- Real-time messaging with support agents
- Typing indicators
- Read receipts
- Message history
- Quick reply buttons
- WhatsApp escalation
- Connection status monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.x
- npm or yarn
- Expo CLI
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/anushatechnologies/Laundry_Android_App.git
cd Laundry_Android_App
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Create a `.env` file or update `src/lib/config.ts`:
```typescript
export const API_BASE_URL = 'https://your-backend-api.com/api';
```

4. **Start development server:**
```bash
npm start
```

5. **Run on device:**
```bash
# Android
npm run android

# iOS (macOS only)
npm run ios
```

## 📦 Building APK/AAB

### Development Build

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure build:**
```bash
eas build:configure
```

4. **Build APK (for testing):**
```bash
eas build --platform android --profile preview
```

5. **Build AAB (for Play Store):**
```bash
eas build --platform android --profile production
```

### Local Build (Without EAS)

1. **Generate Android project:**
```bash
npx expo prebuild --platform android
```

2. **Open in Android Studio:**
```bash
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## 🔐 Android Signing Configuration

### Create Keystore

```bash
keytool -genkey -v -keystore laundryfresh-release.keystore -alias laundryfresh -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Signing (android/app/build.gradle)

```gradle
android {
    signingConfigs {
        release {
            storeFile file('laundryfresh-release.keystore')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'laundryfresh'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**⚠️ IMPORTANT:** Never commit keystores or passwords to Git! Use environment variables or GitHub Secrets.

## 🏗️ Project Structure

```
mobile-customer/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── BannerCarousel.tsx
│   │   ├── PromotionsSection.tsx
│   │   └── ...
│   ├── context/             # React Context providers
│   │   └── AppContext.tsx
│   ├── lib/                 # Utilities & services
│   │   ├── api.ts          # REST API client
│   │   ├── chatSocket.ts   # WebSocket chat service
│   │   ├── config.ts       # App configuration
│   │   └── ...
│   ├── screens/             # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── BookScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   ├── LiveChatSupportScreen.tsx
│   │   └── ...
│   ├── services/            # Business logic services
│   │   └── location/
│   ├── types/               # TypeScript type definitions
│   │   └── domain.ts
│   └── ui/                  # UI components & theme
│       ├── components/
│       ├── theme.ts
│       └── ...
├── app.json                 # Expo configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── README.md
```

## 🔧 Configuration

### Backend API
Update `src/lib/config.ts`:
```typescript
export const API_BASE_URL = 'https://api.laundryfresh.com/api';
```

### Firebase (for authentication)
Add `google-services.json` for Android:
```
android/app/google-services.json
```

### Razorpay (for payments)
Update your Razorpay key in the code:
```typescript
const razorpayKey = 'YOUR_RAZORPAY_KEY';
```

## 📱 App Permissions

The app requires these Android permissions:
- `ACCESS_FINE_LOCATION` - For delivery address & hub locator
- `INTERNET` - API calls & WebSocket
- `CAMERA` - Profile photo upload
- `READ_EXTERNAL_STORAGE` - Image selection
- `RECEIVE_BOOT_COMPLETED` - Push notifications
- `VIBRATE` - Notification alerts

## 🎨 UI/UX Features

- **Modern Design:** LaundryFresh brand colors (Orange #F97316, warm tones)
- **Smooth Animations:** React Native Reanimated
- **Gradients:** Expo Linear Gradient
- **Icons:** MaterialCommunityIcons
- **Responsive:** Works on all screen sizes
- **Dark Mode:** Coming soon

## 🌐 Backend Integration

### Required Backend Endpoints

```
Authentication:
POST   /customers/send-otp
POST   /customers/verify-otp
POST   /customers/firebase-login

Services:
GET    /services/catalog
GET    /services/cloth-types
GET    /services/masters
GET    /services/pricing-matrix

Orders:
GET    /orders?customerId=X
POST   /orders
GET    /orders/:id/track

Payments:
POST   /payments/create-order
POST   /payments/verify-signature

Subscriptions:
GET    /subscriptions/plans
POST   /subscriptions/purchase

Chat Support:
GET    /chat/rooms
POST   /chat/rooms
GET    /chat/messages/:roomId
POST   /chat/messages
WebSocket: ws://your-server.com
```

## 🧪 Testing

### Run TypeScript Check
```bash
npm run typecheck
```

### Test on Expo Go
```bash
npm start
# Scan QR code with Expo Go app
```

### Test Production Build
```bash
eas build --platform android --profile preview
# Download and install APK on device
```

## 📦 Dependencies

### Core
- React Native 0.86.3
- Expo ~57.0.18
- TypeScript ~5.9.3

### UI
- @expo/vector-icons
- expo-linear-gradient
- react-native-paper
- nativewind

### Firebase
- @react-native-firebase/app
- @react-native-firebase/auth

### Services
- expo-location
- expo-notifications
- react-native-razorpay
- socket.io-client (for live chat)

## 🚢 Deployment

### Play Store Checklist

- [ ] Update version in `app.json`
- [ ] Generate signed AAB
- [ ] Create store listing
- [ ] Add screenshots (1024x500, 512x512 icon)
- [ ] Write description
- [ ] Set up pricing & distribution
- [ ] Submit for review

### App Store Checklist (iOS)

- [ ] Update version in `app.json`
- [ ] Generate signed IPA
- [ ] Create App Store listing
- [ ] Add screenshots & icon
- [ ] Fill out compliance forms
- [ ] Submit for review

## 🔗 Related Repositories

- [Backend API](https://github.com/anushatechnologies/laundry-backend)
- [Web Admin Dashboard](https://github.com/anushatechnologies/laundry-admin)
- [Agent Web Dashboard](https://github.com/anushatechnologies/laundry-agent)

## 📄 License

Proprietary - © 2026 Anusha Technologies. All rights reserved.

## 👥 Team

- **Company:** Anusha Technologies
- **Product:** LaundryFresh
- **Type:** On-Demand Laundry Service Platform

## 📞 Support

For technical issues:
- Email: support@anushatechnologies.com
- Website: https://laundryfresh.anushatechnologies.com

## 🎯 Roadmap

- [ ] Dark mode support
- [ ] Multi-language support (Hindi, Tamil, Telugu)
- [ ] Apple Pay integration
- [ ] Google Pay UPI integration
- [ ] Loyalty points system
- [ ] Referral rewards
- [ ] In-app reviews & ratings
- [ ] Customer chat history archive

## 🙏 Acknowledgments

Built with:
- React Native & Expo
- Socket.IO for real-time chat
- Razorpay for payments
- Firebase for authentication
- AWS S3 for image storage

---

**LaundryFresh** - Professional Laundry Care, Delivered to Your Doorstep 🧺✨
