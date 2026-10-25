package cn.toside.music.mobile;

import android.os.Bundle;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.View;
import com.reactnativenavigation.NavigationActivity;
import cn.toside.music.mobile.tv.TvRemote;
import cn.toside.music.mobile.tv.TvFocusOutline;

public class MainActivity extends NavigationActivity {
  private void applyTVWindow() {
    if (!TvRemote.isDeviceTV(this)) return;
    getWindow().setBackgroundDrawable(new ColorDrawable(Color.rgb(11, 12, 16)));
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
  }
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (TvRemote.isDeviceTV(this)) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
      applyTVWindow();
      TvFocusOutline.install(getWindow().getDecorView());
    }
  }
  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) applyTVWindow();
  }
}
