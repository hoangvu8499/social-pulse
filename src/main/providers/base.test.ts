import { describe, expect, it } from 'vitest'
import { cutoffTimestamp, nativeId, rankComments, truncate } from './base'
import type { Comment, Post } from '../../shared/types'

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'bluesky:1',
    author: { name: 'Ai Do' },
    content: 'noi dung binh luan',
    createdAt: '2026-10-17T01:00:00.000Z',
    metrics: {},
    replyCount: 0,
    metricsAvailable: true,
    ...overrides
  }
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'bluesky:at://did:plc:abc/app.bsky.feed.post/xyz',
    platform: 'bluesky',
    content: '',
    url: 'https://bsky.app/x',
    author: { name: 'Ai Do' },
    createdAt: '2026-10-17T01:00:00.000Z',
    metrics: {},
    media: [],
    tags: [],
    engagement: 0,
    hotScore: 0,
    velocity: 0,
    crossScore: 0,
    metricsAvailable: true,
    ...overrides
  }
}

describe('nativeId', () => {
  it('cat tien to nen tang va giu nguyen phan con lai', () => {
    expect(nativeId(makePost())).toBe('at://did:plc:abc/app.bsky.feed.post/xyz')
  })

  it('giu nguyen dau hai cham nam ben trong dinh danh', () => {
    const post = makePost({ id: 'lemmy:lemmy.world:12345', platform: 'lemmy' })
    expect(nativeId(post)).toBe('lemmy.world:12345')
  })
})

describe('rankComments', () => {
  it('xep theo luot thich khi nguon co so lieu', () => {
    const ranked = rankComments(
      [
        makeComment({ id: 'a', metrics: { likes: 5 } }),
        makeComment({ id: 'b', metrics: { likes: 50 } }),
        makeComment({ id: 'c', metrics: { likes: 20 } })
      ],
      3
    )
    expect(ranked.map((comment) => comment.id)).toEqual(['b', 'c', 'a'])
  })

  it('xep theo so tra loi khi nguon khong co so lieu', () => {
    // Day la truong hop Hacker News: API tra ve points bang null cho binh luan.
    const ranked = rankComments(
      [
        makeComment({ id: 'a', metricsAvailable: false, metrics: {}, replyCount: 2 }),
        makeComment({ id: 'b', metricsAvailable: false, metrics: {}, replyCount: 30 }),
        makeComment({ id: 'c', metricsAvailable: false, metrics: {}, replyCount: 9 })
      ],
      3
    )
    expect(ranked.map((comment) => comment.id)).toEqual(['b', 'c', 'a'])
  })

  it('dung so tra loi de phan dinh khi luot thich bang nhau', () => {
    const ranked = rankComments(
      [
        makeComment({ id: 'it-tra-loi', metrics: { likes: 10 }, replyCount: 1 }),
        makeComment({ id: 'nhieu-tra-loi', metrics: { likes: 10 }, replyCount: 8 })
      ],
      2
    )
    expect(ranked[0].id).toBe('nhieu-tra-loi')
  })

  it('cat dung so luong duoc yeu cau', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      makeComment({ id: `c${index}`, metrics: { likes: index } })
    )
    expect(rankComments(many, 5)).toHaveLength(5)
  })

  it('khong lam thay doi mang dau vao', () => {
    const input = [
      makeComment({ id: 'a', metrics: { likes: 1 } }),
      makeComment({ id: 'b', metrics: { likes: 9 } })
    ]
    rankComments(input, 2)
    expect(input.map((comment) => comment.id)).toEqual(['a', 'b'])
  })

  it('tra ve mang rong khi khong co binh luan nao', () => {
    expect(rankComments([], 5)).toEqual([])
  })
})

describe('truncate', () => {
  it('giu nguyen chuoi ngan hon gioi han', () => {
    expect(truncate('ngan gon', 100)).toBe('ngan gon')
  })

  it('cat chuoi dai va them dau luoc', () => {
    expect(truncate('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}...`)
  })

  it('go khoang trang thua o hai dau', () => {
    expect(truncate('  co khoang trang  ')).toBe('co khoang trang')
  })
})

describe('cutoffTimestamp', () => {
  it('tra ve moc thoi gian lui dung so gio', () => {
    const now = Date.now()
    const cutoff = cutoffTimestamp(24)
    expect(now - cutoff).toBeGreaterThanOrEqual(24 * 3_600_000 - 50)
    expect(now - cutoff).toBeLessThanOrEqual(24 * 3_600_000 + 50)
  })
})
