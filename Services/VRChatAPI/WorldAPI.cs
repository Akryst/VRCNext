using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class WorldAPI(VRChatApiService ctx)
{
    private readonly Dictionary<string, Task<JObject?>> _worldFetchTasks = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, JObject> _worldCache = new();

    public Task<JObject?> GetWorldAsync(string worldId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(worldId)) return Task.FromResult<JObject?>(null);
        if (_worldCache.TryGetValue(worldId, out var cached)) return Task.FromResult<JObject?>(cached);
        lock (_worldFetchTasks)
        {
            if (_worldFetchTasks.TryGetValue(worldId, out var existing)) return existing;
            var task = FetchWorldAsync(worldId);
            _worldFetchTasks[worldId] = task;
            task.ContinueWith(_ => { lock (_worldFetchTasks) _worldFetchTasks.Remove(worldId); });
            return task;
        }
    }

    private async Task<JObject?> FetchWorldAsync(string worldId)
    {
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds/{worldId}");
            var body = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode)
            {
                var world = JObject.Parse(body);
                _worldCache[worldId] = world;
                return world;
            }
        }
        catch (Exception ex) { ctx.Log($"GetWorld exception: {ex.Message}"); }
        return null;
    }

    public async Task<(JObject? result, int status)> GetWorldWithStatusAsync(string worldId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(worldId)) return (null, 0);
        if (_worldCache.TryGetValue(worldId, out var cached)) return (cached, 200);
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds/{worldId}");
            var body = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode)
            {
                var world = JObject.Parse(body);
                _worldCache[worldId] = world;
                return (world, 200);
            }
            return (null, (int)resp.StatusCode);
        }
        catch (Exception ex) { ctx.Log($"GetWorld exception: {ex.Message}"); }
        return (null, 0);
    }

    public async Task<JObject?> GetWorldFreshAsync(string worldId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(worldId)) return null;
        return await FetchWorldAsync(worldId);
    }

    public async Task<JArray> GetMyWorldsAsync()
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds?user=me&releaseStatus=all&n=100&sort=updated");
            ctx.Log($"GetMyWorlds: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"GetMyWorlds exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> GetUserWorldsAsync(string userId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(userId)) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds?userId={Uri.EscapeDataString(userId)}&releaseStatus=public&n=100&sort=updated");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"GetUserWorlds exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> GetRecentWorldsAsync()
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/instances/recent");
            if (!resp.IsSuccessStatusCode) return new JArray();
            var locations = JArray.Parse(await resp.Content.ReadAsStringAsync());
            var seen = new HashSet<string>();
            var worldIds = new List<string>();
            foreach (var loc in locations)
            {
                var locStr = loc.ToString();
                var worldId = locStr.Contains(':') ? locStr.Split(':')[0] : locStr;
                if (worldId.StartsWith("wrld_") && seen.Add(worldId))
                    worldIds.Add(worldId);
            }
            var tasks = worldIds.Take(16).Select(async wid =>
            {
                try { return await GetWorldAsync(wid); }
                catch { return null; }
            });
            var worlds = await Task.WhenAll(tasks);
            var result = new JArray();
            foreach (var w in worlds)
                if (w != null) result.Add(w);
            return result;
        }
        catch (Exception ex) { ctx.Log($"GetRecentWorlds exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> GetPopularWorldsAsync(int n = 32)
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds?sort=popularity&order=descending&releaseStatus=public&n={n}");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"GetPopularWorlds exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> GetActiveWorldsAsync(int n = 32)
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds?sort=heat&order=descending&releaseStatus=public&n={n}");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"GetActiveWorlds exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> SearchWorldsAsync(string query, int n = 20, int offset = 0)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(query)) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/worlds?search={Uri.EscapeDataString(query)}&n={n}&offset={offset}&sort=relevance");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"SearchWorlds exception: {ex.Message}"); }
        return new JArray();
    }
}
