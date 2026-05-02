using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace VRCNext.Services.Helpers;

public static class FavoritedImagesStore
{
    private static readonly string FilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "VRCNext", "favorited_images.json");

    public static List<string> Load()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                var json = File.ReadAllText(FilePath);
                return JsonConvert.DeserializeObject<List<string>>(json) ?? new();
            }
        }
        catch { }
        return new();
    }

    public static void Save(List<string> items)
    {
        try
        {
            var dir = Path.GetDirectoryName(FilePath)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(FilePath, JsonConvert.SerializeObject(items, Formatting.Indented));
        }
        catch { }
    }
}

public static class MigrationHelper
{
    public static void MigrateFavorites(AppSettings settings)
    {
        if (settings.Favorites.Count == 0) return;

        var existing = FavoritedImagesStore.Load();
        foreach (var path in settings.Favorites)
            if (!existing.Contains(path))
                existing.Add(path);

        FavoritedImagesStore.Save(existing);

        settings.Favorites.Clear();
        settings.Save();
    }

    public static void MigrateBuiltInDashboardTheme(AppSettings settings)
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "custom-themes", "Dashboard Theme");
        try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); } catch { }

        bool changed = settings.ActiveCustomThemes.Remove("Dashboard Theme");
        if (!settings.ActiveCustomThemes.Contains("VRCNext v2 Preview"))
        {
            settings.ActiveCustomThemes.Insert(0, "VRCNext v2 Preview");
            changed = true;
        }
        if (changed) settings.Save();
    }

    public static async Task MigrateUserTrackingCountsAsync(AppSettings settings, Action<int>? onProgress = null)
    {
        if (settings.UserTrackingCountsMigrated) return;

        // Wait for the app to finish loading before touching the DB
        await Task.Delay(5000);
        onProgress?.Invoke(1);

        try
        {
            using var db = Database.OpenConnection();

            // Phase 1: one scan for all meet_again counts (uses idx_events_type index)
            var meetCounts = new Dictionary<string, long>();
            using (var cmd = db.CreateCommand())
            {
                cmd.CommandText = "SELECT user_id, COUNT(*) FROM events WHERE type='meet_again' AND user_id!='' GROUP BY user_id";
                using var r = cmd.ExecuteReader();
                while (r.Read()) meetCounts[r.GetString(0)] = r.GetInt64(1);
            }
            onProgress?.Invoke(15);

            // Phase 2: one scan for all first_meet dates
            var firstMeets = new Dictionary<string, string>();
            using (var cmd = db.CreateCommand())
            {
                cmd.CommandText = "SELECT user_id, MIN(timestamp) FROM events WHERE type='first_meet' AND user_id!='' GROUP BY user_id";
                using var r = cmd.ExecuteReader();
                while (r.Read()) firstMeets[r.GetString(0)] = r.GetString(1);
            }
            onProgress?.Invoke(25);

            // Phase 3: write in small batches so SQLite is never locked for long
            var allIds = new HashSet<string>(meetCounts.Keys);
            allIds.UnionWith(firstMeets.Keys);
            var total = Math.Max(allIds.Count, 1);
            int done  = 0;

            var batch = new List<string>(50);
            foreach (var uid in allIds)
            {
                batch.Add(uid);
                if (batch.Count >= 50)
                {
                    ApplyMeetCountBatch(db, batch, meetCounts, firstMeets);
                    done += batch.Count;
                    batch.Clear();
                    onProgress?.Invoke(25 + (int)(done * 73.0 / total));
                    await Task.Delay(20);
                }
            }
            if (batch.Count > 0)
            {
                ApplyMeetCountBatch(db, batch, meetCounts, firstMeets);
                done += batch.Count;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Migration] MigrateUserTrackingCounts failed: {ex.Message}");
            onProgress?.Invoke(-1);
            return;
        }

        onProgress?.Invoke(100);
        settings.UserTrackingCountsMigrated = true;
        settings.Save();
    }

    private static void ApplyMeetCountBatch(
        SqliteConnection db,
        List<string> userIds,
        Dictionary<string, long> meetCounts,
        Dictionary<string, string> firstMeets)
    {
        using var tx  = db.BeginTransaction();
        using var ins = db.CreateCommand();
        using var upd = db.CreateCommand();
        ins.Transaction = tx;
        upd.Transaction = tx;

        ins.CommandText = @"INSERT OR IGNORE INTO user_tracking
            (user_id, total_seconds, last_seen, last_seen_location, display_name, image, first_meet_date, meet_again_count)
            VALUES ($uid, 0, '', '', '', '', $fm, $ma)";
        var pInsUid = ins.Parameters.Add("$uid", SqliteType.Text);
        var pInsFm  = ins.Parameters.Add("$fm",  SqliteType.Text);
        var pInsMa  = ins.Parameters.Add("$ma",  SqliteType.Integer);

        upd.CommandText = @"UPDATE user_tracking SET
            meet_again_count = $ma,
            first_meet_date  = CASE WHEN first_meet_date = '' THEN $fm ELSE first_meet_date END
            WHERE user_id = $uid";
        var pUpdUid = upd.Parameters.Add("$uid", SqliteType.Text);
        var pUpdFm  = upd.Parameters.Add("$fm",  SqliteType.Text);
        var pUpdMa  = upd.Parameters.Add("$ma",  SqliteType.Integer);

        foreach (var uid in userIds)
        {
            var ma = meetCounts.TryGetValue(uid, out var mc) ? mc : 0L;
            var fm = firstMeets.TryGetValue(uid, out var fd) ? fd : "";

            pInsUid.Value = uid; pInsFm.Value = fm; pInsMa.Value = ma;
            ins.ExecuteNonQuery();

            pUpdUid.Value = uid; pUpdFm.Value = fm; pUpdMa.Value = ma;
            upd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    public static void MigrateCachesToSubdir()
    {
        var root  = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VRCNext");
        var subdir = Path.Combine(root, "Caches");

        string[] files =
        [
            "fav_worlds_cache.json",
            "avatars_cache.json",
            "groups_cache.json",
            "friends_cache.json",
            "mutual_cache.json",
        ];

        try { Directory.CreateDirectory(subdir); } catch { }

        foreach (var name in files)
        {
            var oldPath = Path.Combine(root, name);
            var newPath = Path.Combine(subdir, name);
            if (!File.Exists(oldPath)) continue;
            try
            {
                if (!File.Exists(newPath))
                    File.Move(oldPath, newPath);
                else
                    File.Delete(oldPath);
            }
            catch { }
        }
    }
}
