import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { AppSettings, ProviderCredentials } from '../shared/types'
import { DEFAULT_PLATFORMS } from '../shared/platforms'

/**
 * Luu cai dat ra dia duoi dang JSON.
 *
 * Rieng phan khoa API duoc ma hoa bang safeStorage cua Electron, tuc la
 * DPAPI tren Windows va Keychain tren macOS. Khoa chi giai ma duoc boi
 * chinh tai khoan nguoi dung tren chinh may do, nen mot ban sao file
 * settings bi lo ra ngoai cung khong dung duoc.
 *
 * Neu he dieu hanh khong cung cap ma hoa, app ghi khoa dang chu thuong va
 * danh dau ro trong file de nguoi dung biet ma can nhac.
 */

export const DEFAULT_SETTINGS: AppSettings = {
  credentials: {},
  enabledPlatforms: DEFAULT_PLATFORMS,
  limit: 10,
  sinceHours: 24,
  autoRefreshMinutes: 0,
  theme: 'dark',
  keepSnapshots: 30
}

interface StoredShape {
  version: 1
  settings: Omit<AppSettings, 'credentials'>
  credentials: { encrypted: true; blob: string } | { encrypted: false; value: ProviderCredentials }
}

let settingsPath: string | null = null

function filePath(): string {
  if (!settingsPath) {
    settingsPath = join(app.getPath('userData'), 'settings.json')
  }
  return settingsPath
}

function encodeCredentials(credentials: ProviderCredentials): StoredShape['credentials'] {
  const json = JSON.stringify(credentials)

  if (safeStorage.isEncryptionAvailable()) {
    return { encrypted: true, blob: safeStorage.encryptString(json).toString('base64') }
  }

  return { encrypted: false, value: credentials }
}

function decodeCredentials(stored: StoredShape['credentials'] | undefined): ProviderCredentials {
  if (!stored) return {}

  try {
    if (stored.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) return {}
      const plain = safeStorage.decryptString(Buffer.from(stored.blob, 'base64'))
      return JSON.parse(plain) as ProviderCredentials
    }
    return stored.value ?? {}
  } catch {
    // Khoa hong hoac duoc ma hoa boi mot tai khoan khac. Bo qua thay vi
    // lam sap app: nguoi dung chi can nhap lai khoa la xong.
    return {}
  }
}

export function loadSettings(): AppSettings {
  const path = filePath()
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as StoredShape
    return {
      ...DEFAULT_SETTINGS,
      ...raw.settings,
      credentials: decodeCredentials(raw.credentials)
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })

  const { credentials, ...rest } = settings
  const payload: StoredShape = {
    version: 1,
    settings: rest,
    credentials: encodeCredentials(credentials)
  }

  // Ghi ra file tam roi doi ten de tranh mat sach cai dat neu app bi tat
  // dot ngot dung luc dang ghi.
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(payload, null, 2), 'utf-8')
  renameSync(temp, path)

  return settings
}

export function settingsFilePath(): string {
  return filePath()
}

/** Cho biet khoa co dang duoc ma hoa khong, de UI noi that voi nguoi dung. */
export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
