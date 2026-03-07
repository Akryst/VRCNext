## What's New in 2026.6.2

### Memory Leaks Fixed

This update fixes an memory leak caused by opening many profiles.
Thanks to the person o nreddit who reported this! :)

- Removed `_userDetailCache` — was storing full user profile payloads (groups, worlds, mutuals) for up to 200 profiles in RAM. Each entry could reach 100KB+ of parsed JSON objects.
- Removed `ServeAndRefresh` background pattern — previously fired 5 parallel API calls (GetUser, GetInstance, GetGroups, GetWorlds, GetMutuals) on every single profile open, even when already cached. Opening 10 profiles rapidly resulted in 50+ concurrent HTTP requests with their response buffers all sitting in RAM simultaneously.
- Removed `_playerImageCache` — replaced with `_friendNameImg` lookups where applicable.
- Fixed `ImageCacheService.DownloadAsync` — was using `ReadAsByteArrayAsync()` which buffered the entire image file as a `byte[]` in RAM before writing to disk. Replaced with `ResponseHeadersRead` + `CopyToAsync` to stream directly to disk without RAM buffering.
- Added concurrency limit to `ImageCacheService` — max 8 simultaneous image downloads via `SemaphoreSlim` to prevent download floods when many profiles are opened at once.
- Fixed VOSK `Model` not being disposed when disabling Voice Fight — caused a persistent ~100MB RAM increase that never freed after toggling the feature off.
