package ci.cabine.app.plugins;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.IBinder;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Method;

/**
 * SunmiPrinterPlugin — reflection-based, no compile-time Sunmi SDK dependency.
 * Compiles on any Android device; activates automatically on Sunmi hardware at runtime.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {

    private static final String SUNMI_PACKAGE = "woyou.aidlservice.jiuiv5";
    private static final String SUNMI_ACTION  = "woyou.aidlservice.jiuiv5.IWoyouService";

    private IBinder printerBinder = null;
    private boolean connected = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerBinder = service;
            connected = true;
        }
        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerBinder = null;
            connected = false;
        }
    };

    @Override
    public void load() {
        try {
            Intent intent = new Intent();
            intent.setPackage(SUNMI_PACKAGE);
            intent.setAction(SUNMI_ACTION);
            getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            // Not a Sunmi device — silently ignored
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (connected) getContext().unbindService(connection);
        } catch (Exception ignored) {}
    }

    private void invoke(String method, Class<?>[] types, Object[] args) throws Exception {
        Method m = printerBinder.getClass().getMethod(method, types);
        m.invoke(printerBinder, args);
    }

    @PluginMethod
    public void printerInit(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        try {
            invoke("printerInit", new Class[]{android.os.IInterface.class}, new Object[]{null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        String text = call.getString("text", "");
        try {
            invoke("printText", new Class[]{String.class, android.os.IInterface.class}, new Object[]{text, null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setFontSize(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        float size = call.getInt("size", 18).floatValue();
        try {
            invoke("setFontSize", new Class[]{float.class, android.os.IInterface.class}, new Object[]{size, null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setAlignment(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        int alignment = call.getInt("alignment", 0);
        try {
            invoke("setAlignment", new Class[]{int.class, android.os.IInterface.class}, new Object[]{alignment, null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void printBitmap(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        String b64 = call.getString("base64", "");
        try {
            byte[] bytes  = Base64.decode(b64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            invoke("printBitmap", new Class[]{Bitmap.class, android.os.IInterface.class}, new Object[]{bitmap, null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!connected) { call.reject("Sunmi non connecté"); return; }
        int mode = call.getInt("mode", 0);
        try {
            invoke("cutPaper", new Class[]{int.class, android.os.IInterface.class}, new Object[]{mode, null});
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        call.resolve(ret);
    }
}
