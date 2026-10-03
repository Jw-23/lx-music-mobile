# Apple 风格界面与资料库

界面参考 [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) 的导航、信息层级和可访问性原则。主界面采用系统字体、大标题、分组列表、独立的迷你播放器和常驻导航。横屏使用侧栏；资料库封面网格按实际可用宽度排列。

## 使用流程

- **资料库**：直接查看歌单、歌曲数量和最近播放；右上角 `+` 创建歌单。
- **添加歌曲**：搜索结果、歌单歌曲、最近播放和迷你播放器提供直接添加入口。选择面板支持搜索歌单、新建并加入、重复歌曲状态、保存失败重试。单曲与批量操作使用同一选择面板。
- **歌单详情**：播放、随机播放、重命名和删除；原有歌曲长按菜单、批量管理、导入导出、同步和本地歌曲导入继续可用。资料库的“管理歌单”进入独立的分组列表，支持搜索、封面、数量和完整操作面板。
- **最近播放**：在音频实际开始播放时记录，保存最新 200 首不同歌曲，重复播放置顶。暂停恢复不会重复记录。支持再次播放、加入歌单、确认后清空。

二级界面使用共享设计：操作菜单采用完整的可滚动底部面板，选项菜单采用带勾选的浮层；编辑面板、确认与提示弹窗、文件选择器、分类与排行榜选择同步更新。设置从分组分类进入详情，布尔值使用系统开关、单选值使用右侧勾选。已移除仅适用于旧抽屉的方向与首页滑动设置；退出、返回桌面和底栏进度功能保留。

横屏收紧歌单导航与操作区，使用可滚动侧栏；迷你播放器保持紧凑，在竖屏并启用底栏调节进度时显示时间和可点击进度条。完整播放器始终可以调节进度。

## 数据与主题

最近播放使用独立的 `@recent_history_v1` 存储键，不属于播放队列或普通歌单，不受清理已播放队列、歌单同步或删除歌单影响。记录与清空的存储写入串行执行，防止旧写入覆盖新数据。现有歌单仍使用原有 list_event 数据层。

`src/theme/design.ts` 定义语义颜色与设计尺寸，新界面读取主题角色。`apple`、`apple_dark` 是默认浅色和深色主题；原有主题和用户自定义主题保留。首次升级时通过 `@apple_interface_v1` 切换到 Apple 默认主题，此后不会覆盖用户选择的皮肤。默认跟随系统外观，可在设置中更改。

## 验证

```sh
npm ci
npm run test:recent
npx tsc --noEmit
npm run lint
mkdir -p /tmp/lx-ui-build
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/lx-ui-build/index.android.bundle --assets-dest /tmp/lx-ui-build/assets
```

Android 原生构建需要 JDK 17、Android SDK 36 和项目指定的 NDK。调试构建使用项目自带 debug.keystore，不需要 release 的 keystore.properties。发布构建仍需要配置自己的签名密钥。

已完成：最近播放的 6 项自动测试、全项目 TypeScript 和 lint 检查、Android JS bundle 和 arm64 调试原生构建。Android 模拟器已检查资料库、创建与重命名、键盘布局、歌单数量、完整操作菜单、本地 WAV 导入与实际播放、新建歌单并加入、最近播放重启保留、设置分类与语言切换、深色与横屏布局。未进行 iOS 运行验证。界面截图见 `doc/screenshots`。

## GitHub Actions 发布

推送与 package.json 版本一致的 `v*` tag 触发 `.github/workflows/release.yml`。工作流先运行测试、类型检查与 lint，再生成签名 APK，发布各 CPU 架构及通用安装包，同时提供 SHA256 校验文件。

工作流也支持在 Actions 中手动运行并填写已有版本 tag；会检出该 tag，验证版本一致后构建，用于首次触发或重试。

签名使用仓库的 `KEYSTORE_STORE_FILE_BASE64`、`KEYSTORE_STORE_FILE`、`KEYSTORE_KEY_ALIAS`、`KEYSTORE_PASSWORD` 和 `KEYSTORE_KEY_PASSWORD` secrets。首次发布的 fork 使用独立签名；本地备份为受 Git 忽略的 `android/app/lx-music-release.keystore` 和 `android/keystore.properties`，应一并安全备份以供后续版本继续使用。不能覆盖安装上游官方签名的 APK。

## v1.10.2 播放与更新

底栏采用上一首、播放/暂停、下一首。歌单、搜索、排行榜和最近播放中的添加按钮继续保留。播放详情横竖屏都有“播放队列”入口：点选歌曲播放，使用上移/下移和移除按钮调整本次队列。调整不写回歌单；从资料库重新开始播放歌单会重置队列。稍后播放的歌曲优先播放，可单独排序或移除。随机、循环等播放模式仍由播放页模式按钮控制。

歌词页预加载，封面与歌词支持原生分页滑动及明确的切换按钮。歌词即时通过原生列表动画跟随；手动拖动和惯性滚动期间停止自动跟随，惯性结束后 2.5 秒恢复。尊重系统减弱动态效果；远处未测量歌词的定位最多重试两次，切歌及卸载清理任务。

更新渠道统一配置在 `src/config/release.js`，为 `Jw-23/lx-music-mobile`。检查通过 `/releases/latest` 读取正式发布，历史来自同仓库，下载从所选发布的真实 assets 选择设备 ABI 或 universal APK。网络失败不会切换到上游发布源。

验证命令：`npm test`、`npx tsc --noEmit`、`npm run lint`、签名 Android Release 构建。模拟器操作体验由用户自行测试。

## v1.10.3 歌词交互

播放详情去除封面/歌词文字切换，只保留左右分页滑动；队列入口仅用图标，保留读屏标签。歌词行可直接点按跳转到时间戳，无需开启高级歌词进度设置。拖动、惯性滑动期间阻止误触跳转，结束后 2.5 秒恢复跟随；播放行通过原生缩放和渐亮动画突出。

统一进度处理同步音频和歌词，暂停时跳转仍保持暂停，范围限制在歌曲时长内；失败时恢复实际位置，旧跳转失败不会覆盖后续跳转。27 项回归检查覆盖上述交互逻辑和既有播放队列、最近播放、更新来源。
