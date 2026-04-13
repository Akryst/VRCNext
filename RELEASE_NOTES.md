**2026.15.3**

**Instance Modal**
* Added Instance Server Location Badge

**User Profiles**
* Added more Instance infos such as the Instance ID and Server Location in "Current World" Section

**Media Library**
* Added a **Folder View** option to the **Media Library**.
  When using Folder View, the Media Library will show all subfolders inside the watch folders you added to VRCN. For example, if you added `VRChat`, it will show subfolders such as `2025-04`, `2025-05`, and so on. This can help some users find images faster.
* Added **Reveal in Explorer** button to the context menu.
  This opens the file location of the image or video and highlights it in File Explorer.
* Added a **Set as Desktop Background** button to the context menu. Clicking it will replace your current Windows desktop background with the selected image.
* Added *Resolution* Badges to Images that indicates if an image is: SD, HD, 2K, 4K or 8K.
* Removed the **Media Library** subtitle, as it is already included in the main title.

**Caching Update**
* Added **Blocked** cache with a TTL of 1 day
* Added **Muted** cache with a TTL of 1 day
* Added **Favorited Avatars** cache with a TTL of 1 day
* Added **Inventory** cache with a TTL of 12 hours
* Added **Groups** Cache to user profiles with a TLL of 1 Day
* Added **Content** Cache to user profiles with a TLL of 1 Day
* Added **Favs.** Cache to user profiles with a TLL of 3 Days

These caching updates will not affect your experience in any negative way. If something new appears in your inventory or anywhere else, you can simply press the **Refresh** button, which is available throughout the app. This change is mainly there to prevent VRCN from requesting the same data repeatedly during the day. Fewer API requests to VRChat also helps reduce unnecessary load.
