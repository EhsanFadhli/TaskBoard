const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const fs   = require('fs');
const path = require('path');

let win;
let forceQuit = false; // set to true once the renderer says it's OK to close

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  // Intercept the close button — ask the renderer first
  win.on('close', e => {
    if (forceQuit) return; // renderer already confirmed → let it through
    e.preventDefault();    // block the close
    win.webContents.send('app:closing'); // tell renderer to check unsaved state
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Renderer says "yes, close for real"
ipcMain.on('app:confirm-close', () => {
  forceQuit = true;
  win.close();
});

// ── Open file dialog ──────────────────────────────────────────────────────────
ipcMain.handle('dialog:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open TaskBoard file',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const filePath = filePaths[0];
  const content  = fs.readFileSync(filePath, 'utf8');
  return { filePath, content };
});

// ── Save file (overwrite current path directly) ───────────────────────────────
ipcMain.handle('file:save', async (_, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Save As dialog (first save / new file) ────────────────────────────────────
ipcMain.handle('dialog:saveAs', async (_, { suggestedName, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save TaskBoard file',
    defaultPath: suggestedName || 'tasks.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
});
