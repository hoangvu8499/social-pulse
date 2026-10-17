import type { Comment, Post } from '../../shared/types'
import { getJson, normalizeInstance } from './http'
import {
  cutoffTimestamp,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

/**
 * Lemmy la mang lien bang kieu Reddit. API v3 cho doc danh sach bai
 * da xep hang san theo `TopDay` hoac `TopHour` ma khong can dang nhap.
 */

interface LemmyListResponse {
  posts?: LemmyPostView[]
}

interface LemmyPostView {
  post?: {
    id: number
    name?: string
    body?: string
    url?: string
    published?: string
    thumbnail_url?: string
    ap_id?: string
    nsfw?: boolean
  }
  creator?: {
    name?: string
    display_name?: string
    actor_id?: string
    avatar?: string
  }
  community?: {
    name?: string
    title?: string
  }
  counts?: {
    score?: number
    upvotes?: number
    downvotes?: number
    comments?: number
  }
}

export const DEFAULT_LEMMY_INSTANCE = 'lemmy.world'

function sortFor(sinceHours: number): string {
  if (sinceHours <= 6) return 'TopSixHour'
  if (sinceHours <= 12) return 'TopTwelveHour'
  if (sinceHours <= 24) return 'TopDay'
  if (sinceHours <= 168) return 'TopWeek'
  return 'TopMonth'
}

export const lemmyProvider: Provider = {
  id: 'lemmy',

  async fetchTop({ limit, sinceHours, credentials }: ProviderContext): Promise<Post[]> {
    const instance = normalizeInstance(credentials.lemmyInstance, DEFAULT_LEMMY_INSTANCE)
    const batch = Math.min(Math.max(limit * 2, 20), 50)
    const url =
      `https://${instance}/api/v3/post/list` +
      `?sort=${sortFor(sinceHours)}&limit=${batch}&type_=All`

    const response = await getJson<LemmyListResponse>(url)
    const cutoff = cutoffTimestamp(sinceHours)

    return (response.posts ?? [])
      .filter((view) => view.post?.id)
      .map((view) => toPost(view, instance))
      .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
  },

  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const instance = normalizeInstance(credentials.lemmyInstance, DEFAULT_LEMMY_INSTANCE)
    // Id noi bo cua Lemmy la `lemmy:<may-chu>:<so-hieu>`, lay phan cuoi.
    const postId = post.id.split(':').pop() ?? ''

    // `max_depth=1` chi lay binh luan goc, khong keo ca cay tra loi long nhau.
    const url =
      `https://${instance}/api/v3/comment/list` +
      `?post_id=${encodeURIComponent(postId)}&sort=Top&max_depth=1&limit=${Math.min(limit * 3, 50)}`

    const response = await getJson<LemmyCommentListResponse>(url)

    const comments = (response.comments ?? [])
      .filter((view) => view.comment?.id && !view.comment.deleted && !view.comment.removed)
      .map((view) => toComment(view, instance))

    return rankComments(comments, limit)
  }
}

interface LemmyCommentListResponse {
  comments?: LemmyCommentView[]
}

interface LemmyCommentView {
  comment?: {
    id: number
    content?: string
    published?: string
    ap_id?: string
    deleted?: boolean
    removed?: boolean
  }
  creator?: {
    name?: string
    display_name?: string
    actor_id?: string
    avatar?: string
  }
  counts?: {
    score?: number
    upvotes?: number
    child_count?: number
  }
}

function toComment(view: LemmyCommentView, instance: string): Comment {
  const comment = view.comment ?? ({} as NonNullable<LemmyCommentView['comment']>)
  const creator = view.creator ?? {}
  const counts = view.counts ?? {}

  return {
    id: `lemmy:${instance}:${comment.id}`,
    author: {
      name: creator.display_name?.trim() || creator.name || 'unknown',
      handle: creator.name ? `@${creator.name}` : undefined,
      avatarUrl: creator.avatar,
      profileUrl: creator.actor_id
    },
    content: truncate(comment.content ?? '', 600),
    createdAt: withUtcSuffix(comment.published),
    metrics: { likes: counts.upvotes ?? counts.score ?? 0 },
    replyCount: counts.child_count ?? 0,
    url: comment.ap_id ?? `https://${instance}/comment/${comment.id}`,
    metricsAvailable: true
  }
}

/**
 * Lemmy ghi moc thoi gian theo UTC nhung doi khi bo quen hau to Z, khien
 * Date hieu nham la gio dia phuong. Lech nay lam sai het tuoi doi bai viet
 * va keo theo sai ca diem nong, nen phai chuan hoa truoc khi dung.
 */
function withUtcSuffix(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  return value.endsWith('Z') ? value : `${value}Z`
}

function toPost(view: LemmyPostView, instance: string): Post {
  const post = view.post ?? ({} as NonNullable<LemmyPostView['post']>)
  const creator = view.creator ?? {}
  const counts = view.counts ?? {}
  const community = view.community?.name

  return {
    id: `lemmy:${instance}:${post.id}`,
    platform: 'lemmy',
    title: post.name,
    content: truncate(post.body ?? ''),
    url: post.ap_id ?? `https://${instance}/post/${post.id}`,
    author: {
      name: creator.display_name?.trim() || creator.name || 'unknown',
      handle: creator.name ? `@${creator.name}` : undefined,
      avatarUrl: creator.avatar,
      profileUrl: creator.actor_id
    },
    createdAt: withUtcSuffix(post.published),
    metrics: {
      likes: counts.upvotes ?? counts.score ?? 0,
      comments: counts.comments ?? 0
    },
    media: post.thumbnail_url
      ? [{ type: 'image', url: post.thumbnail_url }]
      : post.url
        ? [{ type: 'link', url: post.url }]
        : [],
    tags: [community ? `c/${community}` : '', post.nsfw ? 'NSFW' : ''].filter(Boolean),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
