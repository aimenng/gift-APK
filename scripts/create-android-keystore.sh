#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_PATH="${1:-android/app/release-keystore.jks}"
ALIAS="${2:-coupleconnection}"
STOREPASS="${3:-}"
KEYPASS="${4:-}"
VALIDITY_DAYS="${5:-3650}"
DNAME="${6:-CN=Couple Connection, OU=Mobile, O=Gifts, L=Shenzhen, ST=Guangdong, C=CN}"
STORE_TYPE="${7:-JKS}"

if [ -z "$STOREPASS" ]; then
  STOREPASS="$(openssl rand -base64 24 | tr -d '=+/\n' | cut -c1-24)"
  echo "[Keystore] storePassword not provided, generated a random one."
fi
if [ -z "$KEYPASS" ]; then
  KEYPASS="$(openssl rand -base64 24 | tr -d '=+/\n' | cut -c1-24)"
  echo "[Keystore] keyPassword not provided, generated a random one."
fi

mkdir -p "$(dirname "$KEYSTORE_PATH")"

keytool -genkeypair \
  -v \
  -storetype "$STORE_TYPE" \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -storepass "$STOREPASS" \
  -keypass "$KEYPASS" \
  -dname "$DNAME"

# storeFile is relative to android/ (rootProject.file resolution)
REL_STORE_FILE=$(KEYSTORE_PATH="$KEYSTORE_PATH" python - <<'PY'
import os
from pathlib import Path
keystore = Path(os.environ['KEYSTORE_PATH']).resolve()
android_dir = Path('android').resolve()
print(os.path.relpath(keystore, android_dir))
PY
)

cat > android/keystore.properties <<PROPS
storeFile=$REL_STORE_FILE
storePassword=$STOREPASS
keyAlias=$ALIAS
keyPassword=$KEYPASS
PROPS

echo "[Keystore] generated: $KEYSTORE_PATH"
echo "[Keystore] properties: android/keystore.properties"
echo "[Keystore] storeType: $STORE_TYPE"
echo "[Keystore] IMPORTANT: back up keystore + passwords securely."
