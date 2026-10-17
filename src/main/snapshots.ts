import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { ProviderResult, Snapshot, FetchOptions } from '../shared/types'

/**
 * Luu lai moi lan quet de theo doi xu huong theo thoi gian.
 *
 * Mot bai dang nong hom nay chi co y nghia khi biet hom qua no o dau.
 * Snapshot cho phep tra loi nhung cau hoi kieu "chu de nay bat dau lan
 * truyen tu luc nao" ma mot lan quet don le khong tra loi duoc.
 */

let historyPath: string | null = null

function filePath(): string {
  if (!historyPath) {
    historyPath = join(app.getPath('userData'), 'snapshots.json')
  }
  return historyPath
}

export function loadSnapshots(): Snapshot[] {
  const path = filePath()
  if (!existsSync(path)) return []

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as Snapshot[]) : []
  } catch {
    return []
  }
}

function persist(snapshots: Snapshot[]): void {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(snapshots), 'utf-8')
  renameSync(temp, path)
}

/**
 * Thu gon ket qua truoc khi ghi ra dia.
 *
 * Luu nguyen ket qua day du thi moi lan quet ton khoang 120 KB, va voi cai
 * dat mac dinh giu ba muoi lan thi file len toi vai megabyte, bi ghi lai
 * toan bo sau moi lan quet. Phan thuc su can giu chi la du de doi chieu hai
 * lan quet va nhin lai sau nay, nen noi dung bai bi cat bo. Cach nay giam
 * kich thuoc khoang hai muoi lan ma khong mat gi dang ke.
 */
function slim(results: ProviderResult[]): ProviderResult[] {
  return results.map((result) => ({
    ...result,
    posts: result.posts.map((post) => ({
      ...post,
      content: '',
      title: post.title?.slice(0, 120),
      media: [],
      tags: []
    }))
  }))
}

export function addSnapshot(
  results: ProviderResult[],
  options: Omit<FetchOptions, 'credentials'>,
  keep: number
): Snapshot {
  const snapshot: Snapshot = {
    id: `snap-${Date.now()}`,
    takenAt: new Date().toISOString(),
    options,
    results: slim(results)
  }

  // Giu ban moi nhat o dau va cat bot phan duoi, de file khong phinh mai.
  const next = [snapshot, ...loadSnapshots()].slice(0, Math.max(keep, 1))
  persist(next)

  return snapshot
}

export function clearSnapshots(): void {
  persist([])
}

export function snapshotsFilePath(): string {
  return filePath()
}

/**
 * Doi chieu lan quet hien tai voi lan quet gan nhat truoc do,
 * cho biet bai nao moi xuat hien va bai nao da roi khoi bang.
 */
export interface SnapshotDiff {
  previousAt: string | null
  newPostIds: string[]
  droppedPostIds: string[]
}

export function diffWithPrevious(current: ProviderResult[]): SnapshotDiff {
  const history = loadSnapshots()
  const previous = history[0]

  if (!previous) {
    return { previousAt: null, newPostIds: [], droppedPostIds: [] }
  }

  const currentIds = new Set(current.flatMap((result) => result.posts.map((post) => post.id)))
  const previousIds = new Set(previous.results.flatMap((result) => result.posts.map((p) => p.id)))

  return {
    previousAt: previous.takenAt,
    newPostIds: [...currentIds].filter((id) => !previousIds.has(id)),
    droppedPostIds: [...previousIds].filter((id) => !currentIds.has(id))
  }
}
