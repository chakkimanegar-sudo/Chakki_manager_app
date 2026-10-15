# Chakki Manager — Android APK / iOS build

This project is prepared as an Expo native WebView shell around the deployed Chakki Manager web app.

## Required before a release build

Set `EXPO_PUBLIC_DOMAIN` to the **HTTPS production/deployed domain** of the Chakki Manager web app.

Do not use a temporary preview/dev URL for a release APK; preview domains can expire or become unreachable.

Example:

```bash
EXPO_PUBLIC_DOMAIN=https://your-production-domain.example
```

## Android test APK

From `artifacts/chakki-mobile`:

```bash
npx eas login
npx eas build --platform android --profile apk
```

The `apk` profile produces an installable APK for testing/distribution.

## Android production

```bash
npx eas build --platform android --profile production
```

This produces an Android App Bundle (AAB) suitable for Play Store release.

## iOS

```bash
npx eas build --platform ios --profile production
```

An Apple Developer account is required for device/App Store distribution. TestFlight/App Store signing is handled by EAS.

## Compatibility target

- Android: API 24+ (Android 7.0+)
- iOS: 15.1+
- Android tablets: enabled
- iPad: enabled

The native wrapper does not promise every historical device/OS version; the targets above are the supported minimums.
