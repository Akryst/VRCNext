#if WINDOWS
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;
using Valve.VR;
using Vortice.Direct3D;
using Vortice.Direct3D11;
using Vortice.DXGI;

namespace VRCNext.Services
{
    public class FrameShotService : IDisposable
    {
        // Config
        public uint LeftButtonId  { get; private set; } = (uint)EVRButtonId.k_EButton_Grip;
        public uint RightButtonId { get; private set; } = (uint)EVRButtonId.k_EButton_Grip;
        // Activation radius in metres: framing only starts while hands are within
        // this distance of each other. Once framing has started, the user can
        // pull hands apart freely without losing the frame.
        public float ActivationRadius { get; private set; } = 0.15f;

        // State
        public bool IsConnected { get; private set; }
        public bool IsFraming   { get; private set; }
        public string? LastError { get; private set; }

        // Events
        public event Action<object>? OnStateUpdate;
        public event Action? OnVRQuit;

        // OpenVR
        private CVRSystem? _vrSystem;
        private bool _ownedInit;
        private ulong _overlayHandle;
        private CancellationTokenSource? _cts;
        private Task? _pollTask;
        private bool _running;
        private bool _disposed;
        private readonly Action<string> _log;

        // Controller tracking
        private uint _leftIdx  = OpenVR.k_unTrackedDeviceIndexInvalid;
        private uint _rightIdx = OpenVR.k_unTrackedDeviceIndexInvalid;
        private readonly TrackedDevicePose_t[] _poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];

        // Button state
        private bool _leftHeld;
        private bool _rightHeld;
        private bool _leftHeldPrev;
        private bool _rightHeldPrev;

        // Frame geometry (cached for capture after release)
        private Vector3 _lastLeftPos;
        private Vector3 _lastRightPos;
        private float _lastFrameWidth;
        private float _lastFrameHeight;

        // Locked frame-plane basis — captured at the moment framing starts.
        // Used ONLY for projecting hand distance onto stable axes so that head
        // rotation doesn't change the frame's size. Orientation/position of the
        // visible overlay use the CURRENT HMD pose (head-locked frame).
        private Vector3 _framingRight;
        private Vector3 _framingUp;
        private bool    _framingBasisLocked;

        // D3D11 — overlay frame texture (light blue border)
        private ID3D11Device?        _d3dDevice;
        private ID3D11DeviceContext? _d3dContext;
        private ID3D11Texture2D?     _overlayTex;
        private ID3D11Texture2D?     _stagingTex;
        private const int FRAME_TEX_W = 1024;
        private const int FRAME_TEX_H = 1024;
        private readonly byte[] _frameUploadBuf = new byte[FRAME_TEX_W * FRAME_TEX_H * 4];
        private Bitmap? _frameBitmap;
        private int _lastDrawnW = -1;
        private int _lastDrawnH = -1;

        // Mirror texture for capture — acquired ONCE per session and reused across captures.
        // Per OpenVR docs the compositor continuously updates the texture content, so the
        // same SRV reflects the current frame on every CopyResource.
        private IntPtr                   _mirrorSrv     = IntPtr.Zero;
        private ID3D11ShaderResourceView? _mirrorSrvObj;
        private ID3D11Texture2D?         _mirrorTexCached;
        private ID3D11Texture2D?         _mirrorStaging;
        private int     _mirrorW;
        private int     _mirrorH;
        private Format  _mirrorTexFormat;
        private Format  _mirrorSrvFormat;

        // Output directory
        private static readonly string OutputDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyPictures),
            "VRCN", "FrameShots");

        // Sound assets — copied to <out>/frameshot/*.wav by VRCNext.csproj
        private static readonly string SoundDir = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "frameshot");

        // Output device — -1 means "system default". Each Play() creates a NEW
        // WaveOutEvent so a device change applies immediately without restart.
        private int _outputDeviceIndex = -1;

        public void SetOutputDevice(int idx) => _outputDeviceIndex = idx;

        [DllImport("winmm.dll")] private static extern int waveOutGetNumDevs();
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        private struct WAVEOUTCAPS
        {
            public ushort wMid, wPid;
            public uint vDriverVersion;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szPname;
            public uint dwFormats;
            public ushort wChannels, wReserved1;
            public uint dwSupport;
        }
        [DllImport("winmm.dll", CharSet = CharSet.Ansi)]
        private static extern int waveOutGetDevCaps(IntPtr deviceID, out WAVEOUTCAPS caps, int size);

        public static string[] GetOutputDevices()
        {
            int count = waveOutGetNumDevs();
            var names = new string[count];
            for (int i = 0; i < count; i++)
            {
                waveOutGetDevCaps(new IntPtr(i), out var caps, Marshal.SizeOf<WAVEOUTCAPS>());
                names[i] = caps.szPname ?? "";
            }
            return names;
        }

        private void PlaySoundAsync(string fileName)
        {
            var path = Path.Combine(SoundDir, fileName);
            if (!File.Exists(path)) return;
            int devIdx = _outputDeviceIndex; // snapshot at trigger time
            _ = Task.Run(() =>
            {
                try
                {
                    var reader  = new WaveFileReader(path);
                    // Fresh WaveOutEvent per play, so the device chosen NOW takes effect
                    // immediately — no app restart needed when the user switches output.
                    var waveOut = new WaveOutEvent { DeviceNumber = devIdx };
                    waveOut.PlaybackStopped += (_, __) =>
                    {
                        try { waveOut.Dispose(); } catch { }
                        try { reader.Dispose();  } catch { }
                    };
                    waveOut.Init(reader);
                    waveOut.Play();
                }
                catch (Exception ex) { _log($"[FrameShot] Sound '{fileName}': {ex.Message}"); }
            });
        }

        public FrameShotService(Action<string> log) => _log = log;

        public bool Connect()
        {
            if (IsConnected) return true;
            LastError = null;

            try
            {
                if (OpenVR.System != null)
                {
                    _vrSystem  = OpenVR.System;
                    _ownedInit = false;
                    _log("[FrameShot] Reusing existing OpenVR session");
                }
                else
                {
                    var err = EVRInitError.None;
                    _vrSystem = OpenVR.Init(ref err, EVRApplicationType.VRApplication_Overlay);
                    if (err != EVRInitError.None)
                    {
                        try { OpenVR.Shutdown(); } catch { }
                        err = EVRInitError.None;
                        _vrSystem = OpenVR.Init(ref err, EVRApplicationType.VRApplication_Background);
                        if (err != EVRInitError.None)
                        {
                            LastError = $"OpenVR init failed: {err}";
                            _log($"[FrameShot] {LastError}");
                            return false;
                        }
                    }
                    _ownedInit = true;
                    _log("[FrameShot] OpenVR initialized");
                }

                if (OpenVR.Overlay == null)
                {
                    LastError = "IVROverlay not available";
                    return false;
                }

                var oErr = OpenVR.Overlay.CreateOverlay("vrcnext.frameshot", "VRCNext FrameShot", ref _overlayHandle);
                if (oErr == EVROverlayError.KeyInUse)
                    OpenVR.Overlay.FindOverlay("vrcnext.frameshot", ref _overlayHandle);
                else if (oErr != EVROverlayError.None)
                {
                    LastError = $"CreateOverlay: {oErr}";
                    return false;
                }

                OpenVR.Overlay.SetOverlayAlpha(_overlayHandle, 1.0f);
                OpenVR.Overlay.SetOverlayInputMethod(_overlayHandle, VROverlayInputMethod.None);
                OpenVR.Overlay.SetOverlayFlag(_overlayHandle, VROverlayFlags.SortWithNonSceneOverlays, true);

                try
                {
                    D3D11.D3D11CreateDevice(null, DriverType.Hardware, DeviceCreationFlags.None,
                        [FeatureLevel.Level_11_0, FeatureLevel.Level_10_1],
                        out _d3dDevice, out _d3dContext);

                    _overlayTex = _d3dDevice!.CreateTexture2D(new Texture2DDescription
                    {
                        Width = FRAME_TEX_W, Height = FRAME_TEX_H, MipLevels = 1, ArraySize = 1,
                        Format = Format.R8G8B8A8_UNorm,
                        SampleDescription = new SampleDescription(1, 0),
                        Usage = ResourceUsage.Default,
                        BindFlags = BindFlags.ShaderResource,
                    });
                    _stagingTex = _d3dDevice.CreateTexture2D(new Texture2DDescription
                    {
                        Width = FRAME_TEX_W, Height = FRAME_TEX_H, MipLevels = 1, ArraySize = 1,
                        Format = Format.R8G8B8A8_UNorm,
                        SampleDescription = new SampleDescription(1, 0),
                        Usage = ResourceUsage.Staging,
                        CPUAccessFlags = CpuAccessFlags.Write,
                    });
                    _frameBitmap = new Bitmap(FRAME_TEX_W, FRAME_TEX_H, PixelFormat.Format32bppArgb);
                    _log("[FrameShot] D3D11 device + textures ready");
                }
                catch (Exception ex)
                {
                    LastError = $"D3D11 init failed: {ex.Message}";
                    _log($"[FrameShot] {LastError}");
                    return false;
                }

                UpdateControllerIndices();

                try { Directory.CreateDirectory(OutputDir); } catch { }

                IsConnected = true;
                _log("[FrameShot] Connected");
                EmitState();
                return true;
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                _log($"[FrameShot] Connect error: {ex.Message}");
                return false;
            }
        }

        public void Disconnect()
        {
            StopPolling();
            if (!IsConnected) return;

            if (_overlayHandle != 0 && OpenVR.Overlay != null)
            {
                try { OpenVR.Overlay.HideOverlay(_overlayHandle); } catch { }
                try { OpenVR.Overlay.DestroyOverlay(_overlayHandle); } catch { }
                _overlayHandle = 0;
            }

            // Tear down mirror pipeline in reverse order
            try { _mirrorStaging?.Dispose();   } catch { } _mirrorStaging   = null;
            try { _mirrorTexCached?.Dispose(); } catch { } _mirrorTexCached = null;
            try { _mirrorSrvObj?.Dispose();    } catch { } _mirrorSrvObj    = null;
            if (_mirrorSrv != IntPtr.Zero && OpenVR.Compositor != null)
            {
                try { OpenVR.Compositor.ReleaseMirrorTextureD3D11(_mirrorSrv); } catch { }
            }
            _mirrorSrv = IntPtr.Zero;

            if (_ownedInit)
            {
                try { OpenVR.Shutdown(); } catch { }
                _ownedInit = false;
            }

            _stagingTex?.Dispose(); _stagingTex = null;
            _overlayTex?.Dispose(); _overlayTex = null;
            _d3dContext?.Dispose(); _d3dContext = null;
            _d3dDevice?.Dispose();  _d3dDevice  = null;
            _frameBitmap?.Dispose(); _frameBitmap = null;

            IsConnected = false;
            IsFraming   = false;
            _vrSystem   = null;
            _log("[FrameShot] Disconnected");
            EmitState();
        }

        public void StartPolling()
        {
            if (_running) return;
            _cts     = new CancellationTokenSource();
            _running = true;
            _pollTask = PollLoopAsync(_cts.Token);
            StartVrserverMonitor(_cts.Token);
        }

        public void StopPolling()
        {
            _running = false;
            _cts?.Cancel();
            try { _pollTask?.Wait(2000); } catch { }
            _pollTask = null;
        }

        public void ApplyConfig(uint leftButton, uint rightButton, float activationRadius)
        {
            LeftButtonId     = leftButton;
            RightButtonId    = rightButton;
            ActivationRadius = Math.Clamp(activationRadius, 0.05f, 0.30f);
        }

        private async Task PollLoopAsync(CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    try
                    {
                        ProcessFrame();
                        EmitState();
                        await Task.Delay(11, ct);
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex)
                    {
                        _log($"[FrameShot] {ex.Message}");
                        try { await Task.Delay(500, ct); }
                        catch (OperationCanceledException) { break; }
                    }
                }
            }
            catch { }
            _running = false;
        }

        private void ProcessFrame()
        {
            if (_vrSystem == null) return;

            var evt = new VREvent_t();
            while (_vrSystem.PollNextEvent(ref evt, (uint)Marshal.SizeOf<VREvent_t>()))
            {
                if ((EVREventType)evt.eventType == EVREventType.VREvent_Quit)
                {
                    _vrSystem = null;
                    try { OpenVR.System?.AcknowledgeQuit_Exiting(); } catch { }
                    _cts?.Cancel();
                    _ = Task.Run(() => OnVRQuit?.Invoke());
                    return;
                }
            }

            _vrSystem.GetDeviceToAbsoluteTrackingPose(
                ETrackingUniverseOrigin.TrackingUniverseStanding, 0, _poses);
            UpdateControllerIndices();

            _leftHeldPrev  = _leftHeld;
            _rightHeldPrev = _rightHeld;
            _leftHeld  = IsButtonHeld(_leftIdx,  LeftButtonId);
            _rightHeld = IsButtonHeld(_rightIdx, RightButtonId);

            bool wasFraming = IsFraming;
            bool keysHeld   = _leftHeld && _rightHeld;

            // Activation: only START framing when hands are within ActivationRadius.
            // Once framing has begun, the user is free to pull hands apart — the
            // gesture continues as long as both keys stay held.
            if (!keysHeld)
            {
                IsFraming = false;
            }
            else if (wasFraming)
            {
                IsFraming = true; // continue, no distance check
            }
            else
            {
                IsFraming = AreHandsWithinActivationRadius();
            }

            if (IsFraming && !wasFraming)
            {
                // Lock SIZE basis (head rotation must not affect frame size) and
                // snapshot the average hand→HMD distance (locks how far in front
                // of the user the head-locked frame floats).
                uint hmdIdx = (uint)OpenVR.k_unTrackedDeviceIndex_Hmd;
                if (_poses[hmdIdx].bPoseIsValid)
                {
                    var hmdRot = RotFromMatrix(_poses[hmdIdx].mDeviceToAbsoluteTracking);
                    _framingRight = Vector3.Transform(Vector3.UnitX, hmdRot);
                    _framingUp    = Vector3.Transform(Vector3.UnitY, hmdRot);
                    _framingBasisLocked = true;
                }
                PlaySoundAsync("Start.wav");
            }
            if (!IsFraming) _framingBasisLocked = false;

            if (IsFraming)
            {
                UpdateFrameAndRender();
            }
            else if (wasFraming)
            {
                // Released — distinguish photo vs cancel
                bool rightReleased = _rightHeldPrev && !_rightHeld;
                bool leftReleased  = _leftHeldPrev  && !_leftHeld;

                if (OpenVR.Overlay != null && _overlayHandle != 0)
                {
                    try { OpenVR.Overlay.HideOverlay(_overlayHandle); } catch { }
                }

                if (rightReleased && !leftReleased)
                {
                    // Right released first — take the shot
                    PlaySoundAsync("Shot.wav");
                    _ = Task.Run(CaptureAndSave);
                }
                else if (leftReleased)
                {
                    PlaySoundAsync("Stop.wav");
                    _log("[FrameShot] Cancelled");
                }
            }
        }

        private bool AreHandsWithinActivationRadius()
        {
            if (_leftIdx == OpenVR.k_unTrackedDeviceIndexInvalid ||
                _rightIdx == OpenVR.k_unTrackedDeviceIndexInvalid ||
                !_poses[_leftIdx].bPoseIsValid || !_poses[_rightIdx].bPoseIsValid)
                return false;
            var L = PosFromMatrix(_poses[_leftIdx].mDeviceToAbsoluteTracking);
            var R = PosFromMatrix(_poses[_rightIdx].mDeviceToAbsoluteTracking);
            return (R - L).Length() <= ActivationRadius;
        }

        private bool IsButtonHeld(uint deviceIdx, uint buttonId)
        {
            if (_vrSystem == null || deviceIdx == OpenVR.k_unTrackedDeviceIndexInvalid) return false;
            var s = new VRControllerState_t();
            if (!_vrSystem.GetControllerState(deviceIdx, ref s, (uint)Marshal.SizeOf<VRControllerState_t>()))
                return false;
            return (s.ulButtonPressed & (1UL << (int)buttonId)) != 0;
        }

        private void UpdateControllerIndices()
        {
            if (_vrSystem == null) return;
            _leftIdx  = _vrSystem.GetTrackedDeviceIndexForControllerRole(ETrackedControllerRole.LeftHand);
            _rightIdx = _vrSystem.GetTrackedDeviceIndexForControllerRole(ETrackedControllerRole.RightHand);
        }

        private static Vector3 PosFromMatrix(in HmdMatrix34_t m) => new(m.m3, m.m7, m.m11);

        private static Quaternion RotFromMatrix(in HmdMatrix34_t m)
        {
            float tr = m.m0 + m.m5 + m.m10;
            Quaternion q;
            if (tr > 0f)
            {
                float s = MathF.Sqrt(tr + 1f) * 2f;
                q = new Quaternion((m.m9 - m.m6) / s, (m.m2 - m.m8) / s, (m.m4 - m.m1) / s, 0.25f * s);
            }
            else if (m.m0 > m.m5 && m.m0 > m.m10)
            {
                float s = MathF.Sqrt(1f + m.m0 - m.m5 - m.m10) * 2f;
                q = new Quaternion(0.25f * s, (m.m1 + m.m4) / s, (m.m2 + m.m8) / s, (m.m9 - m.m6) / s);
            }
            else if (m.m5 > m.m10)
            {
                float s = MathF.Sqrt(1f + m.m5 - m.m0 - m.m10) * 2f;
                q = new Quaternion((m.m1 + m.m4) / s, 0.25f * s, (m.m6 + m.m9) / s, (m.m2 - m.m8) / s);
            }
            else
            {
                float s = MathF.Sqrt(1f + m.m10 - m.m0 - m.m5) * 2f;
                q = new Quaternion((m.m2 + m.m8) / s, (m.m6 + m.m9) / s, 0.25f * s, (m.m4 - m.m1) / s);
            }
            return Quaternion.Normalize(q);
        }

        private void UpdateFrameAndRender()
        {
            if (_leftIdx == OpenVR.k_unTrackedDeviceIndexInvalid ||
                _rightIdx == OpenVR.k_unTrackedDeviceIndexInvalid ||
                OpenVR.Overlay == null || _overlayHandle == 0 ||
                !_framingBasisLocked) return;

            uint hmdIdx = (uint)OpenVR.k_unTrackedDeviceIndex_Hmd;
            if (!_poses[_leftIdx].bPoseIsValid || !_poses[_rightIdx].bPoseIsValid || !_poses[hmdIdx].bPoseIsValid)
                return;

            var L = PosFromMatrix(_poses[_leftIdx].mDeviceToAbsoluteTracking);
            var R = PosFromMatrix(_poses[_rightIdx].mDeviceToAbsoluteTracking);
            var hmdRot = RotFromMatrix(_poses[hmdIdx].mDeviceToAbsoluteTracking);

            // SIZE: hand-to-hand vector projected onto the LOCKED basis so head
            // rotation cannot stretch/shrink the frame. Hand movement still does.
            Vector3 diff   = R - L;
            float widthM   = MathF.Max(0.02f, MathF.Abs(Vector3.Dot(diff, _framingRight)));
            float heightM  = MathF.Max(0.02f, MathF.Abs(Vector3.Dot(diff, _framingUp)));

            // ORIENTATION: current HMD basis — frame always faces the user.
            Vector3 hmdRight = Vector3.Transform(Vector3.UnitX,  hmdRot);
            Vector3 hmdUp    = Vector3.Transform(Vector3.UnitY,  hmdRot);
            Vector3 hmdFwd   = Vector3.Transform(-Vector3.UnitZ, hmdRot);

            // POSITION: live hand midpoint in WORLD space. The frame stays glued
            // to the hands — head rotation does not pull it around. (Trade-off:
            // if the user turns far enough that the hands leave their FOV, the
            // frame also leaves the view — expected.)
            Vector3 center = (L + R) * 0.5f;

            _lastLeftPos     = L;
            _lastRightPos    = R;
            _lastFrameWidth  = widthM;
            _lastFrameHeight = heightM;

            // Compute drawn pixel rect once, here — used for both texture redraw
            // AND for SetOverlayTextureBounds. Tracking the integer pixel dims (not
            // the float aspect) avoids flicker: any sub-pixel hand movement would
            // shift the bounds but not the cached texture, leaving stale border
            // pixels outside the new bounds → edges flickering on/off.
            float aspect = heightM / widthM;
            int drawW = FRAME_TEX_W;
            int drawH = (int)MathF.Round(FRAME_TEX_W * aspect);
            if (drawH > FRAME_TEX_H) { drawH = FRAME_TEX_H; drawW = (int)MathF.Round(FRAME_TEX_H / aspect); }

            if (drawW != _lastDrawnW || drawH != _lastDrawnH)
            {
                DrawFrameTexture(drawW, drawH);
                _lastDrawnW = drawW;
                _lastDrawnH = drawH;
            }

            // Overlay width in meters
            OpenVR.Overlay.SetOverlayWidthInMeters(_overlayHandle, widthM);

            // Build world transform: orient with HMD basis, position at center
            var transform = new HmdMatrix34_t
            {
                m0 = hmdRight.X, m1 = hmdUp.X, m2 = -hmdFwd.X, m3 = center.X,
                m4 = hmdRight.Y, m5 = hmdUp.Y, m6 = -hmdFwd.Y, m7 = center.Y,
                m8 = hmdRight.Z, m9 = hmdUp.Z, m10 = -hmdFwd.Z, m11 = center.Z,
            };
            OpenVR.Overlay.SetOverlayTransformAbsolute(_overlayHandle,
                ETrackingUniverseOrigin.TrackingUniverseStanding, ref transform);

            OpenVR.Overlay.ShowOverlay(_overlayHandle);
        }

        private void DrawFrameTexture(int drawW, int drawH)
        {
            if (_frameBitmap == null || _d3dContext == null || _stagingTex == null || _overlayTex == null) return;

            using (var g = Graphics.FromImage(_frameBitmap))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                // Light-blue border
                using var pen = new Pen(Color.FromArgb(255, 130, 210, 255), 8f);
                int inset = 4;
                g.DrawRectangle(pen, inset, inset, drawW - inset * 2 - 1, drawH - inset * 2 - 1);

                // Subtle inner shadow line for definition
                using var pen2 = new Pen(Color.FromArgb(120, 255, 255, 255), 1.5f);
                g.DrawRectangle(pen2, inset + 6, inset + 6, drawW - inset * 2 - 13, drawH - inset * 2 - 13);
            }

            // Copy bitmap → staging
            var rect = new Rectangle(0, 0, FRAME_TEX_W, FRAME_TEX_H);
            var bData = _frameBitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            try
            {
                int srcStride = bData.Stride;
                // Convert BGRA→RGBA into upload buf
                for (int y = 0; y < FRAME_TEX_H; y++)
                {
                    nint srcRow = bData.Scan0 + y * srcStride;
                    int dstOff = y * FRAME_TEX_W * 4;
                    for (int x = 0; x < FRAME_TEX_W; x++)
                    {
                        byte b = Marshal.ReadByte(srcRow, x * 4 + 0);
                        byte g = Marshal.ReadByte(srcRow, x * 4 + 1);
                        byte r = Marshal.ReadByte(srcRow, x * 4 + 2);
                        byte a = Marshal.ReadByte(srcRow, x * 4 + 3);
                        _frameUploadBuf[dstOff + x * 4 + 0] = r;
                        _frameUploadBuf[dstOff + x * 4 + 1] = g;
                        _frameUploadBuf[dstOff + x * 4 + 2] = b;
                        _frameUploadBuf[dstOff + x * 4 + 3] = a;
                    }
                }
            }
            finally { _frameBitmap.UnlockBits(bData); }

            var box = _d3dContext.Map(_stagingTex, 0, MapMode.Write, Vortice.Direct3D11.MapFlags.None);
            try
            {
                int rowBytes = FRAME_TEX_W * 4;
                for (int y = 0; y < FRAME_TEX_H; y++)
                {
                    Marshal.Copy(_frameUploadBuf, y * rowBytes,
                        box.DataPointer + (nint)((long)y * box.RowPitch),
                        rowBytes);
                }
            }
            finally { _d3dContext.Unmap(_stagingTex, 0); }

            _d3dContext.CopyResource(_overlayTex, _stagingTex);

            // Crop overlay bounds so the visible region matches the drawn aspect rectangle
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f, vMin = 0f,
                uMax = (float)drawW / FRAME_TEX_W,
                vMax = (float)drawH / FRAME_TEX_H,
            };
            OpenVR.Overlay?.SetOverlayTextureBounds(_overlayHandle, ref bounds);

            var vrTex = new Texture_t
            {
                handle      = _overlayTex.NativePointer,
                eType       = ETextureType.DirectX,
                eColorSpace = EColorSpace.Auto,
            };
            OpenVR.Overlay?.SetOverlayTexture(_overlayHandle, ref vrTex);
        }

        private void CaptureAndSave()
        {
            try
            {
                if (_d3dDevice == null || _d3dContext == null || OpenVR.Compositor == null)
                {
                    _log("[FrameShot] Capture skipped: no compositor/device");
                    return;
                }

                // Ensure mirror pipeline is initialized (once per session)
                if (!EnsureMirrorPipeline()) return;

                // Let compositor render at least a few frames without the (now-hidden) overlay
                Thread.Sleep(80);

                // CopyResource into our staging texture, then map and read the crop region.
                _d3dContext.CopyResource(_mirrorStaging!, _mirrorTexCached!);

                var (px0, py0, px1, py1) = ProjectFrameToMirror(_mirrorW, _mirrorH);
                int x0 = Math.Clamp(Math.Min(px0, px1), 0, _mirrorW - 1);
                int y0 = Math.Clamp(Math.Min(py0, py1), 0, _mirrorH - 1);
                int x1 = Math.Clamp(Math.Max(px0, px1), 0, _mirrorW - 1);
                int y1 = Math.Clamp(Math.Max(py0, py1), 0, _mirrorH - 1);
                int cw = Math.Max(2, x1 - x0);
                int ch = Math.Max(2, y1 - y0);

                var box = _d3dContext.Map(_mirrorStaging!, 0, MapMode.Read, Vortice.Direct3D11.MapFlags.None);
                Bitmap? bmp = null;
                try
                {
                    bmp = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
                    var rect = new Rectangle(0, 0, cw, ch);
                    var bData = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                    try
                    {
                        var fmtName = _mirrorSrvFormat.ToString();
                        bool swapRB = !fmtName.StartsWith("B8G8R8A8", StringComparison.Ordinal);

                        var rowBuf = new byte[cw * 4];
                        for (int y = 0; y < ch; y++)
                        {
                            var srcRowPtr = box.DataPointer
                                            + (nint)((long)(y + y0) * box.RowPitch)
                                            + (nint)(x0 * 4);
                            Marshal.Copy(srcRowPtr, rowBuf, 0, cw * 4);
                            if (swapRB)
                            {
                                for (int x = 0; x < cw; x++)
                                {
                                    byte r = rowBuf[x * 4 + 0];
                                    byte b = rowBuf[x * 4 + 2];
                                    rowBuf[x * 4 + 0] = b;
                                    rowBuf[x * 4 + 2] = r;
                                    rowBuf[x * 4 + 3] = 255;
                                }
                            }
                            else
                            {
                                for (int x = 0; x < cw; x++)
                                    rowBuf[x * 4 + 3] = 255;
                            }
                            Marshal.Copy(rowBuf, 0,
                                bData.Scan0 + (nint)(y * bData.Stride),
                                cw * 4);
                        }
                    }
                    finally { bmp.UnlockBits(bData); }
                }
                finally { _d3dContext.Unmap(_mirrorStaging!, 0); }

                if (bmp != null)
                {
                    try { Directory.CreateDirectory(OutputDir); } catch { }
                    var filename = $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.png";
                    var path = Path.Combine(OutputDir, filename);
                    bmp.Save(path, ImageFormat.Png);
                    _log($"[FrameShot] Saved {path} ({cw}x{ch})");
                    bmp.Dispose();
                }
            }
            catch (Exception ex)
            {
                _log($"[FrameShot] Capture failed: {ex.Message}");
            }
        }

        private bool EnsureMirrorPipeline()
        {
            if (_mirrorStaging != null && _mirrorTexCached != null && _mirrorSrvObj != null)
                return true;
            if (_d3dDevice == null || OpenVR.Compositor == null) return false;

            var srv = IntPtr.Zero;
            var cErr = OpenVR.Compositor.GetMirrorTextureD3D11(EVREye.Eye_Left, _d3dDevice.NativePointer, ref srv);
            if (cErr != EVRCompositorError.None || srv == IntPtr.Zero)
            {
                _log($"[FrameShot] GetMirrorTextureD3D11 failed: {cErr}");
                return false;
            }
            _mirrorSrv = srv;
            _mirrorSrvObj = new ID3D11ShaderResourceView(srv);
            _mirrorSrvFormat = _mirrorSrvObj.Description.Format; // typed
            var resource = _mirrorSrvObj.Resource;
            _mirrorTexCached = resource.QueryInterface<ID3D11Texture2D>();
            var desc = _mirrorTexCached.Description;
            _mirrorW = (int)desc.Width;
            _mirrorH = (int)desc.Height;
            _mirrorTexFormat = desc.Format;

            _mirrorStaging = _d3dDevice.CreateTexture2D(new Texture2DDescription
            {
                Width = (uint)_mirrorW, Height = (uint)_mirrorH, MipLevels = 1, ArraySize = 1,
                Format = desc.Format,
                SampleDescription = new SampleDescription(1, 0),
                Usage = ResourceUsage.Staging,
                CPUAccessFlags = CpuAccessFlags.Read,
            });

            _log($"[FrameShot] Mirror pipeline ready {_mirrorW}x{_mirrorH} texFmt={_mirrorTexFormat} srvFmt={_mirrorSrvFormat}");
            return true;
        }

        // Project the 4 frame corners (in world space) onto the left-eye mirror image
        private (int x0, int y0, int x1, int y1) ProjectFrameToMirror(int mw, int mh)
        {
            uint hmdIdx = (uint)OpenVR.k_unTrackedDeviceIndex_Hmd;
            if (_vrSystem == null) return (0, 0, mw, mh);

            // HMD pose at capture time
            var hmdM = _poses[hmdIdx].mDeviceToAbsoluteTracking;
            var hmdRot = RotFromMatrix(hmdM);

            // Build view matrix (inverse of eyeWorld = hmdWorld * eyeToHead)
            var eyeToHead = _vrSystem.GetEyeToHeadTransform(EVREye.Eye_Left);
            var hmdWorld = ToMatrix4x4(hmdM);
            var eyeOffset = ToMatrix4x4(eyeToHead);
            var eyeWorld = eyeOffset * hmdWorld;
            Matrix4x4.Invert(eyeWorld, out var view);

            var proj = ToMatrix4x4Proj(_vrSystem.GetProjectionMatrix(EVREye.Eye_Left, 0.05f, 50f));
            var vp = view * proj;

            // Mirror exactly the same geometry the overlay uses: world hand
            // midpoint as center, current HMD basis for orientation.
            Vector3 hmdRight = Vector3.Transform(Vector3.UnitX,  hmdRot);
            Vector3 hmdUp    = Vector3.Transform(Vector3.UnitY,  hmdRot);
            Vector3 center   = (_lastLeftPos + _lastRightPos) * 0.5f;
            float halfW = _lastFrameWidth  * 0.5f;
            float halfH = _lastFrameHeight * 0.5f;

            // Inset a couple cm so the frame border itself isn't part of the crop
            float inset = 0.005f;
            halfW = MathF.Max(0.01f, halfW - inset);
            halfH = MathF.Max(0.01f, halfH - inset);

            Vector3[] corners =
            {
                center - hmdRight * halfW - hmdUp * halfH,
                center + hmdRight * halfW - hmdUp * halfH,
                center + hmdRight * halfW + hmdUp * halfH,
                center - hmdRight * halfW + hmdUp * halfH,
            };

            int minX = int.MaxValue, minY = int.MaxValue, maxX = int.MinValue, maxY = int.MinValue;
            foreach (var w in corners)
            {
                var clip = Vector4.Transform(new Vector4(w, 1f), vp);
                if (clip.W <= 0) continue;
                float ndcX = clip.X / clip.W;
                float ndcY = clip.Y / clip.W;
                int px = (int)((ndcX * 0.5f + 0.5f) * mw);
                int py = (int)((1f - (ndcY * 0.5f + 0.5f)) * mh);
                if (px < minX) minX = px;
                if (py < minY) minY = py;
                if (px > maxX) maxX = px;
                if (py > maxY) maxY = py;
            }
            if (minX == int.MaxValue) return (0, 0, mw, mh);
            return (minX, minY, maxX, maxY);
        }

        private static Matrix4x4 ToMatrix4x4(in HmdMatrix34_t m) => new(
            m.m0, m.m4, m.m8,  0,
            m.m1, m.m5, m.m9,  0,
            m.m2, m.m6, m.m10, 0,
            m.m3, m.m7, m.m11, 1);

        private static Matrix4x4 ToMatrix4x4Proj(in HmdMatrix44_t m) => new(
            m.m0,  m.m4,  m.m8,  m.m12,
            m.m1,  m.m5,  m.m9,  m.m13,
            m.m2,  m.m6,  m.m10, m.m14,
            m.m3,  m.m7,  m.m11, m.m15);

        private void EmitState()
        {
            OnStateUpdate?.Invoke(new
            {
                connected      = IsConnected,
                framing        = IsFraming,
                leftController = _leftIdx  != OpenVR.k_unTrackedDeviceIndexInvalid,
                rightController = _rightIdx != OpenVR.k_unTrackedDeviceIndexInvalid,
                error = (string?)null,
            });
        }

        private void StartVrserverMonitor(CancellationToken ct)
        {
            var procs = System.Diagnostics.Process.GetProcessesByName("vrserver");
            if (procs.Length == 0) return;
            var proc = procs[0];
            for (int i = 1; i < procs.Length; i++) procs[i].Dispose();
            _ = Task.Run(async () =>
            {
                try
                {
                    await proc.WaitForExitAsync(ct);
                    if (!ct.IsCancellationRequested && _vrSystem != null)
                    {
                        _log("[FrameShot] vrserver.exe exited — nulling OpenVR interface");
                        _vrSystem = null;
                        _cts?.Cancel();
                        _ = Task.Run(() => OnVRQuit?.Invoke());
                    }
                }
                catch { }
                finally { proc.Dispose(); }
            }, CancellationToken.None);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Disconnect();
            _cts?.Dispose();
        }
    }
}
#endif
