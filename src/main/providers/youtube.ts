import type { Comment, Post } from '../../shared/types'
import { stripHtml } from '../../shared/scoring'
import { getJson } from './http'
import {
  CredentialsRequired,
  nativeId,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

/**
 * YouTube Data API v3, bang xep hang `mostPopular` theo tung quoc gia.
 * Khoa API dang ky mien phi tai Google Cloud Console, han muc mac dinh
 * 10.000 don vi moi ngay, moi lan quet ton khoang 5 don vi.
 */

interface YouTubeResponse {
  items?: YouTubeVideo[]
  error?: { message?: string }
}

interface YouTubeVideo {
  id: string
  snippet?: {
    publishedAt?: string
    title?: string
    description?: string
    channelTitle?: string
    channelId?: string
    tags?: string[]
    thumbnails?: Record<string, { url?: string }>
  }
  statistics?: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
}

export const DEFAULT_YOUTUBE_REGION = 'VN'

export const youtubeProvider: Provider = {
  id: 'youtube',

  async fetchTop({ limit, credentials }: ProviderContext): Promise<Post[]> {
    const key = credentials.youtubeApiKey?.trim()
    if (!key) {
      throw new CredentialsRequired(
        'Chua co YouTube Data API key. Tao khoa mien phi tai Google Cloud Console, bat YouTube Data API v3 roi dan vao tab Cai dat.'
      )
    }

    const region = (credentials.youtubeRegion || DEFAULT_YOUTUBE_REGION).toUpperCase()
    const url =
      'https://www.googleapis.com/youtube/v3/videos' +
      '?part=snippet,statistics&chart=mostPopular' +
      `&regionCode=${encodeURIComponent(region)}` +
      `&maxResults=${Math.min(Math.max(limit, 5), 50)}` +
      `&key=${encodeURIComponent(key)}`

    const response = await getJson<YouTubeResponse>(url)
    if (response.error?.message) throw new Error(response.error.message)

    // Bang xep hang thinh hanh cua YouTube khong loc theo gio dang.
    // Video nam trong bang van dang nong, nen giu nguyen thay vi cat bot.
    return (response.items ?? []).filter((item) => item.id).map(toPost)
  },

  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const key = credentials.youtubeApiKey?.trim()
    if (!key) {
      throw new CredentialsRequired('Chua co YouTube Data API key de doc binh luan.')
    }

    // `order=relevance` tra ve binh luan noi bat theo cach xep cua YouTube,
    // gan voi thu nguoi xem thuc su thay duoi video.
    const url =
      'https://www.googleapis.com/youtube/v3/commentThreads' +
      '?part=snippet&order=relevance&textFormat=plainText' +
      `&videoId=${encodeURIComponent(nativeId(post))}` +
      `&maxResults=${Math.min(Math.max(limit, 5), 50)}` +
      `&key=${encodeURIComponent(key)}`

    const response = await getJson<YouTubeCommentThreads>(url)
    if (response.error?.message) throw new Error(response.error.message)

    const comments = (response.items ?? [])
      .filter((item) => item.snippet?.topLevelComment?.id)
      .map(toComment)

    return rankComments(comments, limit)
  }
}

interface YouTubeCommentThreads {
  items?: YouTubeCommentThread[]
  error?: { message?: string }
}

interface YouTubeCommentThread {
  snippet?: {
    totalReplyCount?: number
    topLevelComment?: {
      id?: string
      snippet?: {
        textDisplay?: string
        authorDisplayName?: string
        authorProfileImageUrl?: string
        authorChannelUrl?: string
        likeCount?: number
        publishedAt?: string
      }
    }
  }
}

function toComment(thread: YouTubeCommentThread): Comment {
  const top = thread.snippet?.topLevelComment
  const snippet = top?.snippet ?? {}

  return {
    id: `youtube:${top?.id}`,
    author: {
      name: snippet.authorDisplayName ?? 'unknown',
      avatarUrl: snippet.authorProfileImageUrl,
      profileUrl: snippet.authorChannelUrl
    },
    content: truncate(stripHtml(snippet.textDisplay ?? ''), 600),
    createdAt: snippet.publishedAt ?? new Date().toISOString(),
    metrics: { likes: snippet.likeCount ?? 0 },
    replyCount: thread.snippet?.totalReplyCount ?? 0,
    metricsAvailable: true
  }
}

function pickThumbnail(thumbnails?: Record<string, { url?: string }>): string | undefined {
  if (!thumbnails) return undefined
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url
  )
}

function toPost(video: YouTubeVideo): Post {
  const snippet = video.snippet ?? {}
  const stats = video.statistics ?? {}
  const thumbnail = pickThumbnail(snippet.thumbnails)

  return {
    id: `youtube:${video.id}`,
    platform: 'youtube',
    title: snippet.title,
    content: truncate(snippet.description ?? '', 600),
    url: `https://www.youtube.com/watch?v=${video.id}`,
    author: {
      name: snippet.channelTitle ?? 'unknown',
      profileUrl: snippet.channelId
        ? `https://www.youtube.com/channel/${snippet.channelId}`
        : undefined
    },
    createdAt: snippet.publishedAt ?? new Date().toISOString(),
    metrics: {
      likes: Number(stats.likeCount ?? 0),
      comments: Number(stats.commentCount ?? 0),
      views: Number(stats.viewCount ?? 0)
    },
    media: thumbnail ? [{ type: 'video', url: thumbnail, thumbnailUrl: thumbnail }] : [],
    tags: (snippet.tags ?? []).slice(0, 4),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
