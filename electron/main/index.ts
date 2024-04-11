import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  shell,
  Menu,
  MenuItem,
} from 'electron';
import { release } from 'node:os';
import { join } from 'node:path';
import { requestPost } from '../api';
import { runExec } from '../api/cmd';
import { update } from './update';
// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '../');
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) {
  app.disableHardwareAcceleration();
}

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const menu = new Menu();
if (process.platform === 'darwin') {
  menu.append(
    new MenuItem({
      label: 'edit',
      submenu: [
        { label: 'copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { label: 'selectAll', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    }),
  );
}
Menu.setApplicationMenu(menu);

let win: BrowserWindow | null = null;
const preload = join(__dirname, '../preload/index.js');
const devUrl = process.env.VITE_DEV_SERVER_URL;
const prodUrl = join(process.env.DIST, 'index.html');
async function createWindow() {
  let favicon = '';
  if (process.platform === 'linux') {
    favicon = 'favicon.png';
  }
  if (process.platform === 'win32') {
    favicon = 'faviconwin.ico';
  }
  if (process.platform === 'darwin') {
    favicon = 'favicon.png';
  }

  win = new BrowserWindow({
    title: '',
    icon: join(process.env.PUBLIC, favicon),
    width: 800,
    height: 600,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
      // nodeIntegration: false, // default
      // contextIsolation: true, // default
      webSecurity: true,
    },
  });

  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools();
  } else {
    win.loadFile(prodUrl);
    // win.webContents.openDevTools();
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Apply electron-updater
  update(win);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${devUrl}#${arg}`);
  } else {
    childWindow.loadFile(prodUrl, { hash: arg });
  }
});

ipcMain.on('pin-true', () => {
  win?.setAlwaysOnTop(true);
});
ipcMain.on('pin-false', () => {
  win?.setAlwaysOnTop(false);
});
ipcMain.on('open-dev', () => {
  win?.webContents.openDevTools();
});

const fileType = ['txt'];
ipcMain.handle('open-save-dialog', (_, arg) => {
  if (win) {
    dialog
      .showSaveDialog(win, {
        defaultPath: 'test.txt',
        filters: [{ name: 'txt', extensions: fileType }],
      })
      .then((result: any) => {
        return { filePath: result.filePath };
      })
      .catch(() => {
        return { filePath: '' };
      });
  }
  return { filePath: '' };
});

ipcMain.handle('open-select-dialog', async (_, arg) => {
  if (win) {
    const openDialogReturnValue = await dialog.showOpenDialog(win, {
      title: 'select file',
      filters: [{ name: 'txt', extensions: fileType }],
      properties: ['openFile'],
    });
    const filePaths = openDialogReturnValue.filePaths;
    if (filePaths && filePaths.length > 0) {
      return { filePath: filePaths[0] };
    } else {
      return { filePath: '' };
    }
  } else {
    return { filePath: '' };
  }
});

ipcMain.handle('request-post', async (_, arg) => {
  if (win) {
    const { url, data, cookies } = arg || {};
    try {
      console.warn('【main req】', url);
      const { res, netCode, setCookie, err } = await requestPost(
        url || '',
        data || {},
        cookies || '',
      );
      console.warn('【main rep】', res);
      return { res, netCode, setCookie, err };
    } catch (err) {
      return { res: undefined, netCode: 4043, setCookie: '', err };
    }
  } else {
    return {
      res: undefined,
      netCode: 4044,
      setCookie: '',
      err: 'ipcMain post err: win empty',
    };
  }
});

ipcMain.handle('open-select-path-dialog', async (_, arg) => {
  if (win) {
    const openDialogReturnValue = await dialog.showOpenDialog(win, {
      title: 'select folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    const filePaths = openDialogReturnValue.filePaths;
    if (filePaths && filePaths.length > 0) {
      return { filePath: filePaths[0] };
    } else {
      return { filePath: '' };
    }
  } else {
    return { filePath: '' };
  }
});

ipcMain.handle('run-exec', async (_, arg) => {
  try {
    if (win) {
      const { cmdStr, cmdPath } = arg || {};
      const res = await runExec(cmdStr, cmdPath);
      return { res, code: 200 };
    } else {
      return { res: '', code: 400 };
    }
  } catch (e) {
    return { res: e, code: 500 };
  }
});
