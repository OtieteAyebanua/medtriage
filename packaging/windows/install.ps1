# Installs __APP_NAME__ for the current Windows user and adds Desktop and Start menu shortcuts.
# Run it through "Install __APP_NAME__.cmd" (double-click). No administrator rights needed.
# (Template: packaging/publish.sh fills in the placeholders.)

$ErrorActionPreference = 'Stop'

$appName = '__APP_NAME__'
$exeName = '__EXE__'
$source = $PSScriptRoot
$target = Join-Path $env:LOCALAPPDATA "Programs\$appName"

Write-Host "Installing $appName to $target"

# An update can't replace the program while it's running
Get-Process -Name $exeName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -Path $source -Exclude 'install.ps1', '*.cmd' |
    Copy-Item -Destination $target -Recurse -Force

# Files from a downloaded zip are marked as "from the internet"; clear that so they run without extra prompts
Get-ChildItem -Path $target -Recurse | Unblock-File

$shell = New-Object -ComObject WScript.Shell
$shortcutFolders = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs')   # Start menu
)
foreach ($folder in $shortcutFolders) {
    $shortcut = $shell.CreateShortcut((Join-Path $folder "$appName.lnk"))
    $shortcut.TargetPath = Join-Path $target "$exeName.exe"
    $shortcut.WorkingDirectory = $target
    $shortcut.IconLocation = (Join-Path $target 'Assets\medtriage.ico') + ',0'
    $shortcut.Description = $appName
    $shortcut.Save()
}

Write-Host ''
Write-Host "Done. Double-click the $appName icon on your Desktop to start."
__AFTER_INSTALL__
