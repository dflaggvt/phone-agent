# Phone Agent Android

Native Android control surface for the Phone Agent backend.

## Current scope

- Reads live call history from the deployed Cloud Run backend.
- Shows caller, summary, urgency, callback, follow-up, and transcript details.
- Uses Firebase Phone Auth for first-run account creation and mobile-number verification.
- Provides Verizon forwarding dial codes for the Phone Agent assistant number.
- Registers an Android FCM token after Firebase sign-in and receives privacy-safe push notifications for assistant events.
- Includes first-pass local rule toggles, transfer approvals, FCM-triggered live refresh, and deployment settings.

The production Android UI is Kotlin + Jetpack Compose. Persistent rules and the final Play promotion workflow are still pending. Push notifications use FCM data messages with private-safe payloads; the app does not run periodic notification polling. Contact sync is optional and only uploads minimal address-book identity data after the user grants Android Contacts permission.

## Release build

Release signing is configured from environment variables so keystores and passwords never enter source control:

- `PHONE_AGENT_KEYSTORE_PATH`
- `PHONE_AGENT_KEYSTORE_PASSWORD`
- `PHONE_AGENT_KEY_ALIAS`
- `PHONE_AGENT_KEY_PASSWORD`

For local release builds, the same keys may be placed in ignored `android/signing.properties`. Production CI should prefer managed secrets. Release builds fail fast if neither the environment variables nor `android/signing.properties` are present, because unsigned release bundles are not Play-ready.

The current local upload key is stored outside the repo under:

```text
%USERPROFILE%\.phone-agent\secrets\phone-agent-upload.p12
```

Build a closed-test app bundle:

```powershell
.\gradlew.bat bundleRelease
```

Output:

```text
app/build/outputs/bundle/release/app-release.aab
```

Before public launch, enroll this upload certificate with Google Play App Signing or replace it with the production upload key chosen for the Play account. Do not lose the upload key; future Play releases must use the same upload key unless Google Play key reset is used.

## Build

```powershell
$env:ANDROID_HOME = "C:\AndroidSDK"
$env:ANDROID_SDK_ROOT = "C:\AndroidSDK"
.\gradlew.bat assembleDebug
```

Firebase Android configuration is loaded only through `android/app/google-services.json` and the Google Services Gradle plugin. Do not add a manual Firebase config fallback or build-time Firebase env vars.

Debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Backend

The debug build points at:

```text
https://phone-agent-47585065917.us-central1.run.app
```

The Phone Agent number is:

```text
+1 (914) 359-3659
```
