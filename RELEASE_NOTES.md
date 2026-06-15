**2026.31.1**

**User Profiles**

* Added a **Refresh** button/icon to manually refresh a user profile when needed.

This is useful when groups or mutuals change while the profile is already open, since this data does not refresh automatically on live servers.

**Improvements**

* Groups now always show up-to-date data when opening a user profile instead of using hard-cached data.
* Mutual groups now always show up-to-date data when opening a user profile instead of using hard-cached data.
* Mutual friends now always show up-to-date data when opening a user profile instead of using hard-cached data.
* Groups, mutual groups, and mutual friends are now cached for 1 minute to prevent request spam when opening profiles.

**Fixes**

* Fixed a bug where the FFC cacher could show outdated group or mutual data when opening a profile a second time.
