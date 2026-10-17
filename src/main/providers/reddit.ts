import type { Comment, Post } from '../../shared/types'
import { getJson, DEFAULT_USER_AGENT } from './http'
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
 * Reddit da dong endpoint `.json` an danh: goi thang vao www.reddit.com
 * tra ve 403. Con lai hai duong hop le, app dung ca hai:
 *
 *  1. Atom feed cong khai `/r/all/top/.rss` - chay ngay, khong can dang ky,
 *     nhung Reddit khong kem so upvote hay so binh luan trong feed. App chi
 *     nhan duoc thu hang, va se noi ro dieu do thay vi bia ra con so.
 *  2. OAuth client credentials - can Client ID va Secret cua mot app kieu
 *     "script" dang ky mien phi, doi lai co day du so lieu tuong tac.
 */

interface RedditOAuthToken {
  access_token?: string
  expires_in?: number
}

interface RedditListing {
  data?: { children?: Array<{ data?: RedditApiPost }> }
}

interface RedditApiPost {
  id: string
  title: string
  selftext?: string
  author?: string
  permalink?: string
  created_utc?: number
  ups?: number
  num_comments?: number
  subreddit?: string
  thumbnail?: string
  post_hint?: string
  over_18?: boolean
  link_flair_text?: string
}

function timeWindow(sinceHours: number): string {
  if (sinceHours <= 1) return 'hour'
  if (sinceHours <= 24) return 'day'
  if (sinceHours <= 168) return 'week'
  if (sinceHours <= 720) return 'month'
  return 'year'
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getOAuthToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': DEFAULT_USER_AGENT
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    throw new Error(
      `Reddit tu choi cap token (${response.status}). Kiem tra lai Client ID va Secret.`
    )
  }

  const token = (await response.json()) as RedditOAuthToken
  if (!token.access_token) throw new Error('Reddit tra ve phan hoi khong co access_token.')

  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
  }
  return cachedToken.value
}

async function fetchViaOAuth(
  ctx: ProviderContext,
  clientId: string,
  clientSecret: string
): Promise<Post[]> {
  const token = await getOAuthToken(clientId, clientSecret)
  const batch = Math.min(Math.max(ctx.limit * 3, 25), 100)
  const url = `https://oauth.reddit.com/r/all/top?t=${timeWindow(ctx.sinceHours)}&limit=${batch}&raw_json=1`

  const listing = await getJson<RedditListing>(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const cutoff = cutoffTimestamp(ctx.sinceHours)
  return (listing.data?.children ?? [])
    .map((child) => child.data)
    .filter((post): post is RedditApiPost => Boolean(post?.id))
    .map(fromApi)
    .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
}

const OAUTH_HINT =
  'Khai bao Client ID va Secret o tab Cai dat de dung OAuth, duong do co han muc cao hon nhieu va kem day du so lieu tuong tac.'

async function fetchViaRss(ctx: ProviderContext): Promise<Post[]> {
  const url = `https://www.reddit.com/r/all/top/.rss?t=${timeWindow(ctx.sinceHours)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/atom+xml' },
      signal: controller.signal
    })
  } catch (error) {
    // Khi bi chan vi goi qua day, Reddit thuong dong thang ket noi thay vi
    // tra ve ma loi, nen fetch chi bao mot cau chung chung. Noi ro kha nang
    // cao nhat de nguoi dung khong di tim nham nguyen nhan o mang nha minh.
    const reason =
      (error as Error).name === 'AbortError' ? 'qua thoi gian cho' : (error as Error).message
    throw new Error(
      `Khong goi duoc RSS cua Reddit (${reason}). Thuong la do goi qua day trong thoi gian ngan, thu lai sau mot phut. ${OAUTH_HINT}`
    )
  } finally {
    clearTimeout(timer)
  }

  // Reddit chan rat gat voi truy cap an danh: khoang mot yeu cau moi phut
  // tren mot dia chi IP. Noi thang dieu do thay vi de nguoi dung doan mo.
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    const wait = retryAfter ? ` Thu lai sau ${retryAfter} giay.` : ' Thu lai sau mot phut.'
    throw new Error(`Reddit tam chan vi qua nhieu yeu cau.${wait} ${OAUTH_HINT}`)
  }

  if (!response.ok) {
    throw new Error(`Reddit tra ve ${response.status} cho RSS. ${OAUTH_HINT}`)
  }

  const xml = await response.text()
  const cutoff = cutoffTimestamp(ctx.sinceHours)

  return parseAtomEntries(xml)
    .map((entry, index) => fromRss(entry, index))
    .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
}

export const redditProvider: Provider = {
  id: 'reddit',

  async fetchTop(ctx: ProviderContext): Promise<Post[]> {
    const id = ctx.credentials.redditClientId?.trim()
    const secret = ctx.credentials.redditClientSecret?.trim()

    if (id && secret) {
      try {
        return await fetchViaOAuth(ctx, id, secret)
      } catch (error) {
        // Khoa sai hoac het han thi van con duong RSS, khong nen hong ca lan quet.
        console.warn('[reddit] OAuth that bai, lui ve RSS:', (error as Error).message)
      }
    }

    return fetchViaRss(ctx)
  },

  /**
   * Binh luan chi doc duoc qua OAuth. Duong RSS cong khai khong he kem
   * binh luan, va endpoint `.json` an danh thi Reddit da dong.
   */
  async fetchComments(post: Post, { limit, credentials }: ProviderContext): Promise<Comment[]> {
    const id = credentials.redditClientId?.trim()
    const secret = credentials.redditClientSecret?.trim()

    if (!id || !secret) {
      throw new CredentialsRequired(
        'Reddit chi cho doc binh luan qua OAuth. Nhap Client ID va Secret o tab Cai dat, feed RSS cong khai khong kem binh luan.'
      )
    }

    const token = await getOAuthToken(id, secret)
    const url =
      `https://oauth.reddit.com/comments/${nativeId(post)}` +
      `?sort=top&depth=1&limit=${Math.min(limit * 3, 50)}&raw_json=1`

    // Endpoint nay tra ve mang hai phan tu: phan dau la chinh bai viet,
    // phan sau moi la cay binh luan.
    const listings = await getJson<RedditCommentListing[]>(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    const children = listings?.[1]?.data?.children ?? []
    const comments = children
      .filter((child) => child.kind === 't1' && child.data?.id && child.data.body)
      .map((child) => toComment(child.data as RedditComment))

    return rankComments(comments, limit)
  }
}

interface RedditCommentListing {
  data?: { children?: Array<{ kind?: string; data?: RedditComment }> }
}

interface RedditComment {
  id: string
  body?: string
  author?: string
  ups?: number
  created_utc?: number
  permalink?: string
  replies?: unknown
}

function toComment(raw: RedditComment): Comment {
  // `replies` la chuoi rong khi khong co tra loi, va la mot listing khi co.
  const replyListing = raw.replies as RedditCommentListing | '' | undefined
  const replyCount =
    replyListing && typeof replyListing === 'object'
      ? (replyListing.data?.children?.length ?? 0)
      : 0

  return {
    id: `reddit:${raw.id}`,
    author: {
      name: raw.author ?? 'unknown',
      handle: raw.author ? `u/${raw.author}` : undefined,
      profileUrl: raw.author ? `https://www.reddit.com/user/${raw.author}` : undefined
    },
    content: truncate(raw.body ?? '', 600),
    createdAt: new Date((raw.created_utc ?? 0) * 1000).toISOString(),
    metrics: { likes: raw.ups ?? 0 },
    replyCount,
    url: raw.permalink ? `https://www.reddit.com${raw.permalink}` : undefined,
    metricsAvailable: true
  }
}

function fromApi(raw: RedditApiPost): Post {
  const thumbnail = raw.thumbnail?.startsWith('http') ? raw.thumbnail : undefined

  return {
    id: `reddit:${raw.id}`,
    platform: 'reddit',
    title: raw.title,
    content: truncate(raw.selftext ?? ''),
    url: raw.permalink ? `https://www.reddit.com${raw.permalink}` : `https://redd.it/${raw.id}`,
    author: {
      name: raw.author ?? 'unknown',
      handle: raw.author ? `u/${raw.author}` : undefined,
      profileUrl: raw.author ? `https://www.reddit.com/user/${raw.author}` : undefined
    },
    createdAt: new Date((raw.created_utc ?? 0) * 1000).toISOString(),
    metrics: { likes: raw.ups ?? 0, comments: raw.num_comments ?? 0 },
    media: thumbnail
      ? [{ type: raw.post_hint === 'hosted:video' ? 'video' : 'image', url: thumbnail }]
      : [],
    tags: [raw.subreddit && `r/${raw.subreddit}`, raw.link_flair_text, raw.over_18 && 'NSFW']
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 4),
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true
  }
}

interface AtomEntry {
  id: string
  title: string
  link: string
  author: string
  authorUrl: string
  category: string
  published: string
  thumbnail?: string
}

/**
 * Doc Atom bang bieu thuc chinh quy thay vi keo ca mot thu vien XML.
 * Feed cua Reddit co cau truc co dinh va rat don gian, nen cach nay du dung
 * va giup goi cai dat nhe hon dang ke.
 */
function parseAtomEntries(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = []
  const blocks = xml.split('<entry>').slice(1)

  for (const block of blocks) {
    const body = block.split('</entry>')[0] ?? ''
    entries.push({
      id: (pick(body, /<id>([^<]+)<\/id>/) ?? '').replace(/^t3_/, ''),
      title: decodeXml(pick(body, /<title>([\s\S]*?)<\/title>/) ?? ''),
      link: pick(body, /<link[^>]*href="([^"]+)"/) ?? '',
      author: (pick(body, /<name>([^<]+)<\/name>/) ?? '').replace(/^\/u\//, ''),
      authorUrl: pick(body, /<author>[\s\S]*?<uri>([^<]+)<\/uri>/) ?? '',
      category: pick(body, /<category[^>]*label="([^"]+)"/) ?? '',
      published: pick(body, /<published>([^<]+)<\/published>/) ?? new Date().toISOString(),
      thumbnail: pick(body, /<media:thumbnail[^>]*url="([^"]+)"/)
    })
  }

  return entries.filter((entry) => entry.id && entry.title)
}

function pick(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1]
}

const APOSTROPHE = String.fromCharCode(39)

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, APOSTROPHE)
    .replace(/&#x27;/gi, APOSTROPHE)
    .replace(/&amp;/g, '&')
    .trim()
}

function fromRss(entry: AtomEntry, index: number): Post {
  return {
    id: `reddit:${entry.id}`,
    platform: 'reddit',
    title: entry.title,
    content: '',
    url: entry.link,
    author: {
      name: entry.author || 'unknown',
      handle: entry.author ? `u/${entry.author}` : undefined,
      profileUrl: entry.authorUrl || undefined
    },
    createdAt: entry.published,
    metrics: {},
    media: entry.thumbnail ? [{ type: 'image', url: entry.thumbnail }] : [],
    tags: entry.category ? [entry.category] : [],
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: false,
    sourceRank: index
  }
}
