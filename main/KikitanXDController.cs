using Newtonsoft.Json.Linq;
using VRCNext.Services;
using VRCNext.Services.KikitanXD;

namespace VRCNext;

public class KikitanXDController : IDisposable
{
    private readonly CoreLibrary _core;
    private IKikitanSpeechService? _service;
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
                    blockSentences = _settings.BlockedSentences,
                    model = _settings.Model,
                    googleApiKey = _settings.GoogleApiKey
                });
                break;
            }

            case "kxdStart":
            {
                if (msg["deviceIndex"] is JToken di0) _settings.InputDeviceIndex = di0.Value<int>();
                if (msg["apiKey"] is JToken ak0) _settings.ApiKey = ak0.ToString();
                if (msg["googleApiKey"] is JToken gk0) _settings.GoogleApiKey = gk0.ToString();
                if (msg["sourceLang"] is JToken sl0) _settings.SourceLang = sl0.ToString();
                if (msg["targetLang"] is JToken tl0) _settings.TargetLang = tl0.ToString();
                if (msg["translateEnabled"] is JToken te0) _settings.TranslateEnabled = te0.Value<bool>();
                if (msg["oscEnabled"] is JToken oe0) _settings.OscEnabled = oe0.Value<bool>();
                if (msg["noiseGatePct"] is JToken ng0) _settings.NoiseGatePercent = ng0.Value<int>();
                if (msg["personality"] is JToken pe0) _settings.Personality = pe0.ToString();
                if (msg["model"] is JToken md0) _settings.Model = md0.ToString();
                if (msg["blockWords"] is JToken bw0) _settings.BlockedWords = bw0.ToObject<List<string>>() ?? new();
                if (msg["blockSentences"] is JToken bs0) _settings.BlockedSentences = bs0.ToObject<List<string>>() ?? new();
                _settings.Save();

                try
                {
                    StartServiceFromSettings();
                }
                catch (Exception ex)
                {
                    _service?.Dispose();
                    _service = null;
                    _core.SendToJS("kxdState", new { running = false });
                    _core.SendToJS("toast", new { ok = false, msg = ex.Message });
                    _core.SendToJS("log", new { msg = $"Kikitan XD: {ex.Message}", color = "err" });
                }
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
                if (msg["googleApiKey"] is JToken gk) _settings.GoogleApiKey = gk.ToString();
                if (msg["model"] is JToken md) _settings.Model = md.ToString();
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
                _service?.UpdateSettings(_settings);
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
            try
            {
                StartServiceFromSettings();
            }
            catch (Exception ex)
            {
                _service?.Dispose();
                _service = null;
                _core.SendToJS("kxdState", new { running = false });
                _core.SendToJS("log", new { msg = $"Kikitan XD: {ex.Message}", color = "err" });
            }
        }
    }

    private void StartServiceFromSettings()
    {
        _service?.Dispose();
        _service = string.Equals(_settings.Model, "google", StringComparison.OrdinalIgnoreCase)
            ? new GeminiLiveService()
            : new KikitanXDService();
        _service.OnLog += s => Invoke(() => _core.SendToJS("log", new { msg = s, color = "sec" }));
        _service.OnRecognized += (text, isPartial) =>
            Invoke(() => _core.SendToJS("kxdRecognized", new { text, isPartial }));
        _service.OnTranslated += text =>
            Invoke(() => _core.SendToJS("kxdTranslated", new { text }));
        _service.OnChatboxSent += () => _core.OnChatboxPauseRequest?.Invoke(15_000);
        _service.Start(_settings.InputDeviceIndex, _settings);
        _core.SendToJS("kxdState", new { running = true });
    }

    public void Dispose()
    {
        _service?.Dispose();
        _service = null;
    }

    private static void Invoke(Action action) => action();
}
