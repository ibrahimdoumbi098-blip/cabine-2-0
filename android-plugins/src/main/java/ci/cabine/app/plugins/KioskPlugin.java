package ci.cabine.app.plugins;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * KioskPlugin — Capacitor plugin pour le mode kiosque
 *
 * Fonctionnalités:
 *  - lockTask(): bloque l'app en mode kiosque (Android Task Pinning)
 *  - unlockTask(): déverrouille après vérification PIN (côté JS)
 *  - setImmersive(): masque barre nav + status bar (mode plein écran)
 *
 * Installation:
 *   Copier dans android/app/src/main/java/ci/cabine/app/plugins/
 *   Enregistrer dans MainActivity.java:
 *     add(KioskPlugin.class);
 *
 * Note: lockTask() complet nécessite Device Owner.
 *       En mode standard, utilise startLockTask() (Task Pinning avec confirmation user).
 *       Pour Device Owner silencieux, provisionner l'appareil via NFC ou QR code.
 */
@CapacitorPlugin(name = "KioskPlugin")
public class KioskPlugin extends Plugin {

    // ── Plein écran immersif ──────────────────────────────────────────────────
    @PluginMethod
    public void setImmersive(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController ctrl = activity.getWindow()
                    .getInsetsController();
                if (ctrl != null) {
                    if (enabled) {
                        ctrl.hide(WindowInsets.Type.systemBars());
                        ctrl.setSystemBarsBehavior(
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    } else {
                        ctrl.show(WindowInsets.Type.systemBars());
                    }
                }
            } else {
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                          | View.SYSTEM_UI_FLAG_FULLSCREEN
                          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                if (enabled) {
                    activity.getWindow().getDecorView().setSystemUiVisibility(flags);
                } else {
                    activity.getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_VISIBLE);
                }
            }
        });
        call.resolve();
    }

    // ── Verrouillage de tâche ─────────────────────────────────────────────────
    @PluginMethod
    public void lockTask(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            try {
                activity.startLockTask();
                JSObject ret = new JSObject();
                ret.put("locked", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("lockTask échoué: " + e.getMessage());
            }
        });
    }

    // ── Déverrouillage ────────────────────────────────────────────────────────
    @PluginMethod
    public void unlockTask(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            try {
                activity.stopLockTask();
                JSObject ret = new JSObject();
                ret.put("locked", false);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("unlockTask échoué: " + e.getMessage());
            }
        });
    }

    // ── Statut ────────────────────────────────────────────────────────────────
    @PluginMethod
    public void getLockStatus(PluginCall call) {
        ActivityManager am = (ActivityManager)
            getContext().getSystemService(Context.ACTIVITY_SERVICE);
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int mode = am.getLockTaskModeState();
            ret.put("locked", mode != ActivityManager.LOCK_TASK_MODE_NONE);
            ret.put("mode", mode); // 0=none, 1=locked, 2=pinned
        } else {
            ret.put("locked", false);
            ret.put("mode", 0);
        }
        call.resolve(ret);
    }
}
