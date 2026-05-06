**2026.22.0**

### Changes

**Fonts**
* Changed font to Google Sans/Google Noto/Bolds

* **Modals**
* All modals (Group, Profile, Avatars, Worlds) are now 15% bigger.

* **Friend Sidebar**
* Favorites only show friends that are In-Game instead of every single one.
* Favorites won't be shown "IN-GAME" to make sure we don't have duplicates.
* Show "Age Gated" Info in instance info
* Show "Age Gated" Info in instance list info

* **Dashboard**

* The Recently Visited widget no longer shows the current player count for each world.
* This information was not important in this widget and caused extra VRChat API requests.
* Added Video background support (Max 60MB Files 1440p) - not recommended to use but have it.
  
* **User Profile Modal**

* The Info tab has been redesigned to be cleaner and easier to read.
* Badges, Biography, and Trust & Safety are now shown on the left side.
* Profile information and additional details are now shown on the right side.
* Section titles now use a more consistent style.
* Added "Instance Owner" Information to "Current World" Section
* Show "Own" Groups of an user.
* Removed "Representing Group" from "Group" Tab as it's already shown in header.

* **World Modal**

* The Info tab has been redesigned with a cleaner two-column layout.
* Tags, Your Time Spent, Description, and Popularity are now shown on the left side.
* World information and Community details are now shown on the right side.
* Sections are now visually separated to make the page easier to scan.
* Show Age gated instances.

* **Group Modal**

* The Info tab has been redesigned with a two-column layout.
* Description and Rules are now shown on the left side.
* Links, Languages, and Open to new Members are now shown on the right side.
* Visibility is shown as a full-width row at the bottom when you are a member of the group.

* **Fixes & Improvements**

* VRCNext now updates World Insights with a single request instead of requesting every world one by one.
* This makes the hourly refresh much lighter.
* Recently Visited now reuses cached data where possible instead of requesting the same information again.
* If you restart VRCNext and are still in the same world, the app can now reuse your cached location data.
* If a group event is still hosted in the same location, VRCNext no longer requests the same location data again.
* Mutual friends are now cached for 24 hours.
* Opening the same profile again will reuse the cached data instead of sending another request.
* Fixed an issue where the Current World button in the User Profile Modal could not be clicked when the world name contained an apostrophe.
* The **Live** tab in the Group Modal now correctly shows active instances for all users, including non-members.
* Before this fix, the tab could appear empty for non-members because VRChat blocked one of the instance requests until the user joined the group.
* VRCNext now uses a better request for this data, so non-members can see public group instances, while members can still see all available group instances.
