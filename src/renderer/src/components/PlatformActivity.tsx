import type { ProviderResult } from '@shared/types'
import { PLATFORM_MAP } from '@shared/platforms'

/**
 * So sanh muc do soi dong giua cac mang.
 *
 * Do luong duoc chon la crossScore cua bai dan dau moi mang, tuc la bai
 * nong nhat cua mang do dang chay nhanh gap bao nhieu lan muc thuong ngay
 * cua chinh mang do. Day la con so duy nhat trong app so sanh cheo duoc,
 * vi no da tu chuan hoa theo quy mo rieng cua tung mang.
 *
 * Khong dung tong luot thich: Reddit va YouTube co so nguoi dung lon hon
 * Mastodon hang tram lan, nen bieu do se chi noi lai dieu da biet truoc,
 * la mang dong nguoi thi nhieu luot thich hon.
 *
 * Mot chuoi du lieu duy nhat nen khong can chu giai mau, tieu de da goi
 * ten do luong. Moi thanh deu co nhan truc tiep, nen gia tri khong bao gio
 * chi duoc truyen dat bang do dai.
 */

interface PlatformActivityProps {
  results: ProviderResult[]
}

interface Row {
  id: string
  label: string
  value: number
  hasMetrics: boolean
  note?: string
}

function buildRows(results: ProviderResult[]): Row[] {
  return results
    .map((result) => {
      const meta = PLATFORM_MAP[result.platform]
      const label = meta?.label ?? result.platform
      const top = result.posts[0]

      if (result.status !== 'ok' || !top) {
        return { id: result.platform, label, value: 0, hasMetrics: false, note: 'khong co du lieu' }
      }

      if (!top.metricsAvailable) {
        return {
          id: result.platform,
          label,
          value: 0,
          hasMetrics: false,
          note: 'nguon khong cong bo so lieu'
        }
      }

      return { id: result.platform, label, value: top.crossScore, hasMetrics: true }
    })
    .sort((a, b) => b.value - a.value)
}

export function PlatformActivity({ results }: PlatformActivityProps): React.JSX.Element | null {
  const rows = buildRows(results)
  if (rows.length === 0) return null

  const peak = Math.max(...rows.map((row) => row.value), 1)

  return (
    <section
      className="rounded-xl border p-4"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-card)'
      }}
      aria-labelledby="activity-heading"
    >
      <h2
        id="activity-heading"
        className="text-[13px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        Bai dan dau moi mang dang chay nhanh gap may lan muc thuong ngay
      </h2>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Chi so da chuan hoa theo quy mo rieng cua tung mang nen so sanh cheo duoc
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="grid grid-cols-[104px_1fr_auto] items-center gap-3">
            <span
              className="truncate text-[12px]"
              style={{ color: 'var(--text-secondary)' }}
              title={row.label}
            >
              {row.label}
            </span>

            <div
              className="h-2.5 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--heat-track)' }}
              role="img"
              aria-label={
                row.hasMetrics
                  ? `${row.label}: gap ${row.value} lan muc thuong ngay`
                  : `${row.label}: ${row.note}`
              }
            >
              {row.hasMetrics && (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((row.value / peak) * 100, 2)}%`,
                    background: 'var(--heat-fill)'
                  }}
                />
              )}
            </div>

            <span
              className="w-24 text-right text-[12px] tabular-nums"
              style={{ color: row.hasMetrics ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {row.hasMetrics ? `x${row.value.toFixed(1)}` : row.note}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
