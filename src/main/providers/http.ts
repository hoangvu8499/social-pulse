/** User-Agent mac dinh. Nhieu API cong khai tu choi request khong khai bao UA that. */
export const DEFAULT_USER_AGENT =
  'SocialPulse/1.0 (desktop trend reader; +https://github.com/local/social-pulse)'

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface GetJsonOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
}

/**
 * Goi GET tra ve JSON, co timeout va retry luy thua.
 * Chi retry voi loi mang hoac loi 5xx/429; loi 4xx con lai nem ra ngay
 * vi retry cung khong doi duoc ket qua.
 */
export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  const { headers = {}, timeoutMs = 15_000, retries = 2 } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await delay(500 * 2 ** (attempt - 1))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json', ...headers },
        signal: controller.signal
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        const error = new HttpError(
          `${response.status} ${response.statusText} khi goi ${hostOf(url)}`,
          response.status,
          body.slice(0, 500)
        )
        if (response.status >= 500 || response.status === 429) {
          lastError = error
          continue
        }
        throw error
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) {
        throw error
      }
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Chuan hoa ten mien nguoi dung nhap: bo giao thuc, dau gach cuoi va khoang trang. */
export function normalizeInstance(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return fallback
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}
