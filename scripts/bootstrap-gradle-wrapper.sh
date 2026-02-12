#!/usr/bin/env bash
set -euo pipefail

WRAPPER_JAR="android/gradle/wrapper/gradle-wrapper.jar"
WRAPPER_URL="https://raw.githubusercontent.com/gradle/gradle/v8.11.1/gradle/wrapper/gradle-wrapper.jar"

if [ -f "$WRAPPER_JAR" ]; then
  echo "[Gradle Wrapper] gradle-wrapper.jar already exists."
  exit 0
fi

mkdir -p "$(dirname "$WRAPPER_JAR")"
echo "[Gradle Wrapper] downloading gradle-wrapper.jar..."
curl -fsSL "$WRAPPER_URL" -o "$WRAPPER_JAR"
echo "[Gradle Wrapper] downloaded to $WRAPPER_JAR"
