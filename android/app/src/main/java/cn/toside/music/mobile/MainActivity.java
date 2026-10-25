package cn.toside.music.mobile;

import android.os.Bundle;
import android.content.pm.ActivityInfo;
import com.reactnativenavigation.NavigationActivity;
import cn.toside.music.mobile.tv.TvRemote;
import cn.toside.music.mobile.tv.TvFocusOutline;

public class MainActivity extends NavigationActivity {
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (TvRemote.isDeviceTV(this)) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
      TvFocusOutline.install(getWindow().getDecorView());
    }
  }
}
