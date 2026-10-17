import { describe, expect, it } from 'vitest'
import { fetchComments, fetchPlatform, mergeRanked } from './index'
import type { FetchOptions, PlatformId } from '../../shared/types'

/**
 * Test tich hop goi API that.
 *
 * Nhung test nay phu thuoc vao mang va vao viec ben thu ba con song, nen
 * chung khong chay trong bo test mac dinh. Chay rieng khi can kiem chung:
 *
 *   npm run test:live
 *
 * Muc dich cua chung la phat hien som khi mot nen tang doi dinh dang
 * phan hoi hoac dong endpoint, truoc khi nguoi dung gap loi.
 */

const FREE: PlatformId[] = ['hackernews', 'mastodon', 'bluesky', 'lemmy', 'reddit']

function options(platform: PlatformId, overrides: Partial<FetchOptions> = {}): FetchOptions {
  return {
    platforms: [platform],
    limit: 5,
    sinceHours: 24,
    credentials: {},
    ...overrides
  }
}

describe.each(FREE)('provider %s', (platform) => {
  it(
    'tra ve bai viet hop le tu API that',
    async () => {
      const result = await fetchPlatform(platform, options(platform))

      expect(result.platform).toBe(platform)
      expect(['ok', 'empty', 'error']).toContain(result.status)

      // Mot so nguon cong khai chan nhip goi rat gat, Reddit an danh chi cho
      // khoang mot yeu cau moi phut. Loi tam thoi kieu do khong phai la vi
      // pham hop dong cua provider, nhung van phai hien ra de khong bi bo qua.
      if (result.status !== 'ok') {
        console.warn(`[${platform}] ${result.status}: ${result.message}`)
        expect(result.message).toBeTruthy()
        expect(result.posts).toEqual([])
        return
      }

      expect(result.posts.length).toBeGreaterThan(0)
      expect(result.posts.length).toBeLessThanOrEqual(5)

      for (const post of result.posts) {
        expect(post.id.startsWith(`${platform}:`)).toBe(true)
        expect(post.url).toMatch(/^https?:\/\//)
        expect(post.author.name.length).toBeGreaterThan(0)
        expect(Number.isNaN(new Date(post.createdAt).getTime())).toBe(false)
        expect(post.hotScore).toBeGreaterThanOrEqual(0)
        expect(post.hotScore).toBeLessThanOrEqual(100)
        // Bai phai mang mot thu gi do de xem: van ban hoac hinh anh.
        // Mot tam anh khong kem chu van la bai hop le va van co the dang nong,
        // nen khong duoc doi hoi bai nao cung phai co van ban.
        const hasText = (post.title ?? '').length + post.content.length > 0
        expect(hasText || post.media.length > 0).toBe(true)

        // Noi dung phai la van ban sach. Hacker News tra ve `story_text`
        // dang HTML giong het binh luan, nen de lot la nguoi doc nhin thay
        // nguyen chuoi the trong bai.
        expect(post.content).not.toMatch(/<[a-z][^>]*>/i)
        expect(post.content).not.toMatch(/&#x?[0-9a-f]+;/i)
      }

      // Danh sach phai duoc xep giam dan theo diem nong.
      const scores = result.posts.map((post) => post.hotScore)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    },
    45_000
  )
})

describe('cac nen tang can khoa', () => {
  it.each(['youtube', 'x', 'threads', 'facebook'] as PlatformId[])(
    '%s bao thieu khoa thay vi nem loi',
    async (platform) => {
      const result = await fetchPlatform(platform, options(platform))
      expect(result.status).toBe('needs-credentials')
      expect(result.message).toBeTruthy()
      expect(result.posts).toEqual([])
    }
  )
})

describe('gop bang xep hang chung', () => {
  it(
    'tron bai tu nhieu mang va xep theo diem so sanh cheo',
    async () => {
      const results = await Promise.all(
        (['hackernews', 'bluesky'] as PlatformId[]).map((platform) =>
          fetchPlatform(platform, options(platform))
        )
      )

      const merged = mergeRanked(results, 8)
      expect(merged.length).toBeGreaterThan(0)
      expect(merged.length).toBeLessThanOrEqual(8)

      // Bang gop xep theo crossScore chu khong phai hotScore. Moi mang deu co
      // dung mot bai dat 100 hotScore, nen xep theo no thi dau bang chi la mot
      // chum diem 100 bang nhau va mat het thong tin ve mang nao dang soi dong.
      const scores = merged.map((post) => post.crossScore)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    },
    45_000
  )
})

describe('binh luan noi bat', () => {
  it.each(['bluesky', 'mastodon', 'lemmy', 'hackernews'] as PlatformId[])(
    '%s tra ve binh luan hop le tu API that',
    async (platform) => {
      const result = await fetchPlatform(platform, options(platform))
      if (result.status !== 'ok' || result.posts.length === 0) {
        console.warn(`[${platform}] bo qua vi khong lay duoc bai: ${result.message}`)
        return
      }

      const comments = await fetchComments(result.posts[0], {}, 3)
      expect(['ok', 'empty']).toContain(comments.status)
      expect(comments.postId).toBe(result.posts[0].id)

      if (comments.status === 'empty') {
        console.warn(`[${platform}] bai dau khong co binh luan nao`)
        return
      }

      expect(comments.comments.length).toBeLessThanOrEqual(3)

      for (const comment of comments.comments) {
        expect(comment.id.startsWith(`${platform}:`)).toBe(true)
        expect(comment.content.length).toBeGreaterThan(0)
        expect(comment.author.name.length).toBeGreaterThan(0)
        expect(Number.isNaN(new Date(comment.createdAt).getTime())).toBe(false)
        expect(comment.replyCount).toBeGreaterThanOrEqual(0)
        // Noi dung phai sach, khong con the HTML hay thuc the chua giai ma.
        expect(comment.content).not.toMatch(/<[a-z][^>]*>/i)
        expect(comment.content).not.toMatch(/&#x?[0-9a-f]+;/i)
      }

      // Hacker News khong cong bo diem binh luan nen phai duoc danh dau ro.
      if (platform === 'hackernews') {
        expect(comments.comments.every((comment) => !comment.metricsAvailable)).toBe(true)
      }
    },
    45_000
  )

  it('bao khong ho tro khi nen tang khong mo duong doc binh luan', async () => {
    const fake = {
      id: 'khongcothat:1',
      platform: 'khongcothat'
    } as unknown as Parameters<typeof fetchComments>[0]

    const result = await fetchComments(fake, {})
    expect(result.status).toBe('unsupported')
    expect(result.comments).toEqual([])
  })
})
