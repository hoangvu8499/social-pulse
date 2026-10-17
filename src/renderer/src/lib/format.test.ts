import { describe, expect, it } from 'vitest'
import { compactNumber, displayBody, displayTitle, metricsSummary, timeAgo } from './format'
import type { Post } from '@shared/types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'bluesky:1',
    platform: 'bluesky',
    content: '',
    url: 'https://bsky.app/profile/ai/post/1',
    author: { name: 'Ai Do' },
    createdAt: new Date().toISOString(),
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

describe('compactNumber', () => {
  it('giu nguyen so duoi mot nghin', () => {
    expect(compactNumber(999)).toBe('999')
  })

  it('rut gon so tu mot nghin tro len', () => {
    expect(compactNumber(12_400)).toMatch(/12/)
  })

  it('tra ve gach ngang khi khong co gia tri', () => {
    expect(compactNumber(undefined)).toBe('-')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-17T12:00:00.000Z').getTime()

  it('goi khoang duoi mot phut la vua xong', () => {
    expect(timeAgo('2026-10-17T11:59:30.000Z', now)).toBe('vua xong')
  })

  it('tinh theo phut trong vong mot gio', () => {
    expect(timeAgo('2026-10-17T11:30:00.000Z', now)).toBe('30 phut truoc')
  })

  it('tinh theo gio trong vong mot ngay', () => {
    expect(timeAgo('2026-10-17T09:00:00.000Z', now)).toBe('3 gio truoc')
  })

  it('tinh theo ngay khi qua mot ngay', () => {
    expect(timeAgo('2026-10-14T12:00:00.000Z', now)).toBe('3 ngay truoc')
  })

  it('bao khong ro khi ngay thang khong hop le', () => {
    expect(timeAgo('hom qua', now)).toBe('khong ro')
  })
})

describe('displayTitle', () => {
  it('uu tien tieu de that', () => {
    expect(displayTitle(makePost({ title: 'Tieu de', content: 'Noi dung' }))).toBe('Tieu de')
  })

  it('lay dong dau noi dung khi khong co tieu de', () => {
    expect(displayTitle(makePost({ content: 'dong dau\ndong hai' }))).toBe('dong dau')
  })

  it('bo qua dong trong o dau noi dung', () => {
    expect(displayTitle(makePost({ content: '\n\n  \nnoi dung that' }))).toBe('noi dung that')
  })

  it('goi ten theo phuong tien khi bai khong co chu', () => {
    const anh = makePost({ media: [{ type: 'image', url: 'https://x.test/a.jpg' }] })
    const video = makePost({ media: [{ type: 'video', url: 'https://x.test/a.m3u8' }] })

    expect(displayTitle(anh)).toBe('(bai chi co hinh anh)')
    expect(displayTitle(video)).toBe('(bai chi co video)')
  })

  it('bao bai rong khi khong co ca chu lan phuong tien', () => {
    expect(displayTitle(makePost())).toBe('(bai khong co van ban)')
  })
})

describe('displayBody', () => {
  it('giu toan bo noi dung khi da co tieu de rieng', () => {
    const post = makePost({ title: 'Tieu de', content: 'Toan bo noi dung' })
    expect(displayBody(post)).toBe('Toan bo noi dung')
  })

  it('bo dong da dung lam tieu de de khong hien trung lap', () => {
    const post = makePost({ content: 'dong dau\ndong hai\ndong ba' })
    expect(displayBody(post)).toBe('dong hai\ndong ba')
  })
})

describe('metricsSummary', () => {
  it('noi ro khi nguon khong cong bo so lieu', () => {
    expect(metricsSummary(makePost({ metricsAvailable: false }))).toContain('khong cong bo')
  })

  it('chi liet ke chi so thuc su co', () => {
    const summary = metricsSummary(makePost({ metrics: { likes: 10, comments: 0 } }))
    expect(summary).toContain('thich')
    expect(summary).not.toContain('binh luan')
  })

  it('bao chua co tuong tac khi moi chi so deu bang khong', () => {
    expect(metricsSummary(makePost({ metrics: { likes: 0 } }))).toBe('Chua co tuong tac nao')
  })
})
