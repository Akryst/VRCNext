#define MyAppName      "VRCNext"
#define MyAppVersion   "2026.1.0-beta"
#define MyAppPublisher "VRCNext"
#define MyAppURL       "https://vrcnext.app"
#define MyAppExeName   "VRCNext.exe"
#define MyAppSourceDir "bin\Release\net8.0-windows10.0.22621.0\win-x64\publish"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer
OutputBaseFilename=VRCNext_Setup_{#MyAppVersion}_x64
SetupIconFile=logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
MinVersion=10.0.19041
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
Source: "{#MyAppSourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
function NetRuntimeExists(): Boolean;
var
  FindRec: TFindRec;
begin
  Result := False;
  // Check C:\Program Files\dotnet\shared\Microsoft.NETCore.App\8.*
  if FindFirst(ExpandConstant('{pf}\dotnet\shared\Microsoft.NETCore.App\8.*'), FindRec) then
  begin
    Result := True;
    FindClose(FindRec);
    Exit;
  end;
  // Also accept Windows Desktop Runtime (includes NETCore.App)
  if FindFirst(ExpandConstant('{pf}\dotnet\shared\Microsoft.WindowsDesktop.App\8.*'), FindRec) then
  begin
    Result := True;
    FindClose(FindRec);
  end;
end;

function InitializeSetup(): Boolean;
var
  ErrCode: Integer;
begin
  Result := True;
  if not NetRuntimeExists() then
  begin
    if MsgBox(
      'VRCNext requires the .NET 8 Runtime which was not detected on your system.' + #13#10#13#10 +
      'Click OK to open the download page, then re-run this installer after installing .NET 8.' + #13#10 +
      'Click Cancel to continue anyway (the app may not launch).',
      mbConfirmation, MB_OKCANCEL) = IDOK then
    begin
      ShellExec('open', 'https://dotnet.microsoft.com/en-us/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ErrCode);
      Result := False;
    end;
  end;
end;
