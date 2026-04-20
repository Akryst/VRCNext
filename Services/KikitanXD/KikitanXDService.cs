using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
#if WINDOWS
using NAudio.Wave;
#endif

namespace VRCNext.Services.KikitanXD;

#if !WINDOWS
public sealed class KikitanXDService : IDisposable
{
    public event Action<string, bool>? OnRecognized;
    public event Action<string>? OnTranslated;
    public event Action<string>? OnLog;
    public bool IsRunning => false;
    public float MeterLevel => 0f;
    public static string[] GetInputDevices() => [];
    public void Start(int deviceIndex, string apiKey, string sourceLang, string targetLang, bool translate, bool oscEnabled) { }
    public void Stop() { }
    public void Dispose() { }
}
#else

public sealed class KikitanXDService : IDisposable
{
    public event Action<string, bool>? OnRecognized;
    public event Action<string>? OnTranslated;
    public event Action<string>? OnLog;

    private WaveInEvent? _waveIn;
    private volatile float _meterLevel;
    public float MeterLevel => _meterLevel;
    public bool IsRunning => _waveIn != null;

    private readonly ConcurrentQueue<byte[]> _pcmQueue = new();
    private readonly AutoResetEvent _workerEvent = new(false);
    private Thread? _workerThread;
    private volatile bool _workerRunning;

    private string _apiKey = "";
    private string _sourceLang = "auto";
    private string _targetLang = "en";
    private bool _translateEnabled;
    private bool _oscEnabled;

    private static readonly HttpClient _http = new();

    private const int SampleRate = 16000;
    private const int Channels = 1;
    private const int BitsPerSample = 16;

    // VAD thresholds — SilenceThreshold is derived from user noise gate (percent / 100 / 6)
    private volatile float _silenceThreshold = 0.0167f; // ~10% on meter
    private const int SilenceFlushMs = 800;
    private const int MinSpeechMs = 250;
    private const int MaxSegmentMs = 10000;

    public void UpdateSettings(string apiKey, string sourceLang, string targetLang, bool translate, bool oscEnabled, int noiseGatePct)
    {
        _apiKey = apiKey;
        _sourceLang = sourceLang;
        _targetLang = targetLang;
        _translateEnabled = translate;
        _oscEnabled = oscEnabled;
        _silenceThreshold = Math.Clamp(noiseGatePct / 100f / 6f, 0.001f, 0.5f);
    }

    private static readonly string TranslateSystemPrompt =
        "You are a raw linguistic parsing protocol. Your only function is to convert text from [LANG_SRC] to [LANG_TARGET]. " +
        "Output only the direct translation. No pre-text, no post-text, no explanations. " +
        "If the text is already in [LANG_TARGET], output it unchanged.";

    public static string[] GetInputDevices()
    {
        int count = WaveInEvent.DeviceCount;
        var names = new string[count];
        for (int i = 0; i < count; i++)
            names[i] = WaveInEvent.GetCapabilities(i).ProductName;
        return names;
    }

    public void Start(int deviceIndex, string apiKey, string sourceLang, string targetLang, bool translate, bool oscEnabled, int noiseGatePct)
    {
        Stop();
        _apiKey = apiKey;
        _sourceLang = sourceLang;
        _targetLang = targetLang;
        _translateEnabled = translate;
        _oscEnabled = oscEnabled;
        _silenceThreshold = Math.Clamp(noiseGatePct / 100f / 6f, 0.001f, 0.5f);

        _waveIn = new WaveInEvent
        {
            DeviceNumber = deviceIndex,
            WaveFormat = new WaveFormat(SampleRate, BitsPerSample, Channels),
            BufferMilliseconds = 50
        };
        _waveIn.DataAvailable += OnDataAvailable;
        _waveIn.RecordingStopped += OnRecordingStopped;

        _workerRunning = true;
        _workerThread = new Thread(WorkerLoop) { IsBackground = true };
        _workerThread.Start();

        _waveIn.StartRecording();
        Log("Kikitan XD: listening started");
    }

    public void Stop()
    {
        if (_waveIn != null)
        {
            _waveIn.DataAvailable -= OnDataAvailable;
            _waveIn.RecordingStopped -= OnRecordingStopped;
            try { _waveIn.StopRecording(); } catch { }
            _waveIn.Dispose();
            _waveIn = null;
        }

        _workerRunning = false;
        _workerEvent.Set();
        _workerThread?.Join(1000);
        _workerThread = null;

        _meterLevel = 0f;
        Log("Kikitan XD: stopped");
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded <= 0) return;
        UpdateMeter(e.Buffer, e.BytesRecorded);
        var copy = new byte[e.BytesRecorded];
        Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _pcmQueue.Enqueue(copy);
        _workerEvent.Set();
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception != null)
            Log($"Kikitan XD: recording stopped — {e.Exception.Message}");
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

    private void WorkerLoop()
    {
        var speechBuffer = new List<byte>();
        int silentMs = 0;
        int speechMs = 0;
        bool inSpeech = false;
        int bytesPerMs = SampleRate * Channels * (BitsPerSample / 8) / 1000;

        try
        {
            while (_workerRunning)
            {
                _workerEvent.WaitOne(20);

                while (_pcmQueue.TryDequeue(out var chunk))
                {
                    double sum = 0;
                    int samples = chunk.Length / 2;
                    for (int i = 0; i < chunk.Length - 1; i += 2)
                    {
                        short s = (short)(chunk[i] | (chunk[i + 1] << 8));
                        double v = s / 32768.0;
                        sum += v * v;
                    }
                    float rms = samples > 0 ? (float)Math.Sqrt(sum / samples) : 0f;
                    int chunkMs = bytesPerMs > 0 ? chunk.Length / bytesPerMs : 0;

                    if (rms > _silenceThreshold)
                    {
                        silentMs = 0;
                        speechBuffer.AddRange(chunk);
                        speechMs += chunkMs;
                        inSpeech = true;
                    }
                    else if (inSpeech)
                    {
                        silentMs += chunkMs;
                        speechBuffer.AddRange(chunk);
                    }

                    bool flushSilence = inSpeech && silentMs >= SilenceFlushMs && speechMs >= MinSpeechMs;
                    bool flushMax = inSpeech && speechMs >= MaxSegmentMs;

                    if (flushSilence || flushMax)
                    {
                        var segment = speechBuffer.ToArray();
                        speechBuffer.Clear();
                        speechMs = 0;
                        silentMs = 0;
                        inSpeech = false;
                        ThreadPool.QueueUserWorkItem(_ => ProcessSegment(segment));
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Kikitan XD: worker error — {ex.Message}");
            CrashHandler.AddBreadcrumb($"KikitanXD.WorkerLoop: {ex.GetType().Name}: {ex.Message}");
        }
    }

    private void ProcessSegment(byte[] pcm)
    {
        try
        {
            var wavBytes = PcmToWav(pcm, SampleRate, Channels, BitsPerSample);
            string srcText = TranscribeAsync(wavBytes).GetAwaiter().GetResult();
            if (string.IsNullOrWhiteSpace(srcText)) return;

            OnRecognized?.Invoke(srcText, false);

            if (!_translateEnabled || string.IsNullOrWhiteSpace(_targetLang))
            {
                if (_oscEnabled) SendChatbox(srcText);
                return;
            }

            string translated = TranslateAsync(srcText, _sourceLang, _targetLang).GetAwaiter().GetResult();
            if (!string.IsNullOrWhiteSpace(translated))
            {
                OnTranslated?.Invoke(translated);
                if (_oscEnabled) SendChatbox(translated);
            }
        }
        catch (Exception ex)
        {
            Log($"Kikitan XD: process error — {ex.Message}");
        }
    }

    private async Task<string> TranscribeAsync(byte[] wavBytes)
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(wavBytes);
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("audio/wav");
        content.Add(fileContent, "file", "audio.wav");
        content.Add(new StringContent("whisper-large-v3-turbo"), "model");
        if (!string.Equals(_sourceLang, "auto", StringComparison.OrdinalIgnoreCase))
            content.Add(new StringContent(_sourceLang), "language");
        content.Add(new StringContent("json"), "response_format");

        using var req = new HttpRequestMessage(HttpMethod.Post,
            "https://api.groq.com/openai/v1/audio/transcriptions");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        req.Content = content;

        var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            Log($"Kikitan XD: STT error {(int)resp.StatusCode}");
            return "";
        }
        var json = JObject.Parse(await resp.Content.ReadAsStringAsync());
        return json["text"]?.ToString()?.Trim() ?? "";
    }

    private async Task<string> TranslateAsync(string text, string source, string target)
    {
        var body = new JObject
        {
            ["model"] = "llama-3.3-70b-versatile",
            ["temperature"] = 1,
            ["max_completion_tokens"] = 512,
            ["messages"] = new JArray
            {
                new JObject { ["role"] = "system", ["content"] = TranslateSystemPrompt },
                new JObject { ["role"] = "user", ["content"] = $"{source} | {target} | {text}" }
            }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post,
            "https://api.groq.com/openai/v1/chat/completions");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        req.Content = new StringContent(body.ToString(), System.Text.Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            Log($"Kikitan XD: translate error {(int)resp.StatusCode}");
            return "";
        }
        var json = JObject.Parse(await resp.Content.ReadAsStringAsync());
        return json["choices"]?[0]?["message"]?["content"]?.ToString()?.Trim() ?? "";
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
        var b = System.Text.Encoding.UTF8.GetBytes(s);
        buf.AddRange(b);
        int pad = 4 - (b.Length % 4);
        if (pad == 0) pad = 4;
        buf.AddRange(new byte[pad]);
    }

    private static byte[] PcmToWav(byte[] pcm, int sampleRate, int channels, int bitsPerSample)
    {
        using var ms = new MemoryStream();
        using var w = new BinaryWriter(ms);
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        int blockAlign = channels * bitsPerSample / 8;
        w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
        w.Write(36 + pcm.Length);
        w.Write(System.Text.Encoding.ASCII.GetBytes("WAVE"));
        w.Write(System.Text.Encoding.ASCII.GetBytes("fmt "));
        w.Write(16);
        w.Write((short)1);
        w.Write((short)channels);
        w.Write(sampleRate);
        w.Write(byteRate);
        w.Write((short)blockAlign);
        w.Write((short)bitsPerSample);
        w.Write(System.Text.Encoding.ASCII.GetBytes("data"));
        w.Write(pcm.Length);
        w.Write(pcm);
        return ms.ToArray();
    }

    private void Log(string msg) => OnLog?.Invoke(msg);

    public void Dispose()
    {
        Stop();
        _workerEvent.Dispose();
    }
}
#endif
