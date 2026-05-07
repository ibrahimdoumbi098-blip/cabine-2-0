package ci.cabine.app.plugins;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;

/**
 * SunmiPrinterPlugin — Capacitor plugin pour les terminaux Sunmi
 *
 * Pont JavaScript → SDK Sunmi AIDL
 * Compatible: Sunmi V1, V2, V2 Pro, T1, T2, P2
 *
 * Installation:
 *   Copier ce fichier dans android/app/src/main/java/ci/cabine/app/plugins/
 *   Enregistrer dans MainActivity.java:
 *     add(SunmiPrinterPlugin.class);
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {

    private SunmiPrinterService printerService = null;
    private boolean connected = false;

    private final InnerPrinterCallback callback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            printerService = service;
            connected = true;
        }
        @Override
        protected void onDisconnected() {
            printerService = null;
            connected = false;
        }
    };

    @Override
    public void load() {
        InnerPrinterManager.getInstance().bindService(getContext(), callback);
    }

    @Override
    protected void handleOnDestroy() {
        InnerPrinterManager.getInstance().unBindService(getContext(), callback);
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    @PluginMethod
    public void printerInit(PluginCall call) {
        if (!connected) { call.reject("Imprimante Sunmi non connectée"); return; }
        try {
            printerService.printerInit(null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    // ── Imprimer texte ────────────────────────────────────────────────────────
    @PluginMethod
    public void printText(PluginCall call) {
        if (!connected) { call.reject("Non connecté"); return; }
        String text = call.getString("text", "");
        try {
            printerService.printText(text, null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    // ── Taille police ─────────────────────────────────────────────────────────
    @PluginMethod
    public void setFontSize(PluginCall call) {
        if (!connected) { call.reject("Non connecté"); return; }
        int size = call.getInt("size", 18);
        try {
            printerService.setFontSize(size, null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    // ── Alignement (0=gauche, 1=centre, 2=droite) ────────────────────────────
    @PluginMethod
    public void setAlignment(PluginCall call) {
        if (!connected) { call.reject("Non connecté"); return; }
        int alignment = call.getInt("alignment", 0);
        try {
            printerService.setAlignment(alignment, null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    // ── Imprimer image base64 ─────────────────────────────────────────────────
    @PluginMethod
    public void printBitmap(PluginCall call) {
        if (!connected) { call.reject("Non connecté"); return; }
        String b64 = call.getString("base64", "");
        try {
            byte[] bytes  = Base64.decode(b64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            printerService.printBitmap(bitmap, null);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    // ── Couper le papier ─────────────────────────────────────────────────────
    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!connected) { call.reject("Non connecté"); return; }
        int mode = call.getInt("mode", 0); // 0 = full cut
        try {
            printerService.cutPaper(mode, null);
            call.resolve();
        } catch (RemoteException e) { call.reject(e.getMessage()); }
    }

    // ── Statut ────────────────────────────────────────────────────────────────
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        call.resolve(ret);
    }
}
