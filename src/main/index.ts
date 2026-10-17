import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { IPC } from '../shared/ipc'
import type {
  AppInfo,
  CommentsRequest,
  ExportRequest,
  ExportResponse,
  ScanRequest,
  ScanResponse
} from '../shared/ipc'
import type { AppSettings, CommentResult } from '../shared/types'
import { fetchComments, fetchPlatform, mergeRanked } from './providers/index'
import { loadSettings, saveSettings, settingsFilePath, encryptionAvailable } from './settings'
import {
  addSnapshot,
  clearSnapshots,
  diffWithPrevious,
  loadSnapshots,
  snapshotsFilePath
} from './snapshots'
import { buildExport } from './exporters'
import { clearCache } from './cache'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Dong bo giao dien khung cua so voi giao dien app. Khong lam buoc nay thi
  // tren Windows thanh tieu de van trang toat trong khi than app mau toi.
  const settings = loadSettings()
  nativeTheme.themeSource = settings.theme

  // Chon kich thuoc vua voi man hinh dang dung, chu khong co dinh mot con so
  // co the lon hon ca man hinh cua may nho.
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.max(940, Math.min(1280, workArea.width - 120))
  const height = Math.max(600, Math.min(860, workArea.height - 80))

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 940,
    minHeight: 600,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0e14' : '#f7f8fa',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Lien ket ra ngoai luon mo bang trinh duyet he thong. Cho phep dieu huong
  // ben trong cua so app se bien no thanh mot trinh duyet khong co thanh dia
  // chi, tuc la nguoi dung khong con cach nao biet minh dang o trang nao.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevServer = process.env.ELECTRON_RENDERER_URL
      ? url.startsWith(process.env.ELECTRON_RENDERER_URL)
      : false
    if (!isDevServer && !url.startsWith('file://')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.getSettings, (): AppSettings => loadSettings())

  ipcMain.handle(IPC.saveSettings, (_event, next: AppSettings): AppSettings => {
    // Doi khoa hay khung thoi gian thi du lieu dang cache khong con dung nua.
    clearCache()
    nativeTheme.themeSource = next.theme
    return saveSettings(next)
  })

  ipcMain.handle(IPC.scan, async (event, request: ScanRequest): Promise<ScanResponse> => {
    const settings = loadSettings()
    const options = {
      platforms: request.platforms,
      limit: request.limit,
      sinceHours: request.sinceHours,
      credentials: settings.credentials
    }

    let done = 0
    const total = request.platforms.length

    // Quet song song nhung bao tien do ngay khi tung mang xong, de nguoi dung
    // thay ket qua nho giot thay vi ngoi nhin mot o quay vong cho tat ca.
    const results = await Promise.all(
      request.platforms.map(async (platform) => {
        const result = await fetchPlatform(platform, options, { force: request.force })
        done += 1
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC.scanProgress, { platform, done, total })
        }
        return result
      })
    )

    const order = new Map(request.platforms.map((platform, index) => [platform, index]))
    results.sort((a, b) => (order.get(a.platform) ?? 0) - (order.get(b.platform) ?? 0))

    const diff = diffWithPrevious(results)
    addSnapshot(
      results,
      { platforms: request.platforms, limit: request.limit, sinceHours: request.sinceHours },
      settings.keepSnapshots
    )

    return {
      results,
      merged: mergeRanked(results, request.limit),
      diff,
      scannedAt: new Date().toISOString()
    }
  })

  ipcMain.handle(
    IPC.fetchComments,
    async (_event, request: CommentsRequest): Promise<CommentResult> => {
      const settings = loadSettings()
      return fetchComments(request.post, settings.credentials, request.limit ?? 5)
    }
  )

  ipcMain.handle(IPC.getSnapshots, () => loadSnapshots())

  ipcMain.handle(IPC.clearSnapshots, () => {
    clearSnapshots()
    return true
  })

  ipcMain.handle(IPC.exportResults, async (_event, request: ExportRequest): Promise<ExportResponse> => {
    const { content, extension } = buildExport(request.format, request.results, request.merged)
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Luu ket qua quet',
      defaultPath: `social-pulse-${stamp}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    })

    if (canceled || !filePath) return { saved: false }

    try {
      writeFileSync(filePath, content, 'utf-8')
      return { saved: true, path: filePath }
    } catch (error) {
      return { saved: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    // Chi mo http va https. Khong loc thi mot duong dan dang file: hoac
    // mot giao thuc la co the duoc dung de chay thu gi do tren may.
    if (!/^https?:\/\//i.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.copyToClipboard, (_event, text: string) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  ipcMain.handle(IPC.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    settingsPath: settingsFilePath(),
    snapshotsPath: snapshotsFilePath(),
    encryptionAvailable: encryptionAvailable()
  }))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
