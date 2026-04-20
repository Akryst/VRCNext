using Newtonsoft.Json.Linq;
using VRCNext.Services;
using VRCNext.Services.KikitanXD;

namespace VRCNext;

public class KikitanXDController : IDisposable
{
    private readonly CoreLibrary _core;
    private KikitanXDService? _service;
    private KikitanXDSettings _settings;

    public bool IsRunning => _service?.IsRunning ?? false;
    public float MeterLevel => _service?.MeterLevel ?? 0f;

    public KikitanXDController(CoreLibrary core)
    {
        _core = core;
        _settings = KikitanXDSettings.Load();
    }

    public void HandleMessage(string action, JObject msg)
    {
        switch (action)
        {
            case "kxdGetDevices":
            {
                var devices = KikitanXDService.GetInputDevices();
                _core.SendToJS("kxdDevices", new
                {
                    devices,
                    savedIndex = _settings.InputDeviceIndex,
                    apiKey = _settings.ApiKey,
                    sourceLang = _settings.SourceLang,
                    targetLang = _settings.TargetLang,
                    translateEnabled = _settings.TranslateEnabled,
                    oscEnabled = _settings.OscEnabled,
                    noiseGatePct = _settings.NoiseGatePercent
                });
                break;
            }

            case "kxdStart":
            {
                int devIdx = msg["deviceIndex"]?.Value<int>() ?? 0;
                string apiKey = msg["apiKey"]?.ToString() ?? _settings.ApiKey;
                string srcLang = msg["sourceLang"]?.ToString() ?? _settings.SourceLang;
                string tgtLang = msg["targetLang"]?.ToString() ?? _settings.TargetLang;
                bool translate = msg["translateEnabled"]?.Value<bool>() ?? _settings.TranslateEnabled;
                bool osc = msg["oscEnabled"]?.Value<bool>() ?? _settings.OscEnabled;
                int gate = msg["noiseGatePct"]?.Value<int>() ?? _settings.NoiseGatePercent;

                _settings.InputDeviceIndex = devIdx;
                _settings.ApiKey = apiKey;
                _settings.SourceLang = srcLang;
                _settings.TargetLang = tgtLang;
                _settings.TranslateEnabled = translate;
                _settings.OscEnabled = osc;
                _settings.NoiseGatePercent = gate;
                _settings.Save();

                _service?.Dispose();
                _service = new KikitanXDService();
                _service.OnLog += s => Invoke(() => _core.SendToJS("log", new { msg = s, color = "sec" }));
                _service.OnRecognized += (text, isPartial) =>
                    Invoke(() => _core.SendToJS("kxdRecognized", new { text, isPartial }));
                _service.OnTranslated += text =>
                    Invoke(() => _core.SendToJS("kxdTranslated", new { text }));
                _service.Start(devIdx, apiKey, srcLang, tgtLang, translate, osc, gate);
                _core.SendToJS("kxdState", new { running = true });
                break;
            }

            case "kxdStop":
                _service?.Stop();
                _core.SendToJS("kxdState", new { running = false });
                _core.SendToJS("kxdMeter", new { level = 0f });
                break;

            case "kxdSaveSettings":
            {
                if (msg["apiKey"] is JToken ak) _settings.ApiKey = ak.ToString();
                if (msg["sourceLang"] is JToken sl) _settings.SourceLang = sl.ToString();
                if (msg["targetLang"] is JToken tl) _settings.TargetLang = tl.ToString();
                if (msg["translateEnabled"] is JToken te) _settings.TranslateEnabled = te.Value<bool>();
                if (msg["oscEnabled"] is JToken oe) _settings.OscEnabled = oe.Value<bool>();
                if (msg["noiseGatePct"] is JToken ng) _settings.NoiseGatePercent = ng.Value<int>();
                _settings.Save();
                _service?.UpdateSettings(_settings.ApiKey, _settings.SourceLang, _settings.TargetLang,
                    _settings.TranslateEnabled, _settings.OscEnabled, _settings.NoiseGatePercent);
                break;
            }
        }
    }

    public void Dispose()
    {
        _service?.Dispose();
        _service = null;
    }

    private static void Invoke(Action action) => action();
}
