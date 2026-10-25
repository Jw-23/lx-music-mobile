package cn.toside.music.mobile.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.view.ViewTreeObserver;
import com.facebook.react.bridge.ReadableMap;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import java.util.WeakHashMap;

/** One outline per native window, including React Native's separate modal windows. */
public final class TvFocusOutline extends Drawable implements ViewTreeObserver.OnPreDrawListener, View.OnAttachStateChangeListener {
  private static final Map<View, TvFocusOutline> windows = new WeakHashMap<>();
  private final WeakReference<View> root;
  private final Rect rect = new Rect();
  private final Rect visible = new Rect();
  private final Rect rootRect = new Rect();
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Map<View, Boolean> disabled = new WeakHashMap<>();
  private final float density;
  private boolean editing;
  private TvFocusOutline(View root) { this.root = new WeakReference<>(root); density = root.getResources().getDisplayMetrics().density; }
  public static void install(View root) {
    if (windows.containsKey(root)) return;
    TvFocusOutline outline = new TvFocusOutline(root);
    windows.put(root, outline);
    root.getOverlay().add(outline);
    root.addOnAttachStateChangeListener(outline);
    root.getViewTreeObserver().addOnPreDrawListener(outline);
  }
  private static boolean isDisabled(View view) {
    Object tag = view.getTag(com.facebook.react.R.id.accessibility_state);
    if (!(tag instanceof ReadableMap)) return !view.isEnabled();
    ReadableMap state = (ReadableMap) tag;
    return !view.isEnabled() || (state.hasKey("disabled") && !state.isNull("disabled") && state.getBoolean("disabled"));
  }
  @Override public boolean onPreDraw() {
    View window = root.get();
    if (window == null) return true;
    boolean enabled = TvRemote.isEnabled(window.getContext());
    // Pressable's disabled accessibility state does not disable native focus in RN 0.73.
    Iterator<Map.Entry<View, Boolean>> iterator = disabled.entrySet().iterator();
    while (iterator.hasNext()) {
      Map.Entry<View, Boolean> entry = iterator.next();
      if (!enabled || !isDisabled(entry.getKey())) { entry.getKey().setFocusable(entry.getValue()); iterator.remove(); }
    }
    if (enabled) {
      ArrayList<View> focusables = window.getFocusables(View.FOCUS_FORWARD);
      for (View view : focusables) if (isDisabled(view)) { disabled.put(view, view.isFocusable()); view.setFocusable(false); }
    }
    View focus = enabled && window.hasWindowFocus() ? window.findFocus() : null;
    if (window.hasWindowFocus()) TvRemote.onFocusChanged(focus);
    visible.setEmpty();
    if (focus != null && focus != window && focus.isShown() && focus.getGlobalVisibleRect(visible)) {
      window.getGlobalVisibleRect(rootRect);
      visible.offset(-rootRect.left, -rootRect.top);
      visible.inset((int) (2 * density), (int) (2 * density));
    }
    boolean nextEditing = focus != null && focus.isActivated();
    if (!rect.equals(visible) || editing != nextEditing) {
      rect.set(visible); editing = nextEditing; invalidateSelf();
    }
    setBounds(0, 0, window.getWidth(), window.getHeight());
    return true;
  }
  @Override public void draw(Canvas canvas) {
    if (rect.isEmpty()) return;
    RectF box = new RectF(rect);
    paint.setStyle(Paint.Style.STROKE);
    paint.setColor(Color.BLACK); paint.setStrokeWidth(6 * density);
    canvas.drawRoundRect(box, 10 * density, 10 * density, paint);
    paint.setColor(editing ? Color.rgb(255, 159, 10) : Color.WHITE); paint.setStrokeWidth(3 * density);
    canvas.drawRoundRect(box, 10 * density, 10 * density, paint);
  }
  @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
  @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
  @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
  @Override public void onViewAttachedToWindow(View view) {}
  @Override public void onViewDetachedFromWindow(View view) {
    if (view.getViewTreeObserver().isAlive()) view.getViewTreeObserver().removeOnPreDrawListener(this);
    view.removeOnAttachStateChangeListener(this); view.getOverlay().remove(this); windows.remove(view);
  }
}
