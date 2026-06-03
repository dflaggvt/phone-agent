# Google Play Release Checklist

## Internal Test Track

Current target release:

- Track: Google Play internal testing.
- Package name: `com.phoneagent.app`.
- Version code: `2`.
- Version name: `0.1.1-internal`.
- Release artifact: `android/app/build/outputs/bundle/release/app-release.aab`.
- Release notes source: `docs/play-release-notes/internal-test-v0.1.1.md`.

Required before first internal test upload:

- Release app signing configured. Status: local PKCS12 upload key created outside the repo and ignored signing properties configured.
- Version code incremented. Status: complete for `versionCode 2`.
- App bundle generated with `./gradlew bundleRelease`. Status: signed release AAB produced at `android/app/build/outputs/bundle/release/app-release.aab`.
- Firebase Android app uses the production package name.
- Crashlytics enabled in non-debug builds.
- Privacy policy URL available. Status: draft exists in `docs/privacy-policy-draft.md`; must be hosted before Play submission.
- Support email available.
- Data Safety answers drafted. Status: draft exists in `docs/play-store-listing.md`.
- Store listing draft created. Status: draft exists in `docs/play-store-listing.md`.
- Internal tester list configured.

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

## Play Console Upload Steps

1. Create or open the app in Google Play Console.
2. Choose package name `com.phoneagent.app`.
3. Enable Play App Signing.
4. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Internal testing.
5. Paste release notes from `docs/play-release-notes/internal-test-v0.1.1.md`.
6. Add internal testers.
7. Complete App content:
   - Privacy policy URL.
   - Data Safety.
   - Ads: no ads.
   - App access: login required, include tester account instructions.
   - Target audience: adults, not designed for children.
   - Financial features: app collects payment method through Stripe-hosted flow for usage billing.
8. Submit internal test release.

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
