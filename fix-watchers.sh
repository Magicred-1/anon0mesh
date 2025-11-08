#!/bin/bash

# Fix ENOSPC: System limit for number of file watchers reached
# This script increases the inotify file watcher limit for Linux

echo "Current file watcher limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo ""
echo "Increasing file watcher limit to 1048576 (1M)..."

# Temporary fix (until reboot)
sudo sysctl fs.inotify.max_user_watches=1048576
sudo sysctl -p

# Permanent fix (remove old entries first)
echo "Making change permanent..."
sudo sed -i '/fs.inotify.max_user_watches/d' /etc/sysctl.conf
echo fs.inotify.max_user_watches=1048576 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

echo ""
echo "New file watcher limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo ""
echo "✅ Done! You can now run: npx expo start"
