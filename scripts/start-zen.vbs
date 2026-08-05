' ZEN · DESIGN launcher: starts the local dev server in the background
' (no visible window) and opens the browser once it is ready.
Option Explicit

Dim shell, port, url, projectRoot, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

port = "5174"
url = "http://localhost:" & port & "/"
' projectRoot = parent of the folder containing this .vbs (scripts\ -> project root)
projectRoot = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

Dim psCmd
psCmd = _
  "$ErrorActionPreference='Stop';" & _
  "$port='" & port & "'; $url='" & url & "'; $project='" & projectRoot & "';" & _
  "function Test-Server($u){try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; return $r.StatusCode -eq 200}catch{return $false}};" & _
  "if(-not (Test-Server $url)){" & _
  "  $psi=New-Object Diagnostics.ProcessStartInfo;" & _
  "  $psi.FileName='cmd.exe';" & _
  "  $psi.Arguments='/c npx vite --port '+$port+' --host 0.0.0.0';" & _
  "  $psi.WorkingDirectory=$project;" & _
  "  $psi.WindowStyle='Hidden'; $psi.CreateNoWindow=$true;" & _
  "  $psi.UseShellExecute=$false;" & _
  "  $proc=[Diagnostics.Process]::Start($psi);" & _
  "  $ok=$false; for($i=0;$i -lt 80;$i++){Start-Sleep -Milliseconds 500; if(Test-Server $url){$ok=$true;break}};" & _
  "  if(-not $ok){WScript.Quit(1)}" & _
  "};" & _
  "Start-Process $url"

' Run PowerShell hidden (0 = hidden window), wait=False so the launcher exits immediately.
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command """ & psCmd & """", 0, False
