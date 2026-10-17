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
 * Pham vi that su cua Facebook Graph API.
 *
 * Khong ton tai endpoint cong khai nao cho "bai hot nhat Facebook hom nay".
 * Meta da dong Public Feed API va Keyword Insights API tu nhieu nam truoc,
 * va chi con mo CrowdTangle cho mot so to chuc nghien cuu truoc khi dong han.
 * Nhung gi Graph API con cho phep la doc Page ma chinh ban quan tri.
 *
 * Vi vay provider nay lam dung viec do: lay bai cua Page ban so huu trong
 * khung gio da chon, kem so like, binh luan va chia se, roi xep theo tuong tac.
 */

interface FacebookFeedResponse {
  data?: FacebookPost[]
  error?: { message?: string; type?: string; code?: number }
}

interface FacebookPost {
  id: string
  message?: string
  story?: string
  created_time?: string
  permalink_url?: string
  full_picture?: string
  shares?: { count?: number }
  likes?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  reactions?: { summary?: { total_count?: number } }
}

const API_VERSION = 'v21.0'

export const facebookProvider: Provider = {
  id: 'facebook',

  async fetchTop({ limit, sinceHours, credentials }: ProviderContext): Promise<Post[]> {
    const token = credentials.facebookPageToken?.trim()
    const pageId = credentials.facebookPageId?.trim()

    if (!token || !pageId) {
      throw new CredentialsRequired(
        'Facebook khong mo API cho bai hot toan mang. Nhap Page ID va Page Access Token de doc va xep hang bai cua Page ban quan tri.'
      )
    }

    const since = Math.floor(cutoffTimestamp(sinceHours) / 1000)
    const fields = [
      'id',
      'message',
      'story',
      'created_time',
      'permalink_url',
      'full_picture',
      'shares',
      'likes.summary(true).limit(0)',
      'comments.summary(true).limit(0)',
      'reactions.summary(true).limit(0)'
    ].join(',')

    const url =
      `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(pageId)}/posts` +
      `?fields=${encodeURIComponent(fields)}` +
      `&since=${since}` +
      `&limit=${Math.min(Math.max(limit * 2, 10), 100)}` +
      `&access_token=${encodeURIComponent(token)}`

    const response = await getJson<FacebookFeedResponse>(url)
    if (response.error?.message) throw new Error(response.error.message)

    return (response.data ?? []).filter((post) => post.id).map((post) => toPost(post, pageId))
  },

  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const token = credentials.facebookPageToken?.trim()
    if (!token) {
      throw new CredentialsRequired('Chua co Page Access Token de doc binh luan.')
    }

    const fields = 'id,message,created_time,permalink_url,like_count,comment_count,from'
    const url =
      `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(nativeId(post))}/comments` +
      `?fields=${encodeURIComponent(fields)}` +
      // `order=ranked` cho binh luan noi bat theo cach Facebook xep,
      // thay vi danh sach theo thu tu thoi gian.
      '&order=ranked&filter=toplevel' +
      `&limit=${Math.min(Math.max(limit * 2, 10), 50)}` +
      `&access_token=${encodeURIComponent(token)}`

    const response = await getJson<FacebookCommentsResponse>(url)
    if (response.error?.message) throw new Error(response.error.message)

    const comments = (response.data ?? []).filter((item) => item.id).map(toComment)
    return rankComments(comments, limit)
  }
}

interface FacebookCommentsResponse {
  data?: FacebookComment[]
  error?: { message?: string }
}

interface FacebookComment {
  id: string
  message?: string
  created_time?: string
  permalink_url?: string
  like_count?: number
  comment_count?: number
  from?: { name?: string; id?: string }
}

function toComment(raw: FacebookComment): Comment {
  return {
    id: `facebook:${raw.id}`,
    author: {
      // Graph API chi tra ve `from` khi token co quyen tuong ung, nen
      // khong phai luc nao cung biet ai viet binh luan.
      name: raw.from?.name ?? 'nguoi dung Facebook',
      profileUrl: raw.from?.id ? `https://www.facebook.com/${raw.from.id}` : undefined
    },
    content: truncate(raw.message ?? '', 600),
    createdAt: raw.created_time ?? new Date().toISOString(),
    metrics: { likes: raw.like_count ?? 0 },
    replyCount: raw.comment_count ?? 0,
    url: raw.permalink_url,
    metricsAvailable: true
  }
}

function toPost(raw: FacebookPost, pageId: string): Post {
  const reactions = raw.reactions?.summary?.total_count
  const likes = raw.likes?.summary?.total_count

  return {
    id: `facebook:${raw.id}`,
    platform: 'facebook',
    content: truncate(raw.message ?? raw.story ?? ''),
    url: raw.permalink_url ?? `https://www.facebook.com/${raw.id}`,
    author: {
      name: 'Page cua ban',
      profileUrl: `https://www.facebook.com/${pageId}`
    },
    createdAt: raw.created_time ?? new Date().toISOString(),
    metrics: {
      // Reactions bao gom ca like nen uu tien dung, tranh dem trung.
      likes: reactions ?? likes ?? 0,
      comments: raw.comments?.summary?.total_count ?? 0,
      shares: raw.shares?.count ?? 0
    },
    media: raw.full_picture ? [{ type: 'image', url: raw.full_picture }] : [],
    tags: ['Page cua ban'],
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
