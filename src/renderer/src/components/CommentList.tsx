import { useEffect, useState } from 'react'
import { AlertCircle, Heart, KeyRound, Loader2, MessageSquare, Reply } from 'lucide-react'
import type { Comment, CommentResult, Post } from '@shared/types'
import { compactNumber, timeAgo } from '../lib/format'

interface CommentListProps {
  post: Post
  /** Mo hop thoai cai dat khi nguon doi hoi khoa ma chua co */
  onOpenSettings: () => void
}

/**
 * Binh luan duoc tai khi nguoi dung mo ra, khong keo san cung luc quet.
 *
 * Mot lan quet nam mang voi muoi bai moi mang la nam muoi bai. Keo binh
 * luan cho tat ca se la nam muoi luot goi them va cham tran nhip cho cua
 * gan het cac API cong khai, trong khi nguoi dung chi doc binh luan cua
 * vai bai ho thuc su quan tam.
 */
export function CommentList({ post, onOpenSettings }: CommentListProps): React.JSX.Element {
  const [result, setResult] = useState<CommentResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    window.pulse
      .fetchComments({ post, limit: 5 })
      .then((response) => {
        if (!cancelled) setResult(response)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          postId: post.id,
          status: 'error',
          comments: [],
          message: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // Nguoi dung co the dong the truoc khi yeu cau tra ve. Co huy giup
    // tranh ghi trang thai vao mot component da bi go khoi cay.
    return () => {
      cancelled = true
    }
  }, [post])

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-3 text-[11.5px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <Loader2 size={13} className="animate-spin" aria-hidden />
        Dang tai binh luan noi bat
      </div>
    )
  }

  if (!result || result.status !== 'ok') {
    const needsKey = result?.status === 'needs-credentials'

    return (
      <div
        className="flex items-start gap-2 px-3 py-3 text-[11.5px]"
        style={{ color: 'var(--text-muted)' }}
      >
        {needsKey ? (
          <KeyRound size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} aria-hidden />
        ) : (
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
        )}
        <span className="flex-1">{result?.message ?? 'Khong lay duoc binh luan.'}</span>
        {needsKey && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="shrink-0 underline"
            style={{ color: 'var(--accent)' }}
          >
            Nhap khoa
          </button>
        )}
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {result.comments.map((comment, index) => (
        <CommentRow key={comment.id} comment={comment} isFirst={index === 0} />
      ))}
    </ul>
  )
}

function CommentRow({
  comment,
  isFirst
}: {
  comment: Comment
  isFirst: boolean
}): React.JSX.Element {
  return (
    <li
      className="px-3 py-2.5"
      style={isFirst ? undefined : { borderTop: '1px solid var(--border-subtle)' }}
    >
      <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          {comment.author.handle ?? comment.author.name}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{timeAgo(comment.createdAt)}</span>
      </div>

      <p
        className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap"
        style={{ color: 'var(--text-primary)' }}
      >
        {comment.content}
      </p>

      <div
        className="mt-1.5 flex items-center gap-3 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        {comment.metricsAvailable ? (
          <span className="inline-flex items-center gap-1">
            <Heart size={11} aria-hidden />
            <span className="tabular-nums">{compactNumber(comment.metrics.likes ?? 0)}</span>
            <span className="sr-only">luot thich</span>
          </span>
        ) : (
          <span title="Nguon khong cong bo so luot thich cho binh luan">
            xep theo so tra loi
          </span>
        )}

        {comment.replyCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Reply size={11} aria-hidden />
            <span className="tabular-nums">{compactNumber(comment.replyCount)}</span>
            <span className="sr-only">tra loi</span>
          </span>
        )}

        {comment.url && (
          <button
            type="button"
            onClick={() => void window.pulse.openExternal(comment.url as string)}
            className="inline-flex items-center gap-1 underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <MessageSquare size={11} aria-hidden />
            mo
          </button>
        )}
      </div>
    </li>
  )
}
