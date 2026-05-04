using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class AvatarsAPI(VRChatApiService ctx)
{
    private const string UA = AppInfo.UserAgent;

    public async Task<JObject?> GetAvatarAsync(string avatarId)
    {
        if (!ctx.IsLoggedIn) return null;
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/avatars/{avatarId}");
            var body = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode) return JObject.Parse(body);
            ctx.Log($"GetAvatar {(int)resp.StatusCode}: {body[..Math.Min(200, body.Length)]}");
        }
        catch (Exception ex) { ctx.Log($"GetAvatar exception: {ex.Message}"); }
        return null;
    }

    public async Task<(bool ok, string error)> UpdateAvatarAsync(string avatarId, string name, string description, string releaseStatus, List<string> tags)
    {
        if (!ctx.IsLoggedIn) return (false, "Not logged in");
        try
        {
            var body = JsonConvert.SerializeObject(new { name, description, releaseStatus, tags });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/avatars/{avatarId}", content);
            var respBody = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode) return (true, "");
            ctx.Log($"UpdateAvatar {(int)resp.StatusCode}: {respBody[..Math.Min(200, respBody.Length)]}");
            return (false, $"API error {(int)resp.StatusCode}");
        }
        catch (Exception ex) { ctx.Log($"UpdateAvatar exception: {ex.Message}"); return (false, ex.Message); }
    }

    public async Task<bool> SelectAvatarAsync(string avatarId)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/avatars/{avatarId}/select", content);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"SelectAvatar {avatarId}: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode)
            {
                try { ctx.CurrentUserRaw = JObject.Parse(body); } catch { }
                return true;
            }
            return false;
        }
        catch (Exception ex) { ctx.Log($"SelectAvatar exception: {ex.Message}"); return false; }
    }

    public async Task<List<JObject>> GetOwnAvatarsAsync()
    {
        if (!ctx.IsLoggedIn) return new();
        var all = new List<JObject>();
        try
        {
            for (int offset = 0; offset < 500; offset += 50)
            {
                var resp = await ctx._http.GetAsync(
                    $"{VRChatApiService.BASE}/avatars?user=me&releaseStatus=all&n=50&offset={offset}&sort=updated&order=descending");
                if (!resp.IsSuccessStatusCode) break;
                var arr = JArray.Parse(await resp.Content.ReadAsStringAsync());
                if (arr.Count == 0) break;
                all.AddRange(arr.Cast<JObject>());
                if (arr.Count < 50) break;
                await Task.Delay(300);
            }
            ctx.Log($"GetOwnAvatars: found {all.Count}");
        }
        catch (Exception ex) { ctx.Log($"GetOwnAvatars exception: {ex.Message}"); }
        return all;
    }

    public async Task<List<JObject>> GetFavoriteAvatarsAsync()
    {
        if (!ctx.IsLoggedIn) return new();
        var all = new List<JObject>();
        try
        {
            for (int offset = 0; offset < 500; offset += 50)
            {
                var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/avatars/favorites?n=50&offset={offset}");
                if (!resp.IsSuccessStatusCode) break;
                var arr = JArray.Parse(await resp.Content.ReadAsStringAsync());
                if (arr.Count == 0) break;
                all.AddRange(arr.Cast<JObject>());
                if (arr.Count < 50) break;
                await Task.Delay(300);
            }
            ctx.Log($"GetFavoriteAvatars: found {all.Count}");
        }
        catch (Exception ex) { ctx.Log($"GetFavoriteAvatars exception: {ex.Message}"); }
        return all;
    }

    public async Task<List<JObject>> GetFavoriteAvatarsByGroupAsync(string groupTag, int max = 100)
    {
        var all = new List<JObject>();
        if (!ctx.IsLoggedIn) return all;
        try
        {
            int offset = 0;
            while (all.Count < max)
            {
                var n = Math.Min(max - all.Count, 100);
                var url = $"{VRChatApiService.BASE}/avatars/favorites?tag={Uri.EscapeDataString(groupTag)}&n={n}&offset={offset}";
                var resp = await ctx._http.GetAsync(url);
                if (!resp.IsSuccessStatusCode) break;
                var batch = JArray.Parse(await resp.Content.ReadAsStringAsync());
                if (batch.Count == 0) break;
                foreach (var item in batch) all.Add((JObject)item);
                if (batch.Count < n) break;
                offset += batch.Count;
                await Task.Delay(200);
            }
            ctx.Log($"FavoriteAvatars [{groupTag}]: {all.Count} avatars");
        }
        catch (Exception ex) { ctx.Log($"FavoriteAvatarsByGroup exception [{groupTag}]: {ex.Message}"); }
        return all;
    }

    public async Task<(bool ok, string result)> AddAvatarFavoriteAsync(string avatarId, string groupName, string groupType = "avatar", string? oldFvrtId = null)
    {
        if (!ctx.IsLoggedIn) return (false, "Not logged in");
        try
        {
            if (!string.IsNullOrEmpty(oldFvrtId))
            {
                await ctx._http.DeleteAsync($"{VRChatApiService.BASE}/favorites/{oldFvrtId}");
                await Task.Delay(400);
            }
            var json = JsonConvert.SerializeObject(new { type = groupType, favoriteId = avatarId, tags = new[] { groupName } });
            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/favorites",
                new StringContent(json, Encoding.UTF8, "application/json"));
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                var errMsg = VRChatApiService.TryGetApiError(body) ?? $"HTTP {(int)resp.StatusCode}";
                ctx.Log($"AddAvatarFavorite error: {errMsg}");
                return (false, errMsg);
            }
            var result = JObject.Parse(body);
            var newFvrtId = result["id"]?.ToString() ?? "";
            return (true, newFvrtId);
        }
        catch (Exception ex) { ctx.Log($"AddAvatarFavorite exception: {ex.Message}"); return (false, ex.Message); }
    }

    public async Task<JArray> SearchAvatarsAsync(string query, int n = 20, int page = 0)
    {
        var url = $"https://api.avtrdb.com/v2/avatar/search?query={Uri.EscapeDataString(query)}&limit={n}&page={page}";
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UA);
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        try
        {
            ctx.Log($"SearchAvatars: {url}");
            var resp = await client.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"SearchAvatars [{(int)resp.StatusCode}] len={body.Length}");
            if (!resp.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body)) return new JArray();
            var parsed = JToken.Parse(body);
            if (parsed is JObject obj && obj["avatars"] is JArray arr) return arr;
            if (parsed is JArray directArr) return directArr;
        }
        catch (Exception ex) { ctx.Log($"SearchAvatars exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> SearchAvatarsAvtrIcuAsync(string query, int n = 20, int offset = 0)
    {
        var url = $"https://avtr.icu/search?search={Uri.EscapeDataString(query)}&limit={n}&offset={offset}";
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UA);
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        try
        {
            ctx.Log($"SearchAvatarsAvtrIcu: {url}");
            var resp = await client.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"SearchAvatarsAvtrIcu [{(int)resp.StatusCode}] len={body.Length}");
            if (!resp.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body)) return new JArray();
            var parsed = JToken.Parse(body);
            if (parsed is JArray arr) return arr;
        }
        catch (Exception ex) { ctx.Log($"SearchAvatarsAvtrIcu exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> SearchSimilarAvatarsAvtrIcuAsync(string avatarId, int n = 20)
    {
        var url = $"https://avtr.icu/similar/{Uri.EscapeDataString(avatarId)}?limit={n}";
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UA);
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        try
        {
            ctx.Log($"SearchSimilarAvtrIcu: {url}");
            var resp = await client.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"SearchSimilarAvtrIcu [{(int)resp.StatusCode}] len={body.Length}");
            if (!resp.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body)) return new JArray();
            var parsed = JToken.Parse(body);
            if (parsed is JArray arr) return arr;
        }
        catch (Exception ex) { ctx.Log($"SearchSimilarAvtrIcu exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> SearchAvatarsByAuthorAsync(string authorId, int n = 50)
    {
        var url = $"https://api.avtrdb.com/v2/avatar/search?query={Uri.EscapeDataString(authorId)}&limit={n}";
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UA);
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        try
        {
            ctx.Log($"SearchAvatarsByAuthor: {url}");
            var resp = await client.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"SearchAvatarsByAuthor [{(int)resp.StatusCode}] len={body.Length}");
            if (!resp.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body)) return new JArray();
            var parsed = JToken.Parse(body);
            if (parsed is JObject obj && obj["avatars"] is JArray arr) return arr;
            if (parsed is JArray directArr) return directArr;
        }
        catch (Exception ex) { ctx.Log($"SearchAvatarsByAuthor exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<string?> GetAvatarIdByFileIdAsync(string fileId)
    {
        var url = $"https://api.avtrdb.com/v3/avatar/search/vrcx?fileId={Uri.EscapeDataString(fileId)}";
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UA);
        client.DefaultRequestHeaders.TryAddWithoutValidation("Referer", $"https://{AppInfo.Website}");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        try
        {
            ctx.Log($"GetAvatarIdByFileId: {url}");
            var resp = await client.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"GetAvatarIdByFileId [{(int)resp.StatusCode}]: {body[..Math.Min(400, body.Length)]}");
            if (!resp.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body)) return null;
            var parsed = JToken.Parse(body);
            const string robotId = "avtr_c38a1615-5bf5-42b4-84eb-a8b6c37cbd11";
            string? id = null;
            if (parsed is JObject single) id = single["id"]?.ToString();
            else if (parsed is JArray arr && arr.Count > 0) id = arr[0]?["id"]?.ToString();
            if (id == robotId) return null;
            return id;
        }
        catch (Exception ex) { ctx.Log($"GetAvatarIdByFileId exception: {ex.Message}"); }
        return null;
    }

    public async Task<bool> CheckAvatarExistsAvtrIcuAsync(string avatarId)
    {
        var results = await SearchAvatarsAvtrIcuAsync(avatarId, 5, 0);
        return results.Any(a => a["id"]?.ToString() == avatarId);
    }

    public async Task<bool> CheckAvatarExistsAvtrdbAsync(string avatarId)
    {
        var results = await SearchAvatarsAsync(avatarId, 1);
        return results.Count > 0 && results.Any(a =>
            (a["vrc_id"]?.ToString() ?? a["id"]?.ToString() ?? "") == avatarId);
    }
}
