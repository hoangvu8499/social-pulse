import type { CommentResult, ProviderResult, PlatformId } from '../shared/types'

/**
 * Cache ket qua quet theo tung nen tang.
 *
 * Ly do phai co: nhieu API cong khai chan rat gat. Reddit chi cho khoang
 * mot yeu cau moi phut voi truy cap an danh. Neu nguoi dung bam lam moi
 * lien tuc ma lan nao cung goi thang ra ngoai thi se bi chan ngay.
 * Cache giup app lich su voi ben thu ba va phan hoi tuc thi khi du lieu
 * van con moi.
 */

interface CacheEntry {
  result: ProviderResult
  expiresAt: number
}

/** Moi nen tang co nhip lam moi hop ly rieng, tinh bang giay. */
const TTL_SECONDS: Record<PlatformId, number> = {
  reddit: 180,
  hackernews: 90,
  mastodon: 90,
  bluesky: 60,
  lemmy: 90,
  youtube: 300,
  x: 120,
  threads: 300,
  facebook: 300
}

const store = new Map<string, CacheEntry>()

export function cacheKey(platform: PlatformId, limit: number, sinceHours: number): string {
  return `${platform}|${limit}|${sinceHours}`
}

export function readCache(key: string): ProviderResult | null {
  const entry = store.get(key)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }

  return entry.result
}

export function writeCache(platform: PlatformId, key: string, result: ProviderResult): void {
  // Chi cache lan quet thanh cong. Luu ca loi se giu nguoi dung ket trong
  // trang thai hong cho den khi het han, du su co chi thoang qua.
  if (result.status !== 'ok') return

  const ttl = (TTL_SECONDS[platform] ?? 120) * 1000
  store.set(key, { result, expiresAt: Date.now() + ttl })
}

/**
 * Cache binh luan, tach rieng khoi cache bai viet.
 *
 * Binh luan duoc giu lau hon mot chut vi nguoi dung thuong dong roi mo lai
 * cung mot bai nhieu lan trong luc doc, va moi lan mo deu la mot luot goi
 * ra ngoai neu khong co cache.
 *
 * So luong muc bi chan tren: mot phien doc lau co the mo hang tram bai, va
 * giu het trong bo nho thi khong co ly do gi. Khi day, muc cu nhat bi loai
 * truoc, vi Map cua JavaScript duyet theo dung thu tu them vao.
 */
const COMMENT_TTL_MS = 5 * 60 * 1000
const COMMENT_CACHE_LIMIT = 120

const commentStore = new Map<string, { result: CommentResult; expiresAt: number }>()

export function readCommentCache(key: string): CommentResult | null {
  const entry = commentStore.get(key)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    commentStore.delete(key)
    return null
  }

  return entry.result
}

export function writeCommentCache(key: string, result: CommentResult): void {
  if (commentStore.size >= COMMENT_CACHE_LIMIT) {
    const oldest = commentStore.keys().next().value
    if (oldest !== undefined) commentStore.delete(oldest)
  }

  commentStore.set(key, { result, expiresAt: Date.now() + COMMENT_TTL_MS })
}

export function clearCache(): void {
  store.clear()
  commentStore.clear()
}
