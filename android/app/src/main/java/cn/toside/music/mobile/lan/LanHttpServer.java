package cn.toside.music.mobile.lan;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Deliberately small HTTP surface: three bundled assets, pairing and one JSON command endpoint. */
public final class LanHttpServer implements Closeable {
  public static final int PORT = 9528;
  public interface Handler {
    byte[] asset(String name) throws IOException;
    Reply command(String body, long deadline) throws Exception;
  }
  public static final class Reply {
    public final int status;
    public final String body;
    public Reply(int status, String body) { this.status = status; this.body = body; }
  }
  private final ServerSocket server;
  private final Handler handler;
  public final LanAuth auth = new LanAuth();
  private final Set<Socket> clients = Collections.newSetFromMap(new ConcurrentHashMap<Socket, Boolean>());
  private final ThreadPoolExecutor workers = new ThreadPoolExecutor(4, 4, 10, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(8));
  private volatile boolean running = true;
  public LanHttpServer(int port, Handler handler) throws IOException {
    this.handler = handler;
    server = new ServerSocket(); server.setReuseAddress(true);
    try { server.bind(new InetSocketAddress("0.0.0.0", port), 12); }
    catch (IOException error) { server.close(); workers.shutdownNow(); throw error; }
    Thread thread = new Thread(this::accept, "LX-LAN-listener"); thread.setDaemon(true); thread.start();
  }
  public int port() { return server.getLocalPort(); }
  public static List<String> addresses() {
    List<String> list = new ArrayList<>();
    try {
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      while (interfaces != null && interfaces.hasMoreElements()) {
        NetworkInterface network = interfaces.nextElement();
        if (!network.isUp() || network.isLoopback()) continue;
        Enumeration<InetAddress> values = network.getInetAddresses();
        while (values.hasMoreElements()) {
          InetAddress address = values.nextElement();
          if (address instanceof Inet4Address && address.isSiteLocalAddress()) list.add(address.getHostAddress());
        }
      }
    } catch (SocketException ignored) {}
    return list;
  }
  private void accept() {
    while (running) {
      Socket socket = null;
      try {
        socket = server.accept();
        InetAddress peer = socket.getInetAddress();
        if (!(peer.isSiteLocalAddress() || peer.isLoopbackAddress() || peer.isLinkLocalAddress())) { socket.close(); continue; }
        socket.setSoTimeout(10000); clients.add(socket);
        final Socket accepted = socket;
        workers.execute(() -> serve(accepted));
      } catch (IOException | RejectedExecutionException error) {
        if (socket != null) { clients.remove(socket); try { socket.close(); } catch (IOException ignored) {} }
      }
    }
  }
  private static final class BadRequest extends Exception {
    final int status;
    BadRequest(int status) { this.status = status; }
  }
  private String line(InputStream in, int[] budget, long deadline) throws IOException, BadRequest {
    ByteArrayOutputStream result = new ByteArrayOutputStream();
    int last = -1;
    while (true) {
      if (--budget[0] < 0) throw new BadRequest(431);
      if (System.currentTimeMillis() > deadline) throw new BadRequest(408);
      int next = in.read();
      if (next < 0) throw new BadRequest(400);
      if (next == '\n') { if (last != '\r') throw new BadRequest(400); break; }
      if (next == 0) throw new BadRequest(400);
      result.write(next); last = next;
    }
    byte[] bytes = result.toByteArray();
    return new String(bytes, 0, bytes.length - 1, StandardCharsets.US_ASCII);
  }
  private void serve(Socket socket) {
    try {
      InputStream in = new BufferedInputStream(socket.getInputStream());
      long deadline = System.currentTimeMillis() + 10000;
      int[] budget = {16384};
      String[] request = line(in, budget, deadline).split(" ");
      if (request.length != 3 || !request[2].equals("HTTP/1.1")) throw new BadRequest(400);
      String method = request[0], path = request[1];
      Map<String, String> headers = new HashMap<>();
      String value;
      while (!(value = line(in, budget, deadline)).isEmpty()) {
        int colon = value.indexOf(':');
        if (colon < 1) throw new BadRequest(400);
        String key = value.substring(0, colon).toLowerCase(Locale.ROOT);
        if (!key.matches("[a-z0-9-]+") || headers.containsKey(key)) throw new BadRequest(400);
        headers.put(key, value.substring(colon + 1).trim());
      }
      String host = headers.get("host");
      Set<String> hosts = new HashSet<>();
      hosts.add("127.0.0.1:" + port());
      for (String address : addresses()) hosts.add(address + ":" + port());
      if (!hosts.contains(host)) throw new BadRequest(403);
      String origin = headers.get("origin");
      if (origin != null && !origin.equals("http://" + host)) throw new BadRequest(403);
      if (headers.containsKey("transfer-encoding") || headers.containsKey("expect")) throw new BadRequest(400);
      if (method.equals("GET")) {
        String asset = path.equals("/") ? "index.html" : path.equals("/app.js") ? "app.js" : path.equals("/style.css") ? "style.css" : null;
        if (asset == null) throw new BadRequest(404);
        write(socket, 200, asset.endsWith(".js") ? "text/javascript" : asset.endsWith(".css") ? "text/css" : "text/html", handler.asset(asset));
        return;
      }
      if (!method.equals("POST")) throw new BadRequest(405);
      boolean pairing = path.equals("/api/pair");
      if (!pairing && !path.equals("/api/command") && !path.equals("/api/logout")) throw new BadRequest(404);
      String authorization = headers.get("authorization");
      if (!pairing && !auth.authorized(authorization, System.currentTimeMillis())) throw new BadRequest(401);
      String type = headers.get("content-type");
      if (type == null || !(pairing ? type.startsWith("text/plain") : type.startsWith("application/json"))) throw new BadRequest(415);
      String length = headers.get("content-length");
      if (length == null || !length.matches("[0-9]{1,8}")) throw new BadRequest(411);
      int count = Integer.parseInt(length);
      if (count > (pairing ? 64 : 9100000)) throw new BadRequest(413);
      byte[] body = new byte[count]; int read = 0;
      long bodyDeadline = System.currentTimeMillis() + 30000;
      while (read < count) {
        if (System.currentTimeMillis() > bodyDeadline) throw new BadRequest(408);
        int n = in.read(body, read, count - read); if (n < 0) throw new BadRequest(400); read += n;
      }
      String text = new String(body, StandardCharsets.UTF_8);
      Reply result;
      if (pairing) {
        String token = auth.pair(text.trim(), System.currentTimeMillis());
        result = token == null ? new Reply(401, "{\"error\":\"配对码错误或尝试过多，请稍后重试\"}") : new Reply(200, "{\"token\":\"" + token + "\"}");
      } else if (path.equals("/api/logout")) {
        auth.logout(authorization); result = new Reply(200, "{}");
      } else {
        result = handler.command(text, System.currentTimeMillis() + 45000);
      }
      write(socket, result.status, "application/json", result.body.getBytes(StandardCharsets.UTF_8));
    } catch (BadRequest error) {
      try { write(socket, error.status, "application/json", ("{\"error\":\"请求未获允许（" + error.status + "）\"}").getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) {}
    } catch (Exception error) {
      try { write(socket, 503, "application/json", "{\"error\":\"电视暂时无法响应，请重试\"}".getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) {}
    } finally { clients.remove(socket); try { socket.close(); } catch (IOException ignored) {} }
  }
  private void write(Socket socket, int status, String type, byte[] body) throws IOException {
    String headers = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : "Error") + "\r\nContent-Type: " + type + "; charset=utf-8\r\nContent-Length: " + body.length
      + "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\r\n\r\n";
    OutputStream out = socket.getOutputStream(); out.write(headers.getBytes(StandardCharsets.US_ASCII)); out.write(body); out.flush();
  }
  @Override public void close() throws IOException {
    running = false; auth.rotate(); server.close();
    for (Socket client : clients) try { client.close(); } catch (IOException ignored) {}
    workers.shutdownNow();
  }
}
