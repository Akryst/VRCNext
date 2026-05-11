using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using VRCNext.Services;

namespace VRCNext;

public class VRChatConfigController
{
    private readonly CoreLibrary _core;

    private static string ConfigPath => Path.GetFullPath(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "..", "LocalLow", "VRChat", "VRChat", "config.json"));

    public VRChatConfigController(CoreLibrary core) => _core = core;

    public void HandleMessage(string action, JObject msg)
    {
        switch (action)
        {
            case "vrcGetVrchatConfig":
                SendConfig();
                break;
            case "vrcSaveVrchatConfig":
                SaveConfig(msg["config"] as JObject);
                break;
        }
    }

    private void SendConfig()
    {
        try
        {
            var path = ConfigPath;
            JObject config = new();
            if (File.Exists(path))
            {
                var text = File.ReadAllText(path);
                try { config = JObject.Parse(text); } catch { }
            }
            _core.SendToJS("vrchatConfig", new { config, exists = File.Exists(path), path });
        }
        catch (Exception ex)
        {
            _core.SendToJS("vrchatConfig", new { config = new JObject(), exists = false, error = ex.Message });
        }
    }

    private void SaveConfig(JObject? config)
    {
        if (config == null) return;
        try
        {
            var path = ConfigPath;
            var dir = Path.GetDirectoryName(path)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(path, config.ToString(Formatting.Indented));
            _core.SendToJS("toast", new { ok = true, msg = "VRChat config saved" });
        }
        catch (Exception ex)
        {
            _core.SendToJS("toast", new { ok = false, msg = $"Failed to save config: {ex.Message}" });
        }
    }
}
