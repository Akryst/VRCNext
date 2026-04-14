using VRCNext.Services;

namespace VRCNext;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length >= 4 && args[0] == "--watchdog")
        {
            WatchdogRunner.Run(args);
            return;
        }

        if (args.Length >= 1 && args[0] == "--vr-subprocess")
        {
            VRSubprocess.Run();
            return;
        }

        CrashHandler.Register();
        Velopack.VelopackApp.Build().Run();
        new AppShell(args).Run();
    }
}
