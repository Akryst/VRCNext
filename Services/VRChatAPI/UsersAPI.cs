using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class UsersAPI(VRChatApiService ctx)
{
    private readonly Dictionary<string, Task<JObject?>> _userFetchTasks = new();

    public Task<JObject?> GetUserAsync(string userId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(userId)) return Task.FromResult<JObject?>(null);
        lock (_userFetchTasks)
        {
            if (_userFetchTasks.TryGetValue(userId, out var existing)) return existing;
            var task = FetchUserAsync(userId);
            _userFetchTasks[userId] = task;
            task.ContinueWith(_ => { lock (_userFetchTasks) _userFetchTasks.Remove(userId); });
            return task;
        }
    }

    private async Task<JObject?> FetchUserAsync(string userId)
    {
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}");
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"GetUser response: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode) return JObject.Parse(body);
            ctx.Log($"GetUser error: {body[..Math.Min(200, body.Length)]}");
        }
        catch (Exception ex) { ctx.Log($"GetUser exception: {ex.Message}"); }
        return null;
    }

    public async Task<(JObject? result, int status)> GetUserWithStatusAsync(string userId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(userId)) return (null, 0);
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}");
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"GetUser response: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode) return (JObject.Parse(body), (int)resp.StatusCode);
            ctx.Log($"GetUser error: {body[..Math.Min(200, body.Length)]}");
            return (null, (int)resp.StatusCode);
        }
        catch (Exception ex) { ctx.Log($"GetUser exception: {ex.Message}"); }
        return (null, 0);
    }

    public async Task<JObject?> UpdateStatusAsync(string status, string statusDescription)
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null) return null;
        try
        {
            var payload = new JObject { ["status"] = status, ["statusDescription"] = statusDescription };
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/users/{ctx.CurrentUserId}", content);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"UpdateStatus response: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode)
            {
                var user = JObject.Parse(body);
                ctx.CurrentUserRaw = user;
                return user;
            }
            ctx.Log($"UpdateStatus error: {body[..Math.Min(200, body.Length)]}");
        }
        catch (Exception ex) { ctx.Log($"UpdateStatus exception: {ex.Message}"); }
        return null;
    }

    public async Task<bool> SetHomeWorldAsync(string worldId)
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null) return false;
        try
        {
            var payload = new JObject { ["homeLocation"] = worldId };
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/users/{ctx.CurrentUserId}", content);
            ctx.Log($"SetHomeWorld({worldId}): {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"SetHomeWorld exception: {ex.Message}"); return false; }
    }

    public async Task<JObject?> UpdateProfileAsync(string? bio, string? pronouns, List<string>? bioLinks, List<string>? tags, string? userIcon = null, string? profilePicOverride = null)
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null) return null;
        try
        {
            var payload = new JObject();
            if (bio != null) payload["bio"] = bio;
            if (pronouns != null) payload["pronouns"] = pronouns;
            if (bioLinks != null) payload["bioLinks"] = JArray.FromObject(bioLinks);
            if (tags != null) payload["tags"] = JArray.FromObject(tags);
            if (userIcon != null) payload["userIcon"] = userIcon;
            if (profilePicOverride != null) payload["profilePicOverride"] = profilePicOverride;
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/users/{ctx.CurrentUserId}", content);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"UpdateProfile response: {(int)resp.StatusCode}");
            if (resp.IsSuccessStatusCode)
            {
                var user = JObject.Parse(body);
                if (profilePicOverride != null) user["profilePicOverride"] = profilePicOverride;
                ctx.CurrentUserRaw = user;
                return user;
            }
            ctx.Log($"UpdateProfile error: {body[..Math.Min(200, body.Length)]}");
        }
        catch (Exception ex) { ctx.Log($"UpdateProfile exception: {ex.Message}"); }
        return null;
    }

    public async Task<JArray> SearchUsersAsync(string query, int n = 20, int offset = 0)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(query)) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users?search={Uri.EscapeDataString(query)}&n={n}&offset={offset}");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { ctx.Log($"SearchUsers exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JArray> GetUserBadgesAsync(string userId)
    {
        if (!ctx.IsLoggedIn || string.IsNullOrEmpty(userId)) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{Uri.EscapeDataString(userId)}/badges");
            if (resp.IsSuccessStatusCode) return JArray.Parse(await resp.Content.ReadAsStringAsync());
            ctx.Log($"GetUserBadges({userId}) failed: {(int)resp.StatusCode}");
        }
        catch (Exception ex) { ctx.Log($"GetUserBadges({userId}) exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<bool> UpdateBadgeAsync(string badgeId, bool showcased)
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null || string.IsNullOrEmpty(badgeId)) return false;
        try
        {
            var payload = new JObject { ["showcased"] = showcased };
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/users/{ctx.CurrentUserId}/badges/{Uri.EscapeDataString(badgeId)}", content);
            ctx.Log($"UpdateBadge({badgeId}, showcased={showcased}): {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"UpdateBadge exception: {ex.Message}"); return false; }
    }

    public async Task<bool> SendBoopAsync(string userId, string? emojiId = null)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var url = string.IsNullOrEmpty(emojiId)
                ? $"{VRChatApiService.BASE}/users/{userId}/boop"
                : $"{VRChatApiService.BASE}/users/{userId}/boop?emojiId={Uri.EscapeDataString(emojiId)}";
            var resp = await ctx._http.PostAsync(url, new StringContent("{}", Encoding.UTF8, "application/json"));
            ctx.Log($"SendBoop({userId}): {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"SendBoop({userId}) exception: {ex.Message}"); return false; }
    }

    public async Task<JObject?> GetUserNoteAsync(string targetUserId)
    {
        if (!ctx.IsLoggedIn) return null;
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/userNotes?n=100");
            if (!resp.IsSuccessStatusCode) { ctx.Log($"GetUserNotes: HTTP {(int)resp.StatusCode}"); return null; }
            var body = await resp.Content.ReadAsStringAsync();
            var arr = JArray.Parse(body);
            foreach (var note in arr)
                if (note["targetUserId"]?.ToString() == targetUserId)
                    return note as JObject;
            return null;
        }
        catch (Exception ex) { ctx.Log($"GetUserNote exception: {ex.Message}"); return null; }
    }

    public async Task<bool> UpdateUserNoteAsync(string targetUserId, string noteText)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var payload = new { targetUserId, note = noteText };
            var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/userNotes", content);
            ctx.Log($"UpdateUserNote {targetUserId}: {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"UpdateUserNote exception: {ex.Message}"); return false; }
    }

    public async Task<JArray> GetUserGroupsByIdAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}/groups");
            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                var arr = JArray.Parse(body);
                ctx.Log($"GetUserGroups({userId}): {arr.Count} items");
                return arr;
            }
            ctx.Log($"GetUserGroups({userId}) failed: {(int)resp.StatusCode}");
        }
        catch (Exception ex) { ctx.Log($"GetUserGroups({userId}) exception: {ex.Message}"); }
        return new JArray();
    }

    public async Task<JObject?> GetUserRepresentedGroupAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return null;
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}/groups/represented");
            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                var obj = JObject.Parse(body);
                ctx.Log($"GetRepresentedGroup({userId}): {obj["name"]}");
                return obj;
            }
            ctx.Log($"GetRepresentedGroup({userId}): {(int)resp.StatusCode}");
        }
        catch (Exception ex) { ctx.Log($"GetRepresentedGroup({userId}) exception: {ex.Message}"); }
        return null;
    }

    public async Task<(JArray mutuals, bool optedOut)> GetUserMutualsAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return (new JArray(), false);
        try
        {
            const int pageSize = 100;
            var all = new JArray();
            int offset = 0;
            while (true)
            {
                var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}/mutuals/friends?n={pageSize}&offset={offset}");
                var body = await resp.Content.ReadAsStringAsync();
                ctx.Log($"GetUserMutuals/friends({userId}): offset={offset}, status={(int)resp.StatusCode}, bodyLen={body.Length}");

                if (resp.IsSuccessStatusCode)
                {
                    var token = JToken.Parse(body);
                    JArray page;
                    if (token is JArray a)
                        page = a;
                    else if (token is JObject obj)
                    {
                        page = obj["friends"] as JArray
                            ?? obj["mutuals"] as JArray
                            ?? obj["users"] as JArray
                            ?? obj["data"] as JArray
                            ?? new JArray();
                        if (page.Count == 0)
                            ctx.Log($"GetUserMutuals/friends({userId}): object keys={string.Join(", ", obj.Properties().Select(p => p.Name))}");
                    }
                    else
                        page = new JArray();

                    foreach (var item in page) all.Add(item);
                    ctx.Log($"GetUserMutuals/friends({userId}): page {page.Count}, total so far {all.Count}");
                    if (page.Count < pageSize) break;
                    offset += pageSize;
                }
                else if ((int)resp.StatusCode == 403)
                {
                    ctx.Log($"GetUserMutuals/friends({userId}): 403 – user opted out.");
                    return (new JArray(), true);
                }
                else
                {
                    ctx.Log($"GetUserMutuals/friends({userId}): unexpected status {(int)resp.StatusCode}");
                    break;
                }
            }
            return (all, false);
        }
        catch (Exception ex) { ctx.Log($"GetUserMutuals/friends({userId}) exception: {ex.Message}"); }
        return (new JArray(), false);
    }

    public async Task<JArray> GetUserMutualGroupsAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return new JArray();
        try
        {
            const int pageSize = 100;
            var all = new JArray();
            int offset = 0;
            while (true)
            {
                var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/users/{userId}/mutuals/groups?n={pageSize}&offset={offset}");
                var body = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode) break;
                var token = JToken.Parse(body);
                var page = token is JArray a ? a : new JArray();
                foreach (var item in page) all.Add(item);
                if (page.Count < pageSize) break;
                offset += pageSize;
            }
            return all;
        }
        catch (Exception ex) { ctx.Log($"GetUserMutualGroups({userId}) exception: {ex.Message}"); }
        return new JArray();
    }
}
