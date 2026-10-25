package cn.toside.music.mobile.tv;

/** Android key codes; kept independent of the framework for JVM regression tests. */
public final class TvKeyPolicy {
  private TvKeyPolicy() {}
  public static String mediaAction(int code) {
    switch (code) {
      case 85: case 79: return "toggle"; // MEDIA_PLAY_PAUSE, HEADSETHOOK
      case 126: return "play";
      case 127: case 86: return "pause";
      case 87: return "next";
      case 88: return "previous";
      case 89: return "rewind";
      case 90: return "forward";
      default: return null;
    }
  }
  public static boolean activateOnRelease(int action, boolean canceled) { return action == 1 && !canceled; }
  public static boolean isConfirm(int code) { return code == 23 || code == 66 || code == 160; }
  public static int adjustment(int code) {
    if (code == 19 || code == 21) return -1;
    if (code == 20 || code == 22) return 1;
    return 0;
  }
}
