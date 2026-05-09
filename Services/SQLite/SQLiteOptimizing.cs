using Microsoft.Data.Sqlite;
using System.Diagnostics;

namespace VRCNext.Services;

public static class SQLiteOptimizing
{
    private static readonly (string Col, string Label, bool IsInt)[] CleanableCols =
    [
        ("last_seen",                 "Last Seen",           false),
        ("last_seen_location",        "Last Location",       false),
        ("profile_status",            "Status",              false),
        ("profile_status_desc",       "Status Desc",         false),
        ("profile_bio",               "Bio",                 false),
        ("profile_location",          "Location",            false),
        ("profile_cached_at",         "Profile Cache",       false),
        ("profile_last_login",        "Last Login",          false),
        ("profile_last_activity",     "Last Activity",       false),
        ("profile_date_joined",       "Date Joined",         false),
        ("profile_world_name",        "World Name",          false),
        ("profile_instance_type",     "Instance Type",       false),
        ("profile_world_capacity",    "World Capacity",      true),
        ("profile_can_join",          "Can Join",            true),
        ("profile_can_request_invite","Can Req Invite",      true),
        ("profile_can_invite",        "Can Invite",          true),
        ("profile_avatar_file_id",    "Avatar File ID",      false),
        ("profile_state",             "Profile State",       false),
        ("profile_last_platform",     "Last Platform",       false),
        ("profile_user_note",         "User Note",           false),
        ("profile_pronouns",          "Pronouns",            false),
        ("profile_age_verification",  "Age Verification",    false),
        ("profile_bio_links",         "Bio Links",           false),
        ("groups",                    "Groups",              false),
        ("groups_cached_at",          "Groups Cache",        false),
        ("content",                   "Content",             false),
        ("content_cached_at",         "Content Cache",       false),
        ("mutuals",                   "Mutuals",             false),
        ("mutuals_cached_at",         "Mutuals Cache",       false),
        ("mutual_groups",             "Mutual Groups",       false),
        ("mutual_groups_cached_at",   "Mutual Groups Cache", false),
    ];

    public class AnalysisResult
    {
        public long TotalRows          { get; set; }
        public long FriendRows         { get; set; }
        public long CleanableRows      { get; set; }
        public List<(string Label, long Count)> Counts { get; set; } = new();
        public long FriendOnlineCount      { get; set; }
        public long FriendOfflineCount     { get; set; }
        public long FriendStatusCount      { get; set; }
        public long NotificationCount      { get; set; }
        public long VideoUrlCount          { get; set; }
        public long InstancePlayersCount   { get; set; }
    }

    public static AnalysisResult Analyze()
    {
        var result = new AnalysisResult();
        using var db = Database.OpenConnection();

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*), COALESCE(SUM(CASE WHEN profile_is_friend=1 THEN 1 ELSE 0 END),0) FROM user_tracking";
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                result.TotalRows     = r.IsDBNull(0) ? 0 : r.GetInt64(0);
                result.FriendRows    = r.IsDBNull(1) ? 0 : r.GetInt64(1);
                result.CleanableRows = result.TotalRows - result.FriendRows;
            }
        }

        var selects = CleanableCols.Select(c =>
            c.IsInt
                ? $"COALESCE(SUM(CASE WHEN {c.Col}!=0 THEN 1 ELSE 0 END),0)"
                : $"COALESCE(SUM(CASE WHEN {c.Col}!='' AND {c.Col} IS NOT NULL THEN 1 ELSE 0 END),0)");

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = $"SELECT {string.Join(",", selects)} FROM user_tracking WHERE (profile_is_friend IS NULL OR profile_is_friend!=1)";
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                for (int i = 0; i < CleanableCols.Length; i++)
                    result.Counts.Add((CleanableCols[i].Label, r.IsDBNull(i) ? 0 : r.GetInt64(i)));
            }
        }

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = @"SELECT
                COALESCE(SUM(CASE WHEN type='friend_online'  THEN 1 ELSE 0 END),0),
                COALESCE(SUM(CASE WHEN type='friend_offline' THEN 1 ELSE 0 END),0),
                COALESCE(SUM(CASE WHEN type='friend_status'  THEN 1 ELSE 0 END),0)
                FROM friend_events";
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                result.FriendOnlineCount  = r.IsDBNull(0) ? 0 : r.GetInt64(0);
                result.FriendOfflineCount = r.IsDBNull(1) ? 0 : r.GetInt64(1);
                result.FriendStatusCount  = r.IsDBNull(2) ? 0 : r.GetInt64(2);
            }
        }

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT COALESCE(COUNT(*),0) FROM events WHERE type='notification'";
            using var r = cmd.ExecuteReader();
            if (r.Read()) result.NotificationCount = r.IsDBNull(0) ? 0 : r.GetInt64(0);
        }

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT COALESCE(COUNT(*),0) FROM events WHERE type='video_url'";
            using var r = cmd.ExecuteReader();
            if (r.Read()) result.VideoUrlCount = r.IsDBNull(0) ? 0 : r.GetInt64(0);
        }

        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT COALESCE(COUNT(*),0) FROM event_players WHERE event_id IN (SELECT id FROM events WHERE type='instance_join')";
            using var r = cmd.ExecuteReader();
            if (r.Read()) result.InstancePlayersCount = r.IsDBNull(0) ? 0 : r.GetInt64(0);
        }

        return result;
    }

    public static (int UserTrackingCleaned, int FriendEventsCleaned, int NotificationsCleaned, int InstancePlayersCleaned) Optimize()
    {
        using var db = Database.OpenConnection();

        int userCleaned;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = @"UPDATE user_tracking SET
                last_seen='', last_seen_location='',
                profile_status='', profile_status_desc='', profile_bio='', profile_location='',
                profile_avatar_img='', profile_cached_at='',
                profile_last_login='', profile_last_activity='', profile_date_joined='',
                profile_world_name='', profile_world_thumb='', profile_instance_type='',
                profile_user_count=0, profile_world_capacity=0,
                profile_can_join=0, profile_can_request_invite=0, profile_can_invite=0,
                profile_current_avatar_id='', profile_avatar_file_id='', profile_pic_override='',
                profile_tags='[]', profile_note='', profile_friend_key='', profile_traveling_to='',
                profile_state='', profile_last_platform='', profile_platform='', profile_user_note='',
                profile_in_same_instance=0, profile_pronouns='', profile_age_verification='',
                profile_age_verified=0, profile_bio_links='[]', profile_is_favorited=0,
                profile_fav_friend_id='', profile_badges='[]',
                groups='', groups_cached_at='', content='', content_cached_at='',
                mutuals='', mutuals_cached_at='', mutual_groups='', mutual_groups_cached_at=''
                WHERE (profile_is_friend IS NULL OR profile_is_friend!=1)";
            userCleaned = cmd.ExecuteNonQuery();
        }

        int feCleaned;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "DELETE FROM friend_events WHERE type IN ('friend_online','friend_offline','friend_status')";
            feCleaned = cmd.ExecuteNonQuery();
        }

        int notifCleaned;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "DELETE FROM events WHERE type IN ('notification','video_url')";
            notifCleaned = cmd.ExecuteNonQuery();
        }

        int epCleaned;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "DELETE FROM event_players WHERE event_id IN (SELECT id FROM events WHERE type='instance_join')";
            epCleaned = cmd.ExecuteNonQuery();
        }

        return (userCleaned, feCleaned, notifCleaned, epCleaned);
    }

    public static void Vacuum()
    {
        using var db = Database.OpenConnection();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "VACUUM";
        cmd.ExecuteNonQuery();
    }

    public static string CreateBackup()
    {
        var backupDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "Backup");
        Directory.CreateDirectory(backupDir);

        var stamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
        var destPath = Path.Combine(backupDir, $"Database_Backup_{stamp}.db");

        using var db = Database.OpenConnection();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"VACUUM INTO '{destPath.Replace("'", "''")}'";
        cmd.ExecuteNonQuery();

        return destPath;
    }

    public static string CreateRegistryBackup()
    {
        var backupDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "VRCNext", "Backup");
        Directory.CreateDirectory(backupDir);

        var stamp    = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
        var destPath = Path.Combine(backupDir, $"VRChat_Registry_{stamp}.reg");

        var psi = new ProcessStartInfo("reg")
        {
            Arguments              = $"export \"HKCU\\Software\\VRChat\" \"{destPath}\" /y",
            UseShellExecute        = false,
            CreateNoWindow         = true,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
        };
        using var proc = Process.Start(psi) ?? throw new Exception("Could not start reg.exe");
        proc.WaitForExit(15000);
        if (proc.ExitCode != 0)
            throw new Exception($"reg export failed (exit code {proc.ExitCode})");

        return destPath;
    }
}
