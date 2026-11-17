package com.tanzeelati.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TanzeelatiMediaPlugin.class);
        super.onCreate(savedInstanceState);
        TanzeelatiMediaPlugin.handleSharedIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        TanzeelatiMediaPlugin.handleSharedIntent(intent);
    }
}
