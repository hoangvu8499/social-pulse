import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Flame, Inbox, KeyRound } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PLATFORM_MAP } from '@shared/platforms'
import type { PlatformId } from '@shared/types'
import { selectVisiblePosts, usePulse } from './store'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { PostCard } from './components/PostCard'
import { PlatformActivity } from './components/PlatformActivity'
import { SettingsDialog } from './components/SettingsDialog'

/** Theo doi che do toi dang thuc su ap dung, de chon dung buoc mau cho cham nen tang. */
function useDarkMode(theme: 'dark' | 'light' | 'system' | undefined): boolean {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (theme === 'dark') return true
  if (theme === 'light') return false
  return systemDark
}

function StatusNotice({
  platform,
  status,
  message,
  onOpenSettings
}: {
  platform: PlatformId
  status: string
  message?: string
  onOpenSettings: () => void
}): React.JSX.Element {
  const meta = PLATFORM_MAP[platform]
  const needsKey = status === 'needs-credentials'

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[11.5px]"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-secondary)'
      }}
    >
      {needsKey ? (
        <KeyRound size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} aria-hidden />
      ) : (
        <AlertTriangle
          size={14}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--critical)' }}
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {meta?.label ?? platform}
        </span>
        <span> - {message ?? 'Khong lay duoc du lieu.'}</span>
      </div>

      {needsKey && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="shrink-0 rounded px-2 py-0.5 text-[11px] underline"
          style={{ color: 'var(--accent)' }}
        >
          Nhap khoa
        </button>
      )}
    </div>
  )
}

export default function App(): React.JSX.Element {
  const state = usePulse(
    useShallow((store) => ({
      settings: store.settings,
      appInfo: store.appInfo,
      results: store.results,
      merged: store.merged,
      scannedAt: store.scannedAt,
      newPostIds: store.newPostIds,
      scanning: store.scanning,
      progress: store.progress,
      scanError: store.scanError,
      tab: store.tab,
      query: store.query,
      sortKey: store.sortKey,
      bookmarks: store.bookmarks,
      settingsOpen: store.settingsOpen
    }))
  )

  const actions = usePulse(
    useShallow((store) => ({
      loadSettings: store.loadSettings,
      updateSettings: store.updateSettings,
      scan: store.scan,
      setTab: store.setTab,
      setQuery: store.setQuery,
      setSortKey: store.setSortKey,
      toggleBookmark: store.toggleBookmark,
      togglePlatform: store.togglePlatform,
      setSettingsOpen: store.setSettingsOpen
    }))
  )

  const dark = useDarkMode(state.settings?.theme)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void actions.loadSettings()
  }, [actions])

  // Tu dong quet lai theo nhip nguoi dung dat. Dat 0 la tat han.
  useEffect(() => {
    const minutes = state.settings?.autoRefreshMinutes ?? 0
    if (minutes <= 0) return

    const timer = setInterval(() => void actions.scan(false), minutes * 60_000)
    return () => clearInterval(timer)
  }, [state.settings?.autoRefreshMinutes, actions])

  // Phim tat: Ctrl+R quet lai, Ctrl+F nhay vao o tim kiem.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey)) return

      if (event.key === 'r') {
        event.preventDefault()
        void actions.scan(true)
      }

      if (event.key === 'f') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])

  // Callback on dinh giua cac lan ve lai. Neu truyen ham moi moi lan thi
  // memo cua the bai viet mat tac dung hoan toan.
  const openSettings = useCallback(() => actions.setSettingsOpen(true), [actions])

  const visible = useMemo(
    () =>
      selectVisiblePosts({
        merged: state.merged,
        results: state.results,
        tab: state.tab,
        query: state.query,
        sortKey: state.sortKey
      }),
    [state.merged, state.results, state.tab, state.query, state.sortKey]
  )

  const problems = state.results.filter((result) => result.status !== 'ok' && result.status !== 'empty')
  const okTabs = state.results.filter((result) => result.posts.length > 0)

  if (!state.settings) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Dang khoi dong...
      </div>
    )
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-0)' }}>
      <Sidebar
        settings={state.settings}
        results={state.results}
        scanning={state.scanning}
        dark={dark}
        onTogglePlatform={(platform) => void actions.togglePlatform(platform)}
        onChange={(patch) => void actions.updateSettings(patch)}
        onOpenSettings={() => actions.setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          settings={state.settings}
          results={state.results}
          merged={state.merged}
          scanning={state.scanning}
          progress={state.progress}
          scannedAt={state.scannedAt}
          query={state.query}
          sortKey={state.sortKey}
          onQueryChange={actions.setQuery}
          onSortChange={actions.setSortKey}
          onScan={(force) => void actions.scan(force)}
          onChange={(patch) => void actions.updateSettings(patch)}
        />

        {okTabs.length > 0 && (
          <div
            className="no-select flex gap-1 overflow-x-auto border-b px-4 py-1.5"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            role="tablist"
          >
            <button
              type="button"
              onClick={() => actions.setTab('all')}
              className="shrink-0 rounded-md px-3 py-1.5 text-[12px] transition-colors"
              style={
                state.tab === 'all'
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { color: 'var(--text-muted)' }
              }
              role="tab"
              aria-selected={state.tab === 'all'}
            >
              Tong hop
            </button>

            {okTabs.map((result) => {
              const meta = PLATFORM_MAP[result.platform]
              const active = state.tab === result.platform
              return (
                <button
                  key={result.platform}
                  type="button"
                  onClick={() => actions.setTab(result.platform)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] transition-colors"
                  style={
                    active
                      ? { background: 'var(--surface-2)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-muted)' }
                  }
                  role="tab"
                  aria-selected={active}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: dark ? meta?.accentDark : meta?.accentLight }}
                    aria-hidden
                  />
                  {meta?.label ?? result.platform}
                  <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {result.posts.length}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {state.scanError && (
            <div
              className="mb-3 rounded-lg border px-3 py-2.5 text-[12px]"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--critical)',
                color: 'var(--text-secondary)'
              }}
            >
              {state.scanError}
            </div>
          )}

          {state.results.length === 0 && !state.scanning && (
            <div
              className="mx-auto mt-16 max-w-md text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              <Flame size={34} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} aria-hidden />
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Chua co du lieu nao
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed">
                Bam Quet ngay de lay nhung bai dang nong nhat trong{' '}
                {state.settings.sinceHours} gio qua tu cac mang ben trai.
              </p>
              <p className="mt-2 text-[11.5px]">Phim tat: Ctrl+R de quet lai, Ctrl+F de tim</p>
            </div>
          )}

          {state.tab === 'all' && state.results.length > 0 && (
            <div className="mb-4">
              <PlatformActivity results={state.results} />
            </div>
          )}

          {problems.length > 0 && state.tab === 'all' && (
            <div className="mb-4 flex flex-col gap-1.5">
              {problems.map((result) => (
                <StatusNotice
                  key={result.platform}
                  platform={result.platform}
                  status={result.status}
                  message={result.message}
                  onOpenSettings={openSettings}
                />
              ))}
            </div>
          )}

          {visible.length > 0 ? (
            <div className="flex flex-col gap-2">
              {visible.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  rank={index + 1}
                  isNew={state.newPostIds.has(post.id)}
                  bookmarked={state.bookmarks.has(post.id)}
                  onToggleBookmark={actions.toggleBookmark}
                  dark={dark}
                  onOpenSettings={openSettings}
                />
              ))}
            </div>
          ) : (
            state.results.length > 0 && (
              <div className="mt-12 text-center" style={{ color: 'var(--text-muted)' }}>
                <Inbox size={28} className="mx-auto mb-2" aria-hidden />
                <p className="text-[12.5px]">
                  {state.query
                    ? `Khong co bai nao khop voi "${state.query}"`
                    : 'Khong co bai nao trong khung thoi gian nay'}
                </p>
              </div>
            )
          )}
        </div>
      </main>

      {state.settingsOpen && (
        <SettingsDialog
          settings={state.settings}
          appInfo={state.appInfo}
          onClose={() => actions.setSettingsOpen(false)}
          onSave={(patch) => void actions.updateSettings(patch)}
        />
      )}
    </div>
  )
}
