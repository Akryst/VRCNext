using Newtonsoft.Json.Linq;
using VRCNext.Services;

namespace VRCNext;

// Action Flow - persists user-defined Blockly flows and relays "Send Notification"
// blocks to the system tray. Flow execution itself lives in the JS layer so that
// it has direct access to the live friend/instance state held in the frontend.
public class ActionFlowController : IDisposable
{
    private readonly CoreLibrary _core;
    private ActionFlowSettings   _settings;

#if WINDOWS
    public Func<SystemTrayService?>? TrayServiceProvider { get; set; }
#endif

    public ActionFlowController(CoreLibrary core)
    {
        _core = core;
        _settings = ActionFlowSettings.Load();
    }

    public void HandleMessage(string action, JObject msg)
    {
        switch (action)
        {
            case "afLoadFlows":
            {
                // Send with explicit lowercase keys — SendToJS uses default Newtonsoft
                // serialization which keeps PascalCase, but the JS side reads `id` etc.
                var arr = new JArray();
                foreach (var f in _settings.Flows)
                {
                    arr.Add(new JObject {
                        ["id"]        = f.Id,
                        ["name"]      = f.Name,
                        ["enabled"]   = f.Enabled,
                        ["workspace"] = f.Workspace,
                        ["createdAt"] = f.CreatedAt,
                        ["updatedAt"] = f.UpdatedAt,
                    });
                }
                _core.SendToJS("afFlows", new { flows = arr });
                break;
            }

            case "afSaveFlows":
            {
                var arr = msg["flows"] as JArray;
                if (arr == null) {
                    _core.SendToJS("afSaveResult", new { ok = false, error = "missing flows" });
                    _core.SendToJS("log", new { msg = "[ActionFlow] save rejected: missing flows", color = "err" });
                    break;
                }

                try
                {
                    _settings.Flows = arr.ToObject<List<ActionFlowSettings.ActionFlow>>() ?? new();
                }
                catch (Exception ex)
                {
                    _core.SendToJS("afSaveResult", new { ok = false, error = "parse: " + ex.Message });
                    _core.SendToJS("log", new { msg = "[ActionFlow] save parse error: " + ex.Message, color = "err" });
                    break;
                }

                _settings.Save();
                if (_settings.LastSaveError != null)
                {
                    _core.SendToJS("afSaveResult", new { ok = false, error = _settings.LastSaveError });
                    _core.SendToJS("log", new { msg = "[ActionFlow] save failed: " + _settings.LastSaveError, color = "err" });
                }
                else
                {
                    var nonEmpty = _settings.Flows.Count(f => f.Workspace != null && f.Workspace.HasValues);
                    _core.SendToJS("afSaveResult", new { ok = true, count = _settings.Flows.Count, nonEmpty });
                }
                break;
            }

            case "afTrayNotify":
            {
                var title    = msg["title"]?.ToString()    ?? "Action Flow";
                var subtitle = msg["subtitle"]?.ToString() ?? "";
                var accent   = msg["accent"]?.ToString()   ?? "info";

#if WINDOWS
                var tray = TrayServiceProvider?.Invoke();
                tray?.ShowNotification(title, subtitle, "", accent);
#endif
                break;
            }
        }
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }
}
