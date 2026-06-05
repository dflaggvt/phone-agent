# Google Play Release Checklist

## Closed Test Track

Current target release:

- Track: Google Play closed testing.
- Package name: `com.phoneagent.app`.
- Version code: `3`.
- Version name: `0.1.2-closed`.
- Release artifact: `android/app/build/outputs/bundle/release/app-release.aab`.
- Release notes source: `docs/play-release-notes/closed-test-v0.1.2.md`.

Required before first closed test upload:

- Release app signing configured. Status: local PKCS12 upload key created outside the repo and ignored signing properties configured.
- Version code incremented. Status: complete for `versionCode 3`.
- App bundle generated with `./gradlew bundleRelease`. Status: signed release AAB produced at `android/app/build/outputs/bundle/release/app-release.aab`.
- Release verification. Status: `:app:testReleaseUnitTest`, `:app:bundleRelease`, and `:app:lintRelease` passed for `versionCode 3`.
- Signature verification. Status: `jarsigner` verified the AAB signed by `Phone Agent Upload`; SHA-256 `349EEC876ADA03BBDF4C713F5CBD114EF0B83EBA487B118EB7B2AA62636A867A`.
- Firebase Android app uses the production package name.
- Crashlytics enabled in non-debug builds.
- Privacy policy URL available. Status: draft exists in `docs/privacy-policy-draft.md`; must be hosted before Play submission.
- Support email available.
- Data Safety answers drafted. Status: draft exists in `docs/play-store-listing.md`.
- Store listing draft created. Status: draft exists in `docs/play-store-listing.md`.
- Closed tester list configured.
- Google Play Developer API publishing credential configured if automation is desired. Status: not configured locally.

## Release Signing

The Android project supports release signing from environment variables:

- `PHONE_AGENT_KEYSTORE_PATH`
- `PHONE_AGENT_KEYSTORE_PASSWORD`
- `PHONE_AGENT_KEY_ALIAS`
- `PHONE_AGENT_KEY_PASSWORD`

Do not commit keystores or signing passwords to source control.

Generate an upload key locally:

```powershell
keytool -genkeypair `
  -v `
  -keystore "$env:USERPROFILE\.phone-agent\secrets\phone-agent-upload.p12" `
  -storetype PKCS12 `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000 `
  -alias phone-agent-upload
```

Then set:

```powershell
$env:PHONE_AGENT_KEYSTORE_PATH="$env:USERPROFILE\.phone-agent\secrets\phone-agent-upload.p12"
$env:PHONE_AGENT_KEYSTORE_PASSWORD="<password>"
$env:PHONE_AGENT_KEY_ALIAS="phone-agent-upload"
$env:PHONE_AGENT_KEY_PASSWORD="<password>"
```

Build:

```powershell
cd android
.\gradlew.bat bundleRelease
```

Expected output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

For this repository, the release signing file is expected to live outside source control. The current local machine setup places it under:

```text
C:\Users\Daryl Flagg\.phone-agent\secrets\phone-agent-upload.p12
```

The matching ignored local Gradle signing file lives under:

```text
C:\Users\Daryl Flagg\source\repos\phone-agent\android\signing.properties
```

Treat both files as production credentials. Back them up in a secure password manager or secret vault before using the key for Play Console upload signing.

## Play Console Closed Testing Upload Steps

1. Create or open the app in Google Play Console.
2. Choose package name `com.phoneagent.app`.
3. Enable Play App Signing.
4. Create or choose a closed testing track.
5. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Closed testing.
6. Paste release notes from `docs/play-release-notes/closed-test-v0.1.2.md`.
7. Add closed testers.
8. Complete App content:
   - Privacy policy URL.
   - Data Safety.
   - Ads: no ads.
   - App access: login required, include tester account instructions.
   - Target audience: adults, not designed for children.
   - Financial features: app collects payment method through Stripe-hosted flow for usage billing.
9. Submit closed test release.

## Internal QA Matrix

Minimum device checks:

- Fresh install.
- Sign up.
- Phone verification.
- Assistant naming.
- Billing setup in test mode.
- Assistant number assignment.
- Forwarding instructions.
- Test call.
- Call summary.
- Transfer approval notification.
- Inline answer notification.
- Expired request.
- Calendar connection.
- Calendar create/update.
- Topic creation and call attachment.

Pass criteria:

- `0` crashes.
- `0` raw provider names in consumer onboarding.
- `0` transcript/assistant note leaks in notifications.
- All blocking errors have user-recoverable copy.
