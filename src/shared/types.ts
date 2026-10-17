/**
 * Model du lieu dung chung cho moi mang xa hoi.
 * Moi provider co nhiem vu map du lieu goc cua minh ve dung shape nay,
 * nho vay tang UI khong can biet bai viet den tu dau.
 */

export type PlatformId =
  | 'reddit'
  | 'hackernews'
  | 'mastodon'
  | 'bluesky'
  | 'lemmy'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'facebook'

export interface PostAuthor {
  name: string
  handle?: string
  avatarUrl?: string
  profileUrl?: string
}

export interface PostMedia {
  type: 'image' | 'video' | 'link'
  url: string
  thumbnailUrl?: string
}

export interface PostMetrics {
  likes?: number
  comments?: number
  shares?: number
  views?: number
}

export interface Post {
  /** Khoa duy nhat trong toan app: `${platform}:${nativeId}` */
  id: string
  platform: PlatformId
  title?: string
  content: string
  url: string
  author: PostAuthor
  /** ISO 8601 */
  createdAt: string
  metrics: PostMetrics
  media: PostMedia[]
  tags: string[]
  /** Tong tuong tac tho, dung de xep hang trong cung mot mang */
  engagement: number
  /** Diem nong 0-100, da chuan hoa de so sanh cheo giua cac mang */
  hotScore: number
  /** Tuong tac tren moi gio tuoi doi cua bai viet */
  velocity: number
  /**
   * False khi nguon chi cho biet thu hang ma khong cong bo so lieu tuong tac.
   * UI phai hien thu hang thay vi bia ra con so.
   */
  metricsAvailable: boolean
  /**
   * Diem so sanh cheo giua cac mang: van toc tuong tac cua bai nay gap bao
   * nhieu lan van toc trung vi cua chinh mang do. Khac voi hotScore von luon
   * cham bai dan dau cua moi mang dung 100 diem, chi so nay giu duoc khoang
   * cach that giua mot bai chay vua va mot bai bung no.
   */
  crossScore: number
  /** Thu hang goc do chinh nen tang xep, dung khi khong co so lieu */
  sourceRank?: number
}

/**
 * Mot binh luan noi bat duoi bai viet.
 *
 * Khong phai nen tang nao cung cong bo so lieu cho binh luan. Hacker News
 * la vi du: API tra ve `points` bang null cho moi binh luan. Truong hop do
 * `metricsAvailable` la false va thu tu duoc suy ra tu so luot tra loi,
 * vi mot binh luan keo theo nhieu tranh luan thi dung la binh luan nong.
 */
export interface Comment {
  id: string
  author: PostAuthor
  content: string
  createdAt: string
  metrics: PostMetrics
  /** So tra loi truc tiep duoi binh luan nay */
  replyCount: number
  url?: string
  metricsAvailable: boolean
}

export type CommentStatus = 'ok' | 'empty' | 'needs-credentials' | 'unsupported' | 'error'

export interface CommentResult {
  postId: string
  status: CommentStatus
  comments: Comment[]
  message?: string
}

export interface ProviderCredentials {
  youtubeApiKey?: string
  youtubeRegion?: string
  xBearerToken?: string
  xQuery?: string
  threadsAccessToken?: string
  facebookPageToken?: string
  facebookPageId?: string
  redditClientId?: string
  redditClientSecret?: string
  mastodonInstance?: string
  lemmyInstance?: string
}

export type ProviderStatus = 'ok' | 'empty' | 'needs-credentials' | 'unsupported' | 'error'

export interface ProviderResult {
  platform: PlatformId
  status: ProviderStatus
  posts: Post[]
  /** Thong diep giai thich khi status khac 'ok' */
  message?: string
  /** Du lieu nay lay tu cache thay vi goi moi ra ngoai */
  fromCache?: boolean
  /** Thoi gian goi API, tinh bang ms */
  durationMs: number
  fetchedAt: string
}

export interface FetchOptions {
  platforms: PlatformId[]
  limit: number
  /** Chi lay bai dang trong bao nhieu gio gan day */
  sinceHours: number
  credentials: ProviderCredentials
}

export interface PlatformMeta {
  id: PlatformId
  label: string
  /** Mau dinh danh tren nen sang */
  accentLight: string
  /** Mau dinh danh tren nen toi, lay tu cung bo mau nhung da buoc lai cho nen toi */
  accentDark: string
  /** Co chay duoc ngay khong can khai bao gi khong */
  worksOutOfTheBox: boolean
  /** Giai thich ngan ve dieu kien de dung duoc */
  requirement?: string
}

export interface Snapshot {
  id: string
  takenAt: string
  options: Omit<FetchOptions, 'credentials'>
  results: ProviderResult[]
}

export interface AppSettings {
  credentials: ProviderCredentials
  enabledPlatforms: PlatformId[]
  limit: number
  sinceHours: number
  autoRefreshMinutes: number
  theme: 'dark' | 'light' | 'system'
  keepSnapshots: number
}
