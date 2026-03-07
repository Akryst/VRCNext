using Newtonsoft.Json.Linq;
using VRCNext.Services;

namespace VRCNext;

public partial class MainForm
{
    // --- Notification helpers ---

    private static string? ExtractGroupIdFromLink(string? link)
    {
        if (string.IsNullOrEmpty(link)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(link, @"grp_[0-9a-f\-]+");
        return m.Success ? m.Value : null;
    }

    private static dynamic NormalizeNotifV1(JObject n) => (dynamic)new {
        id             = n["id"]?.ToString() ?? "",
        type           = n["type"]?.ToString() ?? "",
        senderUserId   = n["senderUserId"]?.ToString() ?? "",
        senderUsername = n["senderUsername"]?.ToString() ?? "",
        message        = n["message"]?.ToString() ?? "",
        created_at     = n["created_at"]?.Type == JTokenType.Date
                           ? n["created_at"]!.Value<DateTime>().ToString("o")
                           : n["created_at"]?.ToString() ?? DateTime.UtcNow.ToString("o"),
        seen           = n["seen"]?.Value<bool>() ?? false,
        details        = n["details"],
        _v2            = false,
        _title         = (string?)null,
        _link          = (string?)null,
    };

    private static dynamic NormalizeNotifV2(JObject n) => (dynamic)new {
        id             = n["id"]?.ToString() ?? "",
        type           = n["type"]?.ToString() ?? "",
        senderUserId   = n["senderUserId"]?.ToString() ?? "",
        // v2 uses senderDisplayName; fall back to senderUsername for safety
        senderUsername = n["senderDisplayName"]?.ToString()
                      ?? n["senderUsername"]?.ToString()
                      ?? "",
        message        = n["message"]?.ToString() ?? "",
        created_at     = n["createdAt"]?.Type == JTokenType.Date
                           ? n["createdAt"]!.Value<DateTime>().ToString("o")
                           : n["createdAt"]?.ToString() ?? DateTime.UtcNow.ToString("o"),
        seen           = n["seen"]?.Value<bool>() ?? false,
        details        = (object?)null,
        _v2            = true,
        _title         = n["title"]?.ToString(),
        _link          = n["link"]?.ToString(),
        _data          = n["data"],  // group-specific data: groupId, requestUserId, etc.
    };

    /// <summary>
    /// Process a single notification: add to timeline, send to JS.
    /// If prependToJs is true, sends vrcNotificationPrepend (WS path).
    /// Returns the timeline payload so the caller can batch if needed.
    /// </summary>
    private object? ProcessSingleNotif(dynamic n, bool prependToJs)
    {
        if (_timeline.IsLoggedNotif((string)n.id)) return null;
        _timeline.AddLoggedNotif((string)n.id);

        // ── VRCN Chat intercept ───────────────────────────────────────────────
        var nType = (string)n.type;

        // Boop → store as chat entry so it appears in history and inbox
        if (nType == "boop")
        {
            var boopSender = (string?)n.senderUserId ?? "";
            if (!string.IsNullOrEmpty(boopSender))
            {
                var boopEntry = StoreChatMessage(boopSender, boopSender, "💕 Boop!", "boop");
                Invoke(() => SendToJS("vrcChatMessage", boopEntry));
            }
        }

        // invite OR requestInvite whose slot text starts with "msg " are chat messages.
        if (nType == "invite" || nType == "requestInvite")
        {
            var invMsg = "";
            JObject? det = null;
            try
            {
                var rawDet = n.details as JToken;
                if (rawDet is JObject jo) det = jo;
                else if (rawDet?.Type == JTokenType.String) det = JObject.Parse(rawDet.ToString());
                // invite → inviteMessage, requestInvite → requestMessage
                invMsg = det?["inviteMessage"]?.ToString()
                      ?? det?["requestMessage"]?.ToString()
                      ?? "";
            }
            catch { }

            if (invMsg.StartsWith("msg "))
            {
                var chatText     = invMsg["msg ".Length..];
                var senderId     = (string?)n.senderUserId ?? "";
                var entry        = StoreChatMessage(senderId, senderId, chatText);
                var notifId      = (string)n.id;
                Invoke(() => SendToJS("vrcChatMessage", entry));
                // Auto-hide & mark seen so it doesn't appear in notification panel
                if (!string.IsNullOrEmpty(notifId) && _vrcApi.IsLoggedIn)
                    _ = Task.Run(async () =>
                    {
                        await _vrcApi.MarkNotificationReadAsync(notifId);
                        await _vrcApi.HideNotificationAsync(notifId);
                    });
                return null; // skip timeline + notification panel
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        var senderImg    = "";
        var senderUserId = (string?)n.senderUserId;
        if (!string.IsNullOrEmpty(senderUserId))
        {
            if (_friendNameImg.TryGetValue(senderUserId, out var fi) && !string.IsNullOrEmpty(fi.image))
                senderImg = fi.image;
        }

        // Extract message — for v1 invite responses the text lives in details, not message
        var msgText = (string)n.message;
        if (string.IsNullOrEmpty(msgText))
        {
            JObject? detObj = null;
            var rawDet = n.details as JToken;
            if (rawDet is JObject jo) detObj = jo;
            else if (rawDet?.Type == JTokenType.String) { try { detObj = JObject.Parse(rawDet.ToString()); } catch { } }
            if (detObj != null)
                msgText = detObj["responseMessage"]?.ToString()
                       ?? detObj["inviteMessage"]?.ToString()
                       ?? detObj["requestMessage"]?.ToString()
                       ?? "";
        }

        var notifEv = new TimelineService.TimelineEvent
        {
            Type        = "notification",
            Timestamp   = n.created_at,
            NotifId     = n.id,
            NotifType   = n.type,
            NotifTitle  = (string?)n._title ?? "",
            SenderName  = n.senderUsername,
            SenderId    = n.senderUserId,
            SenderImage = senderImg,
            Message     = msgText,
        };
        _timeline.AddEvent(notifEv);

        if (prependToJs)
            Invoke(() => {
                SendToJS("vrcNotificationPrepend", n);
                SendToJS("timelineEvent", BuildTimelinePayload(notifEv));
            });

        // Async image fetch if not cached
        if (string.IsNullOrEmpty(senderImg) && !string.IsNullOrEmpty(senderUserId) && _vrcApi.IsLoggedIn)
        {
            var evId = notifEv.Id;
            var uid  = senderUserId;
            _ = Task.Run(async () =>
            {
                try
                {
                    var profile = await _vrcApi.GetUserAsync(uid);
                    if (profile == null) return;
                    var img = VRChatApiService.GetUserImage(profile);
                    if (string.IsNullOrEmpty(img)) return;
                    _timeline.UpdateEvent(evId, ev => ev.SenderImage = img);
                    var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == evId);
                    if (updated != null) Invoke(() => SendToJS("timelineEvent", BuildTimelinePayload(updated)));
                }
                catch { }
            });
        }

        // For group notifications without a sender: fetch group name + icon from _data
        var notifTypeStr = (string)n.type;
        if (string.IsNullOrEmpty(senderUserId) && notifTypeStr.StartsWith("group.") && _vrcApi.IsLoggedIn)
        {
            JObject? dataObj = null;
            try
            {
                var rawData = n._data as JToken;
                if (rawData is JObject djo) dataObj = djo;
                else if (rawData?.Type == JTokenType.String) { try { dataObj = JObject.Parse(rawData.ToString()); } catch { } }
            }
            catch { }
            // groupId can be in "groupId" directly, or in "ownerId" (group.event.created uses ownerId = grp_xxx)
            var groupId = dataObj?["groupId"]?.ToString();
            if (string.IsNullOrEmpty(groupId))
            {
                var ownerId = dataObj?["ownerId"]?.ToString();
                if (!string.IsNullOrEmpty(ownerId) && ownerId.StartsWith("grp_")) groupId = ownerId;
            }
            if (!string.IsNullOrEmpty(groupId))
            {
                var evId = notifEv.Id;
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var group = await _vrcApi.GetGroupAsync(groupId);
                        if (group == null) return;
                        var groupName = group["name"]?.ToString() ?? "";
                        var groupIcon = group["iconUrl"]?.ToString() ?? "";
                        if (string.IsNullOrEmpty(groupName) && string.IsNullOrEmpty(groupIcon)) return;
                        _timeline.UpdateEvent(evId, ev => { ev.SenderName = groupName; ev.SenderImage = groupIcon; });
                        var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == evId);
                        if (updated != null) Invoke(() => SendToJS("timelineEvent", BuildTimelinePayload(updated)));
                    }
                    catch { }
                });
            }
        }

        return BuildTimelinePayload(notifEv);
    }

    /// <summary>REST fetch of v1+v2 — used on login and reconnect to catch missed notifications.</summary>
    private Task VrcGetNotificationsAsync() => Task.Run(async () =>
    {
        var t1 = _vrcApi.GetNotificationsAsync();
        var t2 = _vrcApi.GetNotificationsV2Async();
        await Task.WhenAll(t1, t2);

        var list = t1.Result.Cast<JObject>().Select(NormalizeNotifV1).ToList();
        Invoke(() => SendToJS("log", new { msg = $"[Notif REST] v1={t1.Result.Count} types=[{string.Join(",", t1.Result.Cast<JObject>().Select(n => n["type"]?.ToString()))}]", color = "sec" }));

        var v2Ids = new HashSet<string>(list.Select(n => (string)n.id));
        foreach (JObject n in t2.Result.Cast<JObject>())
        {
            var id = n["id"]?.ToString() ?? "";
            if (v2Ids.Contains(id)) continue;
            list.Add(NormalizeNotifV2(n));
        }
        Invoke(() => SendToJS("log", new { msg = $"[Notif REST] v2={t2.Result.Count} types=[{string.Join(",", t2.Result.Cast<JObject>().Select(n => n["type"]?.ToString()))}]", color = "sec" }));

        list = list.OrderByDescending(n => (string)n.created_at).ToList();

        var newTimeline = new List<object>();
        foreach (var n in list)
        {
            var ev = ProcessSingleNotif(n, prependToJs: false);
            if (ev != null) newTimeline.Add(ev);
        }

        Invoke(() =>
        {
            SendToJS("vrcNotifications", list);
            foreach (var ev in newTimeline)
                SendToJS("timelineEvent", ev);
        });
    });
}
