using System.Text;
using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class FriendsAPI(VRChatApiService ctx)
{
    public Task<List<JObject>> GetOnlineFriendsAsync()  => FetchFriendsParallelAsync(offline: false);
    public Task<List<JObject>> GetOfflineFriendsAsync() => FetchFriendsParallelAsync(offline: true);

    private async Task<List<JObject>> FetchFriendsParallelAsync(bool offline)
    {
        var all = new List<JObject>();
        if (!ctx.IsLoggedIn) { if (!offline) ctx.Log("GetFriends: not logged in"); return all; }

        const int pageSize = 50;
        const int concurrency = 1;
        var nextOffset = 0;
        var done = false;
        var lck = new object();

        async Task Worker()
        {
            while (true)
            {
                int myOffset;
                lock (lck) { if (done) return; myOffset = nextOffset; nextOffset += pageSize; }
                try
                {
                    var flag = offline ? "true" : "false";
                    var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/auth/user/friends?offline={flag}&n={pageSize}&offset={myOffset}");
                    var body = await resp.Content.ReadAsStringAsync();
                    ctx.Log($"Fetching {(offline ? "offline" : "online")} friends: offset={myOffset} → {(int)resp.StatusCode}");
                    if (!resp.IsSuccessStatusCode)
                    {
                        ctx.Log($"Friends error: {body[..Math.Min(200, body.Length)]}");
                        lock (lck) done = true; return;
                    }
                    var batch = JArray.Parse(body);
                    ctx.Log($"Friends batch at {myOffset}: {batch.Count}");
                    lock (all) foreach (var x in batch) all.Add((JObject)x);
                    if (batch.Count < pageSize) { lock (lck) done = true; return; }
                }
                catch (Exception ex) { ctx.Log($"Friends worker: {ex.Message}"); lock (lck) done = true; return; }
            }
        }

        await Task.WhenAll(Enumerable.Range(0, concurrency).Select(_ => Worker()));
        ctx.Log($"Total {(offline ? "offline" : "online")} friends: {all.Count}");
        return all;
    }

    public async Task<bool> SendFriendRequestAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/user/{userId}/friendRequest", content);
            ctx.Log($"FriendRequest {userId}: {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"FriendRequest exception: {ex.Message}"); return false; }
    }

    public async Task<bool> UnfriendAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var resp = await ctx._http.DeleteAsync($"{VRChatApiService.BASE}/auth/user/friends/{userId}");
            ctx.Log($"Unfriend {userId}: {(int)resp.StatusCode}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"Unfriend exception: {ex.Message}"); return false; }
    }
}
