import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = join(
  process.cwd(),
  'node_modules',
  '@magicred-1',
  'react-native-lxmf',
  'android',
  'build.gradle.kts'
);

if (!existsSync(target)) {
  process.exit(0);
}

const original = readFileSync(target, 'utf8');
let patched = original
  .replace(
    /^\s*versionCode\s*=\s*.+$/gm,
    '        javaClass.methods.firstOrNull { it.name == "setVersionCode" }?.invoke(this, 1)'
  )
  .replace(
    /^\s*versionName\s*=\s*.+$/gm,
    '        javaClass.methods.firstOrNull { it.name == "setVersionName" }?.invoke(this, "0.1.0")'
  );

if (!patched.includes('setVersionCode')) {
  patched = patched.replace(
    /defaultConfig\s*\{\s*\n(\s*minSdk\s*=\s*24\s*\n)/m,
    'defaultConfig {\n$1        javaClass.methods.firstOrNull { it.name == "setVersionCode" }?.invoke(this, 1)\n        javaClass.methods.firstOrNull { it.name == "setVersionName" }?.invoke(this, "0.1.0")\n'
  );
}

patched = patched
  .replace(/sourceCompatibility\s*=\s*JavaVersion\.VERSION_11/g, 'sourceCompatibility = JavaVersion.VERSION_17')
  .replace(/targetCompatibility\s*=\s*JavaVersion\.VERSION_11/g, 'targetCompatibility = JavaVersion.VERSION_17')
  .replace(/jvmTarget\s*=\s*"11"/g, 'jvmTarget = "17"');

if (patched !== original) {
  writeFileSync(target, patched);
  console.log('Patched @magicred-1/react-native-lxmf Android Gradle file');
}
