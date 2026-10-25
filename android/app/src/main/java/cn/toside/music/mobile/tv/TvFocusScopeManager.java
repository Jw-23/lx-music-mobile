package cn.toside.music.mobile.tv;

import android.view.KeyEvent;
import android.view.View;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.lang.ref.WeakReference;
import java.util.ArrayList;

public final class TvFocusScopeManager extends ReactViewManager {
  @Override public String getName() { return "LXTVFocusScope"; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new Scope(context); }
  @ReactProp(name = "blocked") public void setBlocked(ReactViewGroup view, boolean blocked) { ((Scope) view).block(blocked); }
  @ReactProp(name = "autoFocus") public void setAutoFocus(ReactViewGroup view, boolean auto) { ((Scope) view).autoFocus = auto; }
  public static final class Scope extends ReactViewGroup {
    boolean blocked;
    boolean autoFocus;
    boolean restore;
    int generation;
    WeakReference<View> remembered = new WeakReference<>(null);
    Scope(ThemedReactContext context) { super(context); setFocusable(false); }
    void block(boolean value) {
      if (blocked == value) return;
      if (value && hasFocus()) {
        remembered = new WeakReference<>(findFocus()); restore = true;
      }
      blocked = value; generation++;
      setDescendantFocusability(value ? FOCUS_BLOCK_DESCENDANTS : FOCUS_AFTER_DESCENDANTS);
      if (value && hasFocus()) { View focused = findFocus(); if (focused != null) focused.clearFocus(); }
      if (!value) scheduleFocus();
    }
    private boolean inside(View view) {
      View current = view;
      while (current != null) {
        if (current == this) return true;
        android.view.ViewParent parent = current.getParent();
        current = parent instanceof View ? (View) parent : null;
      }
      return false;
    }
    void scheduleFocus() {
      final int token = ++generation;
      post(new Runnable() {
        int retries;
        @Override public void run() {
          if (token != generation || blocked || !isAttachedToWindow() || !(restore || autoFocus)) return;
          if (hasWindowFocus()) {
            View previous = remembered.get();
            if (previous != null && inside(previous) && previous.isShown() && previous.requestFocus()) { restore = false; return; }
            ArrayList<View> views = getFocusables(FOCUS_FORWARD);
            for (View view : views) if (view != Scope.this && view.isShown() && view.isEnabled() && view.getWidth() > 0 && view.getHeight() > 0 && view.requestFocus()) { restore = false; return; }
          }
          if (++retries < 20) postDelayed(this, 16);
        }
      });
    }
    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); TvFocusOutline.install(getRootView()); scheduleFocus(); }
    @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) { super.onSizeChanged(w, h, oldw, oldh); if (w > 0 && h > 0 && (oldw == 0 || oldh == 0)) scheduleFocus(); }
    @Override protected void onDetachedFromWindow() { generation++; super.onDetachedFromWindow(); }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
      if (TvRemote.dispatch(getContext(), getRootView().findFocus(), event)) return true;
      return super.dispatchKeyEvent(event);
    }
  }
}
