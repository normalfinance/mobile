// Debug builds sign with OUR OWN keystore, not the React Native template's.
//
// Why: Android passkeys (and app links) trust an app by the SHA-256 of its
// signing key published in https://normalfinance.io/.well-known/assetlinks.json.
// The template `android/app/debug.keystore` is public — every Expo project
// ships the same one — so listing its fingerprint would let anyone's app
// claim to be io.normalfinance.app. `credentials/android-debug.keystore` is
// generated once per machine (keytool, see docs below), gitignored, and its
// fingerprint is what the web publishes for dev builds. Release builds get a
// proper upload key via EAS later.
//
// Generate (once):
//   keytool -genkeypair -keystore credentials/android-debug.keystore -alias normaldev \
//     -keyalg RSA -keysize 2048 -validity 10000 -storepass normaldev -keypass normaldev \
//     -dname "CN=Normal dev, O=Normal Finance, C=US"
// Fingerprint for assetlinks.json:
//   keytool -list -v -keystore credentials/android-debug.keystore -alias normaldev -storepass normaldev | grep SHA256

const fs = require("fs");
const path = require("path");
const { withAppBuildGradle } = require("expo/config-plugins");

const KEYSTORE = path.join(__dirname, "..", "credentials", "android-debug.keystore");

module.exports = function withDevKeystore(config) {
  return withAppBuildGradle(config, (c) => {
    if (!fs.existsSync(KEYSTORE)) return c; // no local keystore → template default (CI, fresh clones)
    const block = `        debug {
            storeFile file('${KEYSTORE}')
            storePassword 'normaldev'
            keyAlias 'normaldev'
            keyPassword 'normaldev'
        }`;
    c.modResults.contents = c.modResults.contents.replace(
      /        debug \{\n            storeFile file\('debug\.keystore'\)\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        \}/,
      block
    );
    return c;
  });
};
