; Retain electron-builder's extraction, shortcuts, upgrade and uninstall logic.
; Theme native MUI pages using the existing application palette.
!define MUI_BGCOLOR "100B22"
!define MUI_TEXTCOLOR "F8F7FC"
!define MUI_INSTFILESPAGE_COLORS "F8F7FC 100B22"
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT "Seu downloader está pronto para ser instalado.$\r$\n$\r$\nImagens e vídeos públicos em alta qualidade.$\r$\n$\r$\nTodos os componentes estão incluídos. Não é necessário instalar outras ferramentas.$\r$\n$\r$\nVersão ${VERSION}"
!define MUI_FINISHPAGE_TITLE "Instalação concluída!"
!define MUI_FINISHPAGE_TEXT "O ${PRODUCT_NAME} está pronto.$\r$\n$\r$\nCole um link público e salve sua mídia em alta qualidade."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${PRODUCT_NAME}"
!define MUI_UNFINISHPAGE_TEXT "O aplicativo foi removido.$\r$\nSeus downloads pessoais foram preservados."
!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.InstaTheme
!else
  !define MUI_CUSTOMFUNCTION_GUIINIT InstaTheme
!endif

!macro customWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstaWelcomeTheme
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstaThemePage
!macroend

!macro customFinishPage
  Function InstaStartApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  FunctionEnd
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION InstaStartApp
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstaThemePage
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.InstaThemePage
  !insertmacro MUI_UNPAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.InstaThemePage
!macroend

!macro customUninstallPage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.InstaThemePage
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro InstaThemeControls
  SetCtlColors $HWNDPARENT "F8F7FC" "100B22"
  GetDlgItem $0 $HWNDPARENT 1
  SetCtlColors $0 "F8F7FC" "9A48F7"
  GetDlgItem $0 $HWNDPARENT 2
  SetCtlColors $0 "C5C1D0" "100B22"
  GetDlgItem $0 $HWNDPARENT 3
  SetCtlColors $0 "C5C1D0" "100B22"
  GetDlgItem $0 $HWNDPARENT 1028
  SetCtlColors $0 "AAA5B9" "100B22"
  ; Native dark title bar on supported Windows; older versions ignore this.
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4) i .r0'
!macroend

!ifdef BUILD_UNINSTALLER
  Function un.InstaTheme
    !insertmacro InstaThemeControls
  FunctionEnd
!else
  Function InstaWelcomeTheme
    Call InstaThemePage
    GetDlgItem $0 $HWNDPARENT 1
    SendMessage $0 0x000C 0 "STR:Instalar"
  FunctionEnd
  Function InstaTheme
    !insertmacro InstaThemeControls
  FunctionEnd
!endif

!macro InstaRecursiveTheme PREFIX
  Function ${PREFIX}InstaThemePage
    Push $HWNDPARENT
    Call ${PREFIX}InstaThemeTree
  FunctionEnd
  Function ${PREFIX}InstaThemeTree
    Exch $0
    Push $1
    Push $2
    Push $3
    System::Call 'user32::GetClassName(p r0, t .r2, i 1024)'
    StrCmp $2 "Button" 0 +5
      System::Call 'user32::GetWindowLong(p r0, i -16) i .r3'
      IntOp $3 $3 & 0xF
      StrCmp $3 3 0 +2
        System::Call 'uxtheme::SetWindowTheme(p r0, w "", w "")'
    StrCmp $2 "msctls_progress32" 0 +4
      System::Call 'uxtheme::SetWindowTheme(p r0, w "", w "")'
      SendMessage $0 0x0409 0 0x813DFF
      SendMessage $0 0x2001 0 0x220B10
    SetCtlColors $0 "F8F7FC" "100B22"
    System::Call 'user32::GetWindow(p r0, i 5) p .r1'
    loop_${PREFIX}:
      StrCmp $1 0 done_${PREFIX}
      Push $1
      Call ${PREFIX}InstaThemeTree
      System::Call 'user32::GetWindow(p r1, i 2) p .r1'
      Goto loop_${PREFIX}
    done_${PREFIX}:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd
!macroend
!ifdef BUILD_UNINSTALLER
  !insertmacro InstaRecursiveTheme "un."
!else
  !insertmacro InstaRecursiveTheme ""
!endif
