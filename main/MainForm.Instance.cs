using Newtonsoft.Json.Linq;
using VRCNext.Services;

namespace VRCNext;

public partial class MainForm
{
    private Task VrcGetCurrentInstanceAsync() => Task.Run(async () =>
    {
        try
        {
            // Step 1: Location from log watcher — no API call. If VRChat not running, treat as offline.
            var loc = IsVrcRunning() ? _logWatcher.CurrentLocation : null;
            if (string.IsNullOrEmpty(loc) || loc == "offline" || loc == "private" || loc == "traveling")
            {
                Invoke(() => SendToJS("vrcCurrentInstance", new { empty = true }));
                return;
            }

            var parsed = VRChatApiService.ParseLocation(loc);

            // Only fetch world info from API once per instance (when location changes or cache is empty).
            // Player count comes from LogWatcher — no need to poll the instance endpoint repeatedly.
            string worldName, worldThumb;
            int worldCapacity;

            bool locationChanged = _cachedInstLocation != loc || string.IsNullOrEmpty(_cachedInstWorldName);
            if (locationChanged)
            {
                var inst = await _vrcApi.GetInstanceAsync(loc);
                worldName     = inst?["world"]?["name"]?.ToString() ?? "";
                worldThumb    = inst?["world"]?["thumbnailImageUrl"]?.ToString() ?? "";
                worldCapacity = inst?["world"]?["capacity"]?.Value<int>() ?? inst?["capacity"]?.Value<int>() ?? 0;

                if (string.IsNullOrEmpty(worldName) && !string.IsNullOrEmpty(parsed.worldId))
                {
                    var world = await _vrcApi.GetWorldAsync(parsed.worldId);
                    if (world != null)
                    {
                        worldName     = world["name"]?.ToString() ?? "";
                        worldThumb    = world["thumbnailImageUrl"]?.ToString() ?? "";
                        worldCapacity = world["capacity"]?.Value<int>() ?? 0;
                    }
                }
                if (string.IsNullOrEmpty(worldName)) worldName = parsed.worldId;
            }
            else
            {
                worldName     = _cachedInstWorldName;
                worldThumb    = _cachedInstWorldThumb;
                worldCapacity = _cachedInstCapacity;
            }

            // Step 4: Build player list. Prefer LogWatcher (reads VRChat logs),
            // fall back to API users array
            var users = new List<object>();
            string playerSource = "none";

            Invoke(() => SendToJS("log", new { msg = $"[LOG] {_logWatcher.GetDiagnostics()}", color = "sec" }));

            // Source A: VRChat log file (most complete, shows ALL players)
            var logPlayers = _logWatcher.GetCurrentPlayers();
            if (logPlayers.Count > 0)
            {
                playerSource = "logfile";

                // Only players with a real usr_ ID can be looked up via the VRChat API.
                // Old-format IDs (e.g. "GGQdjFCSD4") are kept for display but not fetched.
                var playersWithId = logPlayers.Where(p => !string.IsNullOrEmpty(p.UserId) && p.UserId.StartsWith("usr_")).ToList();
                var userProfiles  = new Dictionary<string, JObject>();

                // Skip only if we have a previously cached full profile (tags, platform, ageVerified etc.)
                var needFetch = playersWithId.Where(p =>
                    !_playerProfileCache.ContainsKey(p.UserId)
                ).ToList();

                if (needFetch.Count > 0)
                {
                    var semaphore = new SemaphoreSlim(5);
                    var tasks = needFetch.Select(async p =>
                    {
                        await semaphore.WaitAsync();
                        try
                        {
                            var profile = await _vrcApi.GetUserAsync(p.UserId);
                            if (profile != null)
                            {
                                var img = VRChatApiService.GetUserImage(profile);
                                if (!string.IsNullOrEmpty(img))
                                {
                                    _tlPlayerImageCache[p.UserId] = img;
                                    _timeline.SetUserImage(p.UserId, img); // persist across restarts
                                }
                                _playerAgeVerifiedCache[p.UserId] = profile["ageVerified"]?.Value<bool>() ?? false;
                                _playerProfileCache[p.UserId] = profile;
                                lock (userProfiles)
                                    userProfiles[p.UserId] = profile;
                            }
                        }
                        finally { semaphore.Release(); }
                    });
                    await Task.WhenAll(tasks);

                }

                // Load previously cached profiles for players that were skipped
                foreach (var p in playersWithId)
                {
                    if (!userProfiles.ContainsKey(p.UserId) && _playerProfileCache.TryGetValue(p.UserId, out var cached))
                        userProfiles[p.UserId] = cached;
                }

                Invoke(() => SendToJS("log", new { msg = $"[LOG] Profiles: {needFetch.Count} fetched, {playersWithId.Count - needFetch.Count} cached", color = "sec" }));

                foreach (var p in logPlayers)
                {
                    var img               = "";
                    var status            = "";
                    var statusDescription = "";
                    JObject? profObj = null;
                    if (!string.IsNullOrEmpty(p.UserId))
                    {
                        if (userProfiles.TryGetValue(p.UserId, out var prof))
                        {
                            profObj           = prof;
                            img               = VRChatApiService.GetUserImage(prof);
                            status            = prof["status"]?.ToString() ?? "";
                            statusDescription = prof["statusDescription"]?.ToString() ?? "";
                        }
                        else if (_friendNameImg.TryGetValue(p.UserId, out var fi) && !string.IsNullOrEmpty(fi.image))
                        {
                            img = fi.image;
                        }
                        else if (_tlPlayerImageCache.TryGetValue(p.UserId, out var ci) && !string.IsNullOrEmpty(ci))
                        {
                            img = ci;
                        }
                    }
                    users.Add(new {
                        id                = p.UserId,
                        displayName       = p.DisplayName,
                        image             = img,
                        status,
                        statusDescription,
                        joinedAt          = new DateTimeOffset(p.JoinedAt).ToUnixTimeMilliseconds(),
                        tags              = profObj?["tags"]?.ToObject<List<string>>() ?? new List<string>(),
                        ageVerified       = profObj?["ageVerified"]?.Value<bool>() ?? false,
                        platform          = profObj?["last_platform"]?.ToString() ?? "",
                    });
                }
            }

            var nUsers = users.Count;

            _cachedInstLocation   = loc;
            _cachedInstWorldName  = worldName;
            _cachedInstWorldThumb = worldThumb;
            _cachedInstCapacity   = worldCapacity;
            _cachedInstType       = parsed.instanceType;

            Invoke(() =>
            {
                PushDiscordPresence();
                SendToJS("log", new { msg = $"Instance: {worldName} — {nUsers} total, {users.Count} tracked ({playerSource})", color = "ok" });
                SendToJS("vrcCurrentInstance", new {
                    location = loc, worldId = parsed.worldId,
                    worldName, worldThumb,
                    instanceType = parsed.instanceType,
                    nUsers, capacity = worldCapacity, users, playerSource,
                });
            });
        }
        catch (Exception ex)
        {
            Invoke(() =>
            {
                SendToJS("log", new { msg = $"❌ Instance error: {ex.Message}", color = "err" });
                SendToJS("vrcCurrentInstance", new { error = ex.Message });
            });
        }
    });

    /// <summary>
    /// Push an updated vrcCurrentInstance to JS using only cached REST data + live LogWatcher list.
    /// No REST calls — used for instant player join/leave updates.
    /// </summary>
    private void PushCurrentInstanceFromCache()
    {
        if (string.IsNullOrEmpty(_cachedInstLocation)) return;
        var parsed = VRChatApiService.ParseLocation(_cachedInstLocation);
        var logPlayers = _logWatcher.GetCurrentPlayers();
        var users = logPlayers.Select(p =>
        {
            string img = "";
            if (_friendNameImg.TryGetValue(p.UserId ?? "", out var fi) && !string.IsNullOrEmpty(fi.image))
                img = fi.image;
            else if (_tlPlayerImageCache.TryGetValue(p.UserId ?? "", out var ci) && !string.IsNullOrEmpty(ci))
                img = ci;

            var av = !string.IsNullOrEmpty(p.UserId) && _playerAgeVerifiedCache.TryGetValue(p.UserId, out var cached) && cached;

            string status = "", statusDescription = "", platform = "";
            var tags = new List<string>();
            if (!string.IsNullOrEmpty(p.UserId) && _playerProfileCache.TryGetValue(p.UserId, out var prof))
            {
                status            = prof["status"]?.ToString() ?? "";
                statusDescription = prof["statusDescription"]?.ToString() ?? "";
                platform          = prof["last_platform"]?.ToString() ?? "";
                tags              = prof["tags"]?.ToObject<List<string>>() ?? new List<string>();
                if (string.IsNullOrEmpty(img))
                    img = VRChatApiService.GetUserImage(prof);
            }

            return (object)new {
                id                = p.UserId,
                displayName       = p.DisplayName,
                image             = img,
                status,
                statusDescription,
                joinedAt          = new DateTimeOffset(p.JoinedAt).ToUnixTimeMilliseconds(),
                tags,
                ageVerified       = av,
                platform,
            };
        }).ToList();

        SendToJS("vrcCurrentInstance", new {
            location     = _cachedInstLocation,
            worldId      = parsed.worldId,
            worldName    = _cachedInstWorldName,
            worldThumb   = _cachedInstWorldThumb,
            instanceType = _cachedInstType,
            nUsers       = logPlayers.Count,
            capacity     = _cachedInstCapacity,
            users,
            playerSource = "logfile",
        });
    }

    // Timeline - LogWatcher event handlers (run on UI thread)

    private void HandleWorldChangedOnUiThread(string worldId, string location)
    {
        // Finalise previous instance event
        if (_pendingInstanceEventId != null)
        {
            var finalPlayers = _cumulativeInstancePlayers.Select(kv => new TimelineService.PlayerSnap
            {
                UserId      = kv.Key,
                DisplayName = kv.Value.displayName,
                Image       = ResolvePlayerImage(kv.Key, kv.Value.image)
            }).ToList();
            var prevId = _pendingInstanceEventId;
            _timeline.UpdateEvent(prevId, ev => ev.Players = finalPlayers);
            var finalEv = _timeline.GetEvents().FirstOrDefault(e => e.Id == prevId);
            if (finalEv != null) SendToJS("timelineEvent", BuildTimelinePayload(finalEv));
        }

        _cumulativeInstancePlayers.Clear();
        _meetAgainThisInstance.Clear();
        _instanceSnapshotTimer?.Dispose();
        _instanceSnapshotTimer = null;

        // Create new instance_join timeline event (world name resolved asynchronously)
        var evId  = Guid.NewGuid().ToString("N")[..8];
        _pendingInstanceEventId = evId;

        var instEv = new TimelineService.TimelineEvent
        {
            Id        = evId,
            Type      = "instance_join",
            Timestamp = DateTime.UtcNow.ToString("o"),
            WorldId   = worldId,
            Location  = location
        };
        _timeline.AddEvent(instEv);
        SendToJS("timelineEvent", BuildTimelinePayload(instEv));
        SendToJS("log", new { msg = $"[TIMELINE] Instance join: {worldId}", color = "sec" });

        // Reset Discord join timer for the new instance
        _discordJoinedAt = DateTime.Now;

        // Track world visit immediately (log watcher fires on every actual world change)
        _worldTimeTracker.SetCurrentWorld(worldId);
        _lastTrackedWorldId = worldId;

        // Immediately refresh instance panel so sidebar doesn't wait for the 60s poll
        SendToJS("vrcWorldJoined", new { worldId });

        // After 15 s: snapshot players + resolve world name
        _instanceSnapshotTimer = new System.Threading.Timer(_ =>
        {
            try
            {
                Invoke(async () =>
                {
                    try
                    {
                        // Refresh any images that have since been fetched (e.g. via requestInstanceInfo)
                        var snap = _cumulativeInstancePlayers.Select(kv => new TimelineService.PlayerSnap
                        {
                            UserId      = kv.Key,
                            DisplayName = kv.Value.displayName,
                            Image       = ResolvePlayerImage(kv.Key, kv.Value.image)
                        }).ToList();

                        string wName = "", wThumb = "";
                        if (worldId.StartsWith("wrld_") && _vrcApi.IsLoggedIn)
                        {
                            var world = await _vrcApi.GetWorldAsync(worldId);
                            if (world != null)
                            {
                                wName  = world["name"]?.ToString() ?? "";
                                wThumb = world["thumbnailImageUrl"]?.ToString() ?? "";
                            }
                        }

                        _timeline.UpdateEvent(evId, ev =>
                        {
                            ev.WorldName  = wName;
                            ev.WorldThumb = wThumb;
                            ev.Players    = snap;
                        });

                        // Store name/thumb in WorldTimeTracker so Time Spent tab can show it
                        // even for worlds that aren't in the timeline top-200
                        if (!string.IsNullOrEmpty(wName))
                            _worldTimeTracker.UpdateWorldInfo(worldId, wName, wThumb);

                        var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == evId);
                        if (updated != null) SendToJS("timelineEvent", BuildTimelinePayload(updated));
                    }
                    catch { }
                });
            }
            catch { }
        }, null, 15_000, System.Threading.Timeout.Infinite);
    }

    private void HandlePlayerJoinedOnUiThread(string userId, string displayName)
    {
        // Skip events for the local player; VRChat logs OnPlayerJoined for self too
        if (!string.IsNullOrEmpty(_currentVrcUserId) && userId == _currentVrcUserId) return;

        // Accumulate into instance player history
        if (!string.IsNullOrEmpty(userId) && !_cumulativeInstancePlayers.ContainsKey(userId))
        {
            var img = _friendNameImg.TryGetValue(userId, out var fi) ? fi.image : "";
            _cumulativeInstancePlayers[userId] = (displayName, img);
            // Store name in UserTimeTracker so this player appears in Time Spent list
            // even when they are not a friend and not in the timeline top-200
            _timeTracker.UpdateUserInfo(userId, displayName, img);

            // Live-update the instance_join timeline event so the UI shows players immediately
            if (_pendingInstanceEventId != null)
            {
                var evId = _pendingInstanceEventId;
                var snap = _cumulativeInstancePlayers.Select(kv => new TimelineService.PlayerSnap
                {
                    UserId      = kv.Key,
                    DisplayName = kv.Value.displayName,
                    Image       = ResolvePlayerImage(kv.Key, kv.Value.image)
                }).ToList();
                _timeline.UpdateEvent(evId, ev => ev.Players = snap);
                var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == evId);
                if (updated != null) SendToJS("timelineEvent", BuildTimelinePayload(updated));
            }
        }

        // First-meet detection, only after known-users set is seeded
        if (!string.IsNullOrEmpty(userId) && _timeline.KnownUsersSeeded && !_timeline.IsKnownUser(userId))
        {
            _timeline.AddKnownUser(userId);
            var img = _friendNameImg.TryGetValue(userId, out var fi) ? fi.image : "";
            var meetEv = new TimelineService.TimelineEvent
            {
                Type      = "first_meet",
                Timestamp = DateTime.UtcNow.ToString("o"),
                UserId    = userId,
                UserName  = displayName,
                UserImage = img,
                WorldId   = _logWatcher.CurrentWorldId ?? "",
                Location  = _logWatcher.CurrentLocation ?? ""
            };
            _timeline.AddEvent(meetEv);
            SendToJS("timelineEvent", BuildTimelinePayload(meetEv));
            SendToJS("log", new { msg = $"[TIMELINE] First meet: {displayName}", color = "sec" });

            // If no image yet, fetch async and update the event
            if (string.IsNullOrEmpty(img) && _vrcApi.IsLoggedIn)
            {
                var evId = meetEv.Id;
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var profile = await _vrcApi.GetUserAsync(userId);
                        if (profile == null) return;
                        var fetchedImg = VRChatApiService.GetUserImage(profile);
                        if (string.IsNullOrEmpty(fetchedImg)) return;
                        _tlPlayerImageCache[userId]   = fetchedImg;
                        _timeline.SetUserImage(userId, fetchedImg); // persist across restarts
                        _playerProfileCache[userId]   = profile;
                        _playerAgeVerifiedCache[userId] = profile["ageVerified"]?.Value<bool>() ?? false;
                        if (_cumulativeInstancePlayers.TryGetValue(userId, out var ex2) && string.IsNullOrEmpty(ex2.image))
                            _cumulativeInstancePlayers[userId] = (ex2.displayName, fetchedImg);
                        _timeline.UpdateEvent(evId, ev => ev.UserImage = fetchedImg);
                        var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == evId);
                        if (updated != null) Invoke(() => SendToJS("timelineEvent", BuildTimelinePayload(updated)));
                    }
                    catch { }
                });
            }
        }
        else if (!string.IsNullOrEmpty(userId))
        {
            _timeline.AddKnownUser(userId);

            // Meet Again: known user, not yet seen in this instance
            if (_timeline.KnownUsersSeeded && !_meetAgainThisInstance.Contains(userId))
            {
                _meetAgainThisInstance.Add(userId);
                var img = _friendNameImg.TryGetValue(userId, out var fi2) ? fi2.image : "";
                var meetAgainEv = new TimelineService.TimelineEvent
                {
                    Type      = "meet_again",
                    Timestamp = DateTime.UtcNow.ToString("o"),
                    UserId    = userId,
                    UserName  = displayName,
                    UserImage = img,
                    WorldId   = _logWatcher.CurrentWorldId ?? "",
                    Location  = _logWatcher.CurrentLocation ?? ""
                };
                _timeline.AddEvent(meetAgainEv);
                SendToJS("timelineEvent", BuildTimelinePayload(meetAgainEv));

                // Async-fetch image if missing
                if (string.IsNullOrEmpty(img) && _vrcApi.IsLoggedIn)
                {
                    var maEvId = meetAgainEv.Id;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var profile = await _vrcApi.GetUserAsync(userId);
                            if (profile == null) return;
                            var fetchedImg = VRChatApiService.GetUserImage(profile);
                            if (string.IsNullOrEmpty(fetchedImg)) return;
                            _tlPlayerImageCache[userId]   = fetchedImg;
                            _timeline.SetUserImage(userId, fetchedImg); // persist across restarts
                            _playerProfileCache[userId]   = profile;
                            _playerAgeVerifiedCache[userId] = profile["ageVerified"]?.Value<bool>() ?? false;
                            if (_cumulativeInstancePlayers.TryGetValue(userId, out var ex3) && string.IsNullOrEmpty(ex3.image))
                                _cumulativeInstancePlayers[userId] = (ex3.displayName, fetchedImg);
                            _timeline.UpdateEvent(maEvId, ev => ev.UserImage = fetchedImg);
                            var updated = _timeline.GetEvents().FirstOrDefault(e => e.Id == maEvId);
                            if (updated != null) Invoke(() => SendToJS("timelineEvent", BuildTimelinePayload(updated)));
                        }
                        catch { }
                    });
                }
            }
        }

        // Instantly push updated player list to JS (no REST call needed)
        PushCurrentInstanceFromCache();

        // If we don't have a cached profile for this player yet, fetch it async so the
        // instance panel and modal get enriched data (image, status, platform, etc.)
        if (!string.IsNullOrEmpty(userId) && userId.StartsWith("usr_")
            && !_playerProfileCache.ContainsKey(userId) && _vrcApi.IsLoggedIn)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var profile = await _vrcApi.GetUserAsync(userId);
                    if (profile == null) return;
                    var img = VRChatApiService.GetUserImage(profile);
                    if (!string.IsNullOrEmpty(img))
                    {
                        _tlPlayerImageCache[userId] = img;
                        _timeline.SetUserImage(userId, img); // persist across restarts
                    }
                    _playerAgeVerifiedCache[userId] = profile["ageVerified"]?.Value<bool>() ?? false;
                    _playerProfileCache[userId] = profile;

                    // Also enrich the cumulative instance player record with the resolved image
                    if (_cumulativeInstancePlayers.TryGetValue(userId, out var existing) && string.IsNullOrEmpty(existing.image))
                        _cumulativeInstancePlayers[userId] = (existing.displayName, img);

                    Invoke(() =>
                    {
                        PushCurrentInstanceFromCache();

                        // Immediately persist the updated image to the pending instance_join
                        // timeline event — don't wait for the 15 s snapshot, so images are
                        // written to DB even if the snapshot timer fires before all fetches finish.
                        if (_pendingInstanceEventId != null)
                        {
                            var evId = _pendingInstanceEventId;
                            var snap = _cumulativeInstancePlayers.Select(kv => new TimelineService.PlayerSnap
                            {
                                UserId      = kv.Key,
                                DisplayName = kv.Value.displayName,
                                Image       = ResolvePlayerImage(kv.Key, kv.Value.image)
                            }).ToList();
                            _timeline.UpdateEvent(evId, ev => ev.Players = snap);
                        }
                    });
                }
                catch { }
            });
        }
    }

    // Timeline - helpers

    private string FixLocalUrl(string url)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("http://localhost:")) return url;
        var slash = url.IndexOf('/', "http://localhost:".Length);
        return slash < 0 ? url : $"http://localhost:{_httpPort}{url[slash..]}";
    }

    /// <summary>
    /// If url is an original CDN URL → serve via imgcache (cached locally or original as fallback).
    /// If url is already a localhost URL (legacy stored) → fix the port.
    /// </summary>
    private string ResolveAndCache(string url, bool longTtl = false)
    {
        if (string.IsNullOrEmpty(url)) return url;
        // Old record stored as localhost URL → just fix the port, file is already on disk
        if (url.StartsWith("http://localhost:")) return FixLocalUrl(url);
        // New record stored as original CDN URL → serve via imgcache (downloads if needed, falls back to CDN URL)
        if (_imgCache == null) return url;
        return longTtl ? _imgCache.GetWorld(url) : _imgCache.Get(url);
    }

    private object BuildTimelinePayload(TimelineService.TimelineEvent ev) => new
    {
        id          = ev.Id,
        type        = ev.Type,
        timestamp   = ev.Timestamp,
        worldId     = ev.WorldId,
        worldName   = ev.WorldName,
        worldThumb  = ResolveAndCache(ev.WorldThumb, longTtl: true),
        location    = ev.Location,
        players     = ev.Players.Select(p => new { userId = p.UserId, displayName = p.DisplayName, image = ResolveAndCache(ResolvePlayerImage(p.UserId, p.Image)) }).ToList(),
        photoPath   = ev.PhotoPath,
        photoUrl    = !string.IsNullOrEmpty(ev.PhotoPath) ? GetVirtualMediaUrl(ev.PhotoPath) : FixLocalUrl(ev.PhotoUrl),
        userId      = ev.UserId,
        userName    = ev.UserName,
        userImage   = ResolveAndCache(ResolvePlayerImage(ev.UserId, ev.UserImage)),
        meetCount   = ev.Type == "meet_again" ? _timeline.GetMeetAgainCount(ev.UserId) : 0,
        notifId     = ev.NotifId,
        notifType   = ev.NotifType,
        notifTitle  = ev.NotifTitle,
        senderName  = ev.SenderName,
        senderId    = ev.SenderId,
        senderImage = ResolveAndCache(ResolvePlayerImage(ev.SenderId, ev.SenderImage)),
        message     = ev.Message,
    };

    private object BuildFriendTimelinePayload(TimelineService.FriendTimelineEvent ev) => new
    {
        id          = ev.Id,
        type        = ev.Type,
        timestamp   = ev.Timestamp,
        friendId    = ev.FriendId,
        friendName  = ev.FriendName,
        friendImage = ResolveAndCache(ResolvePlayerImage(ev.FriendId, ev.FriendImage)),
        worldId     = ev.WorldId,
        worldName   = ev.WorldName,
        worldThumb  = ResolveAndCache(ev.WorldThumb, longTtl: true),
        location    = ev.Location,
        oldValue    = ev.OldValue,
        newValue    = ev.NewValue,
    };

    /// <summary>
    /// Returns the best available profile image for a user: prefers the live friend/player
    /// image caches (which use the corrected GetUserImage chain) over anything stored in the DB.
    /// </summary>
    private string ResolvePlayerImage(string? userId, string? storedImage)
    {
        if (!string.IsNullOrEmpty(userId))
        {
            if (_friendNameImg.TryGetValue(userId, out var fi) && !string.IsNullOrEmpty(fi.image))
                return fi.image;
            if (_tlPlayerImageCache.TryGetValue(userId, out var ci) && !string.IsNullOrEmpty(ci))
                return ci;
            // Persistent DB cache — survives app restarts (covers non-friends, self, ex-friends)
            var dbImg = _timeline.GetCachedUserImage(userId);
            if (!string.IsNullOrEmpty(dbImg))
            {
                _tlPlayerImageCache[userId] = dbImg; // warm session cache
                return dbImg;
            }
        }
        return storedImage ?? "";
    }
}
