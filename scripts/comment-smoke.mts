/**
 * Quet mot vong roi lay binh luan noi bat cua bai dau moi mang.
 * Dung de mat thuong kiem tra chat luong du lieu binh luan.
 */
import { fetchPlatform, fetchComments } from '../src/main/providers/index'
import type { PlatformId } from '../src/shared/types'

const platforms: PlatformId[] = ['bluesky', 'mastodon', 'lemmy', 'hackernews']

for (const platform of platforms) {
  const result = await fetchPlatform(platform, {
    platforms: [platform],
    limit: 3,
    sinceHours: 24,
    credentials: {}
  })

  const post = result.posts[0]
  console.log(`\n=== ${platform.toUpperCase()} (${result.status}) ===`)
  if (!post) {
    console.log('  khong co bai:', result.message)
    continue
  }

  const label = (post.title || post.content || '(trong)').replace(/\s+/g, ' ').slice(0, 68)
  console.log(`  bai: ${label}`)

  const comments = await fetchComments(post, {}, 3)
  console.log(`  binh luan: ${comments.status}${comments.message ? ' - ' + comments.message : ''}`)

  for (const [index, comment] of comments.comments.entries()) {
    const text = comment.content.replace(/\s+/g, ' ').slice(0, 66)
    const stat = comment.metricsAvailable
      ? `${comment.metrics.likes ?? 0} thich, ${comment.replyCount} tra loi`
      : `${comment.replyCount} tra loi (khong co so lieu thich)`
    console.log(`   ${index + 1}. ${text}`)
    console.log(`      ${comment.author.handle ?? comment.author.name} | ${stat}`)
  }
}
