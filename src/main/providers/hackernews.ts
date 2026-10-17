import type { Comment, Post } from '../../shared/types'
import { stripHtml } from '../../shared/scoring'
import { getJson } from './http'
import {
  cutoffTimestamp,
  nativeId,
  rankComments,
  truncate,
  type Provider,
  type ProviderContext
} from './base'

interface AlgoliaResponse {
  hits?: AlgoliaHit[]
}

interface AlgoliaHit {
  objectID: string
  title?: string
  url?: string
  author?: string
  created_at?: string
  points?: number
  num_comments?: number
  story_text?: string
  _tags?: string[]
}

/**
 * Dung Algolia Search API cua Hacker News: mien phi, khong can khoa,
 * va cho loc theo khoang thoi gian ngay trong mot lan goi.
 */
export const hackerNewsProvider: Provider = {
  id: 'hackernews',

  async fetchTop({ limit, sinceHours }: ProviderContext): Promise<Post[]> {
    const cutoffSeconds = Math.floor(cutoffTimestamp(sinceHours) / 1000)
    const url =
      `https://hn.algolia.com/api/v1/search?tags=story` +
      `&numericFilters=created_at_i>${cutoffSeconds}` +
      `&hitsPerPage=${Math.min(Math.max(limit * 2, 20), 100)}`

    const response = await getJson<AlgoliaResponse>(url)
    return (response.hits ?? []).filter((hit) => hit.objectID).map(toPost)
  },

  /**
   * Hacker News khong cong bo diem cua tung binh luan: API tra ve `points`
   * bang null cho moi binh luan, va giao dien web cung khong hien so nao.
   * Vi vay binh luan duoc xep theo so luot tra loi truc tiep, tuc la do day
   * cua cuoc tranh luan ma no mo ra. App ghi ro day la thu hang suy ra chu
   * khong phai so lieu that.
   */
  async fetchComments(post: Post, { limit }: ProviderContext): Promise<Comment[]> {
    const url = `https://hn.algolia.com/api/v1/items/${nativeId(post)}`
    const item = await getJson<AlgoliaItem>(url)

    const topLevel = (item.children ?? []).filter(
      (child) => child.id && child.text && !child.deleted
    )

    return rankComments(topLevel.map(toComment), limit)
  }
}

interface AlgoliaItem {
  id?: number
  children?: AlgoliaItemNode[]
}

interface AlgoliaItemNode {
  id?: number
  author?: string
  text?: string
  created_at?: string
  points?: number | null
  deleted?: boolean
  children?: AlgoliaItemNode[]
}

/** Dem toan bo nhanh tra loi duoi mot binh luan, khong chi tra loi truc tiep. */
function countDescendants(node: AlgoliaItemNode): number {
  const children = node.children ?? []
  return children.length + children.reduce((sum, child) => sum + countDescendants(child), 0)
}

function toComment(node: AlgoliaItemNode): Comment {
  return {
    id: `hackernews:${node.id}`,
    author: {
      name: node.author ?? 'unknown',
      handle: node.author,
      profileUrl: node.author ? `https://news.ycombinator.com/user?id=${node.author}` : undefined
    },
    content: truncate(stripHtml(node.text ?? ''), 600),
    createdAt: node.created_at ?? new Date().toISOString(),
    metrics: {},
    replyCount: countDescendants(node),
    url: `https://news.ycombinator.com/item?id=${node.id}`,
    metricsAvailable: false
  }
}

function toPost(hit: AlgoliaHit): Post {
  const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`

  return {
    id: `hackernews:${hit.objectID}`,
    platform: 'hackernews',
    title: hit.title ?? '(khong co tieu de)',
    // `story_text` la HTML y het binh luan, nen phai go the va giai ma thuc
    // the. Thieu buoc nay thi nguoi doc nhin thay nguyen chuoi the trong bai.
    content: truncate(stripHtml(hit.story_text ?? '')),
    url: discussionUrl,
    author: {
      name: hit.author ?? 'unknown',
      handle: hit.author,
      profileUrl: hit.author ? `https://news.ycombinator.com/user?id=${hit.author}` : undefined
    },
    createdAt: hit.created_at ?? new Date().toISOString(),
    metrics: {
      likes: hit.points ?? 0,
      comments: hit.num_comments ?? 0
    },
    media: hit.url ? [{ type: 'link', url: hit.url }] : [],
    tags: (hit._tags ?? []).filter((tag) => !tag.startsWith('author_') && tag !== 'story').slice(0, 3),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}
