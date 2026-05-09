**2026.23.0**

## Community feature requests

* **Added “Start VRChat” to the System Tray right-click menu**
  You can now start VRChat directly from the tray icon without opening the main VRCNext window.
  Requested by @octomiku01

* **Added instance status icons and close-instance support**
  Instances now show clearer status icons, including Age Gated information across modals and lists. You can also close an instance directly from VRCNext if it is your own instance and you have permission to close it.
  Requested by @octomiku01

* **Added “Remember Window Size” setting**
  VRCNext can now remember your last window size and restore it the next time you open the app. This can be enabled in **Settings > Window Behavior**.
  Requested by @aghostofthepast

* **Added “Remember Monitor” setting**
  VRCNext can now remember which monitor it was last opened on and restore the window there on the next launch. This can be enabled in **Settings > Window Behavior**.
  Requested by @kivvio

* **Added VRChat Registry Backup**
  VRCNext can now create backups of the VRChat registry data through **Settings > Auto-Backups**. This helps preserve important VRChat-related settings before changes or issues happen.
  Requested by @octomiku01

### Performance
* Profiles are updated now live even if the modal ist open. Bios, Status, Status text, pronouns - everything is updated live without killing VRChats API.

### Context Menu
* Instead of showing "Invite" "Invite with Image" "Invite with text" we now just show "Invite" and it has an sub menu of all three options.
* Added "Request Invite" button to the Context Menu.
* Added user Moderation menu to the context menu. Block, Mute, Mute Chat, Hide Avatar, Interactions.

### Instance List
* Redesigned the instance list design to match the new V2 design.

### Media Library
* Sort for GIFs added to "All Media" Filter

### World Modal
* The Instances tab now refreshes in-place when pressing the Refresh button.
* Existing instance cards stay visible while the refresh runs in the background.
* New instances are added, removed instances are removed, and changed data is updated without clearing the list.
* Group names and short codes are now cached in the local database the first time a world with group instances is opened.
* On every subsequent open, group info loads instantly from the database with no API calls.
* Manually opening a group profile still updates its cached data as before.

### Profile Modal
* Redesigned the content cards to be small compact onse for the sake of UX!
* When clicking an avatar on a content item it will now open the modal instead of switching to that avatar.

### Instance Modal
* The Instance Modal now loads world information much faster by using locally cached data when available, including world name, author, description, and banner.
* Reopening previously visited worlds should no longer cause visible pop-in. If no cache exists yet, the API response automatically fills it for next time.
* The world description is now shown in the left panel.
* Removed the `X instances` and `X friends` stat lines from the left panel for a cleaner layout.
* Instance card header info now uses proper badge styling for region, PC percentage, Quest percentage, player count, and display name.
* The Instance ID copy badge has been moved to the far right of the header row.
* The old `Join World` button was replaced with a compact round icon button to match the Invite and Delete buttons.
* Internal cleanup: Instance Modal logic is now split into `setInstanceModal` for Dashboard, Groups, and Sidebar, and `setOwnInstanceModal` for My Instances.

### Image Cache
* The Instance Modal no longer loads images directly from the VRChat CDN and only displays locally cached images now.
* This helps reduce unnecessary load on VRChat servers.
* If an image is not cached yet, the banner stays hidden until it has been downloaded and will appear the next time the modal is opened.
* This now works for all cached image types: Worlds, Users, Groups, Avatars, Badges, and Events.

### Notification Center
* Added **Current / All / Hidden** tabs to the notification panel.
  * **Current** shows only active, non-hidden notifications (previous behavior).
  * **Hidden** shows ignored friend requests
* Tab switching uses an animated sliding pill selector.

### Activity Log
* CDN image downloads are now tracked in the Activity Log, including request type, URL, and status codes like `CDN 200`, `CDN 404`, and `CDN 429`.
* CDN status entries now use matching colors to make successful, failed, and rate-limited requests easier to identify.
* Added new Activity Log badges for total CDN downloads, average VRChat API GET requests per hour, and average CDN downloads per hour.
* Pressing `Clear` now only clears the visible log text. Counter badges such as `200`, `429`, `404`, `403`, `400`, `CDN`, `AGET/H`, and `ACDN/H` are no longer reset.
