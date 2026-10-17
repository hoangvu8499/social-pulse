/// <reference types="vite/client" />

/**
 * Khai bao cho cac file khong phai TypeScript duoc import truc tiep.
 * Vite bien chung thanh module luc build, nhung trinh kiem tra kieu
 * khong biet dieu do neu khong duoc noi truoc.
 */
declare module '*.css' {
  const content: string
  export default content
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}
