using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class InviteAPI(VRChatApiService ctx)
{
    private const string ChatWorldId = "wrld_4432ea9b-729c-46e3-8eaf-846aa0a37fdd";
    private readonly Dictionary<int, DateTime> _chatSlotTimestamps = new();
    private const int ChatTotalSlots = 24;

    public int ChatSlotsUsed =>
        _chatSlotTimestamps.Count(x => DateTime.Now - x.Value < TimeSpan.FromMinutes(60));

    public async Task<bool> InviteFriendAsync(string userId, string myLocation, int? messageSlot = null)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var loc = myLocation;
            if (string.IsNullOrEmpty(loc) || loc == "offline" || loc == "traveling")
            {
                ctx.Log("InviteFriend: no valid instance to invite to");
                return false;
            }
            var worldId = loc.Contains(':') ? loc.Split(':')[0] : loc;
            var payload = new JObject { ["instanceId"] = loc, ["worldId"] = worldId };
            if (messageSlot.HasValue) payload["messageSlot"] = messageSlot.Value;
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/invite/{userId}", content);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"InviteFriend response: {(int)resp.StatusCode} body: {body[..Math.Min(200, body.Length)]}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"InviteFriend exception: {ex.Message}"); return false; }
    }

    public async Task<bool> InviteFriendWithPhotoAsync(string userId, string myLocation, string imageUrl, int? messageSlot = null)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var loc = myLocation;
            if (string.IsNullOrEmpty(loc) || loc == "offline" || loc == "traveling")
            { ctx.Log("InviteWithPhoto: no valid instance"); return false; }

            byte[] imgBytes;
            if (imageUrl.StartsWith("data:image", StringComparison.OrdinalIgnoreCase))
            {
                var comma = imageUrl.IndexOf(',');
                imgBytes = Convert.FromBase64String(imageUrl[(comma + 1)..]);
            }
            else
            {
                imgBytes = await ctx._http.GetByteArrayAsync(imageUrl);
            }

            var dataObj = new JObject { ["instanceId"] = loc };
            if (messageSlot.HasValue) dataObj["messageSlot"] = messageSlot.Value;

            using var form = new MultipartFormDataContent();
            var imgContent = new ByteArrayContent(imgBytes);
            imgContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
            form.Add(imgContent, "image", "photo.png");
            form.Add(new StringContent(dataObj.ToString(Newtonsoft.Json.Formatting.None)), "data");

            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/invite/{userId}/photo", form);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"InviteWithPhoto response: {(int)resp.StatusCode} body: {body[..Math.Min(200, body.Length)]}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"InviteWithPhoto exception: {ex.Message}"); return false; }
    }

    public async Task<bool> RequestInviteAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var payload = new JObject { ["instanceId"] = "" };
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/requestInvite/{userId}", content);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"RequestInvite response: {(int)resp.StatusCode} body: {body[..Math.Min(200, body.Length)]}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"RequestInvite exception: {ex.Message}"); return false; }
    }

    public async Task<JArray?> GetInviteMessagesAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return null;
        try
        {
            var resp = await ctx._http.GetAsync($"{VRChatApiService.BASE}/message/{userId}/message");
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync();
            return JArray.Parse(body);
        }
        catch (Exception ex) { ctx.Log($"GetInviteMessages exception: {ex.Message}"); return null; }
    }

    public async Task<(bool ok, JArray? messages, int cooldown)> UpdateInviteMessageAsync(string userId, int slot, string message)
    {
        if (!ctx.IsLoggedIn) return (false, null, 0);
        try
        {
            var payload = new JObject { ["message"] = message };
            var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
            var resp = await ctx._http.PutAsync($"{VRChatApiService.BASE}/message/{userId}/message/{slot}", content);
            var body = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode) return (true, JArray.Parse(body), 0);
            if ((int)resp.StatusCode == 429)
            {
                try { var err = JObject.Parse(body); return (false, null, err["remainingCooldownMinutes"]?.Value<int>() ?? 60); } catch { }
                return (false, null, 60);
            }
            ctx.Log($"UpdateInviteMessage {slot} failed: {(int)resp.StatusCode} {body[..Math.Min(200, body.Length)]}");
            return (false, null, 0);
        }
        catch (Exception ex) { ctx.Log($"UpdateInviteMessage exception: {ex.Message}"); return (false, null, 0); }
    }

    public async Task<(int used, int total)> LoadChatSlotStatusAsync()
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null) return (0, ChatTotalSlots);
        try
        {
            var t1 = ctx._http.GetAsync($"{VRChatApiService.BASE}/message/{ctx.CurrentUserId}/message");
            Task<HttpResponseMessage>? t2 = ctx._requestMessageSupported
                ? ctx._http.GetAsync($"{VRChatApiService.BASE}/message/{ctx.CurrentUserId}/requestMessage")
                : null;
            if (t2 != null) await Task.WhenAll(t1, t2);
            else await t1;

            var pairs = t2 != null
                ? new[] { (t1.Result, 0), (t2.Result, 12) }
                : new[] { (t1.Result, 0) };
            foreach (var (resp, offset) in pairs)
            {
                if (!resp.IsSuccessStatusCode)
                {
                    if (offset == 12 && (int)resp.StatusCode == 400)
                    {
                        ctx._requestMessageSupported = false;
                        ctx.Log("LoadChatSlotStatus: requestMessage returned 400 — disabling endpoint");
                    }
                    continue;
                }
                var arr = JArray.Parse(await resp.Content.ReadAsStringAsync());
                foreach (JObject slot in arr.Cast<JObject>())
                {
                    var idx      = slot["slot"]?.Value<int>() ?? -1;
                    var canEdit  = slot["canBeUpdated"]?.Value<bool>() ?? true;
                    var cooldown = slot["remainingCooldownMinutes"]?.Value<int>() ?? 0;
                    if (idx < 0 || idx >= 12) continue;
                    var vSlot = idx + offset;
                    if (!canEdit && cooldown > 0)
                        _chatSlotTimestamps[vSlot] = DateTime.Now - TimeSpan.FromMinutes(60 - cooldown);
                    else
                        _chatSlotTimestamps.Remove(vSlot);
                }
            }
            ctx.Log($"ChatSlotStatus: {ChatSlotsUsed}/{ChatTotalSlots} in cooldown");
        }
        catch (Exception ex) { ctx.Log($"LoadChatSlotStatus exception: {ex.Message}"); }
        return (ChatSlotsUsed, ChatTotalSlots);
    }

    private int GetNextFreeSlot()
    {
        for (int i = 0; i < ChatTotalSlots; i++)
            if (!_chatSlotTimestamps.TryGetValue(i, out var t) || DateTime.Now - t >= TimeSpan.FromMinutes(60))
                return i;
        return -1;
    }

    private async Task<(bool ok, int cooldown)> UpdateChatSlotAsync(int virtualSlot, string text)
    {
        if (ctx.CurrentUserId == null) return (false, 0);
        var type     = virtualSlot < 12 ? "message" : "requestMessage";
        var realSlot = virtualSlot < 12 ? virtualSlot : virtualSlot - 12;
        var payload  = new JObject { ["message"] = text };
        var content  = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
        var resp     = await ctx._http.PutAsync($"{VRChatApiService.BASE}/message/{ctx.CurrentUserId}/{type}/{realSlot}", content);
        var body     = await resp.Content.ReadAsStringAsync();
        if (resp.IsSuccessStatusCode) return (true, 0);
        if ((int)resp.StatusCode == 429)
        {
            try { return (false, JObject.Parse(body)["remainingCooldownMinutes"]?.Value<int>() ?? 60); } catch { }
            return (false, 60);
        }
        ctx.Log($"UpdateChatSlot({type}/{realSlot}) failed: {(int)resp.StatusCode}");
        return (false, 0);
    }

    public async Task<(bool ok, string error, int slotsUsed)> SendChatMessageAsync(string userId, string text)
    {
        if (!ctx.IsLoggedIn || ctx.CurrentUserId == null) return (false, "Not logged in", 0);
        try
        {
            var vSlot = GetNextFreeSlot();
            if (vSlot < 0)
                return (false, $"All {ChatTotalSlots} slots in cooldown", ChatSlotsUsed);

            var (updateOk, cooldown) = await UpdateChatSlotAsync(vSlot, "msg " + text);
            if (!updateOk)
            {
                _chatSlotTimestamps[vSlot] = DateTime.Now - TimeSpan.FromMinutes(60 - Math.Max(cooldown, 1));
                return (false, $"Slot {vSlot} cooldown: {cooldown} min (refreshing…)", ChatSlotsUsed);
            }

            _chatSlotTimestamps[vSlot] = DateTime.Now;

            HttpResponseMessage resp;
            string body;
            if (vSlot < 12)
            {
                var payload = new JObject
                {
                    ["instanceId"]  = $"{ChatWorldId}:0~region(eu)",
                    ["worldId"]     = ChatWorldId,
                    ["messageSlot"] = vSlot,
                };
                var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
                resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/invite/{userId}", content);
                body = await resp.Content.ReadAsStringAsync();
            }
            else
            {
                var realSlot = vSlot - 12;
                var payload  = new JObject { ["messageSlot"] = realSlot };
                var content  = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
                resp = await ctx._http.PostAsync($"{VRChatApiService.BASE}/requestInvite/{userId}", content);
                body = await resp.Content.ReadAsStringAsync();
            }

            ctx.Log($"SendChatMessage({userId}) vSlot={vSlot}: {(int)resp.StatusCode} {body[..Math.Min(150, body.Length)]}");
            return resp.IsSuccessStatusCode
                ? (true, "", ChatSlotsUsed)
                : (false, $"HTTP {(int)resp.StatusCode}", ChatSlotsUsed);
        }
        catch (Exception ex) { ctx.Log($"SendChatMessage exception: {ex.Message}"); return (false, ex.Message, 0); }
    }
}
