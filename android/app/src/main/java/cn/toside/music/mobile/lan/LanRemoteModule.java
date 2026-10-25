package cn.toside.music.mobile.lan;

import android.content.SharedPreferences;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import cn.toside.music.mobile.tv.TvRemote;
import java.io.*;
import java.util.UUID;
import java.util.Map;
import java.util.concurrent.*;

public final class LanRemoteModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext react;
  private final SharedPreferences prefs;
  private final Map<String, Pending> pending = new ConcurrentHashMap<>();
  private LanHttpServer server;
  private String error = "";
  private static final class Pending {
    final CountDownLatch latch = new CountDownLatch(1);
    volatile LanHttpServer.Reply reply;
  }
  public LanRemoteModule(ReactApplicationContext context) {
    super(context); react = context; prefs = context.getSharedPreferences("lx-lan-remote", 0);
  }
  @Override public String getName() { return "LanRemoteModule"; }
  @ReactMethod public void addListener(String name) {}
  @ReactMethod public void removeListeners(double count) {}
  private boolean enabled() { return prefs.getBoolean("enabled", TvRemote.isDeviceTV(react)); }
  private synchronized WritableMap status() {
    WritableMap map = Arguments.createMap(); map.putBoolean("enabled", enabled()); map.putBoolean("running", server != null); map.putString("error", error);
    map.putString("pin", server == null ? "" : server.auth.pin());
    WritableArray urls = Arguments.createArray();
    for (String address : LanHttpServer.addresses()) urls.pushString("http://" + address + ":" + LanHttpServer.PORT);
    map.putArray("urls", urls); return map;
  }
  @ReactMethod public synchronized void getStatus(Promise promise) { promise.resolve(status()); }
  @ReactMethod public synchronized void configure(boolean enabled, boolean rotate, Promise promise) {
    prefs.edit().putBoolean("enabled", enabled).apply();
    if (!enabled) stop(); else if (server == null) start(); else if (rotate) server.auth.rotate();
    promise.resolve(status());
  }
  @ReactMethod public synchronized void startIfEnabled(Promise promise) { if (enabled() && server == null) start(); promise.resolve(status()); }
  private void start() {
    try {
      server = new LanHttpServer(LanHttpServer.PORT, new LanHttpServer.Handler() {
        @Override public byte[] asset(String name) throws IOException {
          try (InputStream in = react.getAssets().open("lan/" + name); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192]; int n; while ((n = in.read(chunk)) != -1) out.write(chunk, 0, n); return out.toByteArray();
          }
        }
        @Override public LanHttpServer.Reply command(String body, long deadline) throws Exception {
          if (!react.hasActiveCatalystInstance()) return new LanHttpServer.Reply(503, "{\"error\":\"应用正在启动\"}");
          String id = UUID.randomUUID().toString(); Pending call = new Pending(); pending.put(id, call);
          try {
            WritableMap event = Arguments.createMap(); event.putString("id", id); event.putString("body", body); event.putDouble("deadline", deadline);
            react.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("lan-request", event);
            if (!call.latch.await(Math.max(1, deadline - System.currentTimeMillis()), TimeUnit.MILLISECONDS)) return new LanHttpServer.Reply(504, "{\"error\":\"操作超时，请刷新状态后重试\"}");
            return call.reply;
          } finally { pending.remove(id); }
        }
      });
      error = "";
    } catch (IOException exception) { error = "无法开启局域网控制，端口可能被占用"; }
  }
  @ReactMethod public void complete(String id, int code, String body) {
    Pending call = pending.get(id);
    if (call != null) { call.reply = new LanHttpServer.Reply(code >= 200 && code <= 599 ? code : 500, body); call.latch.countDown(); }
  }
  private synchronized void stop() {
    if (server != null) { try { server.close(); } catch (IOException ignored) {} server = null; }
    for (Pending call : pending.values()) { call.reply = new LanHttpServer.Reply(503, "{}"); call.latch.countDown(); }
    pending.clear(); error = "";
  }
  @Override public void invalidate() { stop(); super.invalidate(); }
}
