using System.Collections.Concurrent;
using Photino.NET;
using VRCNext.Services;

namespace VRCNext;

public class CoreLibrary
{
    public VRChatApiService VrcApi { get; }

    public AuthAPI Auth { get; }
    public UsersAPI Users { get; }
    public FriendsAPI Friends { get; }
    public AvatarsAPI Avatars { get; }
    public WorldAPI World { get; }
    public InstancesAPI Instances { get; }
    public InviteAPI Invite { get; }
    public FavoritesAPI Favorites { get; }
    public GroupsAPI Groups { get; }
    public CalendarAPI Calendar { get; }
    public NotificationsAPI Notifications { get; }
    public PlayerModerationAPI PlayerModeration { get; }
    public FilesAPI Files { get; }
    public InventoryAPI Inventory { get; }
    public EconomyAPI Economy { get; }
    public VRChatLogWatcher LogWatcher { get; }
    public TimelineService Timeline { get; }
    public AppSettings Settings { get; }
    public CacheHandler Cache { get; }
    public UnifiedTimeEngine TimeEngine { get; }
    public PhotoPlayersStore PhotoPlayersStore { get; }
    public WebhookService Webhook { get; }
    public FileWatcherService FileWatcher { get; }
    public Action<string, object?> SendToJS { get; }
    public Action<string>? AvtrdbSubmit { get; set; }

    public ConcurrentDictionary<string, bool> PlayerAgeVerifiedCache { get; } = new();
    public ConcurrentDictionary<string, Newtonsoft.Json.Linq.JObject> PlayerProfileCache { get; } = new();

    public Dictionary<string, (string name, string thumb)> VrWorldCache { get; } = new();

    public string CurrentVrcUserId { get; set; } = "";
    public string MyVrcStatus { get; set; } = "active";

    // cap profile cache to avoid unbounded growth across long sessions
    private const int ProfileCacheMax = 500;
    public void CachePlayerProfile(string userId, Newtonsoft.Json.Linq.JObject profile)
    {
        if (PlayerProfileCache.Count >= ProfileCacheMax)
            PlayerProfileCache.Clear();
        PlayerProfileCache[userId] = profile;
    }

    // Permini — userId → (allowActive, allowAskMe, allowDnD)
    public Dictionary<string, (bool allowActive, bool allowAskMe, bool allowDnD)> PerminiList { get; } = new();
    public DateTime DiscordJoinedAt { get; set; } = DateTime.MinValue;
    public int HttpPort { get; set; }
    public string CustomThemesDir { get; set; } = "";

    public MemoryTrimService MemTrim { get; }
    public UpdateService UpdateService { get; }

    public PhotinoWindow? Window { get; set; }

    public Func<Task>? PrefetchSharedContent { get; set; }
    public Action? PushDiscordPresence { get; set; }
    public Func<bool>? IsVrcRunning { get; set; }
    public Func<bool>? IsSteamVrRunning { get; set; }
    public Func<string, string>? GetVirtualMediaUrl { get; set; }
    public Action<string>? LoadPage { get; set; }
    public Func<string, Task>? DispatchMessage { get; set; }

#if WINDOWS
    public VRSubprocessHost? VrOverlay { get; set; }
    public Action<bool, bool>? OnTraySettingChanged { get; set; } // (enabled, autoHideNow)
    public Action<string, string, string, string>? OnTrayUserUpdate { get; set; } // name, status, statusDesc, imageUrl
    public Action<Dictionary<string, string>>? OnTrayThemeUpdate { get; set; }
#endif

    public CoreLibrary(
        VRChatApiService vrcApi,
        VRChatLogWatcher logWatcher,
        TimelineService timeline,
        AppSettings settings,
        CacheHandler cache,
        UnifiedTimeEngine timeEngine,
        PhotoPlayersStore photoPlayersStore,
        WebhookService webhook,
        FileWatcherService fileWatcher,
        MemoryTrimService memTrim,
        UpdateService updateService,
        Action<string, object?> sendToJS)
    {
        VrcApi = vrcApi;
        Auth             = new AuthAPI(vrcApi);
        Users            = new UsersAPI(vrcApi);
        Friends          = new FriendsAPI(vrcApi);
        Avatars          = new AvatarsAPI(vrcApi);
        World            = new WorldAPI(vrcApi);
        Instances        = new InstancesAPI(vrcApi);
        Invite           = new InviteAPI(vrcApi);
        Favorites        = new FavoritesAPI(vrcApi);
        Groups           = new GroupsAPI(vrcApi);
        Calendar         = new CalendarAPI(vrcApi);
        Notifications    = new NotificationsAPI(vrcApi);
        PlayerModeration = new PlayerModerationAPI(vrcApi);
        Files            = new FilesAPI(vrcApi);
        Inventory        = new InventoryAPI(vrcApi);
        Economy          = new EconomyAPI(vrcApi);
        LogWatcher = logWatcher;
        Timeline = timeline;
        Settings = settings;
        Cache = cache;
        TimeEngine = timeEngine;
        PhotoPlayersStore = photoPlayersStore;
        Webhook = webhook;
        FileWatcher = fileWatcher;
        MemTrim = memTrim;
        UpdateService = updateService;
        SendToJS = sendToJS;
    }

    public string FixLocalUrl(string url)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("http://localhost:")) return url;
        var slash = url.IndexOf('/', "http://localhost:".Length);
        return slash < 0 ? url : $"http://localhost:{HttpPort}{url[slash..]}";
    }
}
