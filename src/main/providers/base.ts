import type { Comment, Post, PlatformId, ProviderCredentials } from '../../shared/types'

export interface ProviderContext {
  limit: number
  sinceHours: number
  credentials: ProviderCredentials
}

export interface Provider {
  id: PlatformId
  fetchTop(ctx: ProviderContext): Promise<Post[]>

  /**
   * Lay binh luan noi bat duoi mot bai viet.
   *
   * Khong bat buoc: nen tang nao khong mo duong doc binh luan thi de trong,
   * va tang dieu phoi se bao lai la khong ho tro.
   *
   * Ham nhan ca doi tuong Post chu khong chi nhan dinh danh, vi moi mang
   * dinh vi bai theo mot kieu khac nhau. Bluesky can AT-URI, Lemmy can so
   * hieu bai kem ten may chu, YouTube can ma video. Tat ca deu da nam san
   * trong Post nen khong phai dung lai dinh danh tu nhieu manh roi rac.
   */
  fetchComments?(post: Post, ctx: ProviderContext): Promise<Comment[]>
}

/** Cat tien to nen tang ra khoi id noi bo dang `platform:phan-con-lai`. */
export function nativeId(post: Post): string {
  return post.id.slice(post.platform.length + 1)
}

/**
 * Xep binh luan theo do nong va cat lay phan dau.
 *
 * Nguon nao co so lieu thi xep theo tuong tac, nguon nao khong co thi xep
 * theo so luot tra loi, vi mot binh luan keo theo nhieu tranh luan dung la
 * binh luan dang nong.
 */
export function rankComments(comments: Comment[], limit: number): Comment[] {
  const hasMetrics = comments.some((comment) => comment.metricsAvailable)

  return [...comments]
    .sort((a, b) => {
      if (hasMetrics) {
        const byLikes = (b.metrics.likes ?? 0) - (a.metrics.likes ?? 0)
        if (byLikes !== 0) return byLikes
      }
      const byReplies = b.replyCount - a.replyCount
      if (byReplies !== 0) return byReplies
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    .slice(0, limit)
}

/** Nem ra khi provider can khoa ma nguoi dung chua khai bao. */
export class CredentialsRequired extends Error {
  readonly kind = 'needs-credentials'
  constructor(message: string) {
    super(message)
    this.name = 'CredentialsRequired'
  }
}

/** Nem ra khi nen tang khong he co API cho du lieu dang duoc yeu cau. */
export class NotSupported extends Error {
  readonly kind = 'unsupported'
  constructor(message: string) {
    super(message)
    this.name = 'NotSupported'
  }
}

export function cutoffTimestamp(sinceHours: number): number {
  return Date.now() - sinceHours * 3_600_000
}

/** Rut gon noi dung dai de UI khong phai giu chuoi khong lo trong bo nho. */
export function truncate(text: string, max = 2000): string {
  const clean = (text ?? '').trim()
  return clean.length > max ? `${clean.slice(0, max)}...` : clean
}
