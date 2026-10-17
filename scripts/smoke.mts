/**
 * Chay thu mot lan quet that va in ket qua ra terminal.
 * Dung de mat thuong kiem tra chat luong du lieu:  npm run smoke
 */
import { fetchAll, mergeRanked } from '../src/main/providers/index'
import type { PlatformId } from '../src/shared/types'

const platforms: PlatformId[] = ['reddit', 'hackernews', 'mastodon', 'bluesky', 'lemmy']

const results = await fetchAll({
  platforms,
  limit: 10,
  sinceHours: 24,
  credentials: {}
})

for (const result of results) {
  const head = `${result.platform.padEnd(12)} ${result.status.padEnd(18)} ${String(result.durationMs).padStart(5)}ms  ${result.posts.length} bai`
  console.log(`\n${head}`)
  if (result.message) console.log(`  -> ${result.message}`)

  for (const [index, post] of result.posts.slice(0, 3).entries()) {
    const label = (post.title || post.content || '(trong)').replace(/\s+/g, ' ').slice(0, 72)
    const stats = post.metricsAvailable
      ? `like=${post.metrics.likes ?? 0} cmt=${post.metrics.comments ?? 0} share=${post.metrics.shares ?? 0}`
      : 'chi co thu hang'
    console.log(`  ${index + 1}. [${String(post.hotScore).padStart(5)}] ${label}`)
    console.log(`     ${stats}  |  ${post.author.handle ?? post.author.name}`)
  }
}

console.log('\n=== BANG XEP HANG CHUNG (top 10 moi mang gop lai) ===')
for (const [index, post] of mergeRanked(results, 10).entries()) {
  const label = (post.title || post.content || '(trong)').replace(/\s+/g, ' ').slice(0, 64)
  console.log(`${String(index + 1).padStart(2)}. ${post.platform.padEnd(11)} ${String(post.hotScore).padStart(5)}  ${label}`)
}
