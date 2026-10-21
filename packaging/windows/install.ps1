# Installs MedTriage for the current Windows user and adds Desktop and Start menu shortcuts.
# Run it through "Install MedTriage.cmd" (double-click). No administrator rights needed.
# Patient data lives separately in %LOCALAPPDATA%\MedTriage and is kept when you reinstall or update.

$ErrorActionPreference = 'Stop'

$source = $PSScriptRoot
$target = Join-Path $env:LOCALAPPDATA 'Programs\MedTriage'

Write-Host 'Installing MedTriage to' $target

# An update can't replace the program while it's running
Get-Process -Name 'MedTriage' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -Path $source -Exclude 'install.ps1', 'Install MedTriage.cmd' |
    Copy-Item -Destination $target -Recurse -Force

# Files from a downloaded zip are marked as "from the internet"; clear that so they run without extra prompts
Get-ChildItem -Path $target -Recurse | Unblock-File

$exe = Join-Path $target 'MedTriage.exe'
$icon = Join-Path $target 'Assets\medtriage.ico'
$shell = New-Object -ComObject WScript.Shell

$shortcutFolders = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs')   # Start menu
)
foreach ($folder in $shortcutFolders) {
    $shortcut = $shell.CreateShortcut((Join-Path $folder 'MedTriage.lnk'))
    $shortcut.TargetPath = $exe
    $shortcut.WorkingDirectory = $target
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Description = 'MedTriage AI - clinical triage'
    $shortcut.Save()
}

Write-Host ''
Write-Host 'Done. Double-click the MedTriage icon on your Desktop to start.'
Write-Host 'The first time, Windows Firewall may ask about network access: choose "Allow" on private networks'
Write-Host 'so tablets and phones on the facility network can connect.'
