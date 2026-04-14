using Newtonsoft.Json.Linq;

namespace VRCNext;

// Owns all Space Flight (SteamVR playspace drag) state, logic, and message handling.
// SteamVRService runs in the shared VR subprocess — see VRSubprocessHost / VRSubprocess.

public class SpaceFlightController : IDisposable
{
    private readonly CoreLibrary _core;
    private readonly VROverlayController _vroCtrl;
    private bool _sfEventsWired;

    public bool IsConnected => _core.VrOverlay?.SfConnected ?? false;

    public SpaceFlightController(CoreLibrary core, VROverlayController vroCtrl)
    {
        _core    = core;
        _vroCtrl = vroCtrl;
    }

#if WINDOWS
    private VRSubprocessHost EnsureHost()
    {
        if (_core.VrOverlay == null)
        {
            _core.VrOverlay = new VRSubprocessHost(
                s => _core.SendToJS("log", new { msg = s, color = "sec" }));
        }

        if (!_sfEventsWired)
        {
            _sfEventsWired = true;
            var h = _core.VrOverlay;

            h.OnSfUpdate += d => _core.SendToJS("sfUpdate", d);

            h.OnSfQuit += () =>
            {
                _sfEventsWired = false;
                if (!h.VroConnected) _core.VrOverlay = null;
                _core.SendToJS("sfUpdate", new
                {
                    connected = false, dragging = false,
                    offsetX = 0, offsetY = 0, offsetZ = 0,
                    leftController = false, rightController = false, error = (string?)null
                });
                _vroCtrl.UpdateToolStates();
            };
        }

        return _core.VrOverlay;
    }
#endif

    public void HandleMessage(string action, JObject msg)
    {
        switch (action)
        {
#if WINDOWS
            case "sfConnect":
            {
                var host = EnsureHost();
                var (auth, tfa) = _core.VrcApi.GetCookies();
                host.EnsureRunning(_core.ImgCache?.CacheDir ?? "", _core.HttpPort, auth, tfa);
                host.SfConnect(
                    _core.Settings.SfMultiplier,
                    _core.Settings.SfLockX, _core.Settings.SfLockY, _core.Settings.SfLockZ,
                    _core.Settings.SfLeftHand, _core.Settings.SfRightHand, _core.Settings.SfUseGrip);
                _vroCtrl.UpdateToolStates();
                break;
            }

            case "sfDisconnect":
                if (_core.VrOverlay != null)
                {
                    _sfEventsWired = false;
                    _core.VrOverlay.SfDisconnect(); // kills subprocess if VRO also disconnected
                    if (!_core.VrOverlay.VroConnected) _core.VrOverlay = null;
                }
                _core.SendToJS("sfUpdate", new
                {
                    connected = false, dragging = false,
                    offsetX = 0, offsetY = 0, offsetZ = 0,
                    leftController = false, rightController = false, error = (string?)null
                });
                _vroCtrl.UpdateToolStates();
                break;

            case "sfReset":
                _core.VrOverlay?.SfReset();
                break;

            case "sfConfig":
            {
                var mult = msg["dragMultiplier"]?.Value<float>() ?? 1f;
                var lx   = msg["lockX"]?.Value<bool>() ?? false;
                var ly   = msg["lockY"]?.Value<bool>() ?? false;
                var lz   = msg["lockZ"]?.Value<bool>() ?? false;
                var lh   = msg["leftHand"]?.Value<bool>() ?? false;
                var rh   = msg["rightHand"]?.Value<bool>() ?? true;
                var grip = msg["useGrip"]?.Value<bool>() ?? true;
                _core.VrOverlay?.SfConfig(mult, lx, ly, lz, lh, rh, grip);
                break;
            }
#endif
        }
    }

    public void Toggle()
    {
#if WINDOWS
        if (_core.VrOverlay?.SfConnected == true)
        {
            _sfEventsWired = false;
            _core.VrOverlay.SfDisconnect();
            if (!_core.VrOverlay.VroConnected) _core.VrOverlay = null;
            _core.SendToJS("sfUpdate", new
            {
                connected = false, dragging = false,
                offsetX = 0, offsetY = 0, offsetZ = 0,
                leftController = false, rightController = false, error = (string?)null
            });
        }
        else
        {
            var host = EnsureHost();
            var (auth, tfa) = _core.VrcApi.GetCookies();
            host.EnsureRunning(_core.ImgCache?.CacheDir ?? "", _core.HttpPort, auth, tfa);
            host.SfConnect(
                _core.Settings.SfMultiplier,
                _core.Settings.SfLockX, _core.Settings.SfLockY, _core.Settings.SfLockZ,
                _core.Settings.SfLeftHand, _core.Settings.SfRightHand, _core.Settings.SfUseGrip);
        }
#endif
    }

    public void Dispose()
    {
        _sfEventsWired = false;
        // Subprocess disposal is owned by VROverlayController; we just untrack SF state.
    }
}
