/**
 * Ten kenh IPC, khai bao o mot cho duy nhat de main va renderer
 * khong the lech nhau vi mot loi go phim.
 */
export const IPC = {
  scan: 'pulse:scan',
  fetchComments: 'pulse:comments',
  getSettings: 'pulse:settings:get',
  saveSettings: 'pulse:settings:save',
  getSnapshots: 'pulse:snapshots:get',
  clearSnapshots: 'pulse:snapshots:clear',
  exportResults: 'pulse:export',
  openExternal: 'pulse:open-external',
  copyToClipboard: 'pulse:clipboard:write',
  getAppInfo: 'pulse:app-info',
  scanProgress: 'pulse:scan:progress'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface ScanRequest {
  platforms: import('./types').PlatformId[]
  limit: number
  sinceHours: number
  force?: boolean
}

export interface ScanResponse {
  results: import('./types').ProviderResult[]
  merged: import('./types').Post[]
  diff: {
    previousAt: string | null
    newPostIds: string[]
    droppedPostIds: string[]
  }
  scannedAt: string
}

export interface ScanProgress {
  platform: import('./types').PlatformId
  done: number
  total: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  settingsPath: string
  snapshotsPath: string
  encryptionAvailable: boolean
}

export interface CommentsRequest {
  post: import('./types').Post
  limit?: number
}

export interface ExportRequest {
  format: 'json' | 'csv' | 'markdown'
  results: import('./types').ProviderResult[]
  merged: import('./types').Post[]
}

export interface ExportResponse {
  saved: boolean
  path?: string
  error?: string
}
