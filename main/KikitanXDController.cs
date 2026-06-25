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
                    noiseGatePct = _settings.NoiseGatePercent,
                    profileTranslationEnabled = _settings.ProfileTranslationEnabled,
                    profileTargetLang = _settings.ProfileTargetLang,
                    personality = _settings.Personality,
                    blockWords = _settings.BlockedWords,
                    blockSentences = _settings.BlockedSentences
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
                string personality = msg["personality"]?.ToString() ?? _settings.Personality;
                var blockWords = msg["blockWords"]?.ToObject<List<string>>() ?? _settings.BlockedWords;
                var blockSentences = msg["blockSentences"]?.ToObject<List<string>>() ?? _settings.BlockedSentences;

                _settings.InputDeviceIndex = devIdx;
                _settings.ApiKey = apiKey;
                _settings.SourceLang = srcLang;
                _settings.TargetLang = tgtLang;
                _settings.TranslateEnabled = translate;
                _settings.OscEnabled = osc;
                _settings.NoiseGatePercent = gate;
                _settings.Personality = personality;
                _settings.BlockedWords = blockWords;
                _settings.BlockedSentences = blockSentences;
                _settings.Save();

                _service?.Dispose();
                _service = new KikitanXDService();
                _service.OnLog += s => Invoke(() => _core.SendToJS("log", new { msg = s, color = "sec" }));
                _service.OnRecognized += (text, isPartial) =>
                    Invoke(() => _core.SendToJS("kxdRecognized", new { text, isPartial }));
                _service.OnTranslated += text =>
                    Invoke(() => _core.SendToJS("kxdTranslated", new { text }));
                _service.OnChatboxSent += () => _core.OnChatboxPauseRequest?.Invoke(15_000);
                _service.Start(devIdx, apiKey, srcLang, tgtLang, translate, osc, gate, personality, blockWords, blockSentences);
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
                if (msg["deviceIndex"] is JToken di) _settings.InputDeviceIndex = di.Value<int>();
                if (msg["apiKey"] is JToken ak) _settings.ApiKey = ak.ToString();
                if (msg["sourceLang"] is JToken sl) _settings.SourceLang = sl.ToString();
                if (msg["targetLang"] is JToken tl) _settings.TargetLang = tl.ToString();
                if (msg["translateEnabled"] is JToken te) _settings.TranslateEnabled = te.Value<bool>();
                if (msg["oscEnabled"] is JToken oe) _settings.OscEnabled = oe.Value<bool>();
                if (msg["noiseGatePct"] is JToken ng) _settings.NoiseGatePercent = ng.Value<int>();
                if (msg["profileTranslationEnabled"] is JToken pte) _settings.ProfileTranslationEnabled = pte.Value<bool>();
                if (msg["profileTargetLang"] is JToken ptl) _settings.ProfileTargetLang = ptl.ToString();
                if (msg["personality"] is JToken pers) _settings.Personality = pers.ToString();
                if (msg["blockWords"] is JToken bw) _settings.BlockedWords = bw.ToObject<List<string>>() ?? new();
                if (msg["blockSentences"] is JToken bs) _settings.BlockedSentences = bs.ToObject<List<string>>() ?? new();
                _settings.Save();
                _core.SendToJS("toast", new { ok = true, msg = "Saved" });
                _service?.UpdateSettings(_settings.ApiKey, _settings.SourceLang, _settings.TargetLang,
                    _settings.TranslateEnabled, _settings.OscEnabled, _settings.NoiseGatePercent, _settings.Personality,
                    _settings.BlockedWords, _settings.BlockedSentences);
                break;
            }

            case "kxdTranslateProfileText":
            {
                string text = msg["text"]?.ToString() ?? "";
                string reqId = msg["reqId"]?.ToString() ?? "";
                string targetLang = !string.IsNullOrEmpty(msg["targetLang"]?.ToString())
                    ? msg["targetLang"]!.ToString()
                    : _settings.ProfileTargetLang;
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var translated = await KikitanXDService.TranslateStandaloneAsync(
                            _settings.ApiKey, text, "auto", targetLang);
                        _core.SendToJS("kxdProfileTranslated", new { reqId, text = translated, ok = !string.IsNullOrWhiteSpace(translated) });
                    }
                    catch (Exception ex)
                    {
                        _core.SendToJS("kxdProfileTranslated", new { reqId, text = "", ok = false, error = ex.Message });
                    }
                });
                break;
            }
        }
    }

    public void Toggle()
    {
        if (IsRunning)
        {
            _service?.Stop();
            _core.SendToJS("kxdState", new { running = false });
            _core.SendToJS("kxdMeter", new { level = 0f });
        }
        else
        {
            _service?.Dispose();
            _service = new KikitanXDService();
            _service.OnLog += s => Invoke(() => _core.SendToJS("log", new { msg = s, color = "sec" }));
            _service.OnRecognized += (text, isPartial) =>
                Invoke(() => _core.SendToJS("kxdRecognized", new { text, isPartial }));
            _service.OnTranslated += text =>
                Invoke(() => _core.SendToJS("kxdTranslated", new { text }));
            _service.Start(_settings.InputDeviceIndex, _settings.ApiKey, _settings.SourceLang,
                _settings.TargetLang, _settings.TranslateEnabled, _settings.OscEnabled, _settings.NoiseGatePercent, _settings.Personality,
                _settings.BlockedWords, _settings.BlockedSentences);
            _core.SendToJS("kxdState", new { running = true });
        }
    }

    public void Dispose()
    {
        _service?.Dispose();
        _service = null;
    }

    private static void Invoke(Action action) => action();
}
