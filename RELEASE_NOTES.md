**2026.25.7**

**Avatar Search Imrpvoements**
* Avtr.icu will now work properly instead of not showing any search result because of 429 (too many request issues) instead of loading 20 avatars at a time we pre load 300 of them.

**Avatar Lookup**
* Avatar Lookup finds now Avatars of an user even if the user has VRChat+ and a Custom profile image.
* This doesn't mean it will work in every single case! it uses the Represented Group response or Mutual response from VRChats API 
as these contain an Avatar Image URL.

**Improved Caching**
* Reduced API Calls to VRChats API Servers when using the breadcrumb navigation.
* It will use a 5 minute cooldown which just blocks API requests during this short session.

**Performance Settings**
* Animation Settings: Disables all animations and transitions in VRCNext. This can speed up opening dialogs and switching between them, and may also save a little bit of CPU costs.
* Blur Settings: Disables blur filters on modals and overlays. Instead of a blurred background, a dark overlay (75%) is shown. Especially useful when GPU acceleration is disabled, as blur effects are CPU-intensive. It is recommended to disable Blur Filters when using the app without GPU acceleration.
* Both are ON by default and can be turned off.

**VR Overlay Memory Leak**

* Fixed a memory leak in the VR Overlay where images and events were not properly disposed from memory.
* The VR Overlay now uses Gen 1 and Gen 2 GC cleanup as a backup in case something is not disposed correctly.

**GC Gen 1 and Gen 2 Cleanups**

* Gen 1 and Gen 2 GC cleanups now also run for the SteamVR Overlay subprocess of VRCNext.
* Using `/trim` or **Settings > Advanced > Force Memory Trim** now also applies to the subprocess.
* This means **Memory Trim** now covers subprocesses too, so keeping it enabled is recommended.

**Fixes**
* Fixed an race condition between mutuals and group members trying to re-download profile icons
* Fixed an issue that showed the "Backdrop" filter even when the modal was closed.