using Newtonsoft.Json.Linq;

namespace VRCNext.Services;

public class InventoryAPI(VRChatApiService ctx)
{
    public async Task<(JArray items, int totalCount)> GetInventoryItemsAsync(int n = 100, int offset = 0)
    {
        if (!ctx.IsLoggedIn) return (new JArray(), 0);
        try
        {
            var url = $"{VRChatApiService.BASE}/inventory?n={n}&offset={offset}";
            ctx.Log($"GetInventoryItems n={n} offset={offset}");
            var resp = await ctx._http.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"GetInventoryItems response: {(int)resp.StatusCode} len={body.Length} preview={body[..Math.Min(300, body.Length)]}");
            if (resp.IsSuccessStatusCode)
            {
                var token = JToken.Parse(body);
                if (token is JArray arr) return (arr, arr.Count);
                if (token is JObject obj)
                {
                    var data  = obj["data"] as JArray ?? new JArray();
                    var total = obj["totalCount"]?.Value<int>() ?? data.Count;
                    return (data, total);
                }
            }
            else ctx.Log($"GetInventoryItems error: {body[..Math.Min(200, body.Length)]}");
        }
        catch (Exception ex) { ctx.Log($"GetInventoryItems exception: {ex.Message}"); }
        return (new JArray(), 0);
    }

    public async Task<JArray> GetUserPrintsAsync(string userId)
    {
        if (!ctx.IsLoggedIn) return new JArray();

        const int pageSize = 100;
        const int maxPages = 20;
        var all = new JArray();

        for (int page = 0; page < maxPages; page++)
        {
            int offset = page * pageSize;
            try
            {
                var url = $"{VRChatApiService.BASE}/prints/user/{Uri.EscapeDataString(userId)}?n={pageSize}&offset={offset}";
                ctx.Log($"GetUserPrints userId={userId} page={page} offset={offset}");
                var resp = await ctx._http.GetAsync(url);
                var body = await resp.Content.ReadAsStringAsync();
                ctx.Log($"GetUserPrints response: {(int)resp.StatusCode} len={body.Length}");
                if (!resp.IsSuccessStatusCode) break;

                JArray pageArr;
                var token = JToken.Parse(body);
                if      (token is JArray a)  pageArr = a;
                else if (token is JObject o) pageArr = o["prints"] as JArray ?? o["data"] as JArray ?? new JArray();
                else break;

                foreach (var item in pageArr) all.Add(item);
                if (pageArr.Count < pageSize) break;
            }
            catch (Exception ex) { ctx.Log($"GetUserPrints exception: {ex.Message}"); break; }
        }

        ctx.Log($"GetUserPrints total fetched: {all.Count}");
        return all;
    }

    public async Task<bool> DeletePrintAsync(string printId)
    {
        if (!ctx.IsLoggedIn) return false;
        try
        {
            var resp = await ctx._http.DeleteAsync($"{VRChatApiService.BASE}/prints/{printId}");
            var body = await resp.Content.ReadAsStringAsync();
            ctx.Log($"DeletePrint {printId}: {(int)resp.StatusCode} body={body[..Math.Min(300, body.Length)]}");
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex) { ctx.Log($"DeletePrint exception: {ex.Message}"); return false; }
    }
}
