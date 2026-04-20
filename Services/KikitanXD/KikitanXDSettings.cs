using Newtonsoft.Json;

namespace VRCNext.Services.KikitanXD;

public class KikitanXDSettings
{
    private static readonly string FilePath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "VRCNext", "kikitan_xd.json");

    public string ApiKey { get; set; } = "";
    public int InputDeviceIndex { get; set; } = 0;
    public string SourceLang { get; set; } = "auto";
    public string TargetLang { get; set; } = "en";
    public bool TranslateEnabled { get; set; } = true;
    public bool OscEnabled { get; set; } = true;
    public int NoiseGatePercent { get; set; } = 10;

    public static KikitanXDSettings Load()
    {
        try
        {
            if (System.IO.File.Exists(FilePath))
                return JsonConvert.DeserializeObject<KikitanXDSettings>(
                    System.IO.File.ReadAllText(FilePath)) ?? new();
        }
        catch { }
        return new();
    }

    public void Save()
    {
        try
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(FilePath)!);
            System.IO.File.WriteAllText(FilePath, JsonConvert.SerializeObject(this, Formatting.Indented));
        }
        catch { }
    }
}
