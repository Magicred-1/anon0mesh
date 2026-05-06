const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const SERVICE_KT = (pkg) => `package ${pkg}

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class LxmfForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Mesh Network", NotificationManager.IMPORTANCE_LOW)
            ch.description = "Keeps anonmesh connected in background"
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
            return START_NOT_STICKY
        }
        val pi = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("anonmesh")
            .setContentText("Mesh network active")
            .setSmallIcon(R.drawable.notification_icon)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notification)
        }
        return START_STICKY
    }

    companion object {
        const val CHANNEL_ID  = "lxmf_bg_svc"
        const val NOTIF_ID    = 2001
        const val ACTION_STOP = "lxmf.STOP_SERVICE"
    }
}
`;

const MODULE_KT = (pkg) => `package ${pkg}

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LxmfServiceModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "LxmfServiceModule"

    @ReactMethod
    fun start() {
        val intent = Intent(ctx, LxmfForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }

    @ReactMethod
    fun stop() {
        ctx.startService(
            Intent(ctx, LxmfForegroundService::class.java).apply {
                action = LxmfForegroundService.ACTION_STOP
            }
        )
    }
}
`;

const PACKAGE_KT = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LxmfServicePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(LxmfServiceModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

function withAndroidForegroundService(config) {
  const pkg     = config.android?.package ?? 'com.app';
  const pkgPath = pkg.replace(/\./g, '/');

  // 1. Permissions + service in AndroidManifest
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const perms = manifest['uses-permission'];
    const addPerm = (name) => {
      if (!perms.some((p) => p.$['android:name'] === name))
        perms.push({ $: { 'android:name': name } });
    };
    addPerm('android.permission.FOREGROUND_SERVICE');
    addPerm('android.permission.FOREGROUND_SERVICE_DATA_SYNC');

    const app = manifest.application[0];
    if (!app.service) app.service = [];
    const fqn = `${pkg}.LxmfForegroundService`;
    if (!app.service.some((s) => s.$['android:name'] === fqn)) {
      app.service.push({
        $: {
          'android:name':                  fqn,
          'android:foregroundServiceType': 'dataSync',
          'android:exported':              'false',
        },
      });
    }
    return cfg;
  });

  // 2. Write Kotlin files + register package in MainApplication
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const root   = cfg.modRequest.platformProjectRoot;
      const srcDir = path.join(root, 'app/src/main/java', pkgPath);
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'LxmfForegroundService.kt'), SERVICE_KT(pkg));
      fs.writeFileSync(path.join(srcDir, 'LxmfServiceModule.kt'),     MODULE_KT(pkg));
      fs.writeFileSync(path.join(srcDir, 'LxmfServicePackage.kt'),    PACKAGE_KT(pkg));

      // Patch MainApplication.kt — insert package registration
      const mainAppPath = path.join(srcDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, 'utf8');
        if (!src.includes('LxmfServicePackage')) {
          src = src.replace(
            /PackageList\(this\)\.packages\.apply\s*\{[^}]*\}/,
            (match) => match.replace(/(\}\s*)$/, '  add(LxmfServicePackage())\n$1'),
          );
          fs.writeFileSync(mainAppPath, src);
        }
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidForegroundService;
