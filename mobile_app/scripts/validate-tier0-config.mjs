import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const requiredAndroidPermissions = [
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_ADVERTISE",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
];

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function testAppJsonPermissions() {
  const appConfig = JSON.parse(readText("app.json"));
  const permissions = appConfig.expo?.android?.permissions ?? [];
  for (const permission of requiredAndroidPermissions) {
    assert.ok(
      permissions.includes(permission),
      `app.json android.permissions is missing ${permission}`,
    );
  }
}

function testForegroundServicePluginPermissions() {
  const pluginSource = readText("plugins/withAndroidForegroundService.js");
  for (const permission of requiredAndroidPermissions) {
    assert.match(
      pluginSource,
      new RegExp(`addPerm\\(['"]${permission.replaceAll(".", "\\.")}['"]\\)`),
      `withAndroidForegroundService.js is missing addPerm('${permission}')`,
    );
  }
  assert.match(pluginSource, /FOREGROUND_SERVICE_TYPE_DATA_SYNC/);
  assert.match(pluginSource, /'android:foregroundServiceType': 'dataSync'/);
}

function testEnvExample() {
  const envExample = readText(".env.example");
  assert.match(envExample, /^EXPO_PUBLIC_DEMO_MODE=false$/m);
  assert.match(envExample, /^EXPO_PUBLIC_SOLANA_RPC=$/m);
  assert.match(envExample, /EXPO_PUBLIC_ prefix are inlined at build time/);
}

testAppJsonPermissions();
testForegroundServicePluginPermissions();
testEnvExample();
console.log("Tier 0 config checks passed");
