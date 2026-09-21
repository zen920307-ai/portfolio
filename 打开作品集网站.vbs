' Wrapper kept for the Chinese filename. Real launcher is open-local-site.vbs.
Option Explicit
Dim fso, sh, launcher
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
launcher = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "open-local-site.vbs")
If Not fso.FileExists(launcher) Then
  MsgBox "Local site launcher files were not found.", vbCritical, "ZEN DESIGN"
  WScript.Quit 1
End If
sh.Run "wscript.exe """ & launcher & """", 1, False
