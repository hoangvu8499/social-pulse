import type { PlatformMeta, PlatformId } from './types'

/**
 * Danh sach mang xa hoi app ho tro.
 *
 * `worksOutOfTheBox` phan anh su that ve API cong khai cua tung nen tang:
 * mot so mang cho doc du lieu thinh hanh ma khong can dang ky gi,
 * so con lai bat buoc phai co khoa rieng.
 *
 * Ve mau sac: bang mau nay lay tu bo mau phan loai da qua kiem dinh, chu
 * khong phai mau thuong hieu goc cua tung mang. Ly do la mau thuong hieu
 * dat canh nhau thi khong phan biet duoc: Bluesky va Facebook deu xanh
 * duong, con Reddit, Hacker News va YouTube deu nam trong dai do cam. Bo
 * mau duoi day dat moi nguong ve do tach bach, ke ca voi nguoi mu mau, o
 * ca hai che do sang va toi. Bon mang van tinh co trung voi mau thuong
 * hieu that cua minh.
 *
 * X nhan mau trung tinh vi bo mau chi bao dam tach bach cho tam vi tri.
 * Dieu do chap nhan duoc o day vi ten mang luon hien thi ngay canh cham
 * mau, nen danh tinh khong bao gio chi dua vao mau.
 */
export const PLATFORMS: PlatformMeta[] = [
  {
    id: 'bluesky',
    label: 'Bluesky',
    accentLight: '#2a78d6',
    accentDark: '#3987e5',
    worksOutOfTheBox: true
  },
  {
    id: 'reddit',
    label: 'Reddit',
    accentLight: '#eb6834',
    accentDark: '#d95926',
    worksOutOfTheBox: true,
    requirement:
      'Chay duoc ngay qua RSS cong khai, nhung feed do khong kem so lieu tuong tac va bi chan sau khoang mot yeu cau moi phut. Them Client ID va Secret de dung OAuth.'
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    accentLight: '#1baf7a',
    accentDark: '#199e70',
    worksOutOfTheBox: true
  },
  {
    id: 'hackernews',
    label: 'Hacker News',
    accentLight: '#eda100',
    accentDark: '#c98500',
    worksOutOfTheBox: true
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    accentLight: '#6250d6',
    accentDark: '#9085e9',
    worksOutOfTheBox: true
  },
  {
    id: 'youtube',
    label: 'YouTube',
    accentLight: '#e34948',
    accentDark: '#e66767',
    worksOutOfTheBox: false,
    requirement: 'Can YouTube Data API v3 key, dang ky mien phi tai Google Cloud Console.'
  },
  {
    id: 'x',
    label: 'X / Twitter',
    accentLight: '#6b7280',
    accentDark: '#9ca3af',
    worksOutOfTheBox: false,
    requirement:
      'Can Bearer Token cua X API v2. Endpoint tim kiem nam o goi tra phi, goi Free khong doc duoc timeline.'
  },
  {
    id: 'threads',
    label: 'Threads',
    accentLight: '#e87ba4',
    accentDark: '#d55181',
    worksOutOfTheBox: false,
    requirement:
      'Threads API chi cho doc bai cua chinh tai khoan da uy quyen. Meta khong mo endpoint bai thinh hanh toan mang.'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    accentLight: '#008300',
    accentDark: '#008300',
    worksOutOfTheBox: false,
    requirement:
      'Graph API chi cho doc Page ma ban quan tri. Khong co endpoint cong khai cho bai hot toan mang.'
  }
]

export const PLATFORM_MAP: Record<PlatformId, PlatformMeta> = Object.fromEntries(
  PLATFORMS.map((platform) => [platform.id, platform])
) as Record<PlatformId, PlatformMeta>

export const DEFAULT_PLATFORMS: PlatformId[] = PLATFORMS.filter(
  (platform) => platform.worksOutOfTheBox
).map((platform) => platform.id)
