**2026.33.2** BETA

**This is a stable BETA version for the Timeline. there might be some bugs in new categories.**

**Timeline**

* Updated the Instance Modal in **Timeline > Personal > Instances**.
* Added a **Search players...** bar to help you find players faster.
* Added a filter dropdown with options for **Visits**, **Overall Time**, **Visits and Time**, and **Friends**.
* Added a new **Moderation** category to **Timeline > Personal**, logging blocks, mutes, chat mutes, avatar hide/show, drone hide/show, and interaction changes. Actions performed through VRCN and directly in-game are both captured (in-game via the VRChat log), with de-duplication so nothing shows up twice.
* Added a new **Profile** category to **Timeline > Personal** showing your own activity in one place: status changes (Active, Join Me, etc.), status text, bio changes, and when you started and closed VRChat. Updates arrive live over the websocket, just like the friend timeline.
* Increased the gap between "Profile" and "User" in the list view.
* The category filter bars now slide left/right (drag with the mouse or scroll) instead of stacking onto multiple rows when the window is narrow.

**Fixes**

* Fixed the **User** column showing "N/A" for avatar switches in **Timeline > Personal > Avatars** it now shows your own name.
* Fixed **Switch Account** sometimes showing the "VRCNext is already open, close the running instance" dialog the relaunch now waits for the previous instance to fully close.