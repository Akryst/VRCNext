using System.Collections.Concurrent;
using Microsoft.Data.Sqlite;

namespace VRCNext.Services.Helpers;

// Unified image cache. One entity ID → one file → reused everywhere.
// Directory: %AppData%\VRCNext\Caches\ImageCache\{subdir}\{entityId}.{ext}
public static class ImageCacheHelper
{
    private static string _baseDir = "";
    private static HttpClient? _http;
    private static SqliteConnection? _db;
    private static readonly object _dbLock = new();

    public static int  Port            { get; set; } = 49152;
    public static int  LimitGb         { get; set; } = 5;
    public static bool OptimizeEnabled { get; set; } = true;

    // Toggle ImageCache Debugging
    public static bool DebugMode { get; set; } = false;

    /// <summary>Set at startup to route download logs to the activity log.</summary>
    public static Action<string>? Log { get; set; }
    private static readonly ConcurrentDictionary<string, Task<string?>> _downloads = new();
    // Session-scoped path memo: "" = checked, not found; non-empty = full path
    private static readonly ConcurrentDictionary<string, string> _pathCache = new();
    // Last downloaded URL per entity — loaded from SQLite on startup
    private static readonly ConcurrentDictionary<string, string> _urls = new();

    private static readonly string[] _imageExtensions = [".jpg", ".png", ".webp", ".gif"];

    public static void Initialize(HttpClient http)
    {
        _baseDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "Caches", "ImageCache");
        _http = http;

        Directory.CreateDirectory(Path.Combine(_baseDir, "Worlds"));
        Directory.CreateDirectory(Path.Combine(_baseDir, "Groups"));
        Directory.CreateDirectory(Path.Combine(_baseDir, "Avatars"));
        Directory.CreateDirectory(Path.Combine(_baseDir, "Users"));
        Directory.CreateDirectory(Path.Combine(_baseDir, "Badges"));
        Directory.CreateDirectory(Path.Combine(_baseDir, "Events"));

        _InitDb();
    }

    private static void _InitDb()
    {
        _db = new SqliteConnection($"Data Source={Database.DbPath}");
        _db.Open();
        using var cmd = _db.CreateCommand();
        cmd.CommandText = "CREATE TABLE IF NOT EXISTS image_versions (key TEXT PRIMARY KEY, url TEXT NOT NULL);";
        cmd.ExecuteNonQuery();
        _LoadUrls();
    }

    private static void _LoadUrls()
    {
        lock (_dbLock)
        {
            using var cmd = _db!.CreateCommand();
            cmd.CommandText = "SELECT key, url FROM image_versions";
            using var r = cmd.ExecuteReader();
            while (r.Read())
                _urls[r.GetString(0)] = r.GetString(1);
        }
    }

    private static string? GetStoredUrl(string subdir, string entityId)
    {
        var key = $"{subdir}/{entityId}";
        return _urls.TryGetValue(key, out var url) ? url : null;
    }

    private static void SaveUrl(string subdir, string entityId, string url)
    {
        var key = $"{subdir}/{entityId}";
        _urls[key] = url;
        _ = Task.Run(() =>
        {
            lock (_dbLock)
            {
                if (_db == null) return;
                using var cmd = _db.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO image_versions (key, url) VALUES ($key, $url)
                    ON CONFLICT(key) DO UPDATE SET url = $url";
                cmd.Parameters.AddWithValue("$key", key);
                cmd.Parameters.AddWithValue("$url", url);
                cmd.ExecuteNonQuery();
            }
        });
    }

    public static string ToLocalUrl(string localPath)
    {
        var rel = Path.GetRelativePath(_baseDir, localPath).Replace('\\', '/');
        var url = $"http://localhost:{Port}/imgcache/{rel}";
        return DebugMode ? url + "?src=disk" : url;
    }

// World
    public static string? GetWorldCached(string? worldId)
        => FindCachedFile("Worlds", worldId);
    public static Task<string?> CacheWorldAsync(string? worldId, string? imageUrl, bool forceRefresh = false)
        => CacheAsync("Worlds", worldId, imageUrl, forceRefresh);
    public static string? CacheWorldBackground(string? worldId, string? imageUrl)
    {
        var cached = GetWorldCached(worldId);
        if (cached != null) return cached;
        if (!string.IsNullOrWhiteSpace(worldId) && !string.IsNullOrWhiteSpace(imageUrl))
            _ = CacheWorldAsync(worldId, imageUrl);
        return null;
    }

    public static string GetWorldUrl(string? worldId, string? imageUrl)
    {
        imageUrl = StripLocalhostUrl(imageUrl);
        var cached = GetWorldCached(worldId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(imageUrl) && !string.IsNullOrWhiteSpace(worldId))
            {
                var normalized = NormalizeTo512(imageUrl);
                var storedUrl  = GetStoredUrl("Worlds", worldId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Worlds", worldId, imageUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        CacheWorldBackground(worldId, imageUrl);
        return NormalizeTo512(imageUrl ?? "");
    }

// Groups

    public static string? GetGroupCached(string? groupId)
        => FindCachedFile("Groups", groupId);

    public static Task<string?> CacheGroupAsync(string? groupId, string? iconUrl, bool forceRefresh = false)
        => CacheAsync("Groups", groupId, iconUrl, forceRefresh);

    public static string? CacheGroupBackground(string? groupId, string? iconUrl)
    {
        var cached = GetGroupCached(groupId);
        if (cached != null) return cached;
        if (!string.IsNullOrWhiteSpace(groupId) && !string.IsNullOrWhiteSpace(iconUrl))
            _ = CacheGroupAsync(groupId, iconUrl);
        return null;
    }

    public static string GetGroupUrl(string? groupId, string? iconUrl)
    {
        iconUrl = StripLocalhostUrl(iconUrl);
        var cached = GetGroupCached(groupId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(iconUrl) && !string.IsNullOrWhiteSpace(groupId))
            {
                var normalized = NormalizeTo512(iconUrl);
                var storedUrl  = GetStoredUrl("Groups", groupId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Groups", groupId, iconUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        CacheGroupBackground(groupId, iconUrl);
        return NormalizeTo512(iconUrl ?? "");
    }

    public static string GetGroupBannerUrl(string? groupId, string? bannerUrl)
    {
        bannerUrl = StripLocalhostUrl(bannerUrl);
        var bannerId = string.IsNullOrWhiteSpace(groupId) ? null : groupId + "_banner";
        var cached   = FindCachedFile("Groups", bannerId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(bannerUrl) && bannerId != null)
            {
                var normalized = NormalizeTo512(bannerUrl);
                var storedUrl  = GetStoredUrl("Groups", bannerId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Groups", bannerId, bannerUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        if (!string.IsNullOrWhiteSpace(bannerId) && !string.IsNullOrWhiteSpace(bannerUrl))
            _ = CacheAsync("Groups", bannerId, bannerUrl, false);
        return NormalizeTo512(bannerUrl ?? "");
    }

// Users

    public static string? GetUserCached(string? userId)
        => FindCachedFile("Users", userId);

    public static string? GetUserBannerCached(string? userId)
        => FindCachedFile("Users", userId == null ? null : userId + "_banner");

    public static Task<string?> CacheUserAsync(string? userId, string? iconUrl, bool forceRefresh = false)
        => CacheAsync("Users", userId, iconUrl, forceRefresh);

    public static string GetUserUrl(string? userId, string? iconUrl)
    {
        iconUrl = StripLocalhostUrl(iconUrl);
        var cached = GetUserCached(userId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(iconUrl) && !string.IsNullOrWhiteSpace(userId))
            {
                var normalized = NormalizeTo512(iconUrl);
                var storedUrl  = GetStoredUrl("Users", userId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Users", userId, iconUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(iconUrl))
            _ = CacheAsync("Users", userId, iconUrl, false);
        return NormalizeTo512(iconUrl ?? "");
    }

    public static string GetUserBannerUrl(string? userId, string? bannerUrl)
    {
        bannerUrl = StripLocalhostUrl(bannerUrl);
        var bannerId = userId == null ? null : userId + "_banner";
        var cached = GetUserBannerCached(userId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(bannerUrl) && bannerId != null)
            {
                var normalized = NormalizeTo512(bannerUrl);
                var storedUrl  = GetStoredUrl("Users", bannerId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Users", bannerId, bannerUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        if (!string.IsNullOrWhiteSpace(bannerId) && !string.IsNullOrWhiteSpace(bannerUrl))
            _ = CacheAsync("Users", bannerId, bannerUrl, false);
        return NormalizeTo512(bannerUrl ?? "");
    }

// Badges

    public static string GetBadgeUrl(string? badgeId, string? imageUrl)
    {
        var cached = FindCachedFile("Badges", badgeId);
        if (cached != null) return ToLocalUrl(cached);
        imageUrl = StripLocalhostUrl(imageUrl);
        if (!string.IsNullOrWhiteSpace(badgeId) && !string.IsNullOrWhiteSpace(imageUrl))
            _ = CacheAsync("Badges", badgeId, imageUrl, false);
        return NormalizeTo512(imageUrl ?? "");
    }

// Events (Group Events, Calendar Events)

    public static string? GetEventCached(string? eventId)
        => FindCachedFile("Events", eventId);

    public static string GetEventUrl(string? eventId, string? imageUrl)
    {
        imageUrl = StripLocalhostUrl(imageUrl);
        var cached = GetEventCached(eventId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(imageUrl) && !string.IsNullOrWhiteSpace(eventId))
            {
                var normalized = NormalizeTo512(imageUrl);
                var storedUrl  = GetStoredUrl("Events", eventId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Events", eventId, imageUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        if (!string.IsNullOrWhiteSpace(eventId) && !string.IsNullOrWhiteSpace(imageUrl))
            _ = CacheAsync("Events", eventId, imageUrl, false);
        return NormalizeTo512(imageUrl ?? "");
    }

// Avatars

    public static string? GetAvatarCached(string? avatarId)
        => FindCachedFile("Avatars", avatarId);

    public static Task<string?> CacheAvatarAsync(string? avatarId, string? imageUrl, bool forceRefresh = false)
        => CacheAsync("Avatars", avatarId, imageUrl, forceRefresh);

    public static string? CacheAvatarBackground(string? avatarId, string? imageUrl)
    {
        var cached = GetAvatarCached(avatarId);
        if (cached != null) return cached;
        if (!string.IsNullOrWhiteSpace(avatarId) && !string.IsNullOrWhiteSpace(imageUrl))
            _ = CacheAvatarAsync(avatarId, imageUrl);
        return null;
    }

    public static string GetAvatarUrl(string? avatarId, string? imageUrl)
    {
        imageUrl = StripLocalhostUrl(imageUrl);
        var cached = GetAvatarCached(avatarId);
        if (cached != null)
        {
            if (!string.IsNullOrWhiteSpace(imageUrl) && !string.IsNullOrWhiteSpace(avatarId))
            {
                var normalized = NormalizeTo512(imageUrl);
                var storedUrl  = GetStoredUrl("Avatars", avatarId);
                if (storedUrl == normalized) return ToLocalUrl(cached);
                if (!IsNewerOrUnknown(normalized, storedUrl)) return ToLocalUrl(cached);
                _ = CacheAsync("Avatars", avatarId, imageUrl, forceRefresh: true);
                return normalized;
            }
            return ToLocalUrl(cached);
        }
        CacheAvatarBackground(avatarId, imageUrl);
        return NormalizeTo512(imageUrl ?? "");
    }

// Core

    // Strip stale localhost URLs — we can't re-download from localhost.
    private static string? StripLocalhostUrl(string? url) =>
        url != null && url.StartsWith("http://localhost:") ? null : url;

    // Extract VRChat file version number from a normalized URL (e.g. .../image/file_xxx/2/512 → 2)
    private static int ExtractVersion(string? url)
    {
        if (string.IsNullOrEmpty(url)) return 0;
        var marker = "/image/";
        var i = url.IndexOf(marker, StringComparison.Ordinal);
        if (i < 0) return 0;
        var parts = url[(i + marker.Length)..].Split('/');
        // parts[0] = file_xxx, parts[1] = version, parts[2] = size
        if (parts.Length >= 2 && int.TryParse(parts[1], out var v)) return v;
        return 0;
    }

    // Returns true if incomingUrl is newer than (or same version as) the stored URL.
    // Prevents old timeline/event URLs from overwriting a newer cached image.
    private static bool IsNewerOrUnknown(string incomingUrl, string? storedUrl)
    {
        if (string.IsNullOrEmpty(storedUrl)) return true;
        var incomingVer = ExtractVersion(incomingUrl);
        var storedVer   = ExtractVersion(storedUrl);
        if (incomingVer == 0 || storedVer == 0) return true;
        return incomingVer >= storedVer;
    }

    private static Task<string?> CacheAsync(string subdir, string? entityId, string? imageUrl, bool forceRefresh)
    {
        imageUrl = StripLocalhostUrl(imageUrl);
        if (string.IsNullOrWhiteSpace(entityId) || string.IsNullOrWhiteSpace(imageUrl) || _http == null)
            return Task.FromResult<string?>(null);
        if (PermafailHelper.IsPermafailed(NormalizeTo512(imageUrl), "Image"))
            return Task.FromResult<string?>(null);

        if (!forceRefresh)
        {
            var existing = FindCachedFile(subdir, entityId);
            if (existing != null) return Task.FromResult<string?>(existing);
        }

        var key = $"{subdir}/{entityId}";

        // forceRefresh: remove any in-flight task so new URL download always starts fresh
        if (forceRefresh) _downloads.TryRemove(key, out _);

        return _downloads.GetOrAdd(key, _key =>
        {
            var task = DownloadAsync(subdir, entityId, imageUrl, forceRefresh);
            return task.ContinueWith(t =>
            {
                _downloads.TryRemove(key, out _);
                return t.Status == TaskStatus.RanToCompletion ? t.Result : null;
            }, TaskContinuationOptions.ExecuteSynchronously);
        });
    }

    private static async Task<string?> DownloadAsync(string subdir, string entityId, string imageUrl, bool forceRefresh)
    {
        var dir      = Path.Combine(_baseDir, subdir);
        var tmpPath  = Path.Combine(dir, entityId + ".tmp");
        var fetchUrl = NormalizeTo512(imageUrl);

        Log?.Invoke($"[IMG] GET {subdir}/{entityId} → {fetchUrl}");

        try
        {
            using var resp = await _http!.GetAsync(fetchUrl, HttpCompletionOption.ResponseHeadersRead);
            if (!resp.IsSuccessStatusCode)
            {
                var code = (int)resp.StatusCode;
                Log?.Invoke($"[IMG] FAIL {subdir}/{entityId} → {code}");
                if (code == 403 || code == 404) PermafailHelper.Add(fetchUrl, "Image", code);
                return null;
            }

            using (var stream = await resp.Content.ReadAsStreamAsync())
            using (var fs    = File.Create(tmpPath))
                await stream.CopyToAsync(fs);
        }
        catch (Exception ex)
        {
            Log?.Invoke($"[IMG] ERR {subdir}/{entityId} → {ex.Message}");
            TryDelete(tmpPath);
            return null;
        }

        var ext = DetectExtension(tmpPath);
        if (ext == null)
        {
            Log?.Invoke($"[IMG] SKIP {subdir}/{entityId} → not an image");
            TryDelete(tmpPath);
            return null;
        }

        if (forceRefresh)
        {
            _pathCache.TryRemove($"{subdir}/{entityId}", out _);
            foreach (var old in _imageExtensions)
                TryDelete(Path.Combine(dir, entityId + old));
        }

        var finalPath = Path.Combine(dir, entityId + ext);
        try
        {
            File.Move(tmpPath, finalPath, overwrite: true);
        }
        catch
        {
            TryDelete(tmpPath);
            return null;
        }

        _pathCache[$"{subdir}/{entityId}"] = finalPath;
        SaveUrl(subdir, entityId, fetchUrl);
        Log?.Invoke($"[IMG] OK {subdir}/{entityId}{ext}");
        _ = Task.Run(TrimIfNeeded);
        return finalPath;
    }

// Helpers
    private static string? FindCachedFile(string subdir, string? entityId)
    {
        if (string.IsNullOrWhiteSpace(entityId)) return null;
        var key = $"{subdir}/{entityId}";
        if (_pathCache.TryGetValue(key, out var memo))
            return memo.Length > 0 ? memo : null;
        var dir = Path.Combine(_baseDir, subdir);
        foreach (var ext in _imageExtensions)
        {
            var path = Path.Combine(dir, entityId + ext);
            if (File.Exists(path))
            {
                _pathCache[key] = path;
                return path;
            }
        }
        _pathCache[key] = "";
        return null;
    }

    private static string? DetectExtension(string path)
    {
        try
        {
            Span<byte> hdr = stackalloc byte[12];
            using var f = File.OpenRead(path);
            f.ReadAtLeast(hdr, hdr.Length, throwOnEndOfStream: false);

            if (hdr[0] == 0xFF && hdr[1] == 0xD8 && hdr[2] == 0xFF)
                return ".jpg";
            if (hdr[0] == 0x89 && hdr[1] == 0x50 && hdr[2] == 0x4E && hdr[3] == 0x47)
                return ".png";
            if (hdr[0] == 0x52 && hdr[1] == 0x49 && hdr[2] == 0x46 && hdr[3] == 0x46 &&
                hdr[8] == 0x57 && hdr[9] == 0x45 && hdr[10] == 0x42 && hdr[11] == 0x50)
                return ".webp";
            if (hdr[0] == 0x47 && hdr[1] == 0x49 && hdr[2] == 0x46)
                return ".gif";
        }
        catch { }
        return null;
    }

    // Cache Manager

    public static long GetCacheSizeBytes()
    {
        if (!Directory.Exists(_baseDir)) return 0;
        return new DirectoryInfo(_baseDir)
            .GetFiles("*", SearchOption.AllDirectories)
            .Where(f => !f.Name.EndsWith(".tmp"))
            .Sum(f => f.Length);
    }

    public static void TrimIfNeeded()
    {
        var limitBytes = (long)LimitGb * 1024 * 1024 * 1024;
        if (limitBytes <= 0 || !Directory.Exists(_baseDir)) return;
        try
        {
            var files = new DirectoryInfo(_baseDir)
                .GetFiles("*", SearchOption.AllDirectories)
                .Where(f => !f.Name.EndsWith(".tmp"))
                .OrderBy(f => f.LastWriteTimeUtc)
                .ToList();
            var total = files.Sum(f => f.Length);
            if (total <= limitBytes) return;
            var target = (long)(limitBytes * 0.8);
            foreach (var f in files)
            {
                if (total <= target) break;
                try { total -= f.Length; f.Delete(); } catch { }
            }
        }
        catch { }
    }

    public static async Task OptimizeAsync(Action<int, int>? onProgress = null)
    {
        if (!Directory.Exists(_baseDir)) return;
        const long threshold = (long)(1.5 * 1024 * 1024);
        var pngFiles = new DirectoryInfo(_baseDir)
            .GetFiles("*.png", SearchOption.AllDirectories)
            .Where(f => f.Length > threshold)
            .Select(f => f.FullName)
            .ToList();
        int total = pngFiles.Count, done = 0;
        onProgress?.Invoke(done, total);
        foreach (var pngPath in pngFiles)
        {
            var jpgPath = pngPath[..^4] + ".jpg";
            try
            {
                using var bmp = SkiaSharp.SKBitmap.Decode(pngPath);
                if (bmp == null) continue;
                using var img  = SkiaSharp.SKImage.FromBitmap(bmp);
                using var data = img.Encode(SkiaSharp.SKEncodedImageFormat.Jpeg, 80);
                if (data != null)
                {
                    using var fs = File.Create(jpgPath);
                    data.SaveTo(fs);
                    try { File.Delete(pngPath); } catch { }
                }
            }
            catch { }
            done++;
            onProgress?.Invoke(done, total);
            await Task.Yield();
        }
    }

    // Converts VRC Url to CDN 512 Endpoints
    public static string NormalizeTo512(string url)
    {
        const string filePrefix = "/api/1/file/";
        var fi = url.IndexOf(filePrefix, StringComparison.Ordinal);
        if (fi >= 0)
        {
            var rest  = url[(fi + filePrefix.Length)..];
            var parts = rest.Split('/');
            if (parts.Length >= 3 && parts[0].StartsWith("file_", StringComparison.OrdinalIgnoreCase))
                return $"https://api.vrchat.cloud/api/1/image/{parts[0]}/{parts[1]}/512";
        }
        if (url.Contains("/api/1/image/", StringComparison.Ordinal) && url.EndsWith("/256", StringComparison.Ordinal))
            return url[..^3] + "512";
        return url;
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}
