**2026.21.7**

### Changes
* **Recently Visited** Widget on Dashboard will no longer show how many players are i nthe world as it's not needed data and a waste of GET requests.

### Fixes

* **Reduced World Insights API calls from N to 1.** The hourly Insights refresh previously fetched each world individually. The list endpoint already returns all required stats, such as `favorites`, `visits`, and `occupants`, so individual world requests are no longer needed.
* **Reduced Recently Visited API calls** by using cached data where possible.
* **Reduced Friends Location API calls** by using cached data. If the user is still in the same world after restarting the app, VRCNext can reuse the cached location data instead of requesting it again.
* **Reduced Group Activity API calls** by using cached data. If a group event is still hosted in the same location, VRCNext no longer needs to request another update.
* **Reduced Mutual Friends API calls** when opening a friend’s profile. Mutual friends are now cached for 24 hours, so opening the same profile again avoids unnecessary requests to the VRChat API servers.
