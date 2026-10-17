import { describe, expect, it } from 'vitest'
import {
  ageInHours,
  applyHotScores,
  dedupePosts,
  median,
  stripHtml,
  stripLeadingMentions,
  totalEngagement
} from './scoring'
import type { Post } from './types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'test:1',
    platform: 'mastodon',
    content: 'noi dung',
    url: 'https://example.test/1',
    author: { name: 'ai do' },
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

const HOUR = 3_600_000

describe('ageInHours', () => {
  it('tinh dung so gio da troi qua', () => {
    const now = Date.now()
    const threeHoursAgo = new Date(now - 3 * HOUR).toISOString()
    expect(ageInHours(threeHoursAgo, now)).toBeCloseTo(3, 5)
  })

  it('chan duoi nua gio de bai vua dang khong lam no diem', () => {
    const now = Date.now()
    const justNow = new Date(now - 1000).toISOString()
    expect(ageInHours(justNow, now)).toBe(0.5)
  })

  it('tra ve moc chan duoi khi ngay thang khong hop le', () => {
    expect(ageInHours('khong phai ngay thang')).toBe(0.5)
  })
})

describe('totalEngagement', () => {
  it('cho binh luan va chia se trong so cao hon like', () => {
    const likeOnly = totalEngagement({ metrics: { likes: 10 } })
    const commentOnly = totalEngagement({ metrics: { comments: 10 } })
    const shareOnly = totalEngagement({ metrics: { shares: 10 } })

    expect(likeOnly).toBe(10)
    expect(commentOnly).toBe(20)
    expect(shareOnly).toBe(30)
  })

  it('tinh view voi he so rat thap vi view de dat hon nhieu', () => {
    expect(totalEngagement({ metrics: { views: 10_000 } })).toBe(100)
  })

  it('coi chi so thieu la khong', () => {
    expect(totalEngagement({ metrics: {} })).toBe(0)
  })
})

describe('applyHotScores', () => {
  const now = Date.now()

  it('tra ve mang rong khi khong co bai nao', () => {
    expect(applyHotScores([], now)).toEqual([])
  })

  it('cho bai co van toc cao nhat dung 100 diem', () => {
    const scored = applyHotScores(
      [
        makePost({ id: 'a', metrics: { likes: 100 }, createdAt: new Date(now - HOUR).toISOString() }),
        makePost({ id: 'b', metrics: { likes: 10 }, createdAt: new Date(now - HOUR).toISOString() })
      ],
      now
    )

    expect(scored[0].id).toBe('a')
    expect(scored[0].hotScore).toBe(100)
    expect(scored[1].hotScore).toBe(10)
  })

  it('uu tien bai moi hon khi tuong tac bang nhau', () => {
    const scored = applyHotScores(
      [
        makePost({ id: 'cu', metrics: { likes: 100 }, createdAt: new Date(now - 10 * HOUR).toISOString() }),
        makePost({ id: 'moi', metrics: { likes: 100 }, createdAt: new Date(now - 2 * HOUR).toISOString() })
      ],
      now
    )

    expect(scored[0].id).toBe('moi')
    expect(scored[0].hotScore).toBeGreaterThan(scored[1].hotScore)
  })

  it('cham diem theo thu hang khi nguon khong cong bo so lieu', () => {
    const scored = applyHotScores(
      [
        makePost({ id: 'thu-ba', metricsAvailable: false, sourceRank: 2 }),
        makePost({ id: 'thu-nhat', metricsAvailable: false, sourceRank: 0 }),
        makePost({ id: 'thu-hai', metricsAvailable: false, sourceRank: 1 })
      ],
      now
    )

    expect(scored.map((post) => post.id)).toEqual(['thu-nhat', 'thu-hai', 'thu-ba'])
    expect(scored[0].hotScore).toBe(100)
    expect(scored[0].hotScore).toBeGreaterThan(scored[2].hotScore)
    // Khong duoc bia ra so lieu tuong tac cho nguon chi co thu hang.
    expect(scored.every((post) => post.engagement === 0)).toBe(true)
  })

  it('cham tat ca ve khong khi khong bai nao co tuong tac', () => {
    const scored = applyHotScores([makePost({ metrics: { likes: 0 } })], now)
    expect(scored[0].hotScore).toBe(0)
  })
})

describe('stripHtml', () => {
  it('go the va giai ma thuc the HTML', () => {
    expect(stripHtml('<p>Xin <b>chao</b> &amp; tam biet</p>')).toBe('Xin chao & tam biet')
  })

  it('doi the xuong dong thanh ky tu xuong dong', () => {
    expect(stripHtml('dong mot<br/>dong hai')).toBe('dong mot\ndong hai')
  })

  it('go bot dong trong lien tiep', () => {
    expect(stripHtml('<p>mot</p><p>hai</p>')).toBe('mot\n\nhai')
  })
})

describe('dedupePosts', () => {
  it('bo bai trung dinh danh', () => {
    const result = dedupePosts([makePost({ id: 'a' }), makePost({ id: 'a' }), makePost({ id: 'b' })])
    expect(result.map((post) => post.id)).toEqual(['a', 'b'])
  })

  it('bo bai dang cheo co cung noi dung trong cung mot mang', () => {
    const text = 'Cung mot noi dung duoc dang sang hai cong dong khac nhau'
    const result = dedupePosts([
      makePost({ id: 'a', platform: 'lemmy', title: text }),
      makePost({ id: 'b', platform: 'lemmy', title: text })
    ])
    expect(result).toHaveLength(1)
  })

  it('giu lai bai cung noi dung nhung o hai mang khac nhau', () => {
    const text = 'Mot su kien duoc ban luan o nhieu noi cung luc'
    const result = dedupePosts([
      makePost({ id: 'a', platform: 'lemmy', title: text }),
      makePost({ id: 'b', platform: 'mastodon', title: text })
    ])
    expect(result).toHaveLength(2)
  })

  it('khong gop nhung bai co van ban qua ngan', () => {
    const result = dedupePosts([
      makePost({ id: 'a', platform: 'lemmy', title: 'ok' }),
      makePost({ id: 'b', platform: 'lemmy', title: 'ok' })
    ])
    expect(result).toHaveLength(2)
  })

  it('giu nguyen thu tu dau vao', () => {
    const result = dedupePosts([makePost({ id: 'x' }), makePost({ id: 'y' }), makePost({ id: 'z' })])
    expect(result.map((post) => post.id)).toEqual(['x', 'y', 'z'])
  })
})

describe('median', () => {
  it('tra ve gia tri giua voi so luong le', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('tra ve trung binh hai gia tri giua voi so luong chan', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('tra ve khong voi mang rong', () => {
    expect(median([])).toBe(0)
  })
})

describe('stripHtml voi thuc the dang so', () => {
  it('giai ma thuc the thap phan', () => {
    expect(stripHtml('there&#39;s')).toBe(`there${String.fromCharCode(39)}s`)
  })

  it('giai ma thuc the thap luc phan, dang Hacker News dung', () => {
    expect(stripHtml('there&#x27;s')).toBe(`there${String.fromCharCode(39)}s`)
  })

  it('khong giai ma hai lan khi dau va da duoc ma hoa san', () => {
    // `&amp;#39;` phai cho ra chuoi `&#39;` chu khong phai dau nhay don.
    expect(stripHtml('a &amp;#39; b')).toBe('a &#39; b')
  })

  it('giai ma ky tu ngoai bang ma co ban', () => {
    expect(stripHtml('&#128512;')).toBe(String.fromCodePoint(128512))
  })
})

describe('stripLeadingMentions', () => {
  it('go mot luot nhac ten o dau', () => {
    expect(stripLeadingMentions('@aido noi dung that')).toBe('noi dung that')
  })

  it('go nhieu luot nhac ten lien tiep', () => {
    expect(stripLeadingMentions('@mot @hai@may.chu ba')).toBe('ba')
  })

  it('giu nguyen luot nhac ten nam giua cau', () => {
    expect(stripLeadingMentions('chao @aido nhe')).toBe('chao @aido nhe')
  })

  it('khong lam gi khi khong co luot nhac ten', () => {
    expect(stripLeadingMentions('noi dung binh thuong')).toBe('noi dung binh thuong')
  })
})
