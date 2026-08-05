$ErrorActionPreference = "Stop"
$gh = "C:\PROGRA~1\GITHUB~1\gh.exe"
$token = & $gh auth token
if (-not $token) { throw "No GitHub token from gh auth token" }
Set-Location "K:\作品集网站\portfolio"
$url = "https://x-access-token:$token@github.com/zen920307-ai/portfolio.git"
Write-Host "Pushing to GitHub..."
git -c credential.helper= push $url HEAD:main
if ($LASTEXITCODE -ne 0) { throw "git push failed with $LASTEXITCODE" }
git -c credential.helper= fetch $url
git branch --set-upstream-to=origin/main main 2>$null
Write-Host "Push complete."
