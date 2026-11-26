# Registers (or replaces) the Windows scheduled task for the Live Project Chat Summary daily job (owner, 2026-11-26).
# Starts at 8:00 and then every 120 minutes until 22:00, so a PC that was off at 8:00 tries again 2 hours later, and again, until a run
# succeeds; scripts/space-daily.ts skips every later start once today's run has succeeded. "Start when available" also catches a PC that
# was off through a whole start time. Runs on battery too. Run it once:
#   powershell -ExecutionPolicy Bypass -File scripts\space-daily-schedule.ps1
$cmd = Join-Path $PSScriptRoot "space-daily.cmd"
$action = New-ScheduledTaskAction -Execute $cmd
$trigger = New-ScheduledTaskTrigger -Daily -At 8am
$repeat = New-ScheduledTaskTrigger -Once -At 8am -RepetitionInterval (New-TimeSpan -Minutes 120) -RepetitionDuration (New-TimeSpan -Hours 14)
$trigger.Repetition = $repeat.Repetition
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "Live Project Chat Summary" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
$task = Get-ScheduledTask -TaskName "Live Project Chat Summary"
$t = $task.Triggers[0]
Write-Output ("Task '{0}' is {1}. Starts daily at 08:00, repeats every {2} for {3}." -f $task.TaskName, $task.State, $t.Repetition.Interval, $t.Repetition.Duration)
