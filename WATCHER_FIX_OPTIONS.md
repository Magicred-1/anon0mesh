# Alternative Solution: Clean Up Root node_modules

The real problem is you have **TWO node_modules** folders being watched:
- `/home/m4gicred1/Documents/coding/anon0mesh/node_modules` (root)
- `/home/m4gicred1/Documents/coding/anon0mesh/v2/node_modules` (v2)

## Option 1: Remove root node_modules (Recommended)

```bash
# Go to root
cd /home/m4gicred1/Documents/coding/anon0mesh

# Remove root node_modules (not needed)
rm -rf node_modules

# Only work from v2/ directory
cd v2
npx expo start
```

## Option 2: Increase watchers to 1M

```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/v2
./fix-watchers.sh
```

## Option 3: Use Watchman (Facebook's file watcher)

```bash
# Install watchman
sudo apt-get install watchman  # or
brew install watchman  # on macOS

# Then start expo
npx expo start
```

## Recommended Action

**Delete the root node_modules** since all your development is in `v2/`:

```bash
rm -rf /home/m4gicred1/Documents/coding/anon0mesh/node_modules
rm -rf /home/m4gicred1/Documents/coding/anon0mesh/package-lock.json
```

This will cut your file count in half and should fix the issue immediately.
