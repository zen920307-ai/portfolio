Option Explicit

Dim scheduler, taskFolder, task

On Error Resume Next
Set scheduler = CreateObject("Schedule.Service")
scheduler.Connect
Set taskFolder = scheduler.GetFolder("\")
Set task = taskFolder.GetTask("Tang Portfolio Local Site")
task.Stop 0
On Error GoTo 0
