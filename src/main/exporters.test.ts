import { describe, expect, it } from 'vitest'
import { toCsv, toJson, toMarkdown, buildExport } from './exporters'
import type { Post, ProviderResult } from '../shared/types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'bluesky:1',
    platform: 'bluesky',
    content: 'noi dung thu',
    url: 'https://bsky.app/profile/ai/post/1',
    author: { name: 'Ai Do', handle: '@aido.bsky.social' },
    createdAt: '2026-10-17T01:00:00.000Z',
    metrics: { likes: 120, comments: 8, shares: 3 },
    media: [],
    tags: ['#test'],
    engagement: 145,
    hotScore: 100,
    velocity: 50,
    crossScore: 3.2,
    metricsAvailable: true,
    ...overrides
  }
}

function makeResult(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    platform: 'bluesky',
    status: 'ok',
    posts: [makePost()],
    durationMs: 120,
    fetchedAt: '2026-10-17T01:05:00.000Z',
    ...overrides
  }
}

describe('toCsv', () => {
  it('xuat dong tieu de va dung mot dong cho moi bai', () => {
    const csv = toCsv([makePost({ id: 'a' }), makePost({ id: 'b' })])
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('platform')
  })

  it('mo dau bang BOM de Excel doc dung tieng Viet co dau', () => {
    expect(toCsv([makePost()]).startsWith('﻿')).toBe(true)
  })

  it('nhan doi dau nhay kep ben trong o', () => {
    const csv = toCsv([makePost({ title: 'bai co "trich dan" ben trong' })])
    expect(csv).toContain('"bai co ""trich dan"" ben trong"')
  })

  it('giu dau phay trong noi dung ma khong lam vo cot', () => {
    const csv = toCsv([makePost({ content: 'mot, hai, ba' })])
    const dataLine = csv.replace(/^﻿/, '').trim().split('\r\n')[1]
    expect(dataLine).toContain('"mot, hai, ba"')
  })

  it('dep xuong dong trong noi dung thanh khoang trang', () => {
    const csv = toCsv([makePost({ content: 'dong mot\ndong hai' })])
    expect(csv).toContain('dong mot dong hai')
  })

  it('vo hieu hoa o co the bi Excel hieu la cong thuc', () => {
    // Day la lo hong chen cong thuc vao CSV: mot o bat dau bang dau bang
    // se duoc Excel chay nhu cong thuc khi nguoi dung mo file.
    const csv = toCsv([makePost({ title: '=HYPERLINK("http://xau.test")' })])
    expect(csv).toContain(`"'=HYPERLINK`)
  })

  it('de trong o chi so khi nguon khong cong bo so lieu', () => {
    const csv = toCsv([makePost({ metricsAvailable: false, metrics: {} })])
    expect(csv).toContain(',"no",')
  })
})

describe('toJson', () => {
  it('xuat JSON hop le kem moc thoi gian', () => {
    const parsed = JSON.parse(toJson([makeResult()]))
    expect(parsed.generator).toBe('Social Pulse')
    expect(parsed.results).toHaveLength(1)
    expect(typeof parsed.exportedAt).toBe('string')
  })
})

describe('toMarkdown', () => {
  it('ghi tieu de cho tung mang va tung bai', () => {
    const md = toMarkdown([makeResult()])
    expect(md).toContain('# Bai viet nong nhat')
    expect(md).toContain('## Bluesky')
    expect(md).toContain('### 1.')
  })

  it('ghi ly do thay vi danh sach rong khi mang gap su co', () => {
    const md = toMarkdown([
      makeResult({ status: 'needs-credentials', posts: [], message: 'Chua co khoa.' })
    ])
    expect(md).toContain('> Chua co khoa.')
  })

  it('noi ro khi nguon khong cong bo so lieu thay vi ghi so khong', () => {
    const md = toMarkdown([
      makeResult({ posts: [makePost({ metricsAvailable: false, metrics: {} })] })
    ])
    expect(md).toContain('nguon khong cong bo so lieu')
  })
})

describe('buildExport', () => {
  it.each([
    ['csv', 'csv'],
    ['json', 'json'],
    ['markdown', 'md']
  ] as const)('chon dung duoi file cho dinh dang %s', (format, extension) => {
    const output = buildExport(format, [makeResult()], [makePost()])
    expect(output.extension).toBe(extension)
    expect(output.content.length).toBeGreaterThan(0)
  })
})
