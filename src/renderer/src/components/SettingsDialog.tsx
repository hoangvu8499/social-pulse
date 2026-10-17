import { useEffect, useState } from 'react'
import { Lock, ShieldAlert, X } from 'lucide-react'
import type { AppSettings, ProviderCredentials } from '@shared/types'
import type { AppInfo } from '@shared/ipc'

interface SettingsDialogProps {
  settings: AppSettings
  appInfo: AppInfo | null
  onClose: () => void
  onSave: (patch: Partial<AppSettings>) => void
}

interface Field {
  key: keyof ProviderCredentials
  label: string
  placeholder: string
  secret?: boolean
  help?: string
}

interface Group {
  title: string
  note: string
  fields: Field[]
}

const GROUPS: Group[] = [
  {
    title: 'Reddit',
    note: 'Khong co khoa thi app van chay bang RSS cong khai, nhung feed do khong kem so lieu tuong tac va bi chan sau khoang mot yeu cau moi phut. Tao mot app kieu script tai reddit.com/prefs/apps de co day du so lieu.',
    fields: [
      { key: 'redditClientId', label: 'Client ID', placeholder: 'vi du: dQw4w9WgXcQ' },
      { key: 'redditClientSecret', label: 'Client Secret', placeholder: 'chuoi bi mat', secret: true }
    ]
  },
  {
    title: 'YouTube',
    note: 'Khoa mien phi tai Google Cloud Console, nho bat YouTube Data API v3. Han muc mac dinh 10.000 don vi moi ngay, moi lan quet ton khoang 5 don vi.',
    fields: [
      { key: 'youtubeApiKey', label: 'API key', placeholder: 'AIza...', secret: true },
      {
        key: 'youtubeRegion',
        label: 'Quoc gia',
        placeholder: 'VN',
        help: 'Ma hai chu cai, vi du VN, US, JP'
      }
    ]
  },
  {
    title: 'X / Twitter',
    note: 'Endpoint tim kiem nam o goi Basic tro len. Goi Free chi cho dang bai va doc thong tin tai khoan cua chinh ban, goi vao tim kiem se nhan 403.',
    fields: [
      { key: 'xBearerToken', label: 'Bearer Token', placeholder: 'AAAA...', secret: true },
      {
        key: 'xQuery',
        label: 'Truy van',
        placeholder: '(lang:vi OR lang:en) -is:retweet -is:reply',
        help: 'De trong de dung truy van mac dinh'
      }
    ]
  },
  {
    title: 'Threads',
    note: 'Threads API chi doc duoc bai cua chinh tai khoan da uy quyen. Meta khong mo endpoint bai thinh hanh toan mang, nen app xep hang bai cua ban thay vi gia vo lam duoc nhieu hon.',
    fields: [
      { key: 'threadsAccessToken', label: 'Access Token', placeholder: 'THQV...', secret: true }
    ]
  },
  {
    title: 'Facebook',
    note: 'Graph API chi doc duoc Page ma ban quan tri. Khong ton tai endpoint cong khai cho bai hot toan mang, Meta da dong Public Feed API tu lau.',
    fields: [
      { key: 'facebookPageId', label: 'Page ID', placeholder: '1234567890' },
      { key: 'facebookPageToken', label: 'Page Access Token', placeholder: 'EAAG...', secret: true }
    ]
  },
  {
    title: 'May chu lien bang',
    note: 'Mastodon va Lemmy gom nhieu may chu doc lap, moi may xep hang theo luu luong cua rieng no. Doi may chu se cho goc nhin khac han.',
    fields: [
      { key: 'mastodonInstance', label: 'Mastodon', placeholder: 'mastodon.social' },
      { key: 'lemmyInstance', label: 'Lemmy', placeholder: 'lemmy.world' }
    ]
  }
]

export function SettingsDialog({
  settings,
  appInfo,
  onClose,
  onSave
}: SettingsDialogProps): React.JSX.Element {
  const [draft, setDraft] = useState<ProviderCredentials>(settings.credentials)
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefreshMinutes)
  const [keepSnapshots, setKeepSnapshots] = useState(settings.keepSnapshots)

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function save(): void {
    onSave({ credentials: draft, autoRefreshMinutes: autoRefresh, keepSnapshots })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgb(0 0 0 / 55%)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border"
        style={{
          background: 'var(--surface-1)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-card)'
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 id="settings-title" className="text-[14px] font-semibold">
            Cai dat va khoa API
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dong"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            className="mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-[11.5px]"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)'
            }}
          >
            {appInfo?.encryptionAvailable ? (
              <>
                <Lock size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--good)' }} aria-hidden />
                <span>
                  Khoa duoc ma hoa bang kho bao mat cua he dieu hanh truoc khi ghi ra dia, chi tai
                  khoan cua ban tren chinh may nay giai ma duoc.
                </span>
              </>
            ) : (
              <>
                <ShieldAlert
                  size={14}
                  className="mt-0.5 shrink-0"
                  style={{ color: 'var(--warning)' }}
                  aria-hidden
                />
                <span>
                  He dieu hanh khong cung cap kho bao mat, nen khoa se duoc ghi dang chu thuong vao
                  file cai dat. Can nhac truoc khi nhap khoa quan trong.
                </span>
              </>
            )}
          </div>

          {GROUPS.map((group) => (
            <section key={group.title} className="mb-5">
              <h3 className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {group.title}
              </h3>
              <p className="mb-2 mt-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {group.note}
              </p>

              <div className="flex flex-col gap-2">
                {group.fields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1">
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {field.label}
                      {field.help && (
                        <span style={{ color: 'var(--text-muted)' }}> - {field.help}</span>
                      )}
                    </span>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      value={draft[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      spellCheck={false}
                      autoComplete="off"
                      className="rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
                      style={{
                        background: 'var(--surface-2)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}

          <section className="mb-2">
            <h3 className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Hoat dong
            </h3>

            <label className="mt-2 flex items-center justify-between gap-4">
              <span className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                Tu dong quet lai moi (phut, 0 la tat)
              </span>
              <input
                type="number"
                min={0}
                max={240}
                value={autoRefresh}
                onChange={(event) => setAutoRefresh(Math.max(0, Number(event.target.value) || 0))}
                className="w-20 rounded-lg border px-2 py-1.5 text-right text-[12px] tabular-nums outline-none"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)'
                }}
              />
            </label>

            <label className="mt-2 flex items-center justify-between gap-4">
              <span className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                So lan quet luu lai de doi chieu
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={keepSnapshots}
                onChange={(event) => setKeepSnapshots(Math.max(1, Number(event.target.value) || 1))}
                className="w-20 rounded-lg border px-2 py-1.5 text-right text-[12px] tabular-nums outline-none"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)'
                }}
              />
            </label>
          </section>

          {appInfo && (
            <p className="mt-4 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Phien ban {appInfo.version} - Electron {appInfo.electron} - Chrome {appInfo.chrome}
              <br />
              Cai dat luu tai {appInfo.settingsPath}
            </p>
          )}
        </div>

        <footer
          className="flex justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3.5 py-2 text-[12.5px]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Huy
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            Luu lai
          </button>
        </footer>
      </div>
    </div>
  )
}
