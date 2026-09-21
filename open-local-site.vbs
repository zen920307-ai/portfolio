' ZEN DESIGN local site launcher
' NOTE: keep this file ASCII-only. wscript reads .vbs as ANSI,
' so any non-ASCII character in the paths would break the launcher.
Option Explicit

Dim fso, sh, projectRoot, nodeExe, chromeExe, restartScript, url, stamp, exitCode
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

projectRoot = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = projectRoot

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
  nodeExe = "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-2\node.exe"
End If
If Not fso.FileExists(nodeExe) Then
  nodeExe = "node.exe"
End If

chromeExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
restartScript = fso.BuildPath(projectRoot, "scripts\restart-local-site.mjs")

stamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
url = "http://127.0.0.1:4173/?open=" & stamp

If Not IsSiteReady("http://127.0.0.1:4173/") Or Not IsSiteReady("http://127.0.0.1:4173/src/Admin.jsx") Then
  If Not fso.FileExists(nodeExe) Or Not fso.FileExists(restartScript) Then
    MsgBox "Local site launcher files were not found.", vbCritical, "ZEN DESIGN"
    WScript.Quit 1
  End If
  exitCode = sh.Run("""" & nodeExe & """ """ & restartScript & """", 0, True)
  If exitCode <> 0 Or Not IsSiteReady("http://127.0.0.1:4173/") Then
    MsgBox "The local site could not start. Please check Node.js and project dependencies.", vbCritical, "ZEN DESIGN"
    WScript.Quit 1
  End If
End If

' Open Chrome from this user-initiated script so Win11 allows foreground focus.
If fso.FileExists(chromeExe) Then
  sh.Run """" & chromeExe & """ --new-tab " & url, 1, False
Else
  sh.Run "cmd /c start """" " & url, 1, False
End If
WScript.Sleep 400
sh.AppActivate "Google Chrome"

Function IsSiteReady(probeUrl)
  Dim request
  On Error Resume Next
  Set request = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  request.setTimeouts 500, 500, 1000, 1000
  request.open "GET", probeUrl, False
  request.send
  IsSiteReady = (Err.Number = 0 And request.status >= 200 And request.status < 500)
  Err.Clear
  On Error GoTo 0
End Function
