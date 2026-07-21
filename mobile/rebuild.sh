#!/bin/bash
set -e

# ── Environment ────────────────────────────────────────────────────────────────
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

PACKAGE="com.stockli.app"
APK="android/app/build/outputs/apk/debug/app-debug.apk"
MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Stockli Clean Rebuild"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Check device ────────────────────────────────────────────────────────────
echo ""
echo "▶ Checking device..."
DEVICE=$(adb devices | grep -E "emulator|device$" | head -1 | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  echo "✗ No device/emulator connected. Start one first."
  exit 1
fi
echo "✓ Device: $DEVICE"

# ── 2. Uninstall existing app ──────────────────────────────────────────────────
echo ""
echo "▶ Checking if $PACKAGE is installed..."
if adb -s "$DEVICE" shell pm list packages | grep -q "$PACKAGE"; then
  echo "  Found — uninstalling..."
  adb -s "$DEVICE" uninstall "$PACKAGE"
  echo "✓ Uninstalled"
else
  echo "✓ Not installed (clean slate)"
fi

# ── 3. Kill Metro if running ────────────────────────────────────────────────────
echo ""
echo "▶ Stopping Metro bundler..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true
sleep 1
echo "✓ Metro stopped"

# ── 4. Stop Next.js server ─────────────────────────────────────────────────────
echo ""
echo "▶ Stopping Next.js server (port 3001)..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1
echo "✓ Next.js stopped"

# ── 5. Restart Next.js server ──────────────────────────────────────────────────
echo ""
echo "▶ Starting Next.js server..."
cd "$(dirname "$MOBILE_DIR")"
npm run restart:all > /tmp/stockli-next.log 2>&1 &
echo "✓ Next.js starting in background (log: /tmp/stockli-next.log)"
sleep 3

# ── 6. Build APK ───────────────────────────────────────────────────────────────
echo ""
echo "▶ Building APK (this takes ~3-5 min)..."
cd "$MOBILE_DIR/android"
./gradlew assembleDebug --quiet
echo "✓ Build complete"

# ── 7. Install APK ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Installing APK..."
cd "$MOBILE_DIR"
adb -s "$DEVICE" install -r "$APK"
echo "✓ Installed"

# ── 8. Port forwarding ─────────────────────────────────────────────────────────
echo ""
echo "▶ Setting up port forwarding..."
adb -s "$DEVICE" reverse tcp:8081 tcp:8081
adb -s "$DEVICE" reverse tcp:3001 tcp:3001
echo "✓ Ports forwarded (8081, 3001)"

# ── 9. Start Metro ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting Metro bundler..."
cd "$MOBILE_DIR"
npx expo start --clear > /tmp/stockli-metro.log 2>&1 &
echo "✓ Metro starting (log: /tmp/stockli-metro.log)"
sleep 4

# ── 10. Launch app ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Launching Stockli on device..."
adb -s "$DEVICE" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 2>/dev/null
echo "✓ App launched"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ All done! Stockli is running."
echo "  Logs:"
echo "    Next.js → /tmp/stockli-next.log"
echo "    Metro   → /tmp/stockli-metro.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
