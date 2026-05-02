**2026.20.7**

**Changes**
- World Modal: Added "Infos" section (Recommended, Max Capacity, Instances, Published, Updated, Version) and "Community Info" section (Public Players, Private Players, Heat, Popularity) matching the Profile Modal style
- World Modal: Instances moved from bottom of Info tab into a dedicated "Instances (n)" tab — always visible alongside Info and Insights; each instance now shows the world thumbnail matching the Profile "Current World" style, with group badges, join button and friend strip preserved
- World cache (SQLite): Extended world_tracking table with heat, popularity, publicOccupants, privateOccupants, version — persisted on every background detail fetch
- Dashboard sections now auto-refresh on a timer: Group Activity every 10 min, Recently Visited / Favorite Worlds / Favorite Avatars every 60 min, My Avatars / Upcoming Events every 120 min (timer only fires when Dashboard tab is active)
- Added manual refresh button (⟳) to: Recently Visited, Favorite Worlds, Favorite Avatars, My Avatars, Group Activity, Group Activity (Small), Upcoming Events
- Added more logging for "My Instances"

**Fixes**
- World Modal: Clicking a group from the Instances tab now correctly pushes the world onto the breadcrumb stack so back-navigation works
- World Modal: Refreshing instances no longer jumps back to the Info tab — active tab is preserved across refreshes
- World Modal: Instance list is now scrollable (max 5 visible at once) instead of being cut off
- World Modal: Group badges were missing after instances redesign — restored with clickable group name
- World Modal: Join button was missing after instances redesign — restored per instance
- World cache: heat, popularity, publicOccupants, privateOccupants and version were missing from the SQLite cache-first response — now served immediately on modal open without waiting for the REST call
- Invite+ instances showed as "Invite" in the friends sidebar, current instance panel and instance modal — root cause was ParseLocation not checking ~canRequestInvite in the location string
- Your Instances: auto-closed instances (closedAt set) were not removed on refresh — now correctly detected and removed alongside null instances
- Group Activity / Group Activity (Small): Closed instances remained visible as data was never refreshed
- Recently Visited: World list was never updated after initial load
- Favorite Worlds: List stayed frozen until app restart
- Favorite Avatars: List stayed frozen until app restart
- My Avatars: List stayed frozen until app restart
- Upcoming Events: Events were not automatically refreshed and showed stale data
