using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NativeFileDialogSharp;
using VRCNext.Services;
using VRCNext.Services.Helpers;
using System.Diagnostics;

namespace VRCNext;

// Owns all auth, login, settings, setup, cache-send, and startup orchestration.

public class AuthController
{
    private readonly CoreLibrary _core;
    private readonly FriendsController _friends;
    private readonly InstanceController _instance;
    private readonly PhotosController _photos;
    private readonly RelayController _relayCtrl;
    private readonly GroupsController _groups;
    private readonly DiscordController _discordCtrl;

    // Auth State
    private string _pending2faType = "totp";
    private bool _vrcDebugSetup;
    private string _lastAvatarName = "";
    private string _lastVideoUrl = "";
    private DateTime _lastVideoUrlTime = DateTime.MinValue;
    private DateTime _readyAt = DateTime.MaxValue;

    // In-flight guards — prevent duplicate startup fetches when JS triggers same requests
    private int _favWorldsInFlight = 0;
    private int _favAvatarsInFlight = 0;
    private List<JObject>? _cachedFavGroups; // shared across FavWorlds + FavAvatars to avoid double fetch
    public void ClearFavGroupsCache() => _cachedFavGroups = null;

    // Constructor

    public AuthController(
        CoreLibrary core,
        FriendsController friends,
        InstanceController instance,
        PhotosController photos,
        RelayController relayCtrl,
        GroupsController groups,
        DiscordController discordCtrl)
    {
        _core = core;
        _friends = friends;
        _instance = instance;
        _photos = photos;
        _relayCtrl = relayCtrl;
        _groups = groups;
        _discordCtrl = discordCtrl;

        // Allow RelayController to trigger a session resume....
        _relayCtrl.OnWakeResumeRequested = VrcTryResumeAsync;
    }

    // Invoke shim (Photino is thread-safe)
    private static void Invoke(Action action) => action();

    // Message Handler

    public async Task HandleMessage(string action, JObject msg)
    {
        switch (action)
        {
            case "vrcLogin":
                var vrcUser = msg["username"]?.ToString() ?? "";
                var vrcPass = msg["password"]?.ToString() ?? "";
                await VrcLoginAsync(vrcUser, vrcPass);
                break;

            case "vrc2FA":
                var code2fa = msg["code"]?.ToString() ?? "";
                var type2fa = msg["type"]?.ToString() ?? "totp";
                await VrcVerify2FAAsync(code2fa, type2fa);
                break;

            case "vrcLogout":
                _relayCtrl.StopWebSocket();
                await _core.Auth.LogoutAsync();
                _core.Settings.VrcAuthCookie = "";
                _core.Settings.VrcTwoFactorCookie = "";
                _core.Settings.Save();
                _core.SendToJS("vrcLoggedOut", null);
                _core.SendToJS("log", new { msg = "VRChat: Logged out", color = "sec" });
                break;

            case "saveSettings":
                var data = msg["data"];
                if (data != null) ApplySettings(data);
                break;

            case "loadTranslation":
                SendTranslation(msg["language"]?.ToString());
                break;

            case "setupReady":
                _core.SendToJS("setPlatform", new { isLinux = !OperatingSystem.IsWindows() });
                var detectedPath = _core.Settings.VrcPath;
                if (string.IsNullOrWhiteSpace(detectedPath) || !File.Exists(detectedPath))
                    detectedPath = DetectVrcLaunchExe();
                if (!string.IsNullOrEmpty(detectedPath) && detectedPath != _core.Settings.VrcPath)
                {
                    _core.Settings.VrcPath = detectedPath;
                    _core.Settings.Save();
                }
                var photoDir = _core.Settings.WatchFolders.FirstOrDefault() ?? "";
                if (string.IsNullOrEmpty(photoDir))
                    photoDir = DetectVrcPhotoDir();
                _core.SendToJS("setupState", new
                {
                    vrcPath = detectedPath ?? "",
                    photoDir,
                    loggedIn = _core.VrcApi.IsLoggedIn,
                    displayName = _core.VrcApi.IsLoggedIn ? (_core.VrcApi.CurrentUserRaw?["displayName"]?.ToString() ?? "") : "",
                    platform = OperatingSystem.IsWindows() ? "windows" : "linux",
                    language = _core.Settings.Language ?? "en",
                });
                _ = VrcTryResumeAsync();
                break;

            case "setupDone":
                _core.Settings.SetupComplete = true;
                _core.Settings.Save();
                _core.LoadPage?.Invoke(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "index.html"));
                break;

            case "resetSetup":
                _core.Settings.SetupComplete = false;
                _core.Settings.Save();
                var setupHtml = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "setup", "setup.html");
                if (File.Exists(setupHtml)) _core.LoadPage?.Invoke(setupHtml);
                break;

            case "forceTrim":
                _core.MemTrim.TrimNow();
                break;

            case "getImgCacheSize":
                _ = Task.Run(() =>
                {
                    var bytes = ImageCacheHelper.GetCacheSizeBytes();
                    Invoke(() => _core.SendToJS("imgCacheSize", new { bytes }));
                });
                break;

            case "optimizeImgCache":
                _ = Task.Run(async () =>
                {
                    Invoke(() => _core.SendToJS("imgCacheOptimizeProgress", new { done = 0, total = -1 }));
                    await ImageCacheHelper.OptimizeAsync((done, total) =>
                        Invoke(() => _core.SendToJS("imgCacheOptimizeProgress", new { done, total })));
                    var bytes = ImageCacheHelper.GetCacheSizeBytes();
                    Invoke(() =>
                    {
                        _core.SendToJS("imgCacheOptimizeProgress", new { done = -1, total = 0 });
                        _core.SendToJS("imgCacheSize", new { bytes });
                    });
                });
                break;

            case "clearFfcCache":
                _ = Task.Run(() =>
                {
                    _core.Cache.ClearAll();
                    Invoke(() => _core.SendToJS("log", new { msg = "\ud83d\uddd1 FFC cache cleared.", color = "sec" }));
                });
                break;

            case "dbAnalyze":
                _ = Task.Run(() =>
                {
                    Invoke(() => _core.SendToJS("dbAnalyzeProgress", new { running = true }));
                    try
                    {
                        var result = SQLiteOptimizing.Analyze();
                        Invoke(() => _core.SendToJS("dbAnalyzeResult", new
                        {
                            totalRows          = result.TotalRows,
                            friendRows         = result.FriendRows,
                            cleanableRows      = result.CleanableRows,
                            counts             = result.Counts.Select(c => new { label = c.Label, count = c.Count }).ToArray(),
                            friendOnlineCount   = result.FriendOnlineCount,
                            friendOfflineCount  = result.FriendOfflineCount,
                            friendStatusCount   = result.FriendStatusCount,
                            notificationCount      = result.NotificationCount,
                            videoUrlCount          = result.VideoUrlCount,
                            instancePlayersCount   = result.InstancePlayersCount,
                        }));
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("dbAnalyzeResult", new { error = ex.Message }));
                    }
                });
                break;

            case "dbOptimize":
                _ = Task.Run(() =>
                {
                    Invoke(() => _core.SendToJS("dbOptimizeProgress", new { phase = "optimize" }));
                    try
                    {
                        var (userCleaned, feCleaned, notifCleaned, epCleaned) = SQLiteOptimizing.Optimize();
                        Invoke(() => _core.SendToJS("dbOptimizeProgress", new { phase = "vacuum" }));
                        SQLiteOptimizing.Vacuum();
                        Invoke(() => _core.SendToJS("dbOptimizeDone", new { userCleaned, feCleaned, notifCleaned, epCleaned }));
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("dbOptimizeDone", new { error = ex.Message }));
                    }
                });
                break;

            case "dbBackup":
                _ = Task.Run(() =>
                {
                    try
                    {
                        var path = SQLiteOptimizing.CreateBackup();
                        Invoke(() => _core.SendToJS("dbBackupDone", new { path }));
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("dbBackupDone", new { error = ex.Message }));
                    }
                });
                break;

            case "regBackup":
                _ = Task.Run(() =>
                {
                    try
                    {
                        var path = SQLiteOptimizing.CreateRegistryBackup();
                        Invoke(() => _core.SendToJS("regBackupDone", new { path }));
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("regBackupDone", new { error = ex.Message }));
                    }
                });
                break;

            case "forceFfcAll":
                _ = Task.Run(ForceFfcAllAsync);
                break;

            case "setupSaveLanguage":
                _core.Settings.Language = NormalizeLanguage(msg["language"]?.ToString());
                _core.Settings.Save();
                break;

            case "setupSaveStartWithWindows":
                _core.Settings.StartWithWindows = msg["enabled"]?.Value<bool>() ?? false;
                ApplyStartWithWindows(_core.Settings.StartWithWindows);
                _core.Settings.Save();
                break;

            case "setupSaveVrcPath":
                _core.Settings.VrcPath = msg["path"]?.ToString() ?? "";
                _core.Settings.Save();
                break;

            case "setupSavePhotoDir":
                var setupPhotoDir = msg["path"]?.ToString() ?? "";
                if (!string.IsNullOrEmpty(setupPhotoDir)
                    && Directory.Exists(setupPhotoDir)
                    && !_core.Settings.WatchFolders.Contains(setupPhotoDir, StringComparer.OrdinalIgnoreCase))
                {
                    _core.Settings.WatchFolders.Add(setupPhotoDir);
                    _core.Settings.Save();
                }
                break;

            case "setupBrowsePhotoDir":
                {
                    var r = Dialog.FolderPicker(Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "VRChat"));
                    if (r.IsOk) _core.SendToJS("setupPhotoDirResult", r.Path);
                }
                break;

            case "checkUpdate":
                _ = Task.Run(async () =>
                {
                    var version = await _core.UpdateService.CheckAsync();
                    if (version != null)
                        Invoke(() => _core.SendToJS("updateAvailable", new { version }));
                });
                break;

            case "installUpdate":
                _ = Task.Run(async () =>
                {
                    await _core.UpdateService.DownloadAsync(p =>
                        Invoke(() => _core.SendToJS("updateProgress", p)));
                    Invoke(() => _core.SendToJS("updateReady", null));
                    await Task.Delay(800);
                    Invoke(() => _core.UpdateService.ApplyAndRestart());
                });
                break;

            case "restartApp":
                var exe = Environment.ProcessPath;
                if (!string.IsNullOrEmpty(exe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exe,
                        Arguments = $"--waitpid {Environment.ProcessId}",
                        UseShellExecute = true
                    });
                    WindowController.AllowNextClose();
                    try { _core.Window?.Close(); } catch { Environment.Exit(0); }
                }
                break;

            case "openUrl":
                var openUrlTarget = msg["url"]?.ToString();
                if (!string.IsNullOrEmpty(openUrlTarget) &&
                    (openUrlTarget.StartsWith("https://") || openUrlTarget.StartsWith("http://")))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = openUrlTarget,
                        UseShellExecute = true
                    });
                }
                break;

            case "browseExe":
                {
                    var target = msg["target"]?.ToString() ?? "extra";
                    var r = Dialog.FileOpen("exe");
                    if (r.IsOk)
                    {
                        _core.SendToJS("exeAdded", new { target, path = r.Path });
                        if (target == "vrchat")
                        {
                            _core.Settings.VrcPath = r.Path;
                            _core.Settings.Save();
                        }
                    }
                }
                break;

            case "browseDashBg":
                {
                    var r = Dialog.FileOpen("png,jpg,jpeg,bmp,webp,gif,mp4");
                    if (r.IsOk)
                    {
                        try
                        {
                            if (r.Path.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase))
                            {
                                var info = new FileInfo(r.Path);
                                if (info.Length > 60L * 1024 * 1024)
                                {
                                    _core.SendToJS("toast", new { ok = false, msg = "Video must be under 60 MB" });
                                    break;
                                }
                            }
                            var url = $"http://localhost:{_core.HttpPort}/dashbg?file={Uri.EscapeDataString(r.Path)}";
                            _core.SendToJS("dashBgSelected", new { path = r.Path, url });
                        }
                        catch (Exception ex)
                        {
                            _core.SendToJS("log", new { msg = $"Background image error: {ex.Message}", color = "err" });
                        }
                    }
                }
                break;

            case "vrcLoadDashBg":
                _ = Task.Run(() =>
                {
                    try
                    {
                        var bgPath = msg["path"]?.ToString();
                        if (!string.IsNullOrEmpty(bgPath) && File.Exists(bgPath))
                        {
                            var url = $"http://localhost:{_core.HttpPort}/dashbg?file={Uri.EscapeDataString(bgPath)}";
                            Invoke(() => _core.SendToJS("dashBgSelected", new { path = bgPath, url }));
                        }
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("log", new { msg = $"Load background error: {ex.Message}", color = "err" }));
                    }
                });
                break;

            case "vrcRandomDashBg":
                _ = Task.Run(() =>
                {
                    try
                    {
                        var imgExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                            { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp" };
                        var allImages = new List<string>();

                        foreach (var folder in _core.Settings.WatchFolders.Where(Directory.Exists))
                        {
                            try
                            {
                                allImages.AddRange(
                                    Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories)
                                        .Where(f => imgExts.Contains(Path.GetExtension(f)))
                                );
                            }
                            catch { }
                        }

                        if (allImages.Count == 0)
                        {
                            Invoke(() => _core.SendToJS("log", new { msg = "Random background: no images found in watch folders", color = "warn" }));
                            return;
                        }

                        var rng = new Random();
                        var picked = allImages[rng.Next(allImages.Count)];
                        var url = $"http://localhost:{_core.HttpPort}/dashbg?file={Uri.EscapeDataString(picked)}";
                        Invoke(() =>
                        {
                            _core.SendToJS("dashBgSelected", new { path = picked, url });
                            _core.SendToJS("log", new { msg = $"Random background: {Path.GetFileName(picked)}", color = "ok" });
                        });
                    }
                    catch (Exception ex)
                    {
                        Invoke(() => _core.SendToJS("log", new { msg = $"Random background error: {ex.Message}", color = "err" }));
                    }
                });
                break;
        }
    }

    // Ready handler (called from MainForm "ready" case)

    public void HandleReady()
    {
        _readyAt = DateTime.UtcNow;
        SendTranslation(_core.Settings.Language);
        _core.SendToJS("loadSettings", _core.Settings);
        _core.SendToJS("dateTimeFormat", new
        {
            shortDatePattern = VRCNext.Services.Helpers.DateTimeHelper.ShortDatePattern,
            is24Hour = VRCNext.Services.Helpers.DateTimeHelper.Is24Hour,
        });
        _core.SendToJS("favoritesLoaded", _photos.Favorites);
        var customColors = _core.Cache.LoadRaw(CacheHandler.KeyCustomColors);
        if (customColors != null) _core.SendToJS("customColors", customColors);
#if WINDOWS
        if (_core.Settings.MinimizeToTray)
            _core.OnTraySettingChanged?.Invoke(true, true); // autoHide on startup
#endif
        _ = VrcTryResumeAsync();
        _ = Task.Run(async () =>
        {
            await Task.Delay(3000);
            var version = await _core.UpdateService.CheckAsync();
            if (version != null)
                Invoke(() => _core.SendToJS("updateAvailable", new { version }));
        });
    }

    // VRC Debug Log Setup

    private void SetupVrcDebugLog()
    {
        if (_vrcDebugSetup) return;
        _vrcDebugSetup = true;
        _core.VrcApi.DebugLog += msg =>
        {
            try { _core.SendToJS("log", new { msg = $"[VRC] {msg}", color = "sec" }); } catch { }
        };
        _core.LogWatcher.DebugLog += msg =>
        {
            try { _core.SendToJS("log", new { msg = $"[LOG] {msg}", color = "sec" }); } catch { }
        };
        _core.World.OnCacheLog += msg =>
        {
            try { _core.SendToJS("log", new { msg = $"[CACH] {msg}", color = "sec" }); } catch { }
        };
        _core.LogWatcher.WorldChanged += (wId, loc) =>
        {
            try { _instance.HandleWorldChangedOnUiThread(wId, loc); } catch { }
            try { GlSend("gl_world_join", _core.LogWatcher.PendingWorldName is { Length: > 0 } n ? n : wId, wId); } catch { }
        };
        _core.LogWatcher.PlayerJoined += (uid, name) =>
        {
            try { _instance.HandlePlayerJoinedOnUiThread(uid, name); } catch { }
            try { GlSend("gl_player_join", name, uid); } catch { }
        };
        _core.LogWatcher.PlayerLeft += (uid, name) =>
        {
            try
            {
                // End the player's time session immediately on leave
                if (!string.IsNullOrEmpty(uid)) _core.TimeEngine.OnPlayerLeft(uid);
                _instance.PushCurrentInstanceFromCache();
            }
            catch { }
            try { GlSend("gl_player_left", name, uid); } catch { }
        };
        _core.LogWatcher.InstanceClosed += loc =>
        {
            try
            {
                _instance.RecentlyClosedLocs.Add(loc);
                if (_core.Settings.MyInstances.Remove(loc))
                {
                    _core.Settings.Save();
                    _ = Task.Run(() => _core.DispatchMessage?.Invoke("""{"type":"vrcGetMyInstances"}"""));
                }
            }
            catch { }
            try { GlSend("gl_instance_closed", "Instance closed", loc); } catch { }
        };
        _core.LogWatcher.AvatarChanged += (displayName, avatarName) =>
        {
            try
            {
                var myName = _core.VrcApi.CurrentUserRaw?["displayName"]?.ToString() ?? "";
                if (string.IsNullOrEmpty(myName) || displayName != myName) return;
                if (avatarName == _lastAvatarName) return;
                _lastAvatarName = avatarName;
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(2000);
                        await _core.Auth.GetCurrentUserLocationAsync();
                        var avatarId = _core.VrcApi.CurrentAvatarId ?? "";
                        string avatarThumb = "";
                        JObject? av = null;
                        if (!string.IsNullOrEmpty(avatarId))
                        {
                            av = await _core.Avatars.GetAvatarAsync(avatarId);
                            avatarThumb = av?["thumbnailImageUrl"]?.ToString() ?? av?["imageUrl"]?.ToString() ?? "";
                        }
                        var ev = new TimelineService.TimelineEvent
                        {
                            Type      = "avatar_switch",
                            Timestamp = DateTime.UtcNow.ToString("o"),
                            UserId    = avatarId,
                            UserName  = avatarName,
                            UserImage = avatarThumb,
                        };
                        _core.Timeline.AddEvent(ev);
                        _core.SendToJS("timelineEvent", _instance.BuildTimelinePayload(ev));

                        // Submit public avatar to avtrdb if enabled
                        if (!string.IsNullOrEmpty(avatarId) && av?["releaseStatus"]?.ToString() == "public")
                            _core.AvtrdbSubmit?.Invoke(avatarId);
                    }
                    catch { }
                });
            }
            catch { }
        };
        _core.LogWatcher.VideoUrl += url =>
        {
            try
            {
                var now = DateTime.UtcNow;
                if (_lastVideoUrl == url && (now - _lastVideoUrlTime).TotalSeconds < 30) return;
                _lastVideoUrl     = url;
                _lastVideoUrlTime = now;

                var ev = new TimelineService.TimelineEvent
                {
                    Type      = "video_url",
                    Timestamp = now.ToString("o"),
                    WorldId   = _core.LogWatcher.CurrentWorldId ?? "",
                    WorldName = _instance.CachedInstWorldName,
                    Message   = url,
                };
                _core.Timeline.AddEvent(ev);
                _core.SendToJS("timelineEvent", _instance.BuildTimelinePayload(ev));
                try
                {
                    var host = Uri.TryCreate(url, UriKind.Absolute, out var u) ? u.Host : url;
                    GlSend("gl_video_url", host, url);
                }
                catch { }
            }
            catch { }
        };
        _core.LogWatcher.ScreenshotTaken  += path => { try { GlSend("gl_screenshot",     System.IO.Path.GetFileName(path), path); } catch { } };
        _core.LogWatcher.PortalUsed       += ()   => { try { GlSend("gl_portal",         "Portal used", ""); } catch { } };
        _core.LogWatcher.AvatarBlockedPerf += ()  => { try { GlSend("gl_avatar_blocked", "Avatar blocked (perf limit)", ""); } catch { } };
        _core.LogWatcher.ConnectionLost   += ()   => { try { GlSend("gl_connection_lost","Connection lost", ""); } catch { } };
        _core.LogWatcher.ImageLoadError   += url  =>
        {
            try
            {
                var host = Uri.TryCreate(url, UriKind.Absolute, out var u2) ? u2.Host : url;
                GlSend("gl_image_error", $"Image failed: {host}", url);
            }
            catch { }
        };
    }

    private void GlSend(string type, string message, string detail)
    {
        _core.SendToJS("gameLogEvent", new
        {
            type,
            timestamp = DateTime.UtcNow.ToString("o"),
            message,
            detail,
        });
    }

    // Session Resume

    public async Task VrcTryResumeAsync()
    {
        try { await VrcTryResumeInternalAsync(); }
        catch (Exception ex) { _core.SendToJS("log", new { msg = $"VRChat: Resume error — {ex.Message}", color = "warn" }); }
    }

    private async Task VrcTryResumeInternalAsync()
    {
        SetupVrcDebugLog();

        if (!string.IsNullOrEmpty(_core.Settings.VrcAuthCookie))
        {
            _core.SendToJS("log", new { msg = "VRChat: Resuming session...", color = "sec" });
            _core.VrcApi.RestoreCookies(_core.Settings.VrcAuthCookie, _core.Settings.VrcTwoFactorCookie);

            var result = await _core.Auth.TryResumeSessionAsync();
            if (result.Success && result.User != null)
            {
                SendVrcUserData(result.User, loginFlow: true);
                _core.SendToJS("log", new { msg = $"VRChat: Reconnected as {result.User["displayName"]}", color = "ok" });
                SendAllCachedData();
                await _friends.RefreshFriendsAsync();
                _relayCtrl.StartWebSocket();
                _ = TriggerStartupBackgroundRefreshAsync();
                return;
            }

            if (result.NetworkError)
            {
                // Network not ready (post-sleep, no internet) — keep cookies, retry later
                _core.SendToJS("log", new { msg = $"VRChat: Network unavailable ({result.Error}) — cookies preserved, will retry", color = "warn" });
                _relayCtrl.ScheduleResumeRetry();
                return;
            }

            // auth failure w 401 or 403 or 2FA required.. try to lear invalid cookies
            _core.Settings.VrcAuthCookie = "";
            _core.Settings.VrcTwoFactorCookie = "";
            _core.Settings.Save();
            _core.SendToJS("log", new { msg = "VRChat: Session expired, please log in again", color = "warn" });
        }

        if (!string.IsNullOrEmpty(_core.Settings.VrcUsername))
        {
            _core.SendToJS("vrcPrefillLogin", new
            {
                username = _core.Settings.VrcUsername,
                password = _core.Settings.VrcPassword
            });
        }
    }

    // Login

    private async Task VrcLoginAsync(string username, string password)
    {
        SetupVrcDebugLog();
        _core.SendToJS("log", new { msg = "VRChat: Logging in...", color = "sec" });
        var result = await _core.Auth.LoginAsync(username, password);
        if (result.Requires2FA)
        {
            _pending2faType = result.TwoFactorType;
            _core.SendToJS("vrcNeeds2FA", new { type = result.TwoFactorType });
            _core.SendToJS("log", new { msg = $"VRChat: 2FA required ({result.TwoFactorType})", color = "warn" });
        }
        else if (result.Success && result.User != null)
        {
            _core.Settings.VrcUsername = username;
            _core.Settings.VrcPassword = password;
            SaveVrcCookies();
            _core.Settings.Save();

            SendVrcUserData(result.User, loginFlow: true);
            _core.SendToJS("log", new { msg = $"VRChat: Logged in as {result.User["displayName"]}", color = "ok" });
            await _friends.RefreshFriendsAsync();
            _relayCtrl.StartWebSocket();
            _ = TriggerStartupBackgroundRefreshAsync();
        }
        else
        {
            _core.SendToJS("vrcLoginError", new { error = result.Error ?? "Login failed" });
            _core.SendToJS("log", new { msg = $"VRChat: {result.Error}", color = "err" });
        }
    }

    // 2FA

    private async Task VrcVerify2FAAsync(string code, string type)
    {
        var result = await _core.Auth.Verify2FAAsync(code, type);
        if (result.Success && result.User != null)
        {
            SaveVrcCookies();
            _core.Settings.Save();

            SendVrcUserData(result.User, loginFlow: true);
            _core.SendToJS("log", new { msg = $"VRChat: Logged in as {result.User["displayName"]}", color = "ok" });
            await _friends.RefreshFriendsAsync();
            _relayCtrl.StartWebSocket();
            _ = TriggerStartupBackgroundRefreshAsync();
        }
        else
        {
            _core.SendToJS("vrcLoginError", new { error = result.Error ?? "2FA failed" });
            _core.SendToJS("log", new { msg = $"VRChat: 2FA error \u2014 {result.Error}", color = "err" });
        }
    }

    // Cookie Persistence

    private void SaveVrcCookies()
    {
        var (auth, tfa) = _core.VrcApi.GetCookies();
        _core.Settings.VrcAuthCookie = auth ?? "";
        _core.Settings.VrcTwoFactorCookie = tfa ?? "";
    }

    // SendVrcUserData (cross-cutting login orchestration)

    public void SendVrcUserData(JObject user, bool loginFlow = false)
    {
        _core.CurrentVrcUserId = user["id"]?.ToString() ?? "";

        if (loginFlow)
        {
            _core.LogWatcher.Start();
            _photos.StartVrcPhotoWatcher();
            _ = Task.Run(_friends.FetchAndCacheFavFriendsAsync);
        }

        if (!_instance.LogWatcherBootstrapped)
        {
            _instance.LogWatcherBootstrapped = true;
            if (!string.IsNullOrEmpty(_core.LogWatcher.CurrentWorldId) && _instance.PendingInstanceEventId == null)
            {
                var loc = _core.LogWatcher.CurrentLocation ?? _core.LogWatcher.CurrentWorldId;
                var lastJoin = _core.Timeline.GetEvents().FirstOrDefault(e => e.Type == "instance_join");
                if (lastJoin != null && lastJoin.Location == loc)
                {
                    _instance.PendingInstanceEventId = lastJoin.Id;
                    if (lastJoin.Players != null)
                    {
                        foreach (var p in lastJoin.Players)
                        {
                            if (!string.IsNullOrEmpty(p.UserId))
                                _instance.CumulativeInstancePlayers[p.UserId] = (p.DisplayName, p.Image ?? "");
                        }
                    }
                    _core.TimeEngine.OnWorldResumed(_core.LogWatcher.CurrentWorldId, loc);
                    _instance.LastTrackedWorldId = _core.LogWatcher.CurrentWorldId;
                }
                else
                {
                    // Close any open tracked instance_join event from a previous session
                    if (lastJoin != null && lastJoin.Tracked == 1 && string.IsNullOrEmpty(lastJoin.LeftAt))
                        _core.Timeline.SetInstanceEventLeftAt(lastJoin.Id, DateTime.UtcNow.ToString("o"));
                    _instance.HandleWorldChangedOnUiThread(_core.LogWatcher.CurrentWorldId, loc);
                }
                var currentPlayers = _core.LogWatcher.GetCurrentPlayers();
                foreach (var p in currentPlayers)
                {
                    if (string.IsNullOrEmpty(p.UserId)) continue;
                    if (!string.IsNullOrEmpty(_core.CurrentVrcUserId) && p.UserId == _core.CurrentVrcUserId) continue;
                    if (!_instance.CumulativeInstancePlayers.ContainsKey(p.UserId))
                        _instance.CumulativeInstancePlayers[p.UserId] = (p.DisplayName, "");
                    if (!string.IsNullOrEmpty(p.DisplayName))
                        _core.TimeEngine.UpdateUserInfo(p.UserId, p.DisplayName, "");
                    // Register catch-up players in the engine with their real log timestamp.
                    // Without this, players already present when VRCNext starts would have
                    // no active session → Time Together shows 0 instead of the real duration.
                    _core.TimeEngine.OnPlayerJoined(p.UserId, p.JoinedAt.ToUniversalTime());
                }
                // Restore active session from DB — adds gap time for players still present
                var currentPlayerIds = new HashSet<string>(
                    currentPlayers.Where(p => !string.IsNullOrEmpty(p.UserId)).Select(p => p.UserId));
                currentPlayerIds.Remove(_core.CurrentVrcUserId ?? "");
                _core.TimeEngine.RestoreActiveSession(loc, currentPlayerIds);
            }

            var presenceInstance = (user["presence"] as JObject)?["instance"]?.ToString() ?? "";
            if (presenceInstance == "offline")
            {
                var openJoin = _core.Timeline.GetEvents()
                    .FirstOrDefault(e => e.Type == "instance_join" && e.Tracked == 1 && string.IsNullOrEmpty(e.LeftAt));
                if (openJoin != null)
                {
                    _core.Timeline.SetInstanceEventLeftAt(openJoin.Id, DateTime.UtcNow.ToString("o"));
                    var closed = _core.Timeline.GetEvents().FirstOrDefault(e => e.Id == openJoin.Id);
                    if (closed != null) _core.SendToJS("timelineEvent", _instance.BuildTimelinePayload(closed));
                }
            }
        }

        var rawStatus = user["status"]?.ToString() ?? "";
        if (!string.IsNullOrEmpty(rawStatus)) _core.MyVrcStatus = rawStatus;
        _discordCtrl.PushPresence();

        var userImage = VRChatApiService.GetUserImage(user);
        var userDisplayName = user["displayName"]?.ToString() ?? "";
        var userStatus = user["status"]?.ToString() ?? "offline";
        var userStatusDesc = user["statusDescription"]?.ToString() ?? "";

        _core.SendToJS("vrcUser", new
        {
            id = user["id"]?.ToString() ?? "",
            displayName = userDisplayName,
            image = userImage,
            status = userStatus,
            statusDescription = userStatusDesc,
            currentAvatar = user["currentAvatar"]?.ToString() ?? "",
            bio = user["bio"]?.ToString() ?? "",
            pronouns = user["pronouns"]?.ToString() ?? "",
            bioLinks = user["bioLinks"]?.ToObject<List<string>>() ?? new List<string>(),
            tags = user["tags"]?.ToObject<List<string>>() ?? new List<string>(),
            profilePicOverride    = ImageCacheHelper.GetUserBannerUrl(user["id"]?.ToString(), user["profilePicOverride"]?.ToString()),
            currentAvatarImageUrl = ImageCacheHelper.GetAvatarUrl(user["currentAvatar"]?.ToString(), user["currentAvatarImageUrl"]?.ToString()),
            dateJoined        = user["date_joined"]?.ToString() ?? "",
            lastLogin         = user["last_login"]?.ToString() ?? "",
            lastPlatform      = user["last_platform"]?.ToString() ?? "",
            ageVerified       = user["ageVerified"]?.Value<bool>() ?? false,
            allowAvatarCopying = user["allowAvatarCopying"]?.Value<bool>() ?? false,
            isBoopingEnabled  = user["isBoopingEnabled"]?.Value<bool>() ?? false,
            rawJson = user,
        });

#if WINDOWS
        _core.OnTrayUserUpdate?.Invoke(userDisplayName, userStatus, userStatusDesc, userImage);
#endif

        // Fetch own badges (auth endpoint may not include badges, so fetch full user profile)
        var userId = user["id"]?.ToString() ?? "";
        if (!string.IsNullOrEmpty(userId))
        {
            _ = Task.Run(async () =>
            {
                JArray? badgesArr = user["badges"] as JArray;
                if (badgesArr == null || badgesArr.Count == 0)
                {
                    var fullUser = await _core.Users.GetUserAsync(userId);
                    badgesArr = fullUser?["badges"] as JArray ?? new JArray();
                }
                var badges = new List<object>();
                foreach (var b in badgesArr)
                {
                    if (b is not JObject bObj) continue;
                    var imageUrl = bObj["badgeImageUrl"]?.ToString() ?? "";
                    if (string.IsNullOrEmpty(imageUrl)) continue;
                    badges.Add(new
                    {
                        id = bObj["badgeId"]?.ToString() ?? "",
                        name = bObj["badgeName"]?.ToString() ?? "",
                        description = bObj["badgeDescription"]?.ToString() ?? "",
                        imageUrl, showcased = bObj["showcased"]?.Value<bool>() ?? false,
                    });
                }
                Invoke(() => _core.SendToJS("vrcMyBadges", new { badges }));
            });
        }

        if (loginFlow)
        {
            _ = Task.Run(async () =>
            {
                var balance = await _core.Economy.GetBalanceAsync();
                if (balance >= 0)
                    Invoke(() => _core.SendToJS("vrcCredits", new { balance }));
            });
        }
    }

    // Settings

    private void ApplySettings(JToken data)
    {
        try
        {
            _core.Settings.BotName = data["botName"]?.ToString() ?? "VRCNext";
            _core.Settings.BotAvatarUrl = data["botAvatar"]?.ToString() ?? "";
            _core.Settings.VrcPath = data["vrcPath"]?.ToString() ?? "";
            _core.Settings.AutoStart = data["autoStart"]?.Value<bool>() ?? false;
            _core.Settings.StartWithWindows = data["startWithWindows"]?.Value<bool>() ?? false;
            ApplyStartWithWindows(_core.Settings.StartWithWindows);
            _core.Settings.PostAll = data["postAll"]?.Value<bool>() ?? false;
            _core.Settings.Notifications = data["notifications"]?.Value<bool>() ?? true;
            _core.Settings.NotifySound = data["notifySound"]?.Value<bool>() ?? false; // legacy
            _core.Settings.NotifySoundEnabled = data["notifySoundEnabled"]?.Value<bool>() ?? false;
            _core.Settings.MessageSoundEnabled = data["messageSoundEnabled"]?.Value<bool>() ?? false;
            _core.Settings.MediaRelaySoundEnabled = data["mediaRelaySoundEnabled"]?.Value<bool>() ?? false;
            _core.Settings.SteamOverlaySoundEnabled = data["steamOverlaySoundEnabled"]?.Value<bool>() ?? true;
            _core.Settings.MinimizeToTray = data["minimizeToTray"]?.Value<bool>() ?? false;
            _core.Settings.TrayNotificationsEnabled = data["trayNotificationsEnabled"]?.Value<bool>() ?? false;
#if WINDOWS
            _core.OnTraySettingChanged?.Invoke(_core.Settings.MinimizeToTray, false);
#endif
            _core.Settings.Language = NormalizeLanguage(data["language"]?.ToString());
            _core.Settings.Theme = data["theme"]?.ToString() ?? "midnight";
            _core.Settings.SpecialTheme = data["specialTheme"]?.ToString() ?? "";
#if WINDOWS
            // Theme colors are always pushed from JS via overlayThemeColors
            // JS THEMES and would overwrite the correct colors that JS just sent.
#endif
            _core.Settings.AutoColorAccuracy = data["autoColorAccuracy"]?.Value<int>() ?? 50;
            _core.Settings.PlayBtnTheme = data["playBtnTheme"]?.ToString() ?? "";
            _core.Settings.CursorTheme = data["cursorTheme"]?.ToString() ?? "";
            var activeCustomThemes = data["activeCustomThemes"]?.ToObject<List<string>>();
            if (activeCustomThemes != null) _core.Settings.ActiveCustomThemes = activeCustomThemes;
            _core.Settings.GuiZoom = Math.Clamp(data["guiZoom"]?.Value<int>() ?? 100, 50, 200);

            var dashBg = data["dashBgPath"]?.ToString();
            if (dashBg != null) _core.Settings.DashBgPath = dashBg;
            _core.Settings.DashOpacity = data["dashOpacity"]?.Value<int>() ?? 40;
            _core.Settings.RandomDashBg = data["randomDashBg"]?.Value<bool>() ?? false;
            _core.Settings.ClockEnabled  = data["clockEnabled"]?.Value<bool>()  ?? true;
            _core.Settings.ClockAmPm     = data["clockAmPm"]?.Value<bool>()     ?? false;

            // Webhooks: explicit parsing to handle any casing
            if (data["webhooks"] is JArray whArr && whArr.Count > 0)
            {
                _core.Settings.Webhooks.Clear();
                for (int i = 0; i < Math.Min(whArr.Count, 4); i++)
                {
                    var item = whArr[i];
                    _core.Settings.Webhooks.Add(new AppSettings.WebhookSlot {
                        Name = (item["Name"] ?? item["name"])?.ToString() ?? "",
                        Url = (item["Url"] ?? item["url"])?.ToString() ?? "",
                        Enabled = (item["Enabled"] ?? item["enabled"])?.Value<bool>() ?? false,
                    });
                }
                while (_core.Settings.Webhooks.Count < 4)
                    _core.Settings.Webhooks.Add(new AppSettings.WebhookSlot { Name = $"Channel {_core.Settings.Webhooks.Count + 1}" });
            }

            var folders = data["folders"]?.ToObject<List<string>>();
            if (folders != null) _core.Settings.WatchFolders = folders;

            var relayEnabledFoldersToken = data["relayEnabledFolders"];
            if (relayEnabledFoldersToken != null)
                _core.Settings.RelayEnabledFolders = relayEnabledFoldersToken.ToObject<List<string>>();

            var extraExe = data["extraExe"]?.ToObject<List<string>>();
            if (extraExe != null) _core.Settings.ExtraExe = extraExe;

            var extraExeDesktop = data["extraExeDesktop"]?.ToObject<List<string>>();
            if (extraExeDesktop != null) _core.Settings.ExtraExeDesktop = extraExeDesktop;

            var extraExeVR = data["extraExeVR"]?.ToObject<List<string>>();
            if (extraExeVR != null) _core.Settings.ExtraExeVR = extraExeVR;

            var vrcU = data["vrcUsername"]?.ToString();
            var vrcP = data["vrcPassword"]?.ToString();
            if (vrcU != null) _core.Settings.VrcUsername = vrcU;
            if (vrcP != null) _core.Settings.VrcPassword = vrcP;

            // Space Flight settings
            _core.Settings.SfMultiplier = data["sfMultiplier"]?.Value<float>() ?? 1f;
            _core.Settings.SfLockX = data["sfLockX"]?.Value<bool>() ?? false;
            _core.Settings.SfLockY = data["sfLockY"]?.Value<bool>() ?? false;
            _core.Settings.SfLockZ = data["sfLockZ"]?.Value<bool>() ?? false;
            _core.Settings.SfLeftHand = data["sfLeftHand"]?.Value<bool>() ?? false;
            _core.Settings.SfRightHand = data["sfRightHand"]?.Value<bool>() ?? true;
            _core.Settings.SfUseGrip = data["sfUseGrip"]?.Value<bool>() ?? true;
            _core.Settings.ChatboxAutoStart = data["chatboxAutoStart"]?.Value<bool>() ?? false;
            _core.Settings.SfAutoStart = data["sfAutoStart"]?.Value<bool>() ?? false;
            _core.Settings.DiscordPresenceAutoStart = data["discordPresenceAutoStart"]?.Value<bool>() ?? false;
            // VR / Desktop split auto-starts
            _core.Settings.ChatboxAutoStartVR      = data["chatboxAutoStartVR"]?.Value<bool>()      ?? false;
            _core.Settings.ChatboxAutoStartDesktop = data["chatboxAutoStartDesktop"]?.Value<bool>() ?? false;
            _core.Settings.SfAutoStartVR           = data["sfAutoStartVR"]?.Value<bool>()           ?? false;
            _core.Settings.RelayAutoStartVR        = data["relayAutoStartVR"]?.Value<bool>()        ?? false;
            _core.Settings.RelayAutoStartDesktop   = data["relayAutoStartDesktop"]?.Value<bool>()   ?? false;
            _core.Settings.YtAutoStartVR           = data["ytAutoStartVR"]?.Value<bool>()           ?? false;
            _core.Settings.YtAutoStartDesktop      = data["ytAutoStartDesktop"]?.Value<bool>()      ?? false;
            _core.Settings.VfAutoStartVR           = data["vfAutoStartVR"]?.Value<bool>()           ?? false;
            _core.Settings.VfAutoStartDesktop      = data["vfAutoStartDesktop"]?.Value<bool>()      ?? false;
            _core.Settings.DpAutoStartVR           = data["dpAutoStartVR"]?.Value<bool>()           ?? false;
            _core.Settings.DpAutoStartDesktop      = data["dpAutoStartDesktop"]?.Value<bool>()      ?? false;
            _core.Settings.VroAutoStartVR          = data["vroAutoStartVR"]?.Value<bool>()          ?? false;
            // Avatar Scaling
            _core.Settings.AsAutoStartVR            = data["asAutoStartVR"]?.Value<bool>()            ?? false;
            _core.Settings.AsAutoStartDesktop       = data["asAutoStartDesktop"]?.Value<bool>()       ?? false;
            _core.Settings.AsUseSafetySettings      = data["asUseSafety"]?.Value<bool>()              ?? false;
            _core.Settings.AsScale                  = data["asScale"]?.Value<float>()                 ?? 1.0f;
            _core.Settings.AsScaleMin               = data["asScaleMin"]?.Value<float>()              ?? 0.5f;
            _core.Settings.AsScaleMax               = data["asScaleMax"]?.Value<float>()              ?? 3.0f;
            _core.Settings.AsSaveScaleBetweenWorlds = data["asSaveScale"]?.Value<bool>()              ?? false;
            _core.Settings.AsKeyUp                  = data["asKeyUp"]?.Value<int>()                   ?? 0;
            _core.Settings.AsKeyDown                = data["asKeyDown"]?.Value<int>()                 ?? 0;
            _core.Settings.AsSmoothing              = data["asSmoothing"]?.Value<float>()             ?? 30f;
            _core.Settings.VroWaterEnabled = data["vroWaterEnabled"]?.Value<bool>() ?? false;
            _core.Settings.VroWaterHours   = data["vroWaterHours"]?.Value<int>()    ?? 1;
            _core.Settings.VroWaterMinutes = data["vroWaterMinutes"]?.Value<int>()  ?? 0;
            _core.Settings.DpHideInstIdJoinMe  = data["dpHideInstIdJoinMe"]?.Value<bool>()  ?? false;
            _core.Settings.DpHideInstIdOnline  = data["dpHideInstIdOnline"]?.Value<bool>()  ?? false;
            _core.Settings.DpHideInstIdAskMe   = data["dpHideInstIdAskMe"]?.Value<bool>()   ?? true;
            _core.Settings.DpHideInstIdBusy    = data["dpHideInstIdBusy"]?.Value<bool>()    ?? true;
            _core.Settings.DpHideLocJoinMe     = data["dpHideLocJoinMe"]?.Value<bool>()     ?? false;
            _core.Settings.DpHideLocOnline     = data["dpHideLocOnline"]?.Value<bool>()     ?? false;
            _core.Settings.DpHideLocAskMe      = data["dpHideLocAskMe"]?.Value<bool>()      ?? true;
            _core.Settings.DpHideLocBusy       = data["dpHideLocBusy"]?.Value<bool>()       ?? true;
            _core.Settings.DpHidePlayersJoinMe = data["dpHidePlayersJoinMe"]?.Value<bool>() ?? false;
            _core.Settings.DpHidePlayersOnline = data["dpHidePlayersOnline"]?.Value<bool>() ?? false;
            _core.Settings.DpHidePlayersAskMe  = data["dpHidePlayersAskMe"]?.Value<bool>()  ?? true;
            _core.Settings.DpHidePlayersBusy   = data["dpHidePlayersBusy"]?.Value<bool>()   ?? true;
            _core.Settings.DpHideJoinBtnJoinMe = data["dpHideJoinBtnJoinMe"]?.Value<bool>() ?? false;
            _core.Settings.DpHideJoinBtnOnline = data["dpHideJoinBtnOnline"]?.Value<bool>() ?? false;
            _core.Settings.DpHideJoinBtnAskMe  = data["dpHideJoinBtnAskMe"]?.Value<bool>()  ?? true;
            _core.Settings.DpHideJoinBtnBusy   = data["dpHideJoinBtnBusy"]?.Value<bool>()   ?? true;

            // Image cache
            _core.Settings.ImgCacheLimitGb         = Math.Clamp(data["imgCacheLimitGb"]?.Value<int>() ?? 5, 5, 30);
            _core.Settings.ImgCacheOptimizeEnabled = data["imgCacheOptimizeEnabled"]?.Value<bool>() ?? true;
            ImageCacheHelper.LimitGb         = _core.Settings.ImgCacheLimitGb;
            ImageCacheHelper.OptimizeEnabled = _core.Settings.ImgCacheOptimizeEnabled;

            // Fast Fetch Cache
            _core.Settings.FfcEnabled = data["ffcEnabled"]?.Value<bool>() ?? true;

            // Avtrdb Support
            _core.Settings.AvtrdbReportDeleted = data["avtrdbReportDeleted"]?.Value<bool>() ?? true;
            _core.Settings.AvtrdbSubmitAvatars = data["avtrdbSubmitAvatars"]?.Value<bool>() ?? false;

            // Avtr.icu Support
            _core.Settings.AvtrIcuReportDeleted = data["avtrIcuReportDeleted"]?.Value<bool>() ?? true;
            _core.Settings.AvtrIcuSubmitAvatars = data["avtrIcuSubmitAvatars"]?.Value<bool>() ?? false;

            // Memory Trim
            _core.Settings.MemoryTrimEnabled = data["memoryTrimEnabled"]?.Value<bool>() ?? false;
            _core.MemTrim.SetEnabled(_core.Settings.MemoryTrimEnabled);

            // Database optimization (requires restart to take effect)
            _core.Settings.DbOptimize           = data["dbOptimize"]?.Value<bool>() ?? true;
            _core.Settings.DbOptimizeMaxEntries = Math.Clamp(data["dbOptimizeMaxEntries"]?.Value<int>() ?? 500, 500, 250000);

            // Auto-Update
            _core.Settings.AutoUpdate = data["autoUpdate"]?.Value<bool>() ?? true;

            // Crash Reporting
            _core.Settings.SendCrashData       = data["sendCrashData"]?.Value<bool>()       ?? true;
            _core.Settings.RestartAfterCrash   = data["restartAfterCrash"]?.Value<bool>()   ?? true;

            // Text Tools
            _core.Settings.TextToolsEnabled = data["textToolsEnabled"]?.Value<bool>() ?? false;

            // Window Behavior
            _core.Settings.RememberWindowSize     = data["rememberWindowSize"]?.Value<bool>()     ?? false;
            _core.Settings.RememberWindowPosition = data["rememberWindowPosition"]?.Value<bool>() ?? false;

            // Auto-Backups
            _core.Settings.RegBackupEnabled    = data["regBackupEnabled"]?.Value<bool>()    ?? true;
            _core.Settings.RegBackupDays       = data["regBackupDays"]?.Value<int>()        ?? 30;
            _core.Settings.DbAutoBackupEnabled = data["dbAutoBackupEnabled"]?.Value<bool>() ?? true;
            _core.Settings.DbAutoBackupDays    = data["dbAutoBackupDays"]?.Value<int>()     ?? 60;

            // Performance flags (require restart)
            _core.Settings.GpuAcceleration    = data["gpuAcceleration"]?.Value<bool>()    ?? false;
            _core.Settings.GpuShaderCache     = data["gpuShaderCache"]?.Value<bool>()     ?? false;
            _core.Settings.V8Heap128          = data["v8Heap128"]?.Value<bool>()          ?? false;
            _core.Settings.TwoRenderProcesses = data["twoRenderProcesses"]?.Value<bool>() ?? false;

            // Dashboard layout
            var dashOrder  = data["dashSectionOrder"]?.ToObject<List<string>>();
            var dashHidden = data["dashSectionHidden"]?.ToObject<List<string>>();
            if (dashOrder  != null) _core.Settings.DashSectionOrder  = dashOrder;
            if (dashHidden != null) _core.Settings.DashSectionHidden = dashHidden;

            _core.Settings.Save();
            if (_core.Settings.LastSaveError != null)
            {
                _core.SendToJS("log", new { msg = $"❌ Save failed: {_core.Settings.LastSaveError}", color = "err" });
                _core.SendToJS("toast", new { ok = false, msg = "Failed to save this setting, please report this error" });
            }
            else if (DateTime.UtcNow - _readyAt > TimeSpan.FromSeconds(3))
            {
                _core.SendToJS("toast", new { ok = true, msg = "Saved" });
            }

            _core.PushDiscordPresence?.Invoke();

            // No-op with Photino — watch folders served via /media{i}/ routes
        }
        catch (Exception ex)
        {
            _core.SendToJS("log", new { msg = $"Save error: {ex.Message}", color = "err" });
            _core.SendToJS("toast", new { ok = false, msg = "Failed to save this setting, please report this error" });
        }
    }

    private static string NormalizeLanguage(string? language)
    {
        return (language ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "de" => "de",
            "es" => "es",
            "fr" => "fr",
            "ja" => "ja",
            "zh-cn" => "zh-CN",
            "zh_cn" => "zh-CN",
            _ => "en"
        };
    }

    private void SendTranslation(string? requestedLanguage)
    {
        try
        {
            var language = NormalizeLanguage(requestedLanguage);
            var i18nDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "frontend", "i18n");
            var path = Path.Combine(i18nDir, $"{language}.json");
            var fallbackPath = Path.Combine(i18nDir, "en.json");
            var json = File.Exists(path)
                ? File.ReadAllText(path)
                : File.Exists(fallbackPath)
                    ? File.ReadAllText(fallbackPath)
                    : "{}";
            var translations = JObject.Parse(json);
            _core.SendToJS("translationData", new { language, translations });
        }
        catch (Exception ex)
        {
            _core.SendToJS("log", new { msg = $"Translation load failed: {ex.Message}", color = "err" });
            _core.SendToJS("translationData", new { language = "en", translations = new JObject() });
        }
    }

    // Start With Windows

    internal static void ApplyStartWithWindows(bool enable)
    {
#if WINDOWS
        using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
        if (key == null) return;
        var exe = Environment.ProcessPath ?? "";
        if (enable)
            key.SetValue("VRCNext", $"\"{exe}\" --minimized");
        else
            key.DeleteValue("VRCNext", throwOnMissingValue: false);
#else
        var dir  = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "autostart");
        var file = Path.Combine(dir, "VRCNext.desktop");
        if (enable)
        {
            Directory.CreateDirectory(dir);
            var exe = Environment.ProcessPath ?? "VRCNext";
            File.WriteAllText(file,
                "[Desktop Entry]\n" +
                "Type=Application\n" +
                "Name=VRCNext\n" +
                $"Exec=\"{exe}\" --minimized\n" +
                "Hidden=false\n" +
                "NoDisplay=false\n" +
                "X-GNOME-Autostart-enabled=true\n" +
                "StartupNotify=false\n");
        }
        else if (File.Exists(file)) File.Delete(file);
#endif
    }

    // VRC Path Detection

    internal static string? DetectVrcLaunchExe()
    {
        var candidates = new List<string>();

#if WINDOWS
        foreach (var drive in DriveInfo.GetDrives())
        {
            if (drive.DriveType != DriveType.Fixed) continue;
            var root = drive.RootDirectory.FullName;
            candidates.Add(Path.Combine(root, "Program Files (x86)", "Steam", "steamapps", "common", "VRChat", "launch.exe"));
            candidates.Add(Path.Combine(root, "Program Files", "Steam", "steamapps", "common", "VRChat", "launch.exe"));
            candidates.Add(Path.Combine(root, "Steam", "steamapps", "common", "VRChat", "launch.exe"));
            candidates.Add(Path.Combine(root, "SteamLibrary", "steamapps", "common", "VRChat", "launch.exe"));
            candidates.Add(Path.Combine(root, "Games", "Steam", "steamapps", "common", "VRChat", "launch.exe"));
            candidates.Add(Path.Combine(root, "Games", "SteamLibrary", "steamapps", "common", "VRChat", "launch.exe"));
        }

        var steamVdfWin = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            "Steam", "steamapps", "libraryfolders.vdf");
        AddVdfLibraries(steamVdfWin, candidates, "launch.exe");
#else
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var linuxSteamRoots = new[]
        {
            Path.Combine(home, ".local", "share", "Steam"),
            Path.Combine(home, ".steam", "steam"),
            Path.Combine(home, ".steam", "root"),
        };
        foreach (var sr in linuxSteamRoots)
        {
            candidates.Add(Path.Combine(sr, "steamapps", "common", "VRChat", "VRChat.exe"));
            candidates.Add(Path.Combine(sr, "steamapps", "common", "VRChat", "launch.exe"));
            AddVdfLibraries(Path.Combine(sr, "steamapps", "libraryfolders.vdf"), candidates, "VRChat.exe");
        }
#endif
        return candidates.FirstOrDefault(File.Exists);
    }

    private static void AddVdfLibraries(string vdfPath, List<string> candidates, string exe)
    {
        try
        {
            if (!File.Exists(vdfPath)) return;
            var vdf = File.ReadAllText(vdfPath);
            foreach (System.Text.RegularExpressions.Match m in
                System.Text.RegularExpressions.Regex.Matches(vdf, "\"path\"\\s+\"([^\"]+)\""))
            {
                var libPath = m.Groups[1].Value.Replace("\\\\", "\\");
                candidates.Add(Path.Combine(libPath, "steamapps", "common", "VRChat", exe));
            }
        }
        catch { }
    }

    internal static string DetectVrcPhotoDir()
    {
#if WINDOWS
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "VRChat");
        return Directory.Exists(path) ? path : "";
#else
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var steamRoots = new[]
        {
            Path.Combine(home, ".local", "share", "Steam"),
            Path.Combine(home, ".steam", "steam"),
        };
        foreach (var sr in steamRoots)
        {
            var protonPath = Path.Combine(sr, "steamapps", "compatdata", "438100",
                "pfx", "drive_c", "users", "steamuser", "My Pictures", "VRChat");
            if (Directory.Exists(protonPath)) return protonPath;

            var protonPath2 = Path.Combine(sr, "steamapps", "compatdata", "438100",
                "pfx", "drive_c", "users", "steamuser", "Pictures", "VRChat");
            if (Directory.Exists(protonPath2)) return protonPath2;
        }
        var native = Path.Combine(home, "Pictures", "VRChat");
        return Directory.Exists(native) ? native : "";
#endif
    }

    // Cache Send / Startup Refresh

    internal class WFavGroup
    {
        public string name        { get; set; } = "";
        public string displayName { get; set; } = "";
        public string type        { get; set; } = "";
        public int    capacity    { get; set; } = 25;
        public string visibility  { get; set; } = "private";
    }

    internal static List<WFavGroup> FillMissingWorldSlots(List<WFavGroup> groupList)
    {
        var existing = new HashSet<string>(groupList.Select(g => g.name));

        var regularSlots = new[] {
            ("worlds1", "Worlds 1", "world"), ("worlds2", "Worlds 2", "world"),
            ("worlds3", "Worlds 3", "world"), ("worlds4", "Worlds 4", "world")
        };
        foreach (var (sName, sDisplay, sType) in regularSlots)
            if (!existing.Contains(sName))
                groupList.Add(new WFavGroup { name = sName, displayName = sDisplay, type = sType });

        bool hasVrcPlus = groupList.Any(g => g.type == "vrcPlusWorld");
        if (hasVrcPlus)
        {
            var vrcPlusSlots = new[] {
                ("vrcPlusWorlds1", "VRC+ Worlds 1", "vrcPlusWorld"), ("vrcPlusWorlds2", "VRC+ Worlds 2", "vrcPlusWorld"),
                ("vrcPlusWorlds3", "VRC+ Worlds 3", "vrcPlusWorld"), ("vrcPlusWorlds4", "VRC+ Worlds 4", "vrcPlusWorld")
            };
            foreach (var (sName, sDisplay, sType) in vrcPlusSlots)
                if (!existing.Contains(sName))
                    groupList.Add(new WFavGroup { name = sName, displayName = sDisplay, type = sType });
        }

        return groupList
            .OrderBy(g => g.type == "vrcPlusWorld" ? 1 : 0)
            .ThenBy(g => g.name)
            .ToList();
    }

    internal static List<WFavGroup> FillMissingAvatarSlots(List<WFavGroup> groupList)
    {
        var existing = new HashSet<string>(groupList.Select(g => g.name));

        var slots = new[] {
            ("avatars1", "Avatars 1", "avatar"),
            ("avatars2", "Avatars 2", "avatar"),
            ("avatars3", "Avatars 3", "avatar"),
            ("avatars4", "Avatars 4", "avatar"),
            ("avatars5", "Avatars 5", "avatar"),
            ("avatars6", "Avatars 6", "avatar"),
        };
        foreach (var (sName, sDisplay, sType) in slots)
            if (!existing.Contains(sName))
                groupList.Add(new WFavGroup { name = sName, displayName = sDisplay, type = sType });

        return groupList
            .OrderBy(g => g.name)
            .ToList();
    }

    internal static List<WFavGroup> FillMissingFriendSlots(List<WFavGroup> groupList)
    {
        var existing = new HashSet<string>(groupList.Select(g => g.name));
        var slots = new[] {
            ("group_0", "Group 1", "friend"),
            ("group_1", "Group 2", "friend"),
            ("group_2", "Group 3", "friend"),
        };
        foreach (var (sName, sDisplay, sType) in slots)
            if (!existing.Contains(sName))
                groupList.Add(new WFavGroup { name = sName, displayName = sDisplay, type = sType, capacity = 150 });
        foreach (var g in groupList) if (g.capacity < 100) g.capacity = 150;
        return groupList.OrderBy(g => g.name).ToList();
    }

    public async Task FetchAndCacheFavWorldsAsync()
    {
        if (Interlocked.CompareExchange(ref _favWorldsInFlight, 1, 0) != 0) return; // already running
        try
        {
            var groups = _cachedFavGroups ?? await _core.Favorites.GetFavoriteGroupsAsync();
            _cachedFavGroups = groups;
            var worldTypes = new HashSet<string> { "world", "vrcPlusWorld" };
            var groupList = groups
                .Where(g => worldTypes.Contains(g["type"]?.ToString() ?? ""))
                .Select(g => new WFavGroup {
                    name        = g["name"]?.ToString() ?? "",
                    displayName = g["displayName"]?.ToString() ?? "",
                    type        = g["type"]?.ToString() ?? "world",
                    visibility  = g["visibility"]?.ToString() ?? "private",
                })
                .Where(g => !string.IsNullOrEmpty(g.name))
                .ToList();
            groupList = FillMissingWorldSlots(groupList);

            var sem = new SemaphoreSlim(4, 4);
            var perGroup = new System.Collections.Concurrent.ConcurrentDictionary<string, List<JObject>>();
            await Task.WhenAll(groupList.Select(async g =>
            {
                await sem.WaitAsync();
                try { perGroup[g.name] = await _core.Favorites.GetFavoriteWorldsByGroupAsync(g.name, 100); }
                finally { sem.Release(); }
            }));

            var allWorlds = new List<object>();
            foreach (var g in groupList)
            {
                if (!perGroup.TryGetValue(g.name, out var groupWorlds)) continue;
                foreach (var w in groupWorlds)
                {
                    var wid = w["id"]?.ToString() ?? "";
                    var stats = _core.TimeEngine.GetWorldStats(wid);
                    var rawWorldImg = ImageCacheHelper.GetWorldUrl(wid, w["imageUrl"]?.ToString() ?? w["thumbnailImageUrl"]?.ToString());
                    allWorlds.Add(new
                    {
                        id                = wid,
                        name              = w["name"]?.ToString() ?? "",
                        imageUrl          = rawWorldImg,
                        thumbnailImageUrl = rawWorldImg,
                        authorName        = w["authorName"]?.ToString() ?? "",
                        occupants         = w["occupants"]?.Value<int>()  ?? 0,
                        capacity          = w["capacity"]?.Value<int>()   ?? 0,
                        favorites         = w["favorites"]?.Value<int>()  ?? 0,
                        visits            = w["visits"]?.Value<int>()     ?? 0,
                        tags              = w["tags"]?.ToObject<List<string>>() ?? new List<string>(),
                        favoriteGroup     = g.name,
                        favoriteId        = w["favoriteId"]?.ToString() ?? "",
                        worldTimeSeconds  = stats.totalSeconds,
                        worldVisitCount   = stats.visitCount,
                    });
                }
            }

            var payload = new { worlds = allWorlds, groups = groupList };
            if (_core.Settings.FfcEnabled) _core.Cache.Save(CacheHandler.KeyFavWorlds, payload);
            Invoke(() => _core.SendToJS("vrcFavoriteWorlds", payload));
        }
        catch (Exception ex)
        {
            Invoke(() => _core.SendToJS("log", new { msg = $"Favorite worlds error: {ex.Message}", color = "err" }));
        }
        finally { Interlocked.Exchange(ref _favWorldsInFlight, 0); }
    }

    public async Task FetchAndCacheFavAvatarsAsync()
    {
        if (Interlocked.CompareExchange(ref _favAvatarsInFlight, 1, 0) != 0) return; // already running
        try
        {
            var groups = _cachedFavGroups ?? await _core.Favorites.GetFavoriteGroupsAsync();
            _cachedFavGroups = groups;
            var avatarTypes = new HashSet<string> { "avatar" };
            var groupList = groups
                .Where(g => avatarTypes.Contains(g["type"]?.ToString() ?? ""))
                .Select(g => new WFavGroup {
                    name        = g["name"]?.ToString() ?? "",
                    displayName = g["displayName"]?.ToString() ?? "",
                    type        = g["type"]?.ToString() ?? "avatar"
                })
                .Where(g => !string.IsNullOrEmpty(g.name))
                .ToList();
            groupList = FillMissingAvatarSlots(groupList);
            int avCap = _core.VrcApi.HasVrcPlus ? 50 : 25;
            foreach (var g in groupList) g.capacity = avCap;

            var sem = new SemaphoreSlim(4, 4);
            var perGroup = new System.Collections.Concurrent.ConcurrentDictionary<string, List<JObject>>();
            await Task.WhenAll(groupList.Select(async g =>
            {
                await sem.WaitAsync();
                try { perGroup[g.name] = await _core.Favorites.GetFavoriteAvatarsByGroupAsync(g.name, 100); }
                finally { sem.Release(); }
            }));

            var allAvatarsRaw = new List<object>();
            var allAvatarsJs  = new List<object>();
            foreach (var g in groupList)
            {
                if (!perGroup.TryGetValue(g.name, out var groupAvatars)) continue;
                foreach (var a in groupAvatars)
                {
                    var rawUrl    = a["imageUrl"]?.ToString() ?? a["thumbnailImageUrl"]?.ToString() ?? "";
                    var img       = ImageCacheHelper.GetAvatarUrl(a["id"]?.ToString(), rawUrl);
                    var id        = a["id"]?.ToString() ?? "";
                    var name      = a["name"]?.ToString() ?? "";
                    var author    = a["authorName"]?.ToString() ?? "";
                    var release   = a["releaseStatus"]?.ToString() ?? "private";
                    var fvrtId    = a["favoriteId"]?.ToString() ?? "";
                    var pkgs      = (a["unityPackages"] as JArray ?? new JArray())
                        .Select(p => new { platform = p["platform"]?.ToString() ?? "", variant = p["variant"]?.ToString() ?? "" })
                        .ToArray();
                    allAvatarsRaw.Add(new { id, name, imageUrl = rawUrl, thumbnailImageUrl = rawUrl, authorName = author, releaseStatus = release, favoriteGroup = g.name, favoriteId = fvrtId, unityPackages = pkgs });
                    allAvatarsJs.Add(new  { id, name, imageUrl = img,    thumbnailImageUrl = img,    authorName = author, releaseStatus = release, favoriteGroup = g.name, favoriteId = fvrtId, unityPackages = pkgs });
                }
            }

            if (_core.Settings.FfcEnabled) _core.Cache.Save(CacheHandler.KeyFavAvatars, new { avatars = allAvatarsRaw, groups = groupList });
            Invoke(() => _core.SendToJS("vrcFavoriteAvatars", new { avatars = allAvatarsJs, groups = groupList }));
        }
        catch (Exception ex)
        {
            Invoke(() => _core.SendToJS("log", new { msg = $"Favorite avatars error: {ex.Message}", color = "err" }));
        }
        finally { Interlocked.Exchange(ref _favAvatarsInFlight, 0); }
    }

    public async Task FetchAndCacheAvatarsAsync()
    {
        try
        {
            var avatars = await _core.Avatars.GetOwnAvatarsAsync();
            // Build with raw CDN URLs so FFC can detect image changes on next load
            var rawList = avatars.Select(a => new
            {
                id                = a["id"]?.ToString() ?? "",
                name              = a["name"]?.ToString() ?? "",
                imageUrl          = a["imageUrl"]?.ToString() ?? a["thumbnailImageUrl"]?.ToString() ?? "",
                thumbnailImageUrl = a["thumbnailImageUrl"]?.ToString() ?? a["imageUrl"]?.ToString() ?? "",
                authorName        = a["authorName"]?.ToString() ?? "",
                releaseStatus     = a["releaseStatus"]?.ToString() ?? "private",
                description       = a["description"]?.ToString() ?? "",
                unityPackages     = (a["unityPackages"] as JArray ?? new JArray())
                    .Select(p => new { platform = p["platform"]?.ToString() ?? "", variant = p["variant"]?.ToString() ?? "" })
                    .ToArray(),
            }).ToList();
            if (_core.Settings.FfcEnabled)
                _core.Cache.Save(CacheHandler.KeyAvatars, new { filter = "own", avatars = rawList, currentAvatarId = _core.VrcApi.CurrentAvatarId ?? "" });
            // Send to JS with processed image URLs (disk cache or CDN)
            var jsList = rawList.Select(a => { var img = ImageCacheHelper.GetAvatarUrl(a.id, a.imageUrl); return new { a.id, a.name, imageUrl = img, thumbnailImageUrl = img, a.authorName, a.releaseStatus, a.description, a.unityPackages }; }).ToList();
            Invoke(() => _core.SendToJS("vrcAvatars", new { filter = "own", avatars = jsList, currentAvatarId = _core.VrcApi.CurrentAvatarId ?? "" }));
        }
        catch (Exception ex)
        {
            Invoke(() => _core.SendToJS("log", new { msg = $"Avatar load error: {ex.Message}", color = "err" }));
        }
    }

    private void SendAllCachedData()
    {
        var customColors = _core.Cache.LoadRaw(CacheHandler.KeyCustomColors);
        if (customColors != null) _core.SendToJS("customColors", customColors);

        if (!_core.Settings.FfcEnabled) return;

        // Re-process image URLs before sending — FFC stores raw CDN URLs that bypass ImageCache
        if (_core.Cache.LoadRaw(CacheHandler.KeyAvatars) is JObject avatarsObj)
        {
            foreach (var a in avatarsObj["avatars"] as JArray ?? new JArray())
                if (a is JObject ao)
                {
                    ao["imageUrl"] = ImageCacheHelper.GetAvatarUrl(ao["id"]?.ToString(), ao["imageUrl"]?.ToString() ?? ao["thumbnailImageUrl"]?.ToString());
                    ao["thumbnailImageUrl"] = ao["imageUrl"];
                }
            _core.SendToJS("vrcAvatars", avatarsObj);
        }

        if (_core.Cache.LoadRaw(CacheHandler.KeyFavWorlds) is JObject favWorldsObj)
        {
            foreach (var grp in favWorldsObj["worlds"] as JArray ?? new JArray())
                if (grp is JObject wo)
                {
                    wo["imageUrl"] = ImageCacheHelper.GetWorldUrl(wo["id"]?.ToString(), wo["imageUrl"]?.ToString() ?? wo["thumbnailImageUrl"]?.ToString());
                    wo["thumbnailImageUrl"] = wo["imageUrl"];
                }
            _core.SendToJS("vrcFavoriteWorlds", favWorldsObj);
        }

        if (_core.Cache.LoadRaw(CacheHandler.KeyFavAvatars) is JObject favAvatarsObj)
        {
            foreach (var a in favAvatarsObj["avatars"] as JArray ?? new JArray())
                if (a is JObject ao)
                {
                    ao["imageUrl"] = ImageCacheHelper.GetAvatarUrl(ao["id"]?.ToString(), ao["imageUrl"]?.ToString() ?? ao["thumbnailImageUrl"]?.ToString());
                    ao["thumbnailImageUrl"] = ao["imageUrl"];
                }
            _core.SendToJS("vrcFavoriteAvatars", favAvatarsObj);
        }

        if (_core.Cache.LoadRaw(CacheHandler.KeyFavFriends) is JObject favFriendsObj)
            _core.SendToJS("vrcFavoriteFriends", favFriendsObj);
    }

    private static readonly TimeSpan StartupCacheTtl = TimeSpan.FromDays(1);

    private async Task TriggerStartupBackgroundRefreshAsync()
    {
        if (!_core.VrcApi.IsLoggedIn) return;
        _ = Task.Run(_groups.FetchRepresentedGroupAsync);
        if (!_core.Cache.IsFresh(CacheHandler.KeyAvatars,    StartupCacheTtl)) _ = Task.Run(FetchAndCacheAvatarsAsync);
        if (!_core.Cache.IsFresh(CacheHandler.KeyGroups,    StartupCacheTtl))  _ = Task.Run(_groups.FetchAndCacheAsync);
        if (!_core.Cache.IsFresh(CacheHandler.KeyFavWorlds, StartupCacheTtl)) _ = Task.Run(FetchAndCacheFavWorldsAsync);
        if (!_core.Cache.IsFresh(CacheHandler.KeyFavAvatars, StartupCacheTtl)) _ = Task.Run(FetchAndCacheFavAvatarsAsync);
        if (!_core.Cache.IsFresh(CacheHandler.KeyFavFriends, StartupCacheTtl)) _ = Task.Run(_friends.FetchAndCacheFavFriendsAsync);
        if (_core.PrefetchSharedContent != null) _ = Task.Run(_core.PrefetchSharedContent);
        _ = Task.Run(CollectWorldStatsIfMissingAsync);
        if (_core.Settings.AutoUpdate) _ = Task.Run(AutoUpdateAsync);
        await Task.CompletedTask;
    }

    private async Task AutoUpdateAsync()
    {
        try
        {
            var version = await _core.UpdateService.CheckAsync();
            if (version == null) return;

            Invoke(() => _core.SendToJS("updateAvailable", new { version }));

            await _core.UpdateService.DownloadAsync(p =>
                Invoke(() => _core.SendToJS("updateProgress", p)));

            Invoke(() => _core.SendToJS("updateReady", null));
            await Task.Delay(800);
            Invoke(() => _core.UpdateService.ApplyAndRestart());
        }
        catch { }
    }

    private async Task CollectWorldStatsIfMissingAsync()
    {
        try
        {
            if (!_core.VrcApi.IsLoggedIn) return;
            if (_core.Timeline.HasWorldStatsForCurrentHour()) return;
            var worlds = await _core.World.GetMyWorldsAsync();
            foreach (var w in worlds)
            {
                var id = w["id"]?.ToString();
                if (string.IsNullOrEmpty(id)) continue;
                var active    = w["occupants"]?.Value<int>() ?? 0;
                var favorites = w["favorites"]?.Value<int>() ?? 0;
                var visits    = w["visits"]?.Value<int>() ?? 0;
                _core.Timeline.InsertWorldStats(id, active, favorites, visits);
            }
        }
        catch { }
    }

    public async Task ForceFfcAllAsync()
    {
        if (!_core.VrcApi.IsLoggedIn) return;

        void Progress(int current, int total, string label) =>
            Invoke(() => _core.SendToJS("ffcProgress", new {
                progress = total > 0 ? (int)((double)current / total * 100) : 0,
                label,
                done = false
            }));

        try
        {
            var friendIds = _friends.GetTrackedUserIds();
            int total = friendIds.Count + 4;
            int completed = 0;

            Progress(completed, total, "Caching avatars...");
            await FetchAndCacheAvatarsAsync();
            Progress(++completed, total, "Caching favorite avatars...");
            await FetchAndCacheFavAvatarsAsync();
            Progress(++completed, total, "Caching groups...");
            await _groups.FetchAndCacheAsync();
            Progress(++completed, total, "Caching worlds...");
            await FetchAndCacheFavWorldsAsync();

            var semaphore = new SemaphoreSlim(4, 4);
            var tasks = friendIds.Select(async uid =>
            {
                await semaphore.WaitAsync();
                try
                {
                    var payload = await _friends.BuildUserDetailPayloadAsync(uid);
                    if (payload != null)
                    {
                        _core.TimeEngine.SaveUserProfileCache(uid, Newtonsoft.Json.JsonConvert.SerializeObject(payload));
                    }
                    await Task.Delay(250);
                }
                catch { }
                finally
                {
                    semaphore.Release();
                    int c = Interlocked.Increment(ref completed);
                    Progress(c, total, $"Caching profiles... ({c - 3}/{friendIds.Count})");
                }
            });

            await Task.WhenAll(tasks);

            Invoke(() =>
            {
                _core.SendToJS("ffcProgress", new { progress = 100, label = $"Done! {friendIds.Count} profiles cached.", done = true });
                _core.SendToJS("log", new { msg = $"FFC: {friendIds.Count} profiles + avatars + groups + worlds cached.", color = "ok" });
            });
        }
        catch (Exception ex)
        {
            Invoke(() => _core.SendToJS("ffcProgress", new { progress = 0, label = "Error: " + ex.Message, done = true }));
        }
    }
}
