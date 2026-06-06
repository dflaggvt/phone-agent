import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { google } from "googleapis";

const repoRoot = process.cwd();
const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.phoneagent.app";
const track = process.env.GOOGLE_PLAY_TRACK ?? "alpha";
const releaseStatus = process.env.GOOGLE_PLAY_RELEASE_STATUS ?? "draft";
const keyFile =
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY ??
  path.join(os.homedir(), ".phone-agent", "secrets", "google-play-publisher.json");
const aabPath =
  process.env.GOOGLE_PLAY_AAB_PATH ??
  path.join(repoRoot, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
const releaseNotesPath =
  process.env.GOOGLE_PLAY_RELEASE_NOTES_PATH ??
  path.join(repoRoot, "docs", "play-release-notes", "closed-test-v0.1.2-play.txt");
const dryRun = process.env.GOOGLE_PLAY_DRY_RUN === "1" || process.env.GOOGLE_PLAY_DRY_RUN === "true";

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function readReleaseNotes(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    throw new Error(`Release notes file is empty: ${filePath}`);
  }
  if (text.length > 500) {
    throw new Error(`Release notes must be 500 characters or fewer for Play Console. Current length: ${text.length}`);
  }
  return text;
}

requireFile(keyFile, "Google Play service account key");
requireFile(aabPath, "Android App Bundle");
requireFile(releaseNotesPath, "Google Play release notes");

const releaseNotes = readReleaseNotes(releaseNotesPath);
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const androidpublisher = google.androidpublisher({ version: "v3", auth });

let editId;

try {
  const edit = await androidpublisher.edits.insert({ packageName });
  editId = edit.data.id;
  if (!editId) {
    throw new Error("Google Play did not return an edit id.");
  }

  const tracks = await androidpublisher.edits.tracks.list({ packageName, editId });
  const trackNames = tracks.data.tracks?.map((candidate) => candidate.track).filter(Boolean) ?? [];
  if (!trackNames.includes(track)) {
    throw new Error(`Track '${track}' was not found. Available tracks: ${trackNames.join(", ") || "(none)"}`);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          packageName,
          track,
          releaseStatus,
          aabPath,
          releaseNotesPath,
          availableTracks: trackNames,
        },
        null,
        2,
      ),
    );
    await androidpublisher.edits.delete({ packageName, editId });
    process.exit(0);
  }

  const bundle = await androidpublisher.edits.bundles.upload(
    {
      packageName,
      editId,
      media: {
        mimeType: "application/octet-stream",
        body: fs.createReadStream(aabPath),
      },
    },
    { timeout: 300_000 },
  );
  const versionCode = bundle.data.versionCode;
  if (!versionCode) {
    throw new Error("Google Play did not return an uploaded bundle version code.");
  }

  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track,
    requestBody: {
      track,
      releases: [
        {
          name: "0.1.2 closed test",
          versionCodes: [String(versionCode)],
          status: releaseStatus,
          releaseNotes: [
            {
              language: "en-US",
              text: releaseNotes,
            },
          ],
        },
      ],
    },
  });

  const commit = await androidpublisher.edits.commit({ packageName, editId });
  console.log(
    JSON.stringify(
      {
        ok: true,
        packageName,
        track,
        releaseStatus,
        versionCode,
        editId,
        committed: Boolean(commit.data.id),
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (editId) {
    try {
      await androidpublisher.edits.delete({ packageName, editId });
    } catch {
      // Best-effort cleanup only; the original API error is more useful.
    }
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        packageName,
        track,
        message: error.message,
        code: error.code,
        errors: error.errors,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
