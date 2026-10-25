package com.guichaguri.trackplayer.audio;

import android.content.Context;

/** Shared by the RN bridge and audio thread. No I/O happens on the audio thread. */
public final class LoudnessSettings {
    public static volatile boolean enabled = true;
    private LoudnessSettings() {}

    public static void load(Context context) {
        enabled = context.getSharedPreferences("lx-audio", Context.MODE_PRIVATE)
                .getBoolean("normalize", true);
    }

    public static void setEnabled(Context context, boolean value) {
        enabled = value;
        context.getSharedPreferences("lx-audio", Context.MODE_PRIVATE).edit()
                .putBoolean("normalize", value).apply();
    }
}
