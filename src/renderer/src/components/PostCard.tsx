import { memo, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  MessageCircle,
  Repeat2,
  Eye,
  Heart,
  Sparkles
} from 'lucide-react'
import type { Post } from '@shared/types'
import { PLATFORM_MAP } from '@shared/platforms'
import { compactNumber, displayBody, displayTitle, metricsSummary, timeAgo } from '../lib/format'
import { CommentList } from './CommentList'

interface PostCardProps {
  post: Post
  rank: number
  isNew: boolean
  bookmarked: boolean
  onToggleBookmark: (id: string) => void
  /** Dung mau cho che do toi hay sang */
  dark: boolean
  onOpenSettings: () => void
}

function Metric({
  icon: Icon,
  value,
  label
}: {
  icon: typeof Heart
  value: number | undefined
  label: string
}): React.JSX.Element | null {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value.toLocaleString('vi-VN')}`}>
      <Icon size={13} strokeWidth={2} aria-hidden />
      <span className="tabular-nums">{compactNumber(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

function PostCardBase({
  post,
  rank,
  isNew,
  bookmarked,
  onToggleBookmark,
  dark,
  onOpenSettings
}: PostCardProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const meta = PLATFORM_MAP[post.platform]
  const accent = dark ? meta?.accentDark : meta?.accentLight
  const title = displayTitle(post)
  const body = displayBody(post)
  const thumbnail = post.media.find((item) => item.thumbnailUrl || item.type === 'image')

  async function copyLink(): Promise<void> {
    await window.pulse.copyToClipboard(post.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <article
      className="group relative rounded-xl border transition-colors"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div className="flex gap-3 p-3">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1.5 pt-0.5">
          <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {rank}
          </span>
          <span
            className="h-7 w-1.5 rounded-full"
            style={{ background: accent }}
            title={meta?.label}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="font-medium" style={{ color: accent }}>
              {meta?.label ?? post.platform}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{post.author.handle ?? post.author.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>

            {isNew && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'var(--heat-track)', color: 'var(--good)' }}
              >
                <Sparkles size={10} aria-hidden /> moi
              </span>
            )}
          </div>

          <h3
            className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h3>

          {body && (
            <p
              className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {body}
            </p>
          )}

          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={metricsSummary(post)}
          >
            {post.metricsAvailable ? (
              <>
                <Metric icon={Heart} value={post.metrics.likes} label="luot thich" />
                <Metric icon={MessageCircle} value={post.metrics.comments} label="binh luan" />
                <Metric icon={Repeat2} value={post.metrics.shares} label="chia se" />
                <Metric icon={Eye} value={post.metrics.views} label="luot xem" />
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Nguon chi cho thu hang, khong cong bo so lieu tuong tac
              </span>
            )}

            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded px-1.5 py-0.5 text-[10.5px]"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {thumbnail && (
          <img
            src={thumbnail.thumbnailUrl ?? thumbnail.url}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
            style={{ background: 'var(--surface-2)' }}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        )}

        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <div
            className="rounded-md px-2 py-1 text-center"
            style={{ background: 'var(--surface-2)' }}
            title={
              post.metricsAvailable
                ? `Gap ${post.crossScore} lan muc thuong ngay cua ${meta?.label}`
                : 'Diem suy ra tu thu hang do nguon cung cap'
            }
          >
            <div
              className="text-[13px] font-semibold tabular-nums leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              {post.hotScore}
            </div>
            <div className="mt-0.5 text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              diem nong
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => onToggleBookmark(post.id)}
              className="rounded p-1.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: bookmarked ? 'var(--accent)' : 'var(--text-muted)' }}
              title={bookmarked ? 'Bo luu' : 'Luu lai'}
              aria-label={bookmarked ? 'Bo luu bai nay' : 'Luu bai nay'}
            >
              {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>

            <button
              type="button"
              onClick={copyLink}
              className="rounded p-1.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: copied ? 'var(--good)' : 'var(--text-muted)' }}
              title={copied ? 'Da chep' : 'Chep lien ket'}
              aria-label="Chep lien ket bai viet"
            >
              <Copy size={15} />
            </button>

            <button
              type="button"
              onClick={() => void window.pulse.openExternal(post.url)}
              className="rounded p-1.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-muted)' }}
              title="Mo trong trinh duyet"
              aria-label="Mo bai viet trong trinh duyet"
            >
              <ExternalLink size={15} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ borderTop: showComments ? '1px solid var(--border-subtle)' : 'none' }}>
        <button
          type="button"
          onClick={() => setShowComments((open) => !open)}
          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11.5px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-muted)' }}
          aria-expanded={showComments}
        >
          <ChevronDown
            size={13}
            aria-hidden
            style={{
              transform: showComments ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms'
            }}
          />
          {showComments ? 'An binh luan' : 'Binh luan noi bat'}
        </button>

        {showComments && <CommentList post={post} onOpenSettings={onOpenSettings} />}
      </div>
    </article>
  )
}

/**
 * Boc memo vi mot lan quet co the dung den nam muoi the, va moi lan go phim
 * trong o tim kiem deu khien danh sach ve lai. Khong co memo thi tat ca cac
 * the deu dung lai, keo theo ca trang thai mo binh luan ben trong chung.
 */
export const PostCard = memo(PostCardBase)
