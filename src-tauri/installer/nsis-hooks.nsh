; Remove a legacy per-user NSIS installation before installing the per-machine
; package. The old uninstaller runs silently and removes its own registry key,
; shortcuts, and files. A failure aborts with a clear instruction instead of
; leaving two installations behind.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MarkSI" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Removing previous per-user MarkSI installation..."
    ExecWait '$0 /S' $1
    ${If} $1 <> 0
      MessageBox MB_ICONSTOP "Could not remove the previous per-user MarkSI installation. Uninstall it from Apps & Features and run this installer again."
      Abort
    ${EndIf}
  ${EndIf}
!macroend
