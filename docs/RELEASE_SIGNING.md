# Release signing

RECLAIM uses **Play App Signing**: we sign uploads with our *upload key*, and Google re-signs the app for users with its *app signing key*, which Google keeps.

## Where the upload key is
Kept outside the repo on the developer's machine. It must never be committed, emailed or pasted into chat.

| | |
|---|---|
| Keystore | `%USERPROFILE%\.reclaim-keys\reclaim-upload.jks` (PKCS12, RSA 4096) |
| Alias | `reclaim-upload` |
| Password | in `%USERPROFILE%\.reclaim-keys\README-BACK-THIS-UP.txt` |
| Valid | 2026-11-09 to 2054-03-27 |
| Gradle wiring | `%USERPROFILE%\.gradle\gradle.properties` (`RECLAIM_UPLOAD_*`), read by `mobile/android/app/build.gradle` |

**Back up** the `.jks` and the README file together, off this computer (a password manager is best). A lost upload key can be reset through Play Console support, but that takes days.

On a machine without these properties, release builds fall back to the debug key and Gradle prints a warning. Play rejects those uploads.

## Fingerprints (public, safe to share)
Needed for the Google sign-in OAuth clients.

| Key | SHA-1 |
|---|---|
| Debug (`mobile/android/app/debug.keystore`, dev builds) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Upload (`reclaim-upload`, local release builds) | `58:C1:2C:87:7C:08:1A:37:EA:C6:FB:85:C4:40:8A:CF:06:7F:81:59` |
| Play app signing (store installs) | Play Console > Test and release > App integrity, after the first upload |

Upload SHA-256: `F3:4B:8E:FA:93:F6:66:5A:87:4F:DF:02:D4:57:59:52:69:9C:0B:A3:17:16:A0:4F:55:D1:87:22:B4:81:53:1D`

## Build
```powershell
cd mobile\android
.\gradlew.bat bundleRelease     # for Play: app\build\outputs\bundle\release\app-release.aab
.\gradlew.bat assembleRelease   # for sideloading: app\build\outputs\apk\release\app-release.apk
```
Check the signer: `apksigner verify --print-certs app\build\outputs\apk\release\app-release.apk` should show `CN=RECLAIM, O=RECLAIM`.

A phone with a debug-signed RECLAIM must uninstall it before installing a release-signed one (different signature). That wipes the app's local data.
