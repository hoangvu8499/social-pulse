import type { Comment, Post } from '../../shared/types'
import { getJson } from './http'
import {
  cutoffTimestamp,
  nativeId,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

/**
 * Bluesky chay tren AT Protocol va mo mot AppView cong khai khong can dang nhap.
 * App doc feed "What's Hot" do chinh Bluesky van hanh, tra ve day du
 * so like, repost, reply va quote cho tung bai.
 */

const PUBLIC_APPVIEW = 'https://public.api.bsky.app/xrpc'

/** Feed generator "What's Hot" chinh chu cua Bluesky. */
const WHATS_HOT_FEED =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot'

interface BlueskyFeedResponse {
  feed?: Array<{ post?: BlueskyPost }>
  cursor?: string
}

interface BlueskyPost {
  uri: string
  cid?: string
  author?: {
    did?: string
    handle?: string
    displayName?: string
    avatar?: string
  }
  record?: {
    text?: string
    createdAt?: string
    langs?: string[]
    tags?: string[]
  }
  embed?: {
    $type?: string
    images?: Array<{ thumb?: string; fullsize?: string; alt?: string }>
    external?: { uri?: string; thumb?: string; title?: string }
    playlist?: string
    thumbnail?: string
  }
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  indexedAt?: string
}

export const blueskyProvider: Provider = {
  id: 'bluesky',

  async fetchTop({ limit, sinceHours }: ProviderContext): Promise<Post[]> {
    const batch = Math.min(Math.max(limit * 4, 40), 100)
    const url =
      `${PUBLIC_APPVIEW}/app.bsky.feed.getFeed` +
      `?feed=${encodeURIComponent(WHATS_HOT_FEED)}&limit=${batch}`

    const response = await getJson<BlueskyFeedResponse>(url)
    const cutoff = cutoffTimestamp(sinceHours)

    return (response.feed ?? [])
      .map((item) => item.post)
      .filter((post): post is BlueskyPost => Boolean(post?.uri))
      .map(toPost)
      .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
  },

  async fetchComments(post: Post, { limit }: ProviderContext): Promise<Comment[]> {
    // Id noi bo cua Bluesky giu nguyen AT-URI, la thu getPostThread can.
    const uri = nativeId(post)
    const url =
      `${PUBLIC_APPVIEW}/app.bsky.feed.getPostThread` +
      `?uri=${encodeURIComponent(uri)}&depth=1&parentHeight=0`

    const response = await getJson<BlueskyThreadResponse>(url)

    const replies = (response.thread?.replies ?? [])
      .map((reply) => reply.post)
      .filter((reply): reply is BlueskyPost => Boolean(reply?.uri))
      .map(toComment)

    return rankComments(replies, limit)
  }
}

interface BlueskyThreadResponse {
  thread?: {
    post?: BlueskyPost
    replies?: Array<{ post?: BlueskyPost }>
  }
}

function toComment(raw: BlueskyPost): Comment {
  const author = raw.author ?? {}
  const record = raw.record ?? {}

  return {
    id: `bluesky:${raw.uri}`,
    author: {
      name: author.displayName?.trim() || author.handle || 'unknown',
      handle: author.handle ? `@${author.handle}` : undefined,
      avatarUrl: author.avatar,
      profileUrl: author.handle ? `https://bsky.app/profile/${author.handle}` : undefined
    },
    content: truncate(record.text ?? '', 600),
    createdAt: record.createdAt ?? raw.indexedAt ?? new Date().toISOString(),
    metrics: {
      likes: raw.likeCount ?? 0,
      comments: raw.replyCount ?? 0,
      shares: (raw.repostCount ?? 0) + (raw.quoteCount ?? 0)
    },
    replyCount: raw.replyCount ?? 0,
    url: toWebUrl(raw.uri, author.handle),
    metricsAvailable: true
  }
}

/**
 * Doi AT-URI thanh dia chi web mo duoc trong trinh duyet.
 * `at://<did>/app.bsky.feed.post/<rkey>` tuong ung
 * `https://bsky.app/profile/<handle hoac did>/post/<rkey>`.
 */
function toWebUrl(uri: string, handle?: string): string {
  const rkey = uri.split('/').pop() ?? ''
  const did = uri.replace('at://', '').split('/')[0] ?? ''
  return `https://bsky.app/profile/${handle || did}/post/${rkey}`
}

function toPost(raw: BlueskyPost): Post {
  const author = raw.author ?? {}
  const record = raw.record ?? {}
  const embed = raw.embed ?? {}

  const media: Post['media'] = []
  for (const image of embed.images ?? []) {
    if (image.thumb || image.fullsize) {
      media.push({
        type: 'image',
        url: (image.fullsize ?? image.thumb) as string,
        thumbnailUrl: image.thumb
      })
    }
  }
  if (embed.external?.uri) {
    media.push({ type: 'link', url: embed.external.uri, thumbnailUrl: embed.external.thumb })
  }
  if (embed.playlist) {
    media.push({ type: 'video', url: embed.playlist, thumbnailUrl: embed.thumbnail })
  }

  return {
    id: `bluesky:${raw.uri}`,
    platform: 'bluesky',
    content: truncate(record.text ?? ''),
    url: toWebUrl(raw.uri, author.handle),
    author: {
      name: author.displayName?.trim() || author.handle || 'unknown',
      handle: author.handle ? `@${author.handle}` : undefined,
      avatarUrl: author.avatar,
      profileUrl: author.handle ? `https://bsky.app/profile/${author.handle}` : undefined
    },
    createdAt: record.createdAt ?? raw.indexedAt ?? new Date().toISOString(),
    metrics: {
      likes: raw.likeCount ?? 0,
      comments: raw.replyCount ?? 0,
      shares: (raw.repostCount ?? 0) + (raw.quoteCount ?? 0)
    },
    media: media.slice(0, 4),
    tags: (record.tags ?? []).slice(0, 4).map((tag) => `#${tag}`),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
