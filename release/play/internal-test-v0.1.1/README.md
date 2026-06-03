# Phone Agent Internal Test Release 0.1.1

## Artifact

Build output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Copy for release packet:

```text
release/play/internal-test-v0.1.1/app-release-v0.1.1-internal.aab
```

Release packet zip:

```text
release/phone-agent-internal-test-v0.1.1.zip
```

Checksums:

- AAB SHA-256: `EF66BF5150F245CCBD71CB3CBF2C4FB1898D34A807567DE2A23CD34CB806F9A5`
- Upload certificate SHA-256: `28:8C:B8:0E:36:C1:26:95:47:0E:21:61:A7:C9:68:FE:F1:FB:93:9B:CC:3E:1E:CC:1B:2B:84:D3:A0:DE:54:EE`

## Play Console Track

- Track: Internal testing.
- Package: `com.phoneagent.app`.
- Version code: `2`.
- Version name: `0.1.1-internal`.

## Release Notes

Use:

```text
release/play/internal-test-v0.1.1/release-notes/en-US/default.txt
```

## Required Manual Play Console Fields

- Privacy policy URL: host `docs/privacy-policy-draft.md` content before submission.
- Support email: configure in Play Console.
- Data Safety: use `docs/play-store-listing.md` as the draft worksheet.
- App access: login required with phone-number sign-in; provide reviewer/tester instructions.
- Internal testers: add founder/operator tester emails.
- App signing: enable Play App Signing and upload the signed AAB.

## Internal QA Before Promoting

- Fresh install.
- Phone sign-in.
- Assistant naming.
- Billing setup.
- Assistant number assignment.
- Forwarding instructions.
- Inbound test call.
- Known caller behavior.
- Call detail.
- Transfer approval notification.
- Inline answer notification.
- Calendar status and create/update.
- Crashlytics non-sensitive test crash in a release-like build.
