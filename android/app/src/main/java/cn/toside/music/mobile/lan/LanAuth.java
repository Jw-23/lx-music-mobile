package cn.toside.music.mobile.lan;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Locale;

/** No Android dependencies: authentication is exercised on the JVM as well. */
public final class LanAuth {
  private final SecureRandom random = new SecureRandom();
  private final Map<String, Long> sessions = new LinkedHashMap<>();
  private String pin;
  private int failures;
  private long window;
  public LanAuth() { rotate(); }
  public synchronized String pin() { return pin; }
  public synchronized void rotate() {
    pin = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
    sessions.clear(); failures = 0; window = 0;
  }
  public synchronized String pair(String code, long now) {
    if (now - window >= 60000 || now < window) { failures = 0; window = now; }
    if (failures >= 5) return null;
    if (!MessageDigest.isEqual(pin.getBytes(StandardCharsets.UTF_8), code.getBytes(StandardCharsets.UTF_8))) { failures++; return null; }
    prune(now);
    if (sessions.size() >= 8) sessions.remove(sessions.keySet().iterator().next());
    byte[] bytes = new byte[32]; random.nextBytes(bytes);
    StringBuilder value = new StringBuilder();
    for (byte b : bytes) value.append(String.format(Locale.ROOT, "%02x", b & 255));
    String token = value.toString(); sessions.put(token, now + 8 * 60 * 60 * 1000L);
    return token;
  }
  private void prune(long now) {
    Iterator<Map.Entry<String, Long>> it = sessions.entrySet().iterator();
    while (it.hasNext()) if (it.next().getValue() <= now) it.remove();
  }
  public synchronized boolean authorized(String bearer, long now) {
    prune(now);
    return bearer != null && bearer.startsWith("Bearer ") && sessions.containsKey(bearer.substring(7));
  }
  public synchronized void logout(String bearer) { if (bearer != null && bearer.startsWith("Bearer ")) sessions.remove(bearer.substring(7)); }
}
