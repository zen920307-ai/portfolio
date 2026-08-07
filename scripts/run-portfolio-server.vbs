Option Explicit

Dim shell, fso, scriptsDir, projectRoot, nodePath, vitePath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptsDir)
nodePath = "C:\Program Files\nodejs\node.exe"
vitePath = fso.BuildPath(projectRoot, "node_modules\vite\bin\vite.js")

If Not fso.FileExists(nodePath) Then WScript.Quit 2
If Not fso.FileExists(vitePath) Then WScript.Quit 3

shell.CurrentDirectory = projectRoot
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & vitePath & Chr(34) & " --host 127.0.0.1 --port 4173 --strictPort"

' Run fully hidden and wait so the scheduled task lives with the server.
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
