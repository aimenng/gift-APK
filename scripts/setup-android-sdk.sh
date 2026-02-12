#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
CMDLINE_VERSION="11076708"
TOOLS_ZIP="commandlinetools-linux-${CMDLINE_VERSION}_latest.zip"
TOOLS_URL="https://dl.google.com/android/repository/${TOOLS_ZIP}"

mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools"

if [ ! -d "${ANDROID_SDK_ROOT}/cmdline-tools/latest" ]; then
  echo "[Android SDK] downloading cmdline-tools..."
  TMP_ZIP="$(mktemp)"
  curl -L "${TOOLS_URL}" -o "${TMP_ZIP}"
  TMP_DIR="$(mktemp -d)"
  unzip -q "${TMP_ZIP}" -d "${TMP_DIR}"
  mv "${TMP_DIR}/cmdline-tools" "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
fi

export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"

yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

cat > android/local.properties <<LOCAL
sdk.dir=${ANDROID_SDK_ROOT}
LOCAL

echo "[Android SDK] done."
echo "- ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}"
echo "- local.properties generated at android/local.properties"
