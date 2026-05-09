**2026.23.0**

## Community feature requests
* "Add Start VRChat button to right click context menu in System Tray"
Requested by @octomiku01
* "Add status icons to instances + ability to close instances if permitted"
- Closing Instance works if it is your own instance
- Shows Age Gated instances across all modals and lists
Requested by @octomiku01
* "Remember Window Size" - in Settings > Window Behavior
Requested by @aghostofthepast
* "Remember Monitor" - in Settings > Window Behavior
Requested by @kivvio

## Instance List
* Redesigned the instance list design to match the new V2 design.

### World Modal

* The Instances tab now refreshes in-place when pressing the Refresh button.
* Existing instance cards stay visible while the refresh runs in the background.
* New instances are added, removed instances are removed, and changed data is updated without clearing the list.
* Group names and short codes are now cached in the local database the first time a world with group instances is opened.
* On every subsequent open, group info loads instantly from the database with no API calls.
* Manually opening a group profile still updates its cached data as before.

### Instance Modal

* The Instance Modal now loads world information much faster.
* World name, author, description, and banner are loaded from the local cache when available.
* This removes the pop-in effect when reopening a world you have visited before.
* If no cache exists yet, the API response will automatically fill it for the next time.
* The world description is now shown in the left panel.
* Removed the `X instances` and `X friends` stat lines from the left panel for a cleaner layout.
* Info chips in the instance card header now use proper badge styling.
* Region, PC percentage, Quest percentage, player count, and display name now better match the app theme.
* The Instance ID copy badge has been moved to the far right of the header row.
* The old `Join World` button was replaced with a compact round icon button.
* This now matches the style of the Invite and Delete buttons.
* Internal cleanup: Instance Modal logic is now split into two clean functions:
* `setInstanceModal` for Dashboard, Groups, and Sidebar.
* `setOwnInstanceModal` for My Instances.

### Image Cache

* The Instance Modal no longer loads images directly from the VRChat CDN.
* It only displays locally cached images now.
* This helps reduce unnecessary load on VRChat servers.
* If an image is not cached yet, the banner stays hidden.
* Once the image has been downloaded, it will appear the next time the modal is opened.
* This now works for all image types:
* Worlds, Users, Groups, Avatars, Badges, and Events.

### Activity Log

* CDN image downloads are now shown in the Activity Log.
* Example: `CDN - Worlds - <url>`
* CDN status codes are also shown, such as `CDN 200`, `CDN 404`, and `CDN 429`.
* Status codes now use matching colors, for example green, red, or yellow.
* Added a new `CDN` counter badge.
* This shows the total amount of image downloads since the app was started.
* Added a new `AGET/H` badge.
* This shows the average VRChat API GET requests per hour.
* Added a new `ACDN/H` badge.
* This shows the average CDN image downloads per hour.
* Counter badges are no longer reset when pressing `Clear`.
* This includes `200`, `429`, `404`, `403`, `400`, `CDN`, `AGET/H`, and `ACDN/H`.
* Pressing `Clear` now only clears the visible log text.
