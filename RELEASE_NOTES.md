**2026.22.5**

### New

* **Database Optimization added:** A new "Database Optimization" card is available at the bottom of the Settings tab. Run Analysis first to see exactly how many rows will be affected, then run the optimization to free up space. A "Create Backup" button is also available to save a clean copy of your database before making any changes.

  > ⚠️ **Warning:** This operation permanently deletes data from your database and cannot be undone. It removes cached data for non-friended users, friend online/offline/status events, notifications, video URL events, and instance player lists. It is strongly recommended to create a backup before running the optimization.

* **Avatar Modal redesigned:** The Avatar Modal now uses the same cleaner card layout as the Profile, Group, and World modals.
* **Avatar information improved:** Avatar details are now easier to read and better separated into sections.
* **Own Profile redesigned:** Your own profile now matches the normal user profile layout.
* **Own Profile card layout added:** Your own profile now uses cards, edit buttons, and the same info sections as other profiles.
* **Represented group added to Own Profile:** Your represented group is now shown below your status on its own line.

### Changes

* **Modal headers improved:** Header banners in Group, Profile, World, and Avatar modals are now taller and darker for better readability.
* **Profile top row adjusted:** Current World and Instance Owner rows in user profiles are now more compact.
* **Profile and Group row heights aligned:** Current World and Instance Owner now better match the height of Groups and Mutual Friends items.
* **Round buttons adjusted:** Round buttons are now slightly less round to better fit the updated card design.
* **Avatar edit button moved:** The edit pencil is now placed directly next to the avatar name.
* **Avatar author cleanup:** The `Author` entry was removed from the info card because it is already shown in the header.
* **Own Profile info updated:** Your own profile can now show Joined, Last Login, Platform, Age Verified, Avatar Cloning, and Booping.
* **User Profile info updated:** Other user profiles can now show Age Verified and Avatar Cloning.

* **Group posts can now be edited:** An edit button now appears next to the delete button on each post. Clicking it opens the post modal pre-filled with the existing title, content, visibility, and image so you can make changes and save.
* **Group post design updated:** Posts now show the image on the right side of the card, filling the full card height, with title and text content on the left — similar to the layout on VRChat.com.
* **Group Info tab: preview cards added:** The Info tab now shows a Last Post and Last Event card in the left column (between Description and Rules), and an Instances card at the top of the right column. Clicking any card navigates directly to the corresponding tab.
* **Group Info tab: Group Info card added:** A new card in the right column shows Joined Group, Created, Representing, Members, and Verified for the current group.
* **Group data cached:** Group creation date, verification status, join date, representing status, last post, and last event are now stored in the local SQLite cache so the Info tab loads instantly on repeat opens.

### Fixes

* **Own Profile represented group fixed:** Your represented group now loads correctly again after restarting VRCNext.
* **Own Profile status row fixed:** The status row hover effect has been restored.
* **Profile data fixed:** Some profile details were already available but were not shown in the app.
* **Profile UI data fixed:** These details are now passed correctly to the profile UI.
