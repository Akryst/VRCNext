using System.Collections.Concurrent;

namespace VRCNext.Services.Helpers;

// Blocks REST API calls for recently opened modals.
// SQLite already handles data caching — this only suppresses redundant network fetches.
public static class ModalCacheHelper
{
    // Cache Timer
    private const int CacheDurationSeconds = 120;

    private static readonly ConcurrentDictionary<string, DateTime> _timestamps = new();

    // Returns true if the entity was opened within the cache window (no REST call needed).
    public static bool IsCached(string entityId)
    {
        if (!_timestamps.TryGetValue(entityId, out var time)) return false;
        if (DateTime.UtcNow - time < TimeSpan.FromSeconds(CacheDurationSeconds)) return true;
        _timestamps.TryRemove(entityId, out _);
        return false;
    }
    
    public static void Mark(string entityId)
    {
        _timestamps[entityId] = DateTime.UtcNow;
    }

    public static void Invalidate(string entityId)
    {
        _timestamps.TryRemove(entityId, out _);
    }
}
