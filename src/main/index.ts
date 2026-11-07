// XAgent Desktop Main Process
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { startLocalServer, stopLocalServer } from './server';

/**
 * 解析应用图标路径：
 * - 开发态：使用 src/renderer/src/assets/xagent.png
 * - 打包态：使用 process.resourcesPath 下的 icon.png（由 extraResources 提供）
 */
function resolveAppIcon(): string {
  const candidates: string[] = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'icon.png'));
  candidates.push(path.join(__dirname, '../renderer/assets/xagent.png'));
  candidates.push(path.join(__dirname, '../../src/renderer/src/assets/xagent.png'));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return path.join(__dirname, '../../src/renderer/src/assets/xagent.png');
}

// 单实例锁：防止重复启动多个进程导致端口 3456 冲突
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[XAgent Desktop] Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      if (windows[0].isMinimized()) windows[0].restore();
      windows[0].focus();
    }
  });

  function createWindow() {
    const mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 1000,
      minHeight: 650,
      backgroundColor: '#0d0d0d',
      icon: resolveAppIcon(),
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#0d0d0d',
        symbolColor: '#8e8e8e',
        height: 36
      },
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
      console.log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
    });

    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
    if (rendererUrl) {
      mainWindow.loadURL(rendererUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  }

  app.whenReady().then(() => {
    // 启动主进程内置 Hono 服务
    startLocalServer(3456);

    // 原生系统文件夹选择器
    ipcMain.handle('dialog:selectFolder', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const fullPath = result.filePaths[0];
        const folderName = path.basename(fullPath);
        return { path: fullPath, name: folderName };
      }
      return null;
    });

    // 打开系统文件管理器目录
    ipcMain.handle('shell:openPath', async (_, targetPath: string) => {
      if (targetPath) {
        await shell.openPath(targetPath);
        return true;
      }
      return false;
    });

    // 窗口操作支持
    ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
    ipcMain.on('window:maximize', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win?.isMaximized()) win.unmaximize();
      else win?.maximize();
    });
    ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close());

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    stopLocalServer();
  });
}
