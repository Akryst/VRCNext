**2026.25.7**

**VR Overlay Memory Leak**

* Fixed a memory leak in the VR Overlay where images and events were not properly disposed from memory.
* The VR Overlay now uses Gen 1 and Gen 2 GC cleanup as a backup in case something is not disposed correctly.

**GC Gen 1 and Gen 2 Cleanups**

* Gen 1 and Gen 2 GC cleanups now also run for the SteamVR Overlay subprocess of VRCNext.
* Using `/trim` or **Settings > Advanced > Force Memory Trim** now also applies to the subprocess.
* This means **Memory Trim** now covers subprocesses too, so keeping it enabled is recommended.
