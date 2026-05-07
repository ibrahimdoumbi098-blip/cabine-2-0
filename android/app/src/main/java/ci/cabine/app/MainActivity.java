package ci.cabine.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ci.cabine.app.plugins.SunmiPrinterPlugin;
import ci.cabine.app.plugins.KioskPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SunmiPrinterPlugin.class);
        registerPlugin(KioskPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
