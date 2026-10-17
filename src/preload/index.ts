import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppInfo,
  CommentsRequest,
  ExportRequest,
  ExportResponse,
  ScanProgress,
  ScanRequest,
  ScanResponse
} from '../shared/ipc'
import type { AppSettings, CommentResult, Snapshot } from '../shared/types'

/**
 * Cau noi duy nhat giua trang web va he thong.
 *
 * Renderer chay voi contextIsolation bat va khong co quyen Node, nen moi
 * thao tac cham vao dia, mang ngoai hay trinh duyet he thong deu phai di
 * qua danh sach ham co dinh o day. Noi dung tu mang xa hoi do la du lieu
 * khong dang tin, nen be mat tiep xuc cang hep cang tot.
 */
const api = {
  scan: (request: ScanRequest): Promise<ScanResponse> => ipcRenderer.invoke(IPC.scan, request),

  fetchComments: (request: CommentsRequest): Promise<CommentResult> =>
    ipcRenderer.invoke(IPC.fetchComments, request),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.getSettings),

  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.saveSettings, settings),

  getSnapshots: (): Promise<Snapshot[]> => ipcRenderer.invoke(IPC.getSnapshots),

  clearSnapshots: (): Promise<boolean> => ipcRenderer.invoke(IPC.clearSnapshots),

  exportResults: (request: ExportRequest): Promise<ExportResponse> =>
    ipcRenderer.invoke(IPC.exportResults, request),

  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.openExternal, url),

  copyToClipboard: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.copyToClipboard, text),

  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.getAppInfo),

  /** Dang ky nhan tien do quet. Tra ve ham de huy dang ky. */
  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: unknown, progress: ScanProgress): void => callback(progress)
    ipcRenderer.on(IPC.scanProgress, listener)
    return () => {
      ipcRenderer.removeListener(IPC.scanProgress, listener)
    }
  }
}

contextBridge.exposeInMainWorld('pulse', api)

export type PulseApi = typeof api
