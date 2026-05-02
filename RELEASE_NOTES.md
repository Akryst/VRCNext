**2026.20.7**

**Changes**
- Dashboard sections now auto-refresh on a timer: Group Activity every 10 min, Recently Visited / Favorite Worlds / Favorite Avatars every 60 min, My Avatars / Upcoming Events every 120 min (timer only fires when Dashboard tab is active)
- Added manual refresh button (⟳) to: Recently Visited, Favorite Worlds, Favorite Avatars, My Avatars, Group Activity, Group Activity (Small), Upcoming Events

**Fixes**
- Group Activity / Group Activity (Small): Closed instances remained visible as data was never refreshed
- Recently Visited: World list was never updated after initial load
- Favorite Worlds: List stayed frozen until app restart
- Favorite Avatars: List stayed frozen until app restart
- My Avatars: List stayed frozen until app restart
- Upcoming Events: Events were not automatically refreshed and showed stale data
