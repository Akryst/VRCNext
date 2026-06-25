using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
#if WINDOWS
using NAudio.Wave;
#endif

namespace VRCNext.Services.KikitanXD;

#if !WINDOWS
public sealed class GeminiLiveService : IKikitanSpeechService
{
    public event Action<string, bool>? OnRecognized;
    public event Action<string>? OnTranslated;
    public event Action<string>? OnLog;
    public event Action? OnChatboxSent;
    public bool IsRunning => false;
    public float MeterLevel => 0f;
    public void Start(int deviceIndex, KikitanXDSettings settings) { }
    public void UpdateSettings(KikitanXDSettings settings) { }
    public void Stop() { }
    public void Dispose() { }
}
#else

// Google Gemini Live API translation client. Streams 16 kHz mono PCM over a
// BidiGenerateContent WebSocket and emits the input/output transcriptions.
// https://ai.google.dev/gemini-api/docs/live-api/live-translate
public sealed class GeminiLiveService : IKikitanSpeechService
{
    public event Action<string, bool>? OnRecognized;
    public event Action<string>? OnTranslated;
    public event Action<string>? OnLog;
    public event Action? OnChatboxSent;

    private WaveInEvent? _waveIn;
    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task? _receiveTask;
    private Task? _senderTask;
    private volatile bool _running;

    private volatile float _meterLevel;
    public float MeterLevel => _meterLevel;
    public bool IsRunning => _running;

    private readonly ConcurrentQueue<byte[]> _pcmQueue = new();
    private readonly SemaphoreSlim _pcmSignal = new(0);
    private readonly SemaphoreSlim _sendLock = new(1, 1);

    private readonly StringBuilder _turnInput = new();
    private readonly StringBuilder _turnOutput = new();

    private string _apiKey = "";
    private string _targetLang = "en";
    private volatile bool _translateEnabled = true;
    private volatile bool _oscEnabled = true;
    private volatile string[] _blockedWords = Array.Empty<string>();
    private volatile string[] _blockedSentences = Array.Empty<string>();

    private const int SampleRate = 16000;
    private const int Channels = 1;
    private const int BitsPerSample = 16;
    private const string ModelName = "models/gemini-3.5-live-translate-preview";

    public void Start(int deviceIndex, KikitanXDSettings s)
    {
        Stop();
        _apiKey = s.GoogleApiKey ?? "";
        _targetLang = string.IsNullOrWhiteSpace(s.TargetLang) ? "en" : s.TargetLang;
        _translateEnabled = s.TranslateEnabled;
        _oscEnabled = s.OscEnabled;
        _blockedWords = NormalizeList(s.BlockedWords);
        _blockedSentences = NormalizeList(s.BlockedSentences);

        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException("Google API key is missing.");

        _running = true;
        _cts = new CancellationTokenSource();

        // Start the microphone immediately so the level meter works right away,
        // independent of the cloud connection (matches the Groq behaviour).
        _waveIn = new WaveInEvent
        {
            DeviceNumber = deviceIndex,
            WaveFormat = new WaveFormat(SampleRate, BitsPerSample, Channels),
            BufferMilliseconds = 100
        };
        _waveIn.DataAvailable += OnDataAvailable;
        _waveIn.RecordingStopped += OnRecordingStopped;
        _waveIn.StartRecording();

        // Connect and stream in the background; audio is only queued once the
        // socket is open, so a failed connection still leaves the meter live.
        _receiveTask = Task.Run(() => ConnectAndRunAsync(_cts.Token));
        Log("Kikitan XD (Google Gemini Live): microphone started, connecting...");
    }

    private async Task ConnectAndRunAsync(CancellationToken token)
    {
        var uri = new Uri(
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key="
            + Uri.EscapeDataString(_apiKey));
        try
        {
            _ws = new ClientWebSocket();
            await _ws.ConnectAsync(uri, token);
            await SendSetupAsync();
            Log("Kikitan XD (Google Gemini Live): connected");
            _senderTask = Task.Run(() => SenderLoop(token));
            await ReceiveLoop(token);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            CrashHandler.AddBreadcrumb($"GeminiLive.Connect: {ex.GetType().Name}: {ex.Message}");
            Log($"Kikitan XD (Google): connection failed — {ex.Message}. Check your Google API key and network.");
        }
    }

    public void UpdateSettings(KikitanXDSettings s)
    {
        // Target language / API key changes require a fresh session and take
        // effect on the next Start. Live toggles are applied immediately.
        _translateEnabled = s.TranslateEnabled;
        _oscEnabled = s.OscEnabled;
        _blockedWords = NormalizeList(s.BlockedWords);
        _blockedSentences = NormalizeList(s.BlockedSentences);
    }

    public void Stop()
    {
        _running = false;

        if (_waveIn != null)
        {
            _waveIn.DataAvailable -= OnDataAvailable;
            _waveIn.RecordingStopped -= OnRecordingStopped;
            try { _waveIn.StopRecording(); } catch { }
            _waveIn.Dispose();
            _waveIn = null;
        }

        try { _cts?.Cancel(); } catch { }

        if (_ws != null)
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                    _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "stop", CancellationToken.None).Wait(1000);
            }
            catch { }
            try { _ws.Dispose(); } catch { }
            _ws = null;
        }

        try { _receiveTask?.Wait(1000); } catch { }
        try { _senderTask?.Wait(1000); } catch { }
        _receiveTask = null;
        _senderTask = null;

        _cts?.Dispose();
        _cts = null;

        while (_pcmQueue.TryDequeue(out _)) { }
        _turnInput.Clear();
        _turnOutput.Clear();
        _meterLevel = 0f;
        Log("Kikitan XD (Google Gemini Live): stopped");
    }

    private async Task SendSetupAsync()
    {
        // The transcription configs are top-level fields of "setup", while
        // responseModalities and translationConfig live inside generationConfig.
        // https://ai.google.dev/gemini-api/docs/live-api/live-translate
        var setup = new JObject
        {
            ["setup"] = new JObject
            {
                ["model"] = ModelName,
                ["generationConfig"] = new JObject
                {
                    ["responseModalities"] = new JArray { "AUDIO" },
                    ["translationConfig"] = new JObject
                    {
                        ["targetLanguageCode"] = _targetLang,
                        ["echoTargetLanguage"] = true
                    }
                },
                ["inputAudioTranscription"] = new JObject(),
                ["outputAudioTranscription"] = new JObject()
            }
        };
        await SendJsonAsync(setup);
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded <= 0 || !_running) return;
        UpdateMeter(e.Buffer, e.BytesRecorded);
        if (_ws == null || _ws.State != WebSocketState.Open) return; // wait until connected
        var copy = new byte[e.BytesRecorded];
        Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _pcmQueue.Enqueue(copy);
        _pcmSignal.Release();
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception != null)
            Log($"Kikitan XD (Google): recording stopped — {e.Exception.Message}");
    }

    private async Task SenderLoop(CancellationToken token)
    {
        try
        {
            while (!token.IsCancellationRequested)
            {
                await _pcmSignal.WaitAsync(token);
                while (_pcmQueue.TryDequeue(out var chunk))
                {
                    if (_ws == null || _ws.State != WebSocketState.Open) return;
                    var msg = new JObject
                    {
                        ["realtimeInput"] = new JObject
                        {
                            ["audio"] = new JObject
                            {
                                ["data"] = Convert.ToBase64String(chunk),
                                ["mimeType"] = $"audio/pcm;rate={SampleRate}"
                            }
                        }
                    };
                    await SendJsonAsync(msg);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Log($"Kikitan XD (Google): send error — {ex.Message}");
        }
    }

    private async Task SendJsonAsync(JObject obj)
    {
        if (_ws == null) return;
        var bytes = Encoding.UTF8.GetBytes(obj.ToString(Newtonsoft.Json.Formatting.None));
        await _sendLock.WaitAsync();
        try
        {
            await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true,
                _cts?.Token ?? CancellationToken.None);
        }
        finally { _sendLock.Release(); }
    }

    private async Task ReceiveLoop(CancellationToken token)
    {
        var buffer = new byte[16384];
        var sb = new StringBuilder();
        try
        {
            while (!token.IsCancellationRequested && _ws != null && _ws.State == WebSocketState.Open)
            {
                var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    Log($"Kikitan XD (Google): session closed by server — {_ws.CloseStatus} {_ws.CloseStatusDescription}");
                    return;
                }
                sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                if (!result.EndOfMessage) continue;

                var text = sb.ToString();
                sb.Clear();
                HandleServerMessage(text);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            if (_running) Log($"Kikitan XD (Google): receive error — {ex.Message}");
            _running = false;
        }
    }

    private void HandleServerMessage(string text)
    {
        JObject obj;
        try { obj = JObject.Parse(text); }
        catch { return; }

        if (obj["setupComplete"] != null)
        {
            Log("Kikitan XD (Google): session ready");
            return;
        }

        var sc = obj["serverContent"];
        if (sc == null)
        {
            // Surface anything unexpected (error / goAway) so failures are visible.
            var raw = text.Length > 300 ? text[..300] : text;
            Log($"Kikitan XD (Google): {raw}");
            return;
        }

        var inText = sc["inputTranscription"]?["text"]?.ToString();
        if (!string.IsNullOrEmpty(inText))
        {
            _turnInput.Append(inText);
            OnRecognized?.Invoke(_turnInput.ToString(), true);
        }

        var outText = sc["outputTranscription"]?["text"]?.ToString();
        if (!string.IsNullOrEmpty(outText))
        {
            _turnOutput.Append(outText);
            if (_translateEnabled) OnTranslated?.Invoke(_turnOutput.ToString());
        }

        if (sc["turnComplete"]?.Value<bool>() == true)
            FinishTurn();
    }

    private void FinishTurn()
    {
        string src = _turnInput.ToString().Trim();
        string translated = _turnOutput.ToString().Trim();
        _turnInput.Clear();
        _turnOutput.Clear();

        if (src.Length == 0 && translated.Length == 0) return;

        string srcFiltered = ApplyBlockFilters(src);
        if (src.Length > 0 && srcFiltered.Length == 0) return; // fully blocked

        OnRecognized?.Invoke(srcFiltered.Length > 0 ? srcFiltered : src, false);

        string send = _translateEnabled && translated.Length > 0 ? translated : srcFiltered;
        send = ApplyBlockFilters(send);
        if (string.IsNullOrWhiteSpace(send)) return;

        OnTranslated?.Invoke(send);
        if (_oscEnabled) { SendChatbox(send); OnChatboxSent?.Invoke(); }
    }

    private void UpdateMeter(byte[] buf, int length)
    {
        if (length < 2) return;
        double sum = 0;
        int samples = length / 2;
        for (int i = 0; i < length - 1; i += 2)
        {
            short s = (short)(buf[i] | (buf[i + 1] << 8));
            double v = s / 32768.0;
            sum += v * v;
        }
        _meterLevel = Math.Min(1f, (float)Math.Sqrt(sum / samples) * 6f);
    }

    private static string[] NormalizeList(IEnumerable<string>? items)
    {
        if (items == null) return Array.Empty<string>();
        var list = new List<string>();
        foreach (var i in items)
            if (!string.IsNullOrWhiteSpace(i)) list.Add(i.Trim());
        return list.ToArray();
    }

    private static string NormalizeSentence(string s)
    {
        return s.Trim().Trim(' ', '.', ',', '!', '?', ';', ':', '"', '\'', '。', '！', '？', '、', '…').Trim();
    }

    private string ApplyBlockFilters(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        var sentences = _blockedSentences;
        if (sentences.Length > 0)
        {
            string norm = NormalizeSentence(text);
            foreach (var s in sentences)
                if (norm.Equals(NormalizeSentence(s), StringComparison.OrdinalIgnoreCase))
                    return "";
        }

        var words = _blockedWords;
        if (words.Length > 0)
        {
            foreach (var w in words)
            {
                if (string.IsNullOrWhiteSpace(w)) continue;
                text = System.Text.RegularExpressions.Regex.Replace(
                    text,
                    $@"\b{System.Text.RegularExpressions.Regex.Escape(w)}\b",
                    "",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            }
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\s{2,}", " ").Trim();
        }

        return text;
    }

    private static void SendChatbox(string text)
    {
        try
        {
            if (text.Length > 144) text = text[..144];
            using var udp = new System.Net.Sockets.UdpClient();
            udp.Connect("127.0.0.1", 9000);
            var buf = new List<byte>();
            OscString(buf, "/chatbox/input");
            OscString(buf, ",sTF");
            OscString(buf, text);
            var pkt = buf.ToArray();
            udp.Send(pkt, pkt.Length);
        }
        catch { }
    }

    private static void OscString(List<byte> buf, string s)
    {
        var b = Encoding.UTF8.GetBytes(s);
        buf.AddRange(b);
        int pad = 4 - (b.Length % 4);
        if (pad == 0) pad = 4;
        buf.AddRange(new byte[pad]);
    }

    private void Log(string msg) => OnLog?.Invoke(msg);

    public void Dispose()
    {
        Stop();
        _pcmSignal.Dispose();
        _sendLock.Dispose();
    }
}
#endif
