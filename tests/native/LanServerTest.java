import cn.toside.music.mobile.lan.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class LanServerTest {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  static String request(int port, String headers, String body) throws Exception {
    try (Socket socket = new Socket("127.0.0.1", port)) {
      socket.setSoTimeout(3000);
      socket.getOutputStream().write((headers + "\r\n\r\n" + body).getBytes(StandardCharsets.UTF_8));
      ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] bytes = new byte[4096]; int n;
      while ((n = socket.getInputStream().read(bytes)) != -1) out.write(bytes, 0, n);
      return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
  }
  public static void main(String[] args) throws Exception {
    LanAuth auth = new LanAuth(); long now = 1000000;
    for (int i=0; i<5; i++) check(auth.pair("wrong", now) == null);
    check(auth.pair(auth.pin(), now) == null);
    String first = auth.pair(auth.pin(), now + 60001); check(first != null && first.length() == 64);
    check(auth.authorized("Bearer " + first, now + 60002)); check(!auth.authorized("Bearer " + first, now + 9*60*60*1000L));
    String token = auth.pair(auth.pin(), now + 10*60*60*1000L); auth.rotate(); check(!auth.authorized("Bearer " + token, now));
    int[] calls = {0};
    LanHttpServer server = new LanHttpServer(0, new LanHttpServer.Handler() {
      public byte[] asset(String name) { return name.getBytes(StandardCharsets.UTF_8); }
      public LanHttpServer.Reply command(String body, long deadline) { calls[0]++; check(deadline > System.currentTimeMillis()); return new LanHttpServer.Reply(200, "{}"); }
    });
    int port = server.port(); String host = "Host: 127.0.0.1:" + port;
    try {
      String page = request(port, "GET / HTTP/1.1\r\n" + host, ""); check(page.startsWith("HTTP/1.1 200")); check(page.contains("Content-Security-Policy:")); check(!page.contains(server.auth.pin()));
      check(request(port, "GET / HTTP/1.1\r\nHost: evil.test:" + port, "").startsWith("HTTP/1.1 403"));
      check(request(port, "POST /api/command HTTP/1.1\r\n" + host + "\r\nContent-Type: application/json\r\nContent-Length: 2", "{}").startsWith("HTTP/1.1 401")); check(calls[0] == 0);
      String pair = request(port, "POST /api/pair HTTP/1.1\r\n" + host + "\r\nContent-Type: text/plain\r\nContent-Length: 6", server.auth.pin());
      String session = pair.substring(pair.indexOf("{\"token\":\"") + 10).split("\"")[0]; check(session.length() == 64);
      String base = "POST /api/command HTTP/1.1\r\n" + host + "\r\nAuthorization: Bearer " + session + "\r\nContent-Type: application/json\r\n";
      check(request(port, base + "Content-Length: 2", "{}").startsWith("HTTP/1.1 200")); check(calls[0] == 1);
      check(request(port, base + "Origin: https://evil.test\r\nContent-Length: 2", "{}").startsWith("HTTP/1.1 403")); check(calls[0] == 1);
      check(request(port, base + "Content-Length: 9100001", "").startsWith("HTTP/1.1 413"));
      check(request(port, base + "Content-Length: -1", "").startsWith("HTTP/1.1 411"));
      check(request(port, base + "Transfer-Encoding: chunked\r\nContent-Length: 2", "{}").startsWith("HTTP/1.1 400"));
      check(request(port, base + "Content-Length: 2\r\nContent-Length: 2", "{}").startsWith("HTTP/1.1 400"));
      check(request(port, "GET /../private HTTP/1.1\r\n" + host, "").startsWith("HTTP/1.1 404"));
      auth.logout("Bearer " + first); check(!auth.authorized("Bearer " + first, now));
      check(request(port, "POST /api/logout HTTP/1.1\r\n" + host + "\r\nAuthorization: Bearer " + session + "\r\nContent-Type: application/json\r\nContent-Length: 2", "{}").startsWith("HTTP/1.1 200"));
      check(request(port, base + "Content-Length: 2", "{}").startsWith("HTTP/1.1 401"));
    } finally { server.close(); }
    try (ServerSocket replacement = new ServerSocket()) { replacement.setReuseAddress(true); replacement.bind(new InetSocketAddress("127.0.0.1", port)); }
  }
}
