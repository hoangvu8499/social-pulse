import { AlertCircle, CheckCircle2, CircleSlash, KeyRound, Settings, Loader2 } from 'lucide-react'
import type { AppSettings, PlatformId, ProviderResult, ProviderStatus } from '@shared/types'
import { PLATFORMS } from '@shared/platforms'

interface SidebarProps {
  settings: AppSettings
  results: ProviderResult[]
  scanning: boolean
  dark: boolean
  onTogglePlatform: (platform: PlatformId) => void
  onChange: (patch: Partial<AppSettings>) => void
  onOpenSettings: () => void
}

const WINDOWS = [
  { hours: 1, label: '1 gio' },
  { hours: 6, label: '6 gio' },
  { hours: 24, label: '24 gio' },
  { hours: 72, label: '3 ngay' },
  { hours: 168, label: '7 ngay' }
]

const LIMITS = [5, 10, 20, 30]

function StatusIcon({ status }: { status: ProviderStatus | 'idle' }): React.JSX.Element {
  const size = 13
  switch (status) {
    case 'ok':
      return <CheckCircle2 size={size} style={{ color: 'var(--good)' }} aria-hidden />
    case 'needs-credentials':
      return <KeyRound size={size} style={{ color: 'var(--warning)' }} aria-hidden />
    case 'error':
      return <AlertCircle size={size} style={{ color: 'var(--critical)' }} aria-hidden />
    case 'empty':
    case 'unsupported':
      return <CircleSlash size={size} style={{ color: 'var(--text-muted)' }} aria-hidden />
    default:
      return <span style={{ width: size, display: 'inline-block' }} aria-hidden />
  }
}

function statusText(result: ProviderResult | undefined): string {
  if (!result) return 'chua quet'
  switch (result.status) {
    case 'ok':
      return `${result.posts.length} bai${result.fromCache ? ' (cache)' : ''}`
    case 'empty':
      return 'khong co bai moi'
    case 'needs-credentials':
      return 'can khoa'
    case 'unsupported':
      return 'khong ho tro'
    default:
      return 'loi'
  }
}

export function Sidebar({
  settings,
  results,
  scanning,
  dark,
  onTogglePlatform,
  onChange,
  onOpenSettings
}: SidebarProps): React.JSX.Element {
  const byPlatform = new Map(results.map((result) => [result.platform, result]))

  return (
    <aside
      className="no-select flex h-full w-64 shrink-0 flex-col border-r"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3.5">
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
        >
          SP
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight">Social Pulse</div>
          <div className="text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            Bai nong nhat trong ngay
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <h2
          className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Mang xa hoi
        </h2>

        <ul className="flex flex-col gap-0.5">
          {PLATFORMS.map((platform) => {
            const enabled = settings.enabledPlatforms.includes(platform.id)
            const result = byPlatform.get(platform.id)
            const accent = dark ? platform.accentDark : platform.accentLight

            return (
              <li key={platform.id}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)]"
                  title={platform.requirement}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onTogglePlatform(platform.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                    aria-label={`Bat tat ${platform.label}`}
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: accent, opacity: enabled ? 1 : 0.35 }}
                    aria-hidden
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-[12.5px]"
                    style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {platform.label}
                  </span>

                  {scanning && enabled ? (
                    <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <StatusIcon status={result?.status ?? 'idle'} />
                  )}
                </label>

                {enabled && result && (
                  <div
                    className="pl-[46px] pr-2 pb-1 text-[10.5px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {statusText(result)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <h2
          className="px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Khung thoi gian
        </h2>
        <div className="flex flex-wrap gap-1 px-2">
          {WINDOWS.map((window) => (
            <button
              key={window.hours}
              type="button"
              onClick={() => onChange({ sinceHours: window.hours })}
              className="rounded-md px-2 py-1 text-[11.5px] transition-colors"
              style={
                settings.sinceHours === window.hours
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }
              }
              aria-pressed={settings.sinceHours === window.hours}
            >
              {window.label}
            </button>
          ))}
        </div>

        <h2
          className="px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          So bai moi mang
        </h2>
        <div className="flex flex-wrap gap-1 px-2 pb-3">
          {LIMITS.map((limit) => (
            <button
              key={limit}
              type="button"
              onClick={() => onChange({ limit })}
              className="rounded-md px-2.5 py-1 text-[11.5px] tabular-nums transition-colors"
              style={
                settings.limit === limit
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }
              }
              aria-pressed={settings.limit === limit}
            >
              {limit}
            </button>
          ))}
        </div>
      </nav>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-2 border-t px-4 py-3 text-[12.5px] transition-colors hover:bg-[var(--surface-2)]"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
      >
        <Settings size={14} aria-hidden />
        Cai dat va khoa API
      </button>
    </aside>
  )
}
