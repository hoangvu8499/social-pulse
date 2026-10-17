import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Test tich hop goi API that bi loai khoi lan chay mac dinh: chung phu thuoc
 * vao mang va vao viec ben thu ba con song, nen de lan trong bo test thuong
 * ngay se gay bao dong gia. Dat bien LIVE=1 de bat chung len, hoac chay
 * `npm run test:live`.
 */
const includeLive = process.env.LIVE === '1'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    exclude: ['**/node_modules/**', '**/out/**', ...(includeLive ? [] : ['**/live.test.ts'])],
    environment: 'node'
  }
})
