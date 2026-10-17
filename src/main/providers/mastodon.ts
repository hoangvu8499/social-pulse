import type { Comment, Post } from '../../shared/types'
import { stripHtml, stripLeadingMentions } from '../../shared/scoring'
import { getJson, normalizeInstance } from './http'
import {
  cutoffTimestamp,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

/**
 * Mastodon cong bo endpoint `trends/statuses` hoan toan cong khai.
 * Moi may chu lai xep hang theo luu luong cua rieng no, nen nguoi dung
 * doi duoc may chu trong phan Cai dat de nhin thay goc nhin khac.
 */

interface MastodonStatus {
  id: string
  created_at: string
  in_reply_to_id?: string | null
  url?: string
  uri?: string
  content?: string
  spoiler_text?: string
  replies_count?: number
  reblogs_count?: number
  favourites_count?: number
  language?: string
  account?: {
    display_name?: string
    acct?: string
    username?: string
    avatar?: string
    url?: string
  }
  media_attachments?: Array<{
    type?: string
    url?: string
    preview_url?: string
  }>
  tags?: Array<{ name?: string }>
}

export const DEFAULT_MASTODON_INSTANCE = 'mastodon.social'

export const mastodonProvider: Provider = {
  id: 'mastodon',

  async fetchTop({ limit, sinceHours, credentials }: ProviderContext): Promise<Post[]> {
    const instance = normalizeInstance(credentials.mastodonInstance, DEFAULT_MASTODON_INSTANCE)
    const batch = Math.min(Math.max(limit * 2, 20), 40)
    const url = `https://${instance}/api/v1/trends/statuses?limit=${batch}`

    const statuses = await getJson<MastodonStatus[]>(url)
    const cutoff = cutoffTimestamp(sinceHours)

    return statuses
      .filter((status) => status?.id)
      .map((status) => toPost(status, instance))
      .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
  },

  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const instance = normalizeInstance(credentials.mastodonInstance, DEFAULT_MASTODON_INSTANCE)
    // Id noi bo cua Mastodon la `mastodon:<may-chu>:<so-hieu>`, lay phan cuoi.
    const statusId = post.id.split(':').pop() ?? ''
    const url = `https://${instance}/api/v1/statuses/${statusId}/context`

    const context = await getJson<{ descendants?: MastodonStatus[] }>(url)

    // `context` tra ve toan bo cay hoi dap, ke ca tra loi cua tra loi.
    // Chi giu tra loi truc tiep cho bai goc de danh sach con doc duoc.
    const direct = (context.descendants ?? []).filter(
      (status) => status.in_reply_to_id === statusId
    )

    return rankComments(
      direct.map((status) => toComment(status, instance)),
      limit
    )
  }
}

function toComment(status: MastodonStatus, instance: string): Comment {
  const account = status.account ?? {}
  const handle = account.acct?.trim() || account.username?.trim() || 'unknown'

  return {
    id: `mastodon:${instance}:${status.id}`,
    author: {
      name: account.display_name?.trim() || handle,
      handle: handle.includes('@') ? `@${handle}` : `@${handle}@${instance}`,
      avatarUrl: account.avatar,
      profileUrl: account.url
    },
    content: truncate(stripLeadingMentions(stripHtml(status.content ?? '')), 600),
    createdAt: status.created_at,
    metrics: {
      likes: status.favourites_count ?? 0,
      comments: status.replies_count ?? 0,
      shares: status.reblogs_count ?? 0
    },
    replyCount: status.replies_count ?? 0,
    url: status.url ?? status.uri,
    metricsAvailable: true
  }
}

function toPost(status: MastodonStatus, instance: string): Post {
  const account = status.account ?? {}
  // Dung `||` chu khong phai `??`: mot so may chu tra ve chuoi rong cho acct,
  // ma `??` chi bat null va undefined nen se de lot chuoi rong xuong duoi,
  // khien bai viet khong co ten tac gia nao de hien.
  const handle = account.acct?.trim() || account.username?.trim() || 'unknown'
  const spoiler = status.spoiler_text?.trim()
  const body = stripHtml(status.content ?? '')

  return {
    id: `mastodon:${instance}:${status.id}`,
    platform: 'mastodon',
    title: spoiler || undefined,
    content: truncate(body),
    url: status.url ?? status.uri ?? `https://${instance}/@${handle}/${status.id}`,
    author: {
      name: account.display_name?.trim() || handle,
      handle: handle.includes('@') ? `@${handle}` : `@${handle}@${instance}`,
      avatarUrl: account.avatar,
      profileUrl: account.url
    },
    createdAt: status.created_at,
    metrics: {
      likes: status.favourites_count ?? 0,
      comments: status.replies_count ?? 0,
      shares: status.reblogs_count ?? 0
    },
    media: (status.media_attachments ?? [])
      .filter((item) => item.url)
      .slice(0, 4)
      .map((item) => ({
        type: item.type === 'video' || item.type === 'gifv' ? 'video' : 'image',
        url: item.url as string,
        thumbnailUrl: item.preview_url
      })),
    tags: (status.tags ?? [])
      .map((tag) => tag.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 5)
      .map((name) => `#${name}`),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
