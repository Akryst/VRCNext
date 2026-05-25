using Newtonsoft.Json.Linq;

namespace VRCNext;

// Owns all FrameShot (in-VR photo) state, logic, and message handling.
// FrameShotService runs in the shared VR subprocess — see VRSubprocessHost / VRSubprocess.

public class FrameShotController : IDisposable
{
    private readonly CoreLibrary _core;
    private readonly VROverlayController _vroCtrl;
    private readonly PhotosController _photos;
    private bool _fsEventsWired;

    public bool IsConnected => _core.VrOverlay?.FsConnected ?? false;

    public FrameShotController(CoreLibrary core, VROverlayController vroCtrl, PhotosController photos)
    {
        _core    = core;
        _vroCtrl = vroCtrl;
        _photos  = photos;
    }

#if WINDOWS
    private VRSubprocessHost EnsureHost()
    {
        if (_core.VrOverlay == null)
        {
            _core.VrOverlay = new VRSubprocessHost(
                s => _core.SendToJS("log", new { msg = s, color = "sec" }));
        }

        if (!_fsEventsWired)
        {
            _fsEventsWired = true;
            var h = _core.VrOverlay;

            h.OnFsUpdate += d => _core.SendToJS("fsUpdate", d);

            h.OnFsDevices += devices => _core.SendToJS("fsDevices", new { devices });

            h.OnFsPhotoSaved += path =>
            {
                if (!string.IsNullOrEmpty(path)) _photos.HandleExternalSave(path);
            };

            h.OnFsQuit += () =>
            {
                _fsEventsWired = false;
                if (!h.VroConnected && !h.SfConnected) _core.VrOverlay = null;
                _core.SendToJS("fsUpdate", new
                {
                    connected = false, framing = false,
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
            case "fsConnect":
            {
                var host = EnsureHost();
                var (auth, tfa) = _core.VrcApi.GetCookies();
                host.EnsureRunning("", _core.HttpPort, auth, tfa);
                host.FsConnect(_core.Settings.FsLeftButton, _core.Settings.FsRightButton, _core.Settings.FsOutputDevice, _core.Settings.FsActivationRadius, _core.Settings.FsLeftRecordButton, _core.Settings.FsRightRecordButton);
                _vroCtrl.UpdateToolStates();
                break;
            }

            case "fsGetDevices":
                EnsureHost();
                var (auth2, tfa2) = _core.VrcApi.GetCookies();
                _core.VrOverlay?.EnsureRunning("", _core.HttpPort, auth2, tfa2);
                _core.VrOverlay?.FsGetDevices();
                break;

            case "fsSetOutput":
                var dev = msg["deviceName"]?.Value<string>() ?? "";
                _core.Settings.FsOutputDevice = dev;
                _core.Settings.Save();
                _core.VrOverlay?.FsSetOutput(dev);
                break;

            case "fsDisconnect":
                if (_core.VrOverlay != null)
                {
                    _fsEventsWired = false;
                    _core.VrOverlay.FsDisconnect();
                    if (!_core.VrOverlay.VroConnected && !_core.VrOverlay.SfConnected) _core.VrOverlay = null;
                }
                _core.SendToJS("fsUpdate", new
                {
                    connected = false, framing = false,
                    leftController = false, rightController = false, error = (string?)null
                });
                _vroCtrl.UpdateToolStates();
                break;

            case "fsConfig":
            {
                var lb  = (uint)(msg["leftButton"]?.Value<int>()        ?? 2);
                var rb  = (uint)(msg["rightButton"]?.Value<int>()       ?? 2);
                var ar  = msg["activationRadius"]?.Value<int>()         ?? 15;
                var lrb = (uint)(msg["leftRecordButton"]?.Value<int>()  ?? 0);
                var rrb = (uint)(msg["rightRecordButton"]?.Value<int>() ?? 0);
                _core.VrOverlay?.FsConfig(lb, rb, ar, lrb, rrb);
                break;
            }
#endif
        }
    }

    public void Toggle()
    {
#if WINDOWS
        if (_core.VrOverlay?.FsConnected == true)
        {
            _fsEventsWired = false;
            _core.VrOverlay.FsDisconnect();
            if (!_core.VrOverlay.VroConnected && !_core.VrOverlay.SfConnected) _core.VrOverlay = null;
            _core.SendToJS("fsUpdate", new
            {
                connected = false, framing = false,
                leftController = false, rightController = false, error = (string?)null
            });
        }
        else
        {
            var host = EnsureHost();
            var (auth, tfa) = _core.VrcApi.GetCookies();
            host.EnsureRunning("", _core.HttpPort, auth, tfa);
            host.FsConnect(_core.Settings.FsLeftButton, _core.Settings.FsRightButton, _core.Settings.FsOutputDevice, _core.Settings.FsActivationRadius, _core.Settings.FsLeftRecordButton, _core.Settings.FsRightRecordButton);
        }
        _vroCtrl.UpdateToolStates();
#endif
    }

    public void Dispose()
    {
        _fsEventsWired = false;
    }
}
