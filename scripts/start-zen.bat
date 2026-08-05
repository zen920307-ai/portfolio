@echo off
chcp 65001 >nul
setlocal

set "PORT=5174"
set "URL=http://localhost:%PORT%/"
set "PROJECT=%~dp0.."

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$port=%PORT%; $url='%URL%'; $project='%PROJECT%';" ^
  "if($project.EndsWith('\')){$project=$project.TrimEnd('\')};" ^
  "function Test-Server($u){try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; return $r.StatusCode -eq 200}catch{return $false}};" ^
  "if(-not (Test-Server $url)){" ^
  "  Write-Host 'Starting dev server on port' $port '...';" ^
  "  $psi=New-Object Diagnostics.ProcessStartInfo;" ^
  "  $psi.FileName='cmd.exe';" ^
  "  $psi.Arguments='/c npx vite --port '+$port+' --host 0.0.0.0';" ^
  "  $psi.WorkingDirectory=$project;" ^
  "  $psi.WindowStyle='Hidden'; $psi.CreateNoWindow=$true;" ^
  "  $psi.UseShellExecute=$false;" ^
  "  $proc=[Diagnostics.Process]::Start($psi);" ^
  "  $ok=$false; for($i=0;$i -lt 80;$i++){Start-Sleep -Milliseconds 500; if(Test-Server $url){$ok=$true;break}};" ^
  "  if(-not $ok){Write-Host 'ERROR: dev server did not become ready.'; exit 1};" ^
  "  Write-Host 'Server ready.'" ^
  "} else { Write-Host 'Server already running.' };" ^
  "Start-Process $url;" ^
  "Write-Host 'Opened' $url"

endlocal
