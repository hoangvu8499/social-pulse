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
 * Pham vi that su cua Threads API.
 *
 * Meta khong mo bat ky endpoint nao tra ve bai thinh hanh cua toan mang
 * Threads. Threads API chi phuc vu tai khoan da uy quyen: dang bai, doc lai
 * bai cua chinh minh, va xem chi so cua nhung bai do. Vi vay o day app lam
 * dung mot viec hop le va huu ich: lay cac bai cua chinh ban, xep theo
 * tuong tac, de ban biet bai nao cua minh dang chay tot nhat.
 *
 * Ai chao moi mot cong cu lay duoc "top 10 Threads toan cau" thi hoac dang
 * cao giao dien web, viec vi pham dieu khoan va de khien tai khoan bi khoa,
 * hoac dang ban lai du lieu mua tu ben thu ba.
 */

interface ThreadsListResponse {
  data?: ThreadsPost[]
  error?: { message?: string }
}

interface ThreadsPost {
  id: string
  text?: string
  permalink?: string
  timestamp?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  username?: string
}

interface ThreadsInsightsResponse {
  data?: Array<{
    name?: string
    values?: Array<{ value?: number }>
    total_value?: { value?: number }
  }>
}

const API = 'https://graph.threads.net/v1.0'

export const threadsProvider: Provider = {
  id: 'threads',

  async fetchTop({ limit, sinceHours, credentials }: ProviderContext): Promise<Post[]> {
    const token = credentials.threadsAccessToken?.trim()
    if (!token) {
      throw new CredentialsRequired(
        'Threads khong co API bai thinh hanh toan mang. Dan Access Token de doc va xep hang cac bai cua chinh tai khoan ban.'
      )
    }

    const since = Math.floor(cutoffTimestamp(sinceHours) / 1000)
    const url =
      `${API}/me/threads` +
      '?fields=id,text,permalink,timestamp,media_type,media_url,thumbnail_url,username' +
      `&since=${since}` +
      `&limit=${Math.min(Math.max(limit * 2, 10), 100)}` +
      `&access_token=${encodeURIComponent(token)}`

    const response = await getJson<ThreadsListResponse>(url)
    if (response.error?.message) throw new Error(response.error.message)

    const posts = (response.data ?? []).filter((post) => post.id)

    // Chi so nam o endpoint rieng cho tung bai, nen phai goi them.
    // Gioi han so luoc goi de khong dot het han muc trong mot lan quet.
    const withInsights = await Promise.all(
      posts.slice(0, Math.min(limit * 2, 25)).map(async (post) => ({
        post,
        insights: await fetchInsights(post.id, token).catch(() => ({}))
      }))
    )

    return withInsights.map(({ post, insights }) => toPost(post, insights))
  },

  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const token = credentials.threadsAccessToken?.trim()
    if (!token) {
      throw new CredentialsRequired('Chua co Threads Access Token de doc tra loi.')
    }

    const fields = 'id,text,username,timestamp,permalink,has_replies'
    const url =
      `${API}/${encodeURIComponent(nativeId(post))}/replies` +
      `?fields=${encodeURIComponent(fields)}` +
      '&reverse=false' +
      `&limit=${Math.min(Math.max(limit * 2, 10), 50)}` +
      `&access_token=${encodeURIComponent(token)}`

    const response = await getJson<ThreadsRepliesResponse>(url)
    if (response.error?.message) throw new Error(response.error.message)

    const replies = (response.data ?? []).filter((reply) => reply.id)
    return rankComments(replies.map(toComment), limit)
  }
}

interface ThreadsRepliesResponse {
  data?: ThreadsReply[]
  error?: { message?: string }
}

interface ThreadsReply {
  id: string
  text?: string
  username?: string
  timestamp?: string
  permalink?: string
  has_replies?: boolean
}

/**
 * Threads khong cong bo so luot thich cho tung tra loi qua API, va endpoint
 * insights chi ap dung cho bai cua chinh ban chu khong cho tra loi cua
 * nguoi khac. Vi vay tra loi duoc danh dau la khong co so lieu.
 */
function toComment(raw: ThreadsReply): Comment {
  return {
    id: `threads:${raw.id}`,
    author: {
      name: raw.username ?? 'nguoi dung Threads',
      handle: raw.username ? `@${raw.username}` : undefined,
      profileUrl: raw.username ? `https://www.threads.net/@${raw.username}` : undefined
    },
    content: truncate(raw.text ?? '', 600),
    createdAt: raw.timestamp ?? new Date().toISOString(),
    metrics: {},
    replyCount: raw.has_replies ? 1 : 0,
    url: raw.permalink,
    metricsAvailable: false
  }
}

type Insights = { likes?: number; replies?: number; reposts?: number; views?: number }

async function fetchInsights(postId: string, token: string): Promise<Insights> {
  const url =
    `${API}/${postId}/insights` +
    '?metric=likes,replies,reposts,quotes,views' +
    `&access_token=${encodeURIComponent(token)}`

  const response = await getJson<ThreadsInsightsResponse>(url, { retries: 0, timeoutMs: 8000 })
  const result: Insights = {}

  for (const entry of response.data ?? []) {
    const value = entry.total_value?.value ?? entry.values?.[0]?.value ?? 0
    if (entry.name === 'likes') result.likes = value
    if (entry.name === 'replies') result.replies = value
    if (entry.name === 'reposts' || entry.name === 'quotes') {
      result.reposts = (result.reposts ?? 0) + value
    }
    if (entry.name === 'views') result.views = value
  }

  return result
}

function toPost(raw: ThreadsPost, insights: Insights): Post {
  const username = raw.username

  return {
    id: `threads:${raw.id}`,
    platform: 'threads',
    content: truncate(raw.text ?? ''),
    url: raw.permalink ?? `https://www.threads.net/@${username ?? ''}`,
    author: {
      name: username ?? 'tai khoan cua ban',
      handle: username ? `@${username}` : undefined,
      profileUrl: username ? `https://www.threads.net/@${username}` : undefined
    },
    createdAt: raw.timestamp ?? new Date().toISOString(),
    metrics: {
      likes: insights.likes ?? 0,
      comments: insights.replies ?? 0,
      shares: insights.reposts ?? 0,
      views: insights.views ?? 0
    },
    media:
      raw.media_url || raw.thumbnail_url
        ? [
            {
              type: raw.media_type === 'VIDEO' ? 'video' : 'image',
              url: (raw.media_url ?? raw.thumbnail_url) as string,
              thumbnailUrl: raw.thumbnail_url
            }
          ]
        : [],
    tags: ['bai cua ban'],
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
