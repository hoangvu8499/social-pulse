import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, Search, SunMoon, X } from 'lucide-react'
import type { AppSettings, Post, ProviderResult } from '@shared/types'
import type { SortKey } from '../store'
import { formatDateTime } from '../lib/format'

interface ToolbarProps {
  settings: AppSettings
  results: ProviderResult[]
  merged: Post[]
  scanning: boolean
  progress: { done: number; total: number } | null
  scannedAt: string | null
  query: string
  sortKey: SortKey
  onQueryChange: (query: string) => void
  onSortChange: (key: SortKey) => void
  onScan: (force: boolean) => void
  onChange: (patch: Partial<AppSettings>) => void
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'hot', label: 'Nong nhat' },
  { key: 'recent', label: 'Moi nhat' },
  { key: 'engagement', label: 'Tuong tac' }
]

const FORMATS = [
  { format: 'csv' as const, label: 'CSV cho Excel' },
  { format: 'json' as const, label: 'JSON day du' },
  { format: 'markdown' as const, label: 'Markdown de doc' }
]

export function Toolbar({
  settings,
  results,
  merged,
  scanning,
  progress,
  scannedAt,
  query,
  sortKey,
  onQueryChange,
  onSortChange,
  onScan,
  onChange
}: ToolbarProps): React.JSX.Element {
  const [exportOpen, setExportOpen] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  // Menu phai dong khi bam ra ngoai hoac bam Esc. Khong co phan nay thi menu
  // treo lai tren man hinh va che mat noi dung ben duoi.
  useEffect(() => {
    if (!exportOpen) return

    function onPointerDown(event: MouseEvent): void {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setExportOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [exportOpen])

  const hasData = merged.length > 0

  async function doExport(format: 'csv' | 'json' | 'markdown'): Promise<void> {
    setExportOpen(false)
    const response = await window.pulse.exportResults({ format, results, merged })

    if (response.saved && response.path) {
      setExportNote(`Da luu vao ${response.path}`)
    } else if (response.error) {
      setExportNote(`Khong luu duoc: ${response.error}`)
    }

    if (response.saved || response.error) {
      setTimeout(() => setExportNote(null), 5000)
    }
  }

  function cycleTheme(): void {
    const next: AppSettings['theme'] =
      settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'system' : 'dark'
    onChange({ theme: next })
  }

  return (
    <div className="flex flex-col">
      <div
        className="no-select flex flex-wrap items-center gap-2 border-b px-4 py-2.5"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => onScan(true)}
          disabled={scanning}
          className="relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium transition-opacity disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} aria-hidden />
          {scanning
            ? progress
              ? `Dang quet ${progress.done}/${progress.total}`
              : 'Dang quet'
            : 'Quet ngay'}
        </button>

        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tim trong ket qua da quet"
            className="w-full rounded-lg border py-2 pl-8 pr-8 text-[12.5px] outline-none"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
            aria-label="Tim trong ket qua da quet"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Xoa tu khoa tim kiem"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-0.5 rounded-lg p-0.5"
          style={{ background: 'var(--surface-2)' }}
          role="group"
          aria-label="Sap xep"
        >
          {SORTS.map((sort) => (
            <button
              key={sort.key}
              type="button"
              onClick={() => onSortChange(sort.key)}
              className="rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors"
              style={
                sortKey === sort.key
                  ? { background: 'var(--surface-raised)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-muted)' }
              }
              aria-pressed={sortKey === sort.key}
            >
              {sort.label}
            </button>
          ))}
        </div>

        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((open) => !open)}
            disabled={!hasData}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] transition-colors disabled:opacity-45"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
              background: 'var(--surface-2)'
            }}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download size={14} aria-hidden />
            Xuat
          </button>

          {exportOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border py-1"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border-strong)',
                boxShadow: 'var(--shadow-card)'
              }}
              role="menu"
            >
              {FORMATS.map((item) => (
                <button
                  key={item.format}
                  type="button"
                  onClick={() => void doExport(item.format)}
                  className="block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--text-secondary)' }}
                  role="menuitem"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={cycleTheme}
          className="rounded-lg border p-2 transition-colors"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
            background: 'var(--surface-2)'
          }}
          title={`Giao dien: ${settings.theme}`}
          aria-label="Doi giao dien sang toi"
        >
          <SunMoon size={14} />
        </button>
      </div>

      {(scannedAt || exportNote) && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-1.5 text-[11px]"
          style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}
        >
          <span>{scannedAt ? `Quet luc ${formatDateTime(scannedAt)}` : ''}</span>
          {exportNote && <span style={{ color: 'var(--text-secondary)' }}>{exportNote}</span>}
        </div>
      )}
    </div>
  )
}
