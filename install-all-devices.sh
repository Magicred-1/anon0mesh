#!/bin/bash
# Build and run app on all connected Android devices

# Get all connected devices
DEVICES=$(adb devices | grep -w "device" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo "❌ No devices connected"
    exit 1
fi

# Count devices
DEVICE_COUNT=$(echo "$DEVICES" | wc -l)

echo "📱 Found $DEVICE_COUNT connected device(s):"
echo "$DEVICES"
echo ""

if [ $DEVICE_COUNT -eq 1 ]; then
    # Single device - use expo run directly
    DEVICE_ID=$(echo "$DEVICES" | head -1)
    echo "🔨 Building and running on single device: $DEVICE_ID"
    npx expo run:android --device "$DEVICE_ID"
else
    # Multiple devices - build once, then install on all
    echo "🔨 Building APK for multiple devices..."
    npx expo run:android --no-install
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    
    echo ""
    echo "🔍 Finding built APK..."
    APK_PATH=$(find android/app/build/outputs/apk -name "*.apk" | grep -v "unaligned" | head -1)
    
    if [ -z "$APK_PATH" ]; then
        echo "❌ No APK found after build"
        exit 1
    fi
    
    echo "� Found APK: $APK_PATH"
    echo ""
    
    # Install on each device in parallel
    for DEVICE in $DEVICES; do
        (
            echo "📲 Installing on $DEVICE..."
            adb -s "$DEVICE" install -r "$APK_PATH"
            if [ $? -eq 0 ]; then
                echo "✅ Successfully installed on $DEVICE"
                # Launch the app
                adb -s "$DEVICE" shell am start -n host.exp.exponent/.experience.HomeActivity
                echo "🚀 Launched app on $DEVICE"
            else
                echo "❌ Failed to install on $DEVICE"
            fi
        ) &
    done
    
    # Wait for all installations to complete
    wait
    
    echo ""
    echo "🎉 Installation and launch complete on all $DEVICE_COUNT devices!"
fi
