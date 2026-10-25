package cn.toside.music.mobile.tv;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.view.KeyEvent;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.lang.ref.WeakReference;

public final class TvRemote {
  private static Boolean override;
  private static WeakReference<View> adjusting = new WeakReference<>(null);
  private TvRemote() {}
  public static boolean isDeviceTV(Context context) {
    UiModeManager mode = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
    return (mode != null && mode.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION)
        || context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK);
  }
  public static boolean isEnabled(Context context) { return override != null ? override : isDeviceTV(context); }
  public static void setEnabled(boolean enabled) { override = enabled; if (!enabled) finishAdjustment(); }
  private static void finishAdjustment() {
    View view = adjusting.get();
    if (view != null) { view.setActivated(false); view.invalidate(); }
    adjusting.clear();
  }
  public static void onFocusChanged(View focused) {
    if (focused != adjusting.get()) finishAdjustment();
  }
  private static boolean isAdjustable(View view) {
    if (view == null) return false;
    Object id = view.getTag(com.facebook.react.R.id.view_tag_native_id);
    return id instanceof String && ((String) id).startsWith("tv-adjust:");
  }
  private static boolean emit(Context context, String action) {
    Context app = context.getApplicationContext();
    if (!(app instanceof ReactApplication)) return false;
    ReactContext react = ((ReactApplication) app).getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
    if (react == null || !react.hasActiveCatalystInstance()) return false;
    WritableMap payload = Arguments.createMap();
    payload.putString("action", action);
    react.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("tv-remote-action", payload);
    return true;
  }
  public static boolean dispatch(Context context, View focused, KeyEvent event) {
    if (!isEnabled(context)) return false;
    if (adjusting.get() != null && adjusting.get() != focused) finishAdjustment();
    String media = TvKeyPolicy.mediaAction(event.getKeyCode());
    if (media != null) {
      // Consume both edges, act once on release; do not also send to MediaSession.
      if (TvKeyPolicy.activateOnRelease(event.getAction(), event.isCanceled())) return emit(context, media);
      return true;
    }
    if (isAdjustable(focused) && TvKeyPolicy.isConfirm(event.getKeyCode())) {
      if (TvKeyPolicy.activateOnRelease(event.getAction(), event.isCanceled())) {
        if (adjusting.get() == focused) finishAdjustment();
        else { finishAdjustment(); adjusting = new WeakReference<>(focused); focused.setActivated(true); focused.invalidate(); }
      }
      return true;
    }
    if (adjusting.get() == focused && focused != null) {
      if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
        if (event.getAction() == KeyEvent.ACTION_UP) finishAdjustment();
        return true;
      }
      int direction = TvKeyPolicy.adjustment(event.getKeyCode());
      if (direction != 0) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
          // RN registers custom action names while initializing node info. Remote
          // control must also work when no accessibility service has queried it.
          AccessibilityNodeInfo node = focused.createAccessibilityNodeInfo();
          if (node != null) node.recycle();
          ViewCompat.performAccessibilityAction(focused, direction > 0
              ? AccessibilityNodeInfoCompat.ACTION_SCROLL_FORWARD
              : AccessibilityNodeInfoCompat.ACTION_SCROLL_BACKWARD, null);
        }
        return true;
      }
    }
    // Direction, confirm, volume, Back and the soft keyboard keep Android behavior.
    return false;
  }
}
