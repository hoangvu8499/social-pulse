import type { Post } from '@shared/types'

const COMPACT = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const FULL = new Intl.NumberFormat('vi-VN')

/** Rut gon so lon: 12.400 thanh 12,4 N. Dung cho the chi so chat hep. */
export function compactNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '-'
  if (value < 1000) return FULL.format(value)
  return COMPACT.format(value)
}

/** Khoang cach thoi gian dang nguoi doc, vi du "3 gio truoc". */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'khong ro'

  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return 'vua xong'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phut truoc`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} gio truoc`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ngay truoc`

  const months = Math.round(days / 30)
  return `${months} thang truoc`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'khong ro'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Dong mo ta tuong tac cho mot bai.
 * Chi liet ke chi so that su co, de khong hien mot hang so khong vo nghia.
 */
export function metricsSummary(post: Post): string {
  if (!post.metricsAvailable) return 'Nguon khong cong bo so lieu tuong tac'

  const parts: string[] = []
  if (post.metrics.likes) parts.push(`${compactNumber(post.metrics.likes)} thich`)
  if (post.metrics.comments) parts.push(`${compactNumber(post.metrics.comments)} binh luan`)
  if (post.metrics.shares) parts.push(`${compactNumber(post.metrics.shares)} chia se`)
  if (post.metrics.views) parts.push(`${compactNumber(post.metrics.views)} luot xem`)

  return parts.length > 0 ? parts.join(' - ') : 'Chua co tuong tac nao'
}

/** Tieu de hien thi: uu tien tieu de that, neu khong co thi lay dong dau noi dung. */
export function displayTitle(post: Post): string {
  if (post.title?.trim()) return post.title.trim()

  const firstLine = post.content.split('\n').find((line) => line.trim().length > 0)
  if (firstLine?.trim()) return firstLine.trim()

  // Bai chi dang anh hoac video khong he hiem va van co the rat nong,
  // nen goi ten theo loai phuong tien thay vi dan nhan la bai rong.
  if (post.media.some((item) => item.type === 'video')) return '(bai chi co video)'
  if (post.media.some((item) => item.type === 'image')) return '(bai chi co hinh anh)'
  if (post.media.length > 0) return '(bai chi co lien ket)'

  return '(bai khong co van ban)'
}

/** Phan noi dung con lai sau khi da lay tieu de, de khong hien trung lap. */
export function displayBody(post: Post): string {
  if (post.title?.trim()) return post.content.trim()

  const lines = post.content.split('\n')
  const firstIndex = lines.findIndex((line) => line.trim().length > 0)
  return lines
    .slice(firstIndex + 1)
    .join('\n')
    .trim()
}
