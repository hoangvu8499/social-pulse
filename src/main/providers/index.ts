import type {
  CommentResult,
  FetchOptions,
  PlatformId,
  Post,
  ProviderCredentials,
  ProviderResult,
  ProviderStatus
} from '../../shared/types'
import { applyHotScores, dedupePosts } from '../../shared/scoring'
import { cacheKey, readCache, writeCache, readCommentCache, writeCommentCache } from '../cache'
import { CredentialsRequired, NotSupported, type Provider } from './base'
import { redditProvider } from './reddit'
import { hackerNewsProvider } from './hackernews'
import { mastodonProvider } from './mastodon'
import { blueskyProvider } from './bluesky'
import { lemmyProvider } from './lemmy'
import { youtubeProvider } from './youtube'
import { xProvider } from './x'
import { threadsProvider } from './threads'
import { facebookProvider } from './facebook'

const REGISTRY: Record<PlatformId, Provider> = {
  reddit: redditProvider,
  hackernews: hackerNewsProvider,
  mastodon: mastodonProvider,
  bluesky: blueskyProvider,
  lemmy: lemmyProvider,
  youtube: youtubeProvider,
  x: xProvider,
  threads: threadsProvider,
  facebook: facebookProvider
}

function classify(error: unknown): { status: ProviderStatus; message: string } {
  if (error instanceof CredentialsRequired) {
    return { status: 'needs-credentials', message: error.message }
  }
  if (error instanceof NotSupported) {
    return { status: 'unsupported', message: error.message }
  }
  return { status: 'error', message: error instanceof Error ? error.message : String(error) }
}

export interface FetchPlatformOptions {
  /** Bo qua cache va goi thang ra API. Dung cho nut lam moi cuong buc. */
  force?: boolean
}

/**
 * Quet mot nen tang.
 *
 * Ham nay khong bao gio nem loi: moi that bai duoc goi lai thanh mot
 * ProviderResult co trang thai ro rang. Nho vay mot mang hong khong the
 * lam do ca lan quet, va tang UI chi can doc mot kieu du lieu duy nhat.
 */
export async function fetchPlatform(
  platform: PlatformId,
  options: FetchOptions,
  { force = false }: FetchPlatformOptions = {}
): Promise<ProviderResult> {
  const key = cacheKey(platform, options.limit, options.sinceHours)

  if (!force) {
    const cached = readCache(key)
    if (cached) return { ...cached, fromCache: true }
  }

  const startedAt = Date.now()
  const provider = REGISTRY[platform]
  const base = { platform, fetchedAt: new Date().toISOString(), fromCache: false }

  if (!provider) {
    return {
      ...base,
      status: 'unsupported',
      posts: [],
      message: `Chua co provider cho ${platform}.`,
      durationMs: 0
    }
  }

  try {
    const raw = await provider.fetchTop({
      limit: options.limit,
      sinceHours: options.sinceHours,
      credentials: options.credentials
    })

    const ranked = applyHotScores(dedupePosts(raw)).slice(0, options.limit)

    const result: ProviderResult = {
      ...base,
      status: ranked.length > 0 ? 'ok' : 'empty',
      posts: ranked,
      message:
        ranked.length === 0
          ? `Khong co bai nao trong ${options.sinceHours} gio gan day. Thu noi rong khung thoi gian.`
          : undefined,
      durationMs: Date.now() - startedAt
    }

    writeCache(platform, key, result)
    return result
  } catch (error) {
    const { status, message } = classify(error)
    return { ...base, status, posts: [], message, durationMs: Date.now() - startedAt }
  }
}

/**
 * Quet nhieu nen tang song song.
 * Mot mang hong khong keo do cac mang con lai vi moi provider da tu bat loi.
 */
export async function fetchAll(
  options: FetchOptions,
  providerOptions: FetchPlatformOptions = {}
): Promise<ProviderResult[]> {
  const results = await Promise.all(
    options.platforms.map((platform) => fetchPlatform(platform, options, providerOptions))
  )

  // Giu dung thu tu nguoi dung chon de UI khong nhay lung tung giua cac lan quet.
  const order = new Map(options.platforms.map((platform, index) => [platform, index]))
  return results.sort((a, b) => (order.get(a.platform) ?? 0) - (order.get(b.platform) ?? 0))
}

/**
 * Gop bai tu moi mang thanh mot bang xep hang chung.
 *
 * Xep theo crossScore chu khong phai hotScore: hotScore luon cham bai dan dau
 * cua moi mang dung 100 diem, nen neu dung no thi dau bang se la mot chum
 * diem 100 bang nhau va mat het thong tin ve mang nao thuc su dang soi dong.
 */
/**
 * Lay binh luan noi bat cua mot bai.
 *
 * Chay theo yeu cau chu khong keo san cung luc quet. Mot lan quet nam mang
 * voi muoi bai moi mang la nam muoi bai; keo binh luan cho tat ca se la nam
 * muoi luot goi them va cham tran nhip cho cua gan het cac API cong khai.
 * Nguoi dung chi mo binh luan cua vai bai ho quan tam, nen goi dung luc do
 * la vua du va lich su voi ben thu ba.
 */
export async function fetchComments(
  post: Post,
  credentials: ProviderCredentials,
  limit = 5
): Promise<CommentResult> {
  const provider = REGISTRY[post.platform]

  if (!provider?.fetchComments) {
    return {
      postId: post.id,
      status: 'unsupported',
      comments: [],
      message: `${post.platform} khong mo duong doc binh luan.`
    }
  }

  const key = `comments|${post.id}|${limit}`
  const cached = readCommentCache(key)
  if (cached) return cached

  try {
    const comments = await provider.fetchComments(post, {
      limit,
      sinceHours: 24,
      credentials
    })

    const result: CommentResult = {
      postId: post.id,
      status: comments.length > 0 ? 'ok' : 'empty',
      comments,
      message: comments.length === 0 ? 'Bai nay chua co binh luan nao.' : undefined
    }

    if (result.status === 'ok') writeCommentCache(key, result)
    return result
  } catch (error) {
    const { status, message } = classify(error)
    return { postId: post.id, status, comments: [], message }
  }
}

export function mergeRanked(results: ProviderResult[], limit: number): Post[] {
  const all = results.flatMap((result) => result.posts)
  return dedupePosts(all)
    .sort((a, b) => b.crossScore - a.crossScore || b.hotScore - a.hotScore)
    .slice(0, limit)
}

export { REGISTRY }
