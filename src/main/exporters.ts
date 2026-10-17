import type { Post, ProviderResult } from '../shared/types'
import { PLATFORM_MAP } from '../shared/platforms'

/** Cac dinh dang xuat du lieu ma app ho tro. */
export type ExportFormat = 'json' | 'csv' | 'markdown'

const CSV_COLUMNS = [
  'platform',
  'rank',
  'hot_score',
  'cross_score',
  'title',
  'content',
  'author',
  'handle',
  'url',
  'created_at',
  'likes',
  'comments',
  'shares',
  'views',
  'metrics_available',
  'tags'
] as const

/**
 * Boc mot o CSV.
 *
 * Hai chi tiet de hong ma phai xu ly: noi dung mang xa hoi thuong chua
 * dau phay, dau nhay kep va ca ky tu xuong dong, nen moi o deu phai duoc
 * boc trong dau nhay kep va nhan doi dau nhay ben trong. Ngoai ra o bat
 * dau bang =, +, - hoac @ se bi Excel hieu la cong thuc, nen can chen
 * mot dau nhay don o dau de vo hieu hoa.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(posts: Post[]): string {
  const rows = [CSV_COLUMNS.join(',')]

  posts.forEach((post, index) => {
    rows.push(
      [
        post.platform,
        index + 1,
        post.hotScore,
        post.crossScore,
        post.title ?? '',
        post.content.replace(/\r?\n/g, ' '),
        post.author.name,
        post.author.handle ?? '',
        post.url,
        post.createdAt,
        post.metrics.likes ?? '',
        post.metrics.comments ?? '',
        post.metrics.shares ?? '',
        post.metrics.views ?? '',
        post.metricsAvailable ? 'yes' : 'no',
        post.tags.join(' ')
      ]
        .map(csvCell)
        .join(',')
    )
  })

  // Them BOM de Excel tren Windows mo dung tieng Viet co dau.
  return `﻿${rows.join('\r\n')}\r\n`
}

export function toJson(results: ProviderResult[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      generator: 'Social Pulse',
      results
    },
    null,
    2
  )
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '-'
  return value.toLocaleString('vi-VN')
}

export function toMarkdown(results: ProviderResult[]): string {
  const lines: string[] = []
  const stamp = new Date().toLocaleString('vi-VN')

  lines.push(`# Bai viet nong nhat`, '', `Quet luc ${stamp}`, '')

  for (const result of results) {
    const meta = PLATFORM_MAP[result.platform]
    lines.push(`## ${meta?.label ?? result.platform}`, '')

    if (result.status !== 'ok') {
      lines.push(`> ${result.message ?? 'Khong lay duoc du lieu.'}`, '')
      continue
    }

    for (const [index, post] of result.posts.entries()) {
      const heading = post.title || post.content.split('\n')[0] || '(khong co tieu de)'
      lines.push(`### ${index + 1}. ${heading.slice(0, 120)}`)
      lines.push('')
      lines.push(`- Diem nong: ${post.hotScore} | So voi muc thuong ngay: x${post.crossScore}`)
      lines.push(`- Tac gia: ${post.author.handle ?? post.author.name}`)
      lines.push(`- Dang luc: ${new Date(post.createdAt).toLocaleString('vi-VN')}`)

      if (post.metricsAvailable) {
        lines.push(
          `- Tuong tac: ${formatNumber(post.metrics.likes)} thich, ` +
            `${formatNumber(post.metrics.comments)} binh luan, ` +
            `${formatNumber(post.metrics.shares)} chia se`
        )
      } else {
        lines.push(`- Tuong tac: nguon khong cong bo so lieu, chi co thu hang`)
      }

      lines.push(`- Lien ket: ${post.url}`)

      if (post.title && post.content) {
        lines.push('', `> ${post.content.split('\n').join('\n> ').slice(0, 500)}`)
      }

      lines.push('')
    }
  }

  return lines.join('\n')
}

export function buildExport(
  format: ExportFormat,
  results: ProviderResult[],
  merged: Post[]
): { content: string; extension: string } {
  switch (format) {
    case 'csv':
      return { content: toCsv(merged), extension: 'csv' }
    case 'markdown':
      return { content: toMarkdown(results), extension: 'md' }
    case 'json':
    default:
      return { content: toJson(results), extension: 'json' }
  }
}
