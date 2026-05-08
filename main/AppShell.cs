using Photino.NET;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Diagnostics;
using VRCNext.Services;
using VRCNext.Services.Helpers;

namespace VRCNext;

public partial class AppShell
{
    // Fields

    private PhotinoWindow _window = null!;
    private string _thumbCacheDir = "";
    private string _customThemesDir = "";
    private int _httpPort;
    private System.Net.HttpListener? _httpListener;
    private System.Threading.Timer? _uptimeTimer2;
    private System.Threading.Timer? _worldStatsTimer;
    private int _worldStatsOffsetMin; // random 0-10 min offset per session
    private bool _minimized;
    private StreamWriter? _activityLogWriter;
    private string _activityLogPath = "";
    private string _activityLogDir  = "";

    private readonly AppSettings _settings;
    private readonly WebhookService _webhook = new();
    private readonly FileWatcherService _fileWatcher = new();
    private readonly VRChatApiService _vrcApi = new();
    private readonly VRChatLogWatcher _logWatcher = new();
    // Domain controllers
    private CoreLibrary _core = null!;
    private AuthController _authCtrl = null!;
    private FriendsController _friends = null!;
    private InstanceController _instance = null!;
    private NotificationsController _notifications = null!;
    private GroupsController _groups = null!;
    private PhotosController _photos = null!;
    private TimelineController _timelineCtrl = null!;
    private VROverlayController _vroCtrl = null!;
    private SpaceFlightController _sfCtrl = null!;
    private DiscordController _discordCtrl = null!;
    private ChatboxController _chatboxCtrl = null!;
    private VoiceFightController _vfCtrl = null!;
    private KikitanXDController _kxdCtrl = null!;
    private AvatarScalingController _asCtrl = null!;
    private RelayController _relayCtrl = null!;
    private SnipeController _snipeCtrl = null!;
    private WindowController _windowCtrl = null!;
    private readonly CacheHandler _cache = new();
    private readonly UnifiedTimeEngine _timeEngine;
    private readonly PhotoPlayersStore _photoPlayersStore;
    private readonly TimelineService _timeline;
    private readonly UpdateService _updateService = new();
    private readonly MemoryTrimService _memTrim = new();
#if WINDOWS
    private SystemTrayService? _trayService;
#endif

    // VR overlay world name+thumb cache (worldId → name, localUrl)
    private readonly Dictionary<string, (string name, string thumb)> _vrWorldCache = new();

    // Helpers

    private static void Invoke(Action action) => action();
    private static T Invoke<T>(Func<T> func) => func();


    // Helper: always returns ISO 8601 date string from a JToken
    private static string IsoDate(JToken? t)
    {
        if (t == null) return "";
        if (t.Type == JTokenType.Date)
            return t.Value<DateTime>().ToUniversalTime().ToString("o");
        return t.ToString();
    }

    // Loads the inventory cache JSON, sets the value at <paramref name="path"/> (dot-separated)..
    private void InvCacheSaveSection(string path, object value)
    {
        try
        {
            var root = (_cache.LoadRaw(CacheHandler.KeyInventory) as JObject) ?? new JObject();
            var parts = path.Split('.');
            JObject node = root;
            for (int i = 0; i < parts.Length - 1; i++)
            {
                if (node[parts[i]] is not JObject child)
                {
                    child = new JObject();
                    node[parts[i]] = child;
                }
                node = child;
            }
            node[parts[^1]] = JToken.FromObject(value);
            _cache.Save(CacheHandler.KeyInventory, root);
        }
        catch { }
    }

    // Permini loader

    private void LoadPerminiList()
    {
        try
        {
            var raw = _cache.LoadRaw(CacheHandler.KeyPermini);
            if (raw is Newtonsoft.Json.Linq.JArray arr)
            {
                foreach (var item in arr.OfType<Newtonsoft.Json.Linq.JObject>())
                {
                    var uid = item["userId"]?.ToString();
                    if (!string.IsNullOrEmpty(uid))
                        _core.PerminiList[uid] = (
                            item["allowActive"]?.Value<bool>() ?? false,
                            item["allowAskMe"]?.Value<bool>()  ?? false,
                            item["allowDnD"]?.Value<bool>()    ?? false);
                }
            }
        }
        catch { }
    }

    // Constructor

    public AppShell(string[] args)
    {
        _settings = AppSettings.Load();
        MigrationHelper.MigrateFavorites(_settings);           // silently moves Favorites → favorited_images.json
        MigrationHelper.MigrateCachesToSubdir();               // moves 5 cache JSONs from root → Caches/
        MigrationHelper.MigrateBuiltInDashboardTheme(_settings); // removes AppData copy; now hardcoded in index.html
        if (_settings.MemoryTrimEnabled) _memTrim.SetEnabled(true);
        _timeEngine = UnifiedTimeEngine.Load(
            () => _core?.IsVrcRunning?.Invoke() ?? false,
            msg => _core?.SendToJS("log", new { msg, color = "sec" }));
        _photoPlayersStore = PhotoPlayersStore.Load();
        _timeline = TimelineService.Load(_settings);
        _ = MigrationHelper.MigrateUserTrackingCountsAsync(_settings,
            pct => _core?.SendToJS("dbMigrationProgress", new { percent = pct })); // backfill first_meet_date + meet_again_count in background
        _minimized = args.Contains("--minimized");
        LoadDeletedAvatarsCache();

        // Create shared service container and domain controllers
        _core = new CoreLibrary(
            _vrcApi, _logWatcher, _timeline, _settings, _cache,
            _timeEngine, _photoPlayersStore,
            _webhook, _fileWatcher, _memTrim, _updateService,
            (type, payload) => SendToJS(type, payload));
        _core.IsVrcRunning = RelayController.IsVrcRunning;
        _core.IsSteamVrRunning = RelayController.IsSteamVrRunning;
        _core.DispatchMessage = rawMsg => OnWebMessage(rawMsg);
        _core.AvtrdbSubmit        = id => { QueueAvtrdbSubmit(id); QueueAvtrIcuSubmit(id); };
        _core.PrefetchSharedContent = () => PrefetchSharedContentAsync();
        _core.LoadPage = path => _window.Load(path);
        _friends = new FriendsController(_core);
        _instance = new InstanceController(_core, _friends);
        _notifications = new NotificationsController(_core, _friends, _instance);
        _groups = new GroupsController(_core);
        _photos = new PhotosController(_core, _friends, _instance);
        _timelineCtrl = new TimelineController(_core, _friends, _instance, _photos);
        _vroCtrl = new VROverlayController(_core, _friends);
        _sfCtrl = new SpaceFlightController(_core, _vroCtrl);
        _discordCtrl = new DiscordController(_core, _instance, _vroCtrl);
        _chatboxCtrl = new ChatboxController(_core, _vroCtrl);
        _vfCtrl = new VoiceFightController(_core, _vroCtrl);
        _kxdCtrl = new KikitanXDController(_core);
        _asCtrl = new AvatarScalingController(_core);
        _snipeCtrl = new SnipeController(_core);
        _relayCtrl = new RelayController(_core, _friends, _instance, _notifications, _vroCtrl);
        _windowCtrl = new WindowController(_core);
#if WINDOWS
        WindowController.OnMinimized = () => _memTrim.TrimNow();
#endif
        _authCtrl = new AuthController(_core, _friends, _instance, _photos, _relayCtrl, _groups, _discordCtrl);
        _relayCtrl.OnOwnUserUpdated = user => _authCtrl.SendVrcUserData(user);
        _core.PushDiscordPresence = () => _discordCtrl.PushPresence();
        _vroCtrl.OnToolToggle    = ToggleToolFromOverlay;
        _vroCtrl.OnVrScaleChange = delta => _asCtrl.ApplyVrScaleDelta(delta);
        _vroCtrl.GetToolStates = () => (
            _discordCtrl.IsConnected,
            _vfCtrl.IsRunning,
            _kxdCtrl.IsRunning,
            _sfCtrl.IsConnected,
            _relayCtrl.IsRunning,
            _chatboxCtrl.IsEnabled);
        _fileWatcher.NewFile += _photos.OnNewFile;
        _ = SQLiteMigrator.PruneOrphanedTimelinePhotosAsync(
            _timeline,
            pct => _core.SendToJS("dbMigrationProgress", new { percent = pct }),
            id  => _core.SendToJS("timelineEventDeleted", new { id }));

        // Permini — load persisted list into memory
        LoadPerminiList();

#if WINDOWS
        // System tray
        _trayService = new SystemTrayService();
        _trayService.OnShowWindow = () => _windowCtrl.ToggleWindowVisibility();
        _trayService.OnStatusChange = status =>
        {
            var currentDesc = _vrcApi.CurrentUserRaw?["statusDescription"]?.ToString() ?? "";
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(new { action = "vrcUpdateStatus", status, statusDescription = currentDesc });
            _ = OnWebMessage(json);
        };
        _trayService.OnClose = () =>
        {
            WindowController.AllowNextClose();
            try { _window.Close(); } catch { }
        };
        _trayService.ImageDownloader = async url =>
        {
            return await _vrcApi.GetHttpClient().GetByteArrayAsync(url);
        };
        _trayService.Initialize();
        _core.OnTraySettingChanged = (enabled, autoHide) => ApplyTraySetting(enabled, autoHide);
        _core.OnTrayUserUpdate = UpdateTrayUser;
        _core.OnTrayThemeUpdate = colors => _trayService?.UpdateTheme(colors);
#endif
    }

    // Run

    public void Run()
    {
        StartHttpListener();
        _core.HttpPort = _httpPort;

        VRCNext.Services.Helpers.ImageCacheHelper.Initialize(_vrcApi.GetHttpClient());
        VRCNext.Services.Helpers.PermafailHelper.Initialize();
        VRCNext.Services.Helpers.ImageCacheHelper.Port            = _httpPort;
        VRCNext.Services.Helpers.ImageCacheHelper.LimitGb         = _settings.ImgCacheLimitGb;
        VRCNext.Services.Helpers.ImageCacheHelper.OptimizeEnabled = _settings.ImgCacheOptimizeEnabled;
        VRCNext.Services.Helpers.ImageCacheHelper.Log             = (msg, color) => _core.SendToJS("log", new { msg, color });

        _thumbCacheDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "ThumbCache");
        Directory.CreateDirectory(_thumbCacheDir);
        _activityLogDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "Logs");
        Directory.CreateDirectory(_activityLogDir);
        _customThemesDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "custom-themes");
        Directory.CreateDirectory(_customThemesDir);
        _core.CustomThemesDir = _customThemesDir;
        SeedBuiltInThemes();
        var logFileName = $"vrcn-log-{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.txt";
        _activityLogPath = Path.Combine(_activityLogDir, logFileName);
        try { _activityLogWriter = new StreamWriter(_activityLogPath, append: false, System.Text.Encoding.UTF8) { AutoFlush = true }; } catch { }
        try
        {
            foreach (var old in Directory.GetFiles(_activityLogDir, "vrcn-log-*.txt")
                         .OrderByDescending(f => f)
                         .Skip(10))
                File.Delete(old);
        }
        catch { }

        _core.GetVirtualMediaUrl = _photos.GetVirtualMediaUrl;

        var frontend  = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend");
        var startPage = _settings.SetupComplete
            ? Path.Combine(frontend, "index.html")
            : Path.Combine(frontend, "setup", "setup.html");
        if (!File.Exists(startPage)) startPage = Path.Combine(frontend, "index.html");

        int uptimeTick = 0;
        _uptimeTimer2 = new System.Threading.Timer(_ =>
        {
            if (_vfCtrl.IsRunning)
                SendToJS("vfMeter", new { level = _vfCtrl.MeterLevel });
            if (_kxdCtrl.IsRunning)
                SendToJS("kxdMeter", new { level = _kxdCtrl.MeterLevel });
            if (Interlocked.Increment(ref uptimeTick) % 10 == 0 && _relayCtrl.IsRunning)
                SendToJS("uptimeTick", (DateTime.Now - _relayCtrl.RelayStart).ToString(@"hh\:mm\:ss"));
        }, null, 100, 100);

        // Hourly world stats collection for World Insights
        // Fires at each UTC hour + random 0-10 min offset (to spread API load across users)
        _worldStatsOffsetMin = new Random().Next(0, 11);
        _worldStatsTimer = new System.Threading.Timer(async _ =>
        {
            await CollectWorldStatsAsync();
            ScheduleNextWorldStats();
        }, null, Timeout.Infinite, Timeout.Infinite);
        ScheduleNextWorldStats();

        // Chromeless on Windows requires explicit location (Center() sets a flag, not coordinates)
        var (startX, startY) = WindowController.GetCenteredLocation(1100, 700);

#if !WINDOWS
        // Auto-install missing GStreamer plugins required by WebKit2GTK (blank window without them)
        EnsureLinuxGstreamer();

        // WebKit2GTK on systems without proper GPU (VMs, Hyper-V, missing Vulkan):
        // Force Mesa software rendering so EGL/OpenGL never fails in the WebKit child process.
        // These must be set before PhotinoWindow so the child process inherits them.
        void SetIfUnset(string key, string val)
        {
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                Environment.SetEnvironmentVariable(key, val);
        }
        SetIfUnset("WEBKIT_DISABLE_DMABUF_RENDERER",    "1");
        SetIfUnset("WEBKIT_DISABLE_COMPOSITING_MODE",   "1");
        SetIfUnset("LIBGL_ALWAYS_SOFTWARE",             "1");
        SetIfUnset("GALLIUM_DRIVER",                    "llvmpipe");
#endif

        var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "logo.png");
        var webView2DataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "WebView2");
        Directory.CreateDirectory(webView2DataDir);

        var windowBuilder = new PhotinoWindow()
            .SetTitle("VRCNext")
            .SetUseOsDefaultSize(false)
            .SetSize(1100, 700)
            .SetMinSize(900, 540)
            .SetChromeless(OperatingSystem.IsWindows() && !_settings.LegacyWindow)
            .SetResizable(true)
            .SetUseOsDefaultLocation(false)
            .SetLeft(startX)
            .SetTop(startY)
            .SetTemporaryFilesPath(webView2DataDir)
#if WINDOWS
            .SetBrowserControlInitParameters(BuildChromiumFlags(_settings))
#endif
            .RegisterWebMessageReceivedHandler((_, message) => { _ = OnWebMessage(message); });
        if (File.Exists(iconPath)) windowBuilder.SetIconFile(iconPath);
        _window = windowBuilder.Load(startPage);
        _core.Window = _window;

        if (_minimized) _window.SetMinimized(true);
        _window.WaitForClose();
        OnClose();
    }

#if WINDOWS
    private static string BuildChromiumFlags(AppSettings s)
    {
        var flags = new System.Text.StringBuilder();
        if (!s.GpuAcceleration)    flags.Append("--disable-gpu ");
        if (!s.GpuShaderCache)     flags.Append("--disable-gpu-shader-disk-cache ");
        flags.Append(s.V8Heap128 ? "--js-flags=--max-old-space-size=128 " : "--js-flags=--max-old-space-size=64 ");
        flags.Append(s.TwoRenderProcesses ? "--renderer-process-limit=2 " : "--renderer-process-limit=1 ");
        flags.Append("--disable-background-networking --disable-sync --no-first-run");
        return flags.ToString();
    }
#endif

#if !WINDOWS
    private static void EnsureLinuxGstreamer()
    {
        // Check if autoaudiosink is available — its absence crashes WebKitWebProcess (blank window)
        try
        {
            var check = Process.Start(new ProcessStartInfo("gst-inspect-1.0")
            {
                Arguments = "autoaudiosink",
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                UseShellExecute        = false,
            });
            check?.WaitForExit(3000);
            if (check?.ExitCode == 0) return; // already installed
        }
        catch { return; } // gst-inspect-1.0 not on PATH — nothing we can do

        // Determine install command for the running distro
        string pkgs = "";
        if (File.Exists("/usr/bin/pacman") || File.Exists("/bin/pacman"))
            pkgs = "gst-plugins-base gst-plugins-good gst-libav";
        else if (File.Exists("/usr/bin/apt-get"))
            pkgs = "gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-libav";
        else if (File.Exists("/usr/bin/dnf"))
            pkgs = "gstreamer1-plugins-base gstreamer1-plugins-good";
        if (string.IsNullOrEmpty(pkgs)) return;

        string pm  = File.Exists("/usr/bin/pacman") || File.Exists("/bin/pacman") ? "pacman -S --noconfirm"
                   : File.Exists("/usr/bin/apt-get")                               ? "apt-get install -y"
                                                                                   : "dnf install -y";
        string cmd = $"{pm} {pkgs}";

        // Use pkexec — opens a GUI polkit dialog (no terminal needed)
        try
        {
            var proc = Process.Start(new ProcessStartInfo("pkexec")
            {
                Arguments      = $"/bin/bash -c \"{cmd}\"",
                UseShellExecute = false,
            });
            proc?.WaitForExit();
        }
        catch { }
    }
#endif

    // World stats collection, aligned to the UTC hour with a random per-device offset.

    private void ScheduleNextWorldStats()
    {
        var now = DateTime.UtcNow;
        // Target: next UTC hour + offset
        var nextHour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1);
        var target = nextHour.AddMinutes(_worldStatsOffsetMin);
        // If target is in the past (e.g. offset=5 and it's :03), fire for *this* hour
        if (target <= now) target = target.AddHours(1);
        var delay = target - now;
        _worldStatsTimer?.Change(delay, Timeout.InfiniteTimeSpan);
    }

    internal async Task CollectWorldStatsAsync()
    {
        try
        {
            if (!_vrcApi.IsLoggedIn) return;
            var worlds = await _core.World.GetMyWorldsAsync();
            foreach (var w in worlds)
            {
                var id = w["id"]?.ToString();
                if (string.IsNullOrEmpty(id)) continue;
                var active    = w["occupants"]?.Value<int>() ?? 0;
                var favorites = w["favorites"]?.Value<int>() ?? 0;
                var visits    = w["visits"]?.Value<int>() ?? 0;
                _timeline.InsertWorldStats(id, active, favorites, visits);
            }
        }
        catch { }
    }

    // OnClose

    private void OnClose()
    {
        // Add watch dog at first Mark: Watchdog test
        CrashHandler.OnCleanShutdown();
        _relayCtrl?.Dispose();
        _fileWatcher.Dispose();
        _uptimeTimer2?.Dispose();
        _worldStatsTimer?.Dispose();
        _sfCtrl?.Dispose();
        _vfCtrl?.Dispose();
        _kxdCtrl?.Dispose();
        _asCtrl?.Dispose();
        _snipeCtrl?.Dispose();
        _discordCtrl?.Dispose();
        _chatboxCtrl?.Dispose();
        _vroCtrl?.Dispose();
        _timeline.Dispose();
        _photoPlayersStore.Dispose();
        _timeEngine.Dispose();
        _photos.VrcPhotoWatcher?.Dispose();
        _webhook.Dispose();
        _logWatcher.Dispose();
        _memTrim.Dispose();
        _httpListener?.Stop();
        _activityLogWriter?.Dispose();
#if WINDOWS
        _trayService?.Dispose();
#endif
    }

#if WINDOWS
    private void ApplyTraySetting(bool enabled, bool autoHide)
    {
        _trayService?.SetVisible(enabled);
        _trayService?.UpdateLanguage(_settings.Language);
        _windowCtrl.SetHideFromTaskbar(enabled);
        // On startup, auto-hide the window to tray immediately
        if (enabled && autoHide)
            _windowCtrl.HideWindow();
    }

    private void UpdateTrayUser(string name, string status, string statusDesc, string imageUrl)
    {
        _trayService?.UpdateUserInfo(name, status, statusDesc, imageUrl);
    }
#endif


    // Webhook URL stored as XOR-encrypted bytes. Key is injected at build time via secrets.bat, never in source.
    private static readonly byte[] _whEnc = {
        62, 38, 55, 62, 22, 66, 91, 110, 20, 25, 65, 83, 93, 68, 55, 70, 10, 1, 20, 105, 13, 6, 27, 74,
        4, 51, 48, 43, 33, 10, 19, 7, 110, 65, 68, 11, 3, 4, 14, 96, 94, 90, 88, 65, 119, 94, 69, 74,
        87, 65, 110, 107, 108, 34, 10, 15, 45, 3, 30, 40, 3, 123, 103, 76, 12, 47, 92, 62, 42, 46, 52, 23,
        75, 92, 26, 35, 35, 118, 127, 21, 14, 2, 30, 59, 49, 3, 82, 103, 101, 97, 81, 3, 1, 65, 13, 62,
        50, 45, 86, 43, 2, 42, 122, 8, 61, 19, 4, 15, 50, 4, 97, 87, 119, 83, 33, 13, 24, 32, 77, 1, 60
    };
    private static readonly byte[] _whKey = System.Text.Encoding.ASCII.GetBytes(BuildSecrets.WhKey);

    private static string DecryptWebhook()
    {
        var b = new byte[_whEnc.Length];
        for (int i = 0; i < b.Length; i++)
            b[i] = (byte)(_whEnc[i] ^ _whKey[i % _whKey.Length]);
        return System.Text.Encoding.UTF8.GetString(b);
    }

    internal void CheckAndShowPendingCrash()
    {
        var crashPath = Services.CrashHandler.GetPendingCrashFilePath();
        if (crashPath == null) return;

        if (_settings.SendCrashData)
        {
            // Auto-send when the user has crash reporting enabled
            _ = SendPendingCrashReportAsync(silent: true);
        }
        else
        {
            // Show manual modal so the user can decide
            try
            {
                var content = System.IO.File.ReadAllText(crashPath, System.Text.Encoding.UTF8);
                var preview = Services.CrashHandler.GetPreviewText(content);
                SendToJS("showCrashModal", new { preview });
            }
            catch { Services.CrashHandler.ClearPendingCrash(); }
        }
    }

    internal async Task SendPendingCrashReportAsync(bool silent = false)
    {
        try
        {
            var crashPath = Services.CrashHandler.GetPendingCrashFilePath();
            if (crashPath == null) { Services.CrashHandler.ClearPendingCrash(); return; }

            var fullReport = System.IO.File.ReadAllText(crashPath, System.Text.Encoding.UTF8);
            var sanitized  = Services.CrashHandler.SanitizeForReport(fullReport);
            if (string.IsNullOrWhiteSpace(sanitized)) sanitized = "(no extractable content)";

            var url     = DecryptWebhook();
            var asm     = System.Reflection.Assembly.GetEntryAssembly() ?? System.Reflection.Assembly.GetExecutingAssembly();
            var version = asm.GetName().Version?.ToString() ?? "?";
            var header  = $"**VRCNext crash** | v{version} | {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription} | {System.Runtime.InteropServices.RuntimeInformation.OSDescription}";

            using var http        = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            using var form        = new System.Net.Http.MultipartFormDataContent();
            var payloadBytes      = System.Text.Encoding.UTF8.GetBytes(sanitized);
            var fileContent       = new System.Net.Http.ByteArrayContent(payloadBytes);
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
            form.Add(new System.Net.Http.StringContent(header), "content");
            form.Add(fileContent, "files[0]", $"crash_{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.txt");

            await http.PostAsync(url, form);
            Services.CrashHandler.ClearPendingCrash();
            if (!silent) SendToJS("toast", new { ok = true, msg = "Crash report sent. Thank you!" });
        }
        catch
        {
            if (!silent) SendToJS("toast", new { ok = false, msg = "Failed to send crash report." });
        }
    }

    // SendToJS

    private void SendToJS(string type, object? payload = null)
    {
        if (type == "log" && payload != null && _activityLogWriter != null)
        {
            try
            {
                var p = Newtonsoft.Json.Linq.JObject.FromObject(payload);
                var logMsg = p["msg"]?.ToString() ?? "";
                _activityLogWriter.WriteLine($"{DateTime.Now:HH:mm:ss}  {logMsg}");
            }
            catch { }
        }
        var msg = JsonConvert.SerializeObject(new { type, payload });
        try { _window.Invoke(() => _window.SendWebMessage(msg)); } catch { }

#if WINDOWS
        // Forward friend timeline events to the VR wrist overlay
        if (type == "friendTimelineEvent" && payload != null && _core.VrOverlay != null)
        {
            try
            {
                var p           = Newtonsoft.Json.Linq.JObject.FromObject(payload);
                var evType      = p["type"]?.ToString() ?? "";
                var name        = p["friendName"]?.ToString() ?? "Friend";
                var worldName   = p["worldName"]?.ToString() ?? "";
                var oldValue    = p["oldValue"]?.ToString() ?? "";
                var newValue    = p["newValue"]?.ToString() ?? "";
                var friendImage = p["friendImage"]?.ToString() ?? "";
                var friendId    = p["friendId"]?.ToString() ?? "";
                var location    = p["location"]?.ToString() ?? "";

                // Build event text — null means "skip this event"
                string? evText = evType switch
                {
                    "friend_online"     => "Online (Game)",
                    "friend_offline"    => "Offline (Game)",
                    "friend_gps"        => string.IsNullOrWhiteSpace(worldName) ? null : $"→ {worldName}",
                    "friend_status"     => !string.IsNullOrEmpty(oldValue) && !string.IsNullOrEmpty(newValue)
                                           ? $"{oldValue} → {newValue}"
                                           : "Changed status",
                    "friend_statusdesc" => !string.IsNullOrEmpty(newValue) ? newValue : "Changed status text",
                    "friend_bio"        => !string.IsNullOrEmpty(newValue) ? newValue : "Updated bio",
                    "friend_added"      => "Friend added",
                    "friend_removed"    => "Removed you",
                    _                   => null   // ignore unknown events (e.g. "friend_updated")
                };
                if (evText == null) return;

                var time = DateTimeHelper.FormatTime(DateTime.Now);

                // Main overlay (wrist alerts tab) — every event, no filtering
                _core.VrOverlay.AddNotification(evType, name, evText, time, friendImage, friendId, location);

                // HMD toast — every event, cooldown inside EnqueueToast handles rapid-fire dedup
                try
                {
                    bool isFav = !string.IsNullOrEmpty(friendId) && _friends.IsFavorited(friendId);
                    _core.VrOverlay.EnqueueToast(evType, name, evText, time, friendImage, isFav);
                }
                catch { }
            }
            catch { }
        }
#endif
    }

#if WINDOWS
    // VR Overlay tool toggle (fired by overlay card click)

    private void ToggleToolFromOverlay(int idx)
    {
        switch (idx)
        {
            case 0: // Discord Presence
                _discordCtrl.Toggle();
                break;

            case 1: // Voice Fight
                _vfCtrl.Toggle();
                break;

            case 2: // Kikitan XD
                _kxdCtrl.Toggle();
                break;

            case 3: // Space Flight
                _sfCtrl.Toggle();
                break;

            case 4: // Media Relay
                _relayCtrl.ToggleRelay();
                break;

            case 5: // Custom Chatbox
                _chatboxCtrl.Toggle();
                break;
        }
        _vroCtrl.UpdateToolStates();
    }
#endif

    // HttpListener (replaces WebView2 virtual hosts)

    private readonly List<string> _mappedHosts = new();

    private void StartHttpListener()
    {
        // Try the saved port first, then scan for a free one
        var candidates = new List<int>();
        if (_settings.LocalHttpPort > 0) candidates.Add(_settings.LocalHttpPort);
        var rng = new Random();
        for (int i = 0; i < 200; i++) candidates.Add(rng.Next(49152, 65534));

        foreach (var port in candidates)
        {
            _httpListener = new System.Net.HttpListener();
            _httpListener.Prefixes.Add($"http://localhost:{port}/");
            try
            {
                _httpListener.Start();
                _httpPort = port;
                if (_settings.LocalHttpPort != port)
                {
                    _settings.LocalHttpPort = port;
                    _settings.Save();
                }
                break;
            }
            catch (System.Net.HttpListenerException) { _httpListener.Close(); }
        }
        _ = Task.Run(ServeHttpAsync);
    }

    private void UpdateVirtualHostMappings()
    {
        // No-op with Photino — watch folders served via /media{i}/ routes in HttpListener
    }

    private async Task ServeHttpAsync()
    {
        while (_httpListener?.IsListening == true)
        {
            try
            {
                var ctx = await _httpListener.GetContextAsync();
                _ = HandleHttpAsync(ctx);
            }
            catch (ObjectDisposedException) { break; }   // intentional shutdown
            catch { /* transient error (connection reset, OS glitch) — keep accepting */ }
        }
    }

    private async Task HandleHttpAsync(System.Net.HttpListenerContext ctx)
    {
        var path    = ctx.Request.Url?.AbsolutePath ?? "/";
        var isThumb = ctx.Request.Url?.Query?.Contains("thumb=1") == true;
        try
        {
            if (path.StartsWith("/imgcache/"))
            {
                var rel  = Uri.UnescapeDataString(path["/imgcache/".Length..]).Replace('/', Path.DirectorySeparatorChar);
                var file = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "VRCNext", "Caches", "ImageCache", rel);
                await ServeFileAsync(ctx, file);
            }
            else if (path.StartsWith("/vrcphotos/"))
            {
                if (!string.IsNullOrEmpty(_photos.VrcPhotoDir))
                {
                    var file = Path.Combine(_photos.VrcPhotoDir, Uri.UnescapeDataString(path["/vrcphotos/".Length..]));
                    if (isThumb) await ServeThumbAsync(ctx, file); else await ServeFileAsync(ctx, file);
                }
                else ctx.Response.StatusCode = 404;
            }
            else if (path.StartsWith("/media"))
            {
                var rest  = path["/media".Length..];
                var slash = rest.IndexOf('/');
                if (slash > 0 && int.TryParse(rest[..slash], out var idx)
                    && idx < _settings.WatchFolders.Count)
                {
                    var file = Path.Combine(_settings.WatchFolders[idx], Uri.UnescapeDataString(rest[(slash + 1)..]));
                    if (isThumb) await ServeThumbAsync(ctx, file); else await ServeFileAsync(ctx, file);
                }
                else ctx.Response.StatusCode = 404;
            }
            else if (path.StartsWith("/cursor/"))
            {
                var cursorDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "cursor");
                var file = Path.Combine(cursorDir, Uri.UnescapeDataString(path["/cursor/".Length..]));
                await ServeFileAsync(ctx, file);
            }
            else if (path.StartsWith("/builtinthemes/"))
            {
                var rel  = Uri.UnescapeDataString(path["/builtinthemes/".Length..]);
                var file = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "custom-themes", rel.Replace('/', Path.DirectorySeparatorChar));
                await ServeThemeFileAsync(ctx, file);
            }
            else if (path.StartsWith("/customthemes/"))
            {
                var rel  = Uri.UnescapeDataString(path["/customthemes/".Length..]);
                var file = Path.Combine(_customThemesDir, rel.Replace('/', Path.DirectorySeparatorChar));
                await ServeThemeFileAsync(ctx, file);
            }
            else if (path == "/dashbg")
            {
                var query = ctx.Request.Url?.Query ?? "";
                var fileParam = query.TrimStart('?').Split('&')
                    .Select(p => p.Split('=', 2))
                    .Where(p => p.Length == 2 && p[0] == "file")
                    .Select(p => Uri.UnescapeDataString(p[1]))
                    .FirstOrDefault();
                if (!string.IsNullOrEmpty(fileParam) && File.Exists(fileParam))
                    await ServeFileAsync(ctx, fileParam);
                else
                    ctx.Response.StatusCode = 404;
            }
            else ctx.Response.StatusCode = 404;
        }
        catch { ctx.Response.StatusCode = 500; }
        finally { try { ctx.Response.Close(); } catch { } }
    }

    private static async Task ServeThemeFileAsync(System.Net.HttpListenerContext ctx, string file)
    {
        if (!File.Exists(file)) { ctx.Response.StatusCode = 404; return; }
        ctx.Response.ContentType = Path.GetExtension(file).ToLower() == ".js"
            ? "text/javascript; charset=utf-8"
            : "text/css; charset=utf-8";
        ctx.Response.StatusCode = 200;
        var bytes = await File.ReadAllBytesAsync(file);
        ctx.Response.ContentLength64 = bytes.Length;
        await ctx.Response.OutputStream.WriteAsync(bytes);
    }

    public string GetCustomThemesDir() => _customThemesDir;

    private void SeedBuiltInThemes()
    {
        var builtInSrc = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "custom-themes");
        if (!Directory.Exists(builtInSrc)) return;
        foreach (var srcDir in Directory.GetDirectories(builtInSrc))
        {
            var themeName = Path.GetFileName(srcDir);
            if (themeName == "VRCNext v2 Preview") continue; // hardcoded — served from install dir, not AppData
            var destDir   = Path.Combine(_customThemesDir, themeName);
            Directory.CreateDirectory(destDir);
            foreach (var srcFile in Directory.GetFiles(srcDir, "*")
                .Where(f => { var ext = Path.GetExtension(f).ToLower(); return ext == ".css" || ext == ".js" || ext == ".json" || ext == ".md"; }))
            {
                var destFile = Path.Combine(destDir, Path.GetFileName(srcFile));
                if (!File.Exists(destFile))
                    File.Copy(srcFile, destFile);
            }
        }
    }

    private static async Task ServeFileAsync(System.Net.HttpListenerContext ctx, string file)
    {
        if (!File.Exists(file)) { ctx.Response.StatusCode = 404; return; }
        ctx.Response.ContentType = Path.GetExtension(file).ToLower() switch {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png"  => "image/png",
            ".gif"  => "image/gif",
            ".webp" => "image/webp",
            ".mp4"  => "video/mp4",
            ".webm" => "video/webm",
            _       => "application/octet-stream"
        };
        ctx.Response.StatusCode = 200;
        ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
        // Stream directly — NEVER load full file into RAM (videos can be multiple gigabytes)
        ctx.Response.ContentLength64 = new FileInfo(file).Length;
        using var fs = File.OpenRead(file);
        await fs.CopyToAsync(ctx.Response.OutputStream);
    }

    private static readonly SemaphoreSlim _thumbSem = new(2, 2);
    private static int _thumbGenCount = 0;

    private async Task ServeThumbAsync(System.Net.HttpListenerContext ctx, string file)
    {
        if (!File.Exists(file)) { ctx.Response.StatusCode = 404; return; }
        var ext = Path.GetExtension(file).ToLower();
        // Only thumbnail images; serve other types (video etc.) as-is
        if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp"))
        {
            await ServeFileAsync(ctx, file);
            return;
        }

        // Cache key: MD5 of path, invalidate if source is newer
        var keyBytes  = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(file));
        var thumbPath = Path.Combine(_thumbCacheDir, Convert.ToHexString(keyBytes) + ".jpg");

        if (!File.Exists(thumbPath) || File.GetLastWriteTimeUtc(thumbPath) < File.GetLastWriteTimeUtc(file))
        {
            await _thumbSem.WaitAsync();
            try
            {
                // Double-check after acquiring semaphore (another thread may have generated it)
                if (!File.Exists(thumbPath) || File.GetLastWriteTimeUtc(thumbPath) < File.GetLastWriteTimeUtc(file))
                {
                    // Image resize is CPU-bound — offload to thread pool
                    await Task.Run(() =>
                    {
                        var tmpPath = thumbPath + ".tmp";
                        // FromStream instead of FromFile — releases file handle immediately after read
                        var rawBytes = File.ReadAllBytes(file);
                        using var ms  = new MemoryStream(rawBytes);
                        using var src = System.Drawing.Image.FromStream(ms, false, false);
                        const int maxSize = 400;
                        var scale = Math.Min(1.0, Math.Min(maxSize / (double)src.Width, maxSize / (double)src.Height));
                        var w = Math.Max(1, (int)(src.Width  * scale));
                        var h = Math.Max(1, (int)(src.Height * scale));
                        using var bmp = new System.Drawing.Bitmap(w, h);
                        using (var g = System.Drawing.Graphics.FromImage(bmp))
                        {
                            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
                            g.DrawImage(src, 0, 0, w, h);
                        }
                        var jpegCodec = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders()
                            .First(c => c.FormatID == System.Drawing.Imaging.ImageFormat.Jpeg.Guid);
                        var encParams = new System.Drawing.Imaging.EncoderParameters(1);
                        encParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(
                            System.Drawing.Imaging.Encoder.Quality, 72L);
                        // Atomic write: temp file then rename to prevent serving half-written files
                        bmp.Save(tmpPath, jpegCodec, encParams);
                        File.Move(tmpPath, thumbPath, overwrite: true);

                        // Periodic GC to prompt libgdiplus to release native memory
                        if (Interlocked.Increment(ref _thumbGenCount) % 10 == 0)
                            GC.Collect(1, GCCollectionMode.Optimized, false);
                    });
                }
            }
            finally { _thumbSem.Release(); }
        }

        ctx.Response.ContentType = "image/jpeg";
        ctx.Response.StatusCode  = 200;
        var thumbBytes = await File.ReadAllBytesAsync(thumbPath);
        ctx.Response.ContentLength64 = thumbBytes.Length;
        await ctx.Response.OutputStream.WriteAsync(thumbBytes);
    }
}
