#!/bin/bash

# Script to fix react-native-libsodium XCFramework issue
# Reference: react-native-libsodium-issue.md

# In Linux environments (e.g., Ubuntu CI agents), the `xcodebuild` command doesn't exist.
# In these cases, we just skip XCFramework creation without failing the job.
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "ℹ️ xcodebuild not found. Skipping Clibsodium.xcframework creation (non-macOS environment)."
  exit 0
fi

LIBSODIUM_PATH="node_modules/react-native-libsodium/libsodium/build/libsodium-apple"
XCFRAMEWORK_PATH="$LIBSODIUM_PATH/Clibsodium.xcframework"

if [ -d "$XCFRAMEWORK_PATH" ]; then
  exit 0
fi

if [ ! -f "$LIBSODIUM_PATH/ios/lib/libsodium.a" ]; then
  exit 0
fi

echo "🔧 Creating Clibsodium.xcframework..."

xcodebuild -create-xcframework \
  -library "$LIBSODIUM_PATH/ios/lib/libsodium.a" \
  -headers "$LIBSODIUM_PATH/ios/include" \
  -library "$LIBSODIUM_PATH/ios-simulators/lib/libsodium.a" \
  -headers "$LIBSODIUM_PATH/ios-simulators/include" \
  -output "$XCFRAMEWORK_PATH"

if [ $? -eq 0 ]; then
  echo "✅ Clibsodium.xcframework created successfully!"
else
  echo "❌ Error creating Clibsodium.xcframework"
  exit 1
fi
