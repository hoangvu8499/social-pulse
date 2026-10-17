import type { Comment, Post } from '../../shared/types'
import { getJson } from './http'
import {
  CredentialsRequired,
  cutoffTimestamp,
  nativeId,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

/**
 * X API v2, endpoint `tweets/search/recent`.
 *
 * Luu y ve chi phi: endpoint nay nam o goi Basic tro len. Goi Free chi cho
 * dang bai va doc thong tin tai khoan cua chinh minh, goi vao day se nhan 403.
 * App bao dung loi do thay vi im lang tra ve danh sach rong.
 */

interface XSearchResponse {
  data?: XTweet[]
  includes?: { users?: XUser[] }
  errors?: Array<{ detail?: string; title?: string }>
  title?: string
  detail?: string
}

interface XTweet {
  id: string
  text?: string
  created_at?: string
  author_id?: string
  lang?: string
  entities?: { hashtags?: Array<{ tag?: string }> }
  public_metrics?: {
    like_count?: number
    reply_count?: number
    retweet_count?: number
    quote_count?: number
    impression_count?: number
  }
}

interface XUser {
  id: string
  name?: string
  username?: string
  profile_image_url?: string
}

/**
 * Truy van mac dinh: bai tieng Viet hoac tieng Anh, bo retweet va reply
 * de chi con bai goc, vi retweet chi nhan ban tuong tac cua bai khac.
 */
const DEFAULT_QUERY = '(lang:vi OR lang:en) -is:retweet -is:reply -is:quote has:links'

export const xProvider: Provider = {
  id: 'x',

  async fetchTop({ limit, sinceHours, credentials }: ProviderContext): Promise<Post[]> {
    const token = credentials.xBearerToken?.trim()
    if (!token) {
      throw new CredentialsRequired(
        'Chua co Bearer Token cua X API v2. Endpoint tim kiem nam o goi tra phi, goi Free khong doc duoc timeline.'
      )
    }

    const query = credentials.xQuery?.trim() || DEFAULT_QUERY
    // X chi cho tim trong 7 ngay gan nhat va doi `start_time` khong duoc
    // som hon moc do, nen can chan lai truoc khi gui.
    const earliest = Date.now() - 6.9 * 24 * 3_600_000
    const startTime = new Date(Math.max(cutoffTimestamp(sinceHours), earliest)).toISOString()

    const url =
      'https://api.twitter.com/2/tweets/search/recent' +
      `?query=${encodeURIComponent(query)}` +
      `&max_results=${Math.min(Math.max(limit * 3, 10), 100)}` +
      `&start_time=${encodeURIComponent(startTime)}` +
      '&sort_order=relevancy' +
      '&tweet.fields=created_at,public_metrics,lang,entities' +
      '&expansions=author_id' +
      '&user.fields=name,username,profile_image_url'

    const response = await getJson<XSearchResponse>(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.errors?.length) {
      const first = response.errors[0]
      throw new Error(first.detail ?? first.title ?? 'X tra ve loi khong ro chi tiet.')
    }

    const users = new Map((response.includes?.users ?? []).map((user) => [user.id, user]))
    return (response.data ?? [])
      .filter((tweet) => tweet.id)
      .map((tweet) => toPost(tweet, users.get(tweet.author_id ?? '')))
  },

  /**
   * X khong co endpoint rieng cho tra loi. Cach chinh thuc la tim theo
   * `conversation_id`. Truy van lay bai goc da loai bo reply nen moi bai
   * tra ve deu la goc cua cuoc hoi thoai, tuc conversation_id trung voi
   * chinh dinh danh cua no.
   */
  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const token = credentials.xBearerToken?.trim()
    if (!token) {
      throw new CredentialsRequired('Chua co Bearer Token cua X API v2 de doc tra loi.')
    }

    const url =
      'https://api.twitter.com/2/tweets/search/recent' +
      `?query=${encodeURIComponent(`conversation_id:${nativeId(post)} is:reply`)}` +
      `&max_results=${Math.min(Math.max(limit * 2, 10), 100)}` +
      '&tweet.fields=created_at,public_metrics' +
      '&expansions=author_id' +
      '&user.fields=name,username,profile_image_url'

    const response = await getJson<XSearchResponse>(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.errors?.length) {
      const first = response.errors[0]
      throw new Error(first.detail ?? first.title ?? 'X tra ve loi khong ro chi tiet.')
    }

    const users = new Map((response.includes?.users ?? []).map((user) => [user.id, user]))
    const comments = (response.data ?? [])
      .filter((tweet) => tweet.id)
      .map((tweet) => toComment(tweet, users.get(tweet.author_id ?? '')))

    return rankComments(comments, limit)
  }
}

function toComment(tweet: XTweet, user?: XUser): Comment {
  const metrics = tweet.public_metrics ?? {}
  const username = user?.username

  return {
    id: `x:${tweet.id}`,
    author: {
      name: user?.name ?? username ?? 'unknown',
      handle: username ? `@${username}` : undefined,
      avatarUrl: user?.profile_image_url,
      profileUrl: username ? `https://x.com/${username}` : undefined
    },
    content: truncate(tweet.text ?? '', 600),
    createdAt: tweet.created_at ?? new Date().toISOString(),
    metrics: {
      likes: metrics.like_count ?? 0,
      comments: metrics.reply_count ?? 0,
      shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0)
    },
    replyCount: metrics.reply_count ?? 0,
    url: `https://x.com/${username ?? 'i'}/status/${tweet.id}`,
    metricsAvailable: true
  }
}

function toPost(tweet: XTweet, user?: XUser): Post {
  const metrics = tweet.public_metrics ?? {}
  const username = user?.username

  return {
    id: `x:${tweet.id}`,
    platform: 'x',
    content: truncate(tweet.text ?? ''),
    url: `https://x.com/${username ?? 'i'}/status/${tweet.id}`,
    author: {
      name: user?.name ?? username ?? 'unknown',
      handle: username ? `@${username}` : undefined,
      avatarUrl: user?.profile_image_url,
      profileUrl: username ? `https://x.com/${username}` : undefined
    },
    createdAt: tweet.created_at ?? new Date().toISOString(),
    metrics: {
      likes: metrics.like_count ?? 0,
      comments: metrics.reply_count ?? 0,
      shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
      views: metrics.impression_count ?? 0
    },
    media: [],
    tags: (tweet.entities?.hashtags ?? [])
      .map((item) => item.tag)
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 4)
      .map((tag) => `#${tag}`),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
