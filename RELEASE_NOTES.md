**2026.26.0**

**Answer Invite Requests and Invites**
* You can now answer invites and invite requests with a message, or with an image and a message.
* When you open the Notification Center, you will now see **Accept**, **Answer**, and **X**.

**VRChat Configs**
In **Taskbar > Tools > VRChat > VRChat Config**:
* View the cache size in GB.
* Refresh the cache.
* Delete the cache.
* Set the max cache size.
* Set the cache expiry in days.
* Set the First Person Steadycam FOV.

**VRChat Launch Arguments**
In **Taskbar > Tools > VRChat > VRChat Launch Options**:
* Added support for running launch arguments when starting VRChat through VRCNext.

**Activity Log**
* Added new /msg request and /msg invite command that shows the Invite and Requested Invite Response messages.

**Action Flow**
* Added **Action Flow** to **Tools**.
* Action Flow is an automation system inspired by **Google Blockly**, similar to Scratch.
* It lets you build custom automation flows with visual blocks such as **IF**, **IF-DO**, **IF-ELSE**, conditions, time checks, event checks, and action blocks.
* You can automate VRChat account actions such as changing your online status, bio, status text, avatar, or sending invites based on time, events, and custom conditions.
* Action Flow includes more than **40 different action blocks**, making it a powerful tool for advanced users who want to create fully automated workflows.
* Added triggers such as **Every 30 Seconds**, **Every X Minutes**, **At XX:XX**, **When Switching World**, **When Someone Joins**, **When Someone Leaves**, **When Someone Joins or Leaves**, **When My Status Changes**, **On Any WebSocket Event**, **On Specific WebSocket Event**, **When Someone Invites Me**, **When Someone Requests an Invite**, and **Manual Only**.
* Added logic blocks such as **IF-DO**, **IF-DO-ELSE**, **Equals**, **Bigger Than**, **Smaller Than**, **AND**, **OR**, and **TRUE/FALSE**.
* Added condition blocks for custom conditions that can default to **TRUE** or **FALSE** and can be checked or changed inside a flow.
* Added time blocks such as **Is Date**, **Is Time**, and **Is Between XX:XX and XX:XX**.
* Added friend and user blocks such as **Friend Object**, **User Object**, **Self Object**, **Is Friend**, **Invite From X**, and **Invite Request From X**.
* Added status and bio blocks such as **Has Status X**, **Own Status X**, **Has Status Text X**, **Own Status Text X**, **Has Bio Text X**, and **Own Bio Text X**.
* Added world blocks such as **World Object**, **Current World Of**, and **Is In Same Instance As Me**.
* Added action blocks such as **Set Status**, **Set Bio**, **Switch Avatar**, **Switch Favorite Avatar**, **Invite X to My Instance**, **Request Invite From X**, **Answer Invite**, **Answer Invite Request**, and **Send Notification**.
* Added custom **TRUE/FALSE** conditions.
* Added **Is Game Running** check blocks.

**Image Preview**
* Added **Image Preview** to the Media Library.
* Clicking an image now opens the new Image Preview.
* The preview shows the image on the left and all metadata directly on the right.
* Metadata includes date, time, file size, resolution, world, image name, and all players who were present in the instance when the photo was taken.
* This replaces the old behavior where metadata was hidden behind the user icons.

**Image Navigation**
* Added an Image Navigation Bar to the Media Library and Image Preview.
* Added buttons for **Copy to Clipboard**, **Zoom In**, **Zoom Out**, **Rotate Left**, **Rotate Right**, and **Reset**.
* Images can now be moved by dragging with the mouse and zoomed with the mouse wheel.

**Fixes**
* Added a Timeline hotfix to prevent time-spent values from being overwritten after restarts.
* Fixed an issue where extra hours or minutes could be added to a Timeline event when a player rejoined your instance.
* Fixed an edge case where time spent did not update after VRCNext was restarted while the instance event was still active.
* Fixed the right-click context menu not working in the instance player list.
* Fixed Z-ordering issues with the right-click context menu.
* Fixed an issue where Media Relay did not send images if their resolution was bigger than 2000px, even when the file size was still below the Discord webhook limit.
* Fixed several issues caused by the Invite API in VRCN.
* Fixed an issue where invite requests were not reused, wasting request slots.
* Fixed an issue where the mutual network refreshed every time a friend was removed.
* Fixed missing i18n translation keys for several features, tabs, and settings.
* Fixed an issue where the VR Overlay always re-downloaded user profile images.
* Fixed a crucial caching issue in the ImageCache handler for the SteamVR overlay.
* Fixed small issues with Timeline tracking data in **Personal > Instances**.
* Fixed a race condition between VRC logging and Timeline elements.
* Fixed a race condition that added extra time spent to the own user object inside Timeline.
* Fixed a race condition caused by VRChat being closed while VRCN was running, which created multiple timestamps inside the Timeline controller.
* Fixed spelling issues in the German translation.
* Fixed Upload Image Modal Z Layer Index preventing it from being rendered behind Invite/Request modals
* Fixed "Hover" Inbformation Z Layer preventing it from rendering behind any modal or any layer.
