/**
 * PWAアイコン生成スクリプト
 * 使い方: public/logo.png(正方形推奨)を配置して `npm run icons`
 * 出力: public/icons/icon-192.png / icon-512.png / icon-512-maskable.png
 *       public/apple-touch-icon.png(180) / public/favicon.png(48)
 */
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

const SRC = 'public/logo.png'
const BG = '#0B0F14' // テーマ「Casino Luxe」のベース色

if (!existsSync(SRC)) {
  console.error(`エラー: ${SRC} がありません。ロゴ画像を配置してから実行してください。`)
  process.exit(1)
}

await mkdir('public/icons', { recursive: true })

/** 正方形キャンバス(背景BG)にロゴを scale 比率で中央配置して書き出す */
async function emit(out, size, scale = 1) {
  const inner = Math.round(size * scale)
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(out)
  console.log('generated', out)
}

await emit('public/icons/icon-192.png', 192)
await emit('public/icons/icon-512.png', 512)
// maskable は外周が切り取られるためセーフゾーン(約80%)に収める
await emit('public/icons/icon-512-maskable.png', 512, 0.8)
await emit('public/apple-touch-icon.png', 180, 0.92)
await emit('public/favicon.png', 48)
