const { desktop } = require('./package.json');
module.exports = {
  ...desktop,
  directories: { output: 'release', buildResources: 'build' },
  asar: true,
  files: ['electron/**/*', 'desktop-dist/**/*', 'dist/**/*', 'package.json', '!**/*.map'],
  extraResources: [{ from: 'dist-python/downloader-service', to: 'python' }, { from: 'resources/icon.ico', to: 'icon.ico' }, { from: 'resources/THIRD-PARTY-NOTICES.txt', to: 'THIRD-PARTY-NOTICES.txt' }, { from: 'resources/PYTHON-NOTICES.txt', to: 'PYTHON-NOTICES.txt' }],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'resources/icon.ico', requestedExecutionLevel: 'asInvoker' },
  nsis: {
    oneClick: false, perMachine: false, allowElevation: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true, createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
    artifactName: '${productName}-Setup-${version}.${ext}',
    installerLanguages: ['pt_BR'], language: '1046',
    include: 'build/installer.nsh', installerHeader: 'build/installer-header.bmp',
    installerSidebar: 'build/installer-sidebar.bmp', uninstallerSidebar: 'build/installer-sidebar.bmp'
  }
};
