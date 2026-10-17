import { create } from 'zustand'
import type { AppSettings, PlatformId, Post, ProviderResult } from '@shared/types'
import type { AppInfo, ScanResponse } from '@shared/ipc'
import { DEFAULT_PLATFORMS } from '@shared/platforms'

export type SortKey = 'hot' | 'recent' | 'engagement'
export type ViewTab = 'all' | PlatformId

interface PulseState {
  settings: AppSettings | null
  appInfo: AppInfo | null

  results: ProviderResult[]
  merged: Post[]
  scannedAt: string | null
  newPostIds: Set<string>

  scanning: boolean
  progress: { done: number; total: number } | null
  scanError: string | null

  tab: ViewTab
  query: string
  sortKey: SortKey
  bookmarks: Set<string>
  settingsOpen: boolean

  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  scan: (force?: boolean) => Promise<void>
  setTab: (tab: ViewTab) => void
  setQuery: (query: string) => void
  setSortKey: (key: SortKey) => void
  toggleBookmark: (id: string) => void
  togglePlatform: (platform: PlatformId) => Promise<void>
  setSettingsOpen: (open: boolean) => void
}

const BOOKMARKS_KEY = 'social-pulse:bookmarks'

/**
 * Dau trang duoc giu trong localStorage chu khong gui xuong main process.
 * Day la lua chon ca nhan, nhe, va mat di cung khong gay hau qua gi,
 * nen khong dang de phinh them mot file tren dia.
 */
function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persistBookmarks(bookmarks: Set<string>): void {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]))
  } catch {
    // Che do rieng tu hoac bo nho day. Mat dau trang khong dang de bao loi.
  }
}

export const usePulse = create<PulseState>((set, get) => ({
  settings: null,
  appInfo: null,

  results: [],
  merged: [],
  scannedAt: null,
  newPostIds: new Set(),

  scanning: false,
  progress: null,
  scanError: null,

  tab: 'all',
  query: '',
  sortKey: 'hot',
  bookmarks: loadBookmarks(),
  settingsOpen: false,

  loadSettings: async () => {
    const [settings, appInfo] = await Promise.all([
      window.pulse.getSettings(),
      window.pulse.getAppInfo()
    ])
    set({ settings, appInfo })
    applyTheme(settings.theme)
  },

  updateSettings: async (patch) => {
    const current = get().settings
    if (!current) return

    const next: AppSettings = { ...current, ...patch }
    set({ settings: next })
    if (patch.theme) applyTheme(patch.theme)

    await window.pulse.saveSettings(next)
  },

  scan: async (force = false) => {
    const settings = get().settings
    if (!settings || get().scanning) return

    const platforms = settings.enabledPlatforms
    if (platforms.length === 0) {
      set({ scanError: 'Chua chon mang nao de quet.' })
      return
    }

    set({
      scanning: true,
      scanError: null,
      progress: { done: 0, total: platforms.length }
    })

    try {
      const response: ScanResponse = await window.pulse.scan({
        platforms,
        limit: settings.limit,
        sinceHours: settings.sinceHours,
        force
      })

      set({
        results: response.results,
        merged: response.merged,
        scannedAt: response.scannedAt,
        newPostIds: new Set(response.diff.newPostIds),
        scanning: false,
        progress: null
      })
    } catch (error) {
      set({
        scanning: false,
        progress: null,
        scanError: error instanceof Error ? error.message : String(error)
      })
    }
  },

  setTab: (tab) => set({ tab }),
  setQuery: (query) => set({ query }),
  setSortKey: (sortKey) => set({ sortKey }),

  toggleBookmark: (id) => {
    const next = new Set(get().bookmarks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    persistBookmarks(next)
    set({ bookmarks: next })
  },

  togglePlatform: async (platform) => {
    const settings = get().settings
    if (!settings) return

    const enabled = settings.enabledPlatforms.includes(platform)
      ? settings.enabledPlatforms.filter((id) => id !== platform)
      : [...settings.enabledPlatforms, platform]

    // Giu dung thu tu khai bao goc de danh sach khong nhay lung tung
    // moi lan nguoi dung bat tat mot mang.
    const ordered = DEFAULT_PLATFORMS.concat(
      enabled.filter((id) => !DEFAULT_PLATFORMS.includes(id))
    ).filter((id) => enabled.includes(id))

    await get().updateSettings({ enabledPlatforms: ordered })
  },

  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}))

export function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export interface VisiblePostsInput {
  merged: Post[]
  results: ProviderResult[]
  tab: ViewTab
  query: string
  sortKey: SortKey
}

/**
 * Loc va sap xep bai theo trang thai hien tai cua giao dien.
 *
 * Ham nhan tung manh trang thai tuong minh thay vi doc ca store, de noi goi
 * khai bao duoc dung nhung gi minh phu thuoc vao. Doc store ben trong se
 * khien bo nho dem khong biet khi nao can tinh lai.
 */
export function selectVisiblePosts(state: VisiblePostsInput): Post[] {
  const source =
    state.tab === 'all'
      ? state.merged
      : (state.results.find((result) => result.platform === state.tab)?.posts ?? [])

  const needle = state.query.trim().toLowerCase()
  const filtered = needle
    ? source.filter((post) => {
        const haystack = [post.title ?? '', post.content, post.author.name, post.author.handle ?? '']
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
    : source

  const sorted = [...filtered]
  if (state.sortKey === 'recent') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } else if (state.sortKey === 'engagement') {
    sorted.sort((a, b) => b.engagement - a.engagement)
  }
  // 'hot' giu nguyen thu tu do tang du lieu da xep san.

  return sorted
}
