import type { Post } from './types'

const MIN_AGE_HOURS = 0.5

/** So gio tu luc dang den bay gio, chan duoi de bai moi tinh khong lam no diem. */
export function ageInHours(createdAt: string, now = Date.now()): number {
  const published = new Date(createdAt).getTime()
  if (Number.isNaN(published)) return MIN_AGE_HOURS
  return Math.max((now - published) / 3_600_000, MIN_AGE_HOURS)
}

/** Tong tuong tac tho. View duoc nhan he so thap vi de dat hon nhieu so voi like. */
export function totalEngagement(post: Pick<Post, 'metrics'>): number {
  const { likes = 0, comments = 0, shares = 0, views = 0 } = post.metrics
  return likes + comments * 2 + shares * 3 + views * 0.01
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/**
 * Cham diem mot lo bai viet cua cung mot nen tang.
 *
 * App dung hai thang do khac nhau vi chung tra loi hai cau hoi khac nhau:
 *
 *  - `hotScore` 0-100 so bai nay voi bai nong nhat cua chinh mang do.
 *    Day la con so tu nhien khi nhin rieng tung mang.
 *  - `crossScore` so van toc tuong tac cua bai voi van toc trung vi cua mang.
 *    Vi moi mang deu co dung mot bai dat 100 hotScore, chi dua vao hotScore
 *    thi bang xep hang gop se day ngay tu dau. crossScore giu duoc su that
 *    rang mot bai bung no gap ba muoi lan muc thuong ngay thi dang chu y hon
 *    mot bai chi gap ba lan, du ca hai deu dung dau mang cua minh.
 */
export function applyHotScores(posts: Post[], now = Date.now()): Post[] {
  if (posts.length === 0) return []

  // Nguon chi cho thu hang (vi du RSS cua Reddit) thi khong co gi de tinh
  // van toc. Truong hop do cham diem thang theo thu hang de khong bia so lieu,
  // va cho crossScore quanh muc trung binh vi khong du co so de so sanh cheo.
  const rankOnly = posts.every((post) => !post.metricsAvailable)
  if (rankOnly) {
    const ordered = [...posts].sort((a, b) => (a.sourceRank ?? 0) - (b.sourceRank ?? 0))
    const span = Math.max(ordered.length - 1, 1)
    return ordered.map((post, index) => {
      const share = index / span
      return {
        ...post,
        engagement: 0,
        velocity: 0,
        hotScore: Math.round((100 - share * 60) * 10) / 10,
        crossScore: Math.round((2 - share * 1.5) * 100) / 100
      }
    })
  }

  const withVelocity = posts.map((post) => {
    const engagement = totalEngagement(post)
    const velocity = engagement / ageInHours(post.createdAt, now)
    return { ...post, engagement, velocity }
  })

  const velocities = withVelocity.map((post) => post.velocity)
  const peak = Math.max(...velocities, 0)
  const mid = median(velocities.filter((value) => value > 0))

  if (peak <= 0) {
    return withVelocity.map((post) => ({ ...post, hotScore: 0, crossScore: 0 }))
  }

  return withVelocity
    .map((post) => ({
      ...post,
      hotScore: Math.round((post.velocity / peak) * 1000) / 10,
      crossScore: mid > 0 ? Math.round((post.velocity / mid) * 100) / 100 : 0
    }))
    .sort((a, b) => b.velocity - a.velocity)
}

/**
 * Loai bai trung.
 *
 * Can thiet vi hai ly do. Mot la cac mang lien bang nhu Lemmy va Mastodon
 * cho dang cheo cung mot noi dung sang nhieu cong dong, nen mot bai co the
 * xuat hien vai lan voi dinh danh khac nhau. Hai la cung mot noi dung co the
 * duoc dang lai nhieu lan trong cung mot ngay.
 */
export function dedupePosts(posts: Post[]): Post[] {
  const seenIds = new Set<string>()
  const seenFingerprints = new Set<string>()
  const result: Post[] = []

  for (const post of posts) {
    if (seenIds.has(post.id)) continue

    const fingerprint = fingerprintOf(post)
    if (fingerprint && seenFingerprints.has(fingerprint)) continue

    seenIds.add(post.id)
    if (fingerprint) seenFingerprints.add(fingerprint)
    result.push(post)
  }

  return result
}

/**
 * Van tay noi dung dung de phat hien bai trung.
 * Chi gop trong pham vi cung mot nen tang, vi hai mang khac nhau ban ve
 * cung mot su kien van la hai goc nhin dang xem, khong phai ban sao.
 */
function fingerprintOf(post: Post): string {
  const text = (post.title || post.content || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (text.length < 12) return ''
  return `${post.platform}|${text.slice(0, 120)}`
}

/**
 * Bo the HTML va giai ma thuc the, dung cho cac mang tra ve noi dung dang HTML.
 *
 * Phan giai ma phai xu ly ca thuc the dang so nhu `&#39;` va `&#x27;`, khong
 * chi vai ten quen thuoc. Hacker News la vi du: API cua no ma hoa dau nhay
 * don thanh `&#x27;`, nen neu chi doi vai ten co san thi nguoi doc se thay
 * nguyen chuoi ma trong cau.
 *
 * Thu tu quan trong: `&amp;` phai duoc doi sau cung, neu khong thi mot chuoi
 * nhu `&amp;#39;` se bien thanh `&#39;` roi bi giai ma tiep thanh dau nhay,
 * tuc la doi mot lan qua nhieu.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Go cac luot nhac ten o dau mot tra loi.
 *
 * Mastodon va cac mang lien bang khac chen san `@tac-gia` vao dau moi tra
 * loi. Trong danh sach binh luan thi phan nay chi lam nhieu, vi ai cung
 * dang tra loi cung mot bai.
 */
export function stripLeadingMentions(text: string): string {
  return text.replace(/^(?:@[\w.-]+(?:@[\w.-]+)?\s+)+/, '').trim()
}
