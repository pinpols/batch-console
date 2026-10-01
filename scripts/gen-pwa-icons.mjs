#!/usr/bin/env node
// 用 sharp 从品牌原图生成 PWA / iOS 启动图全套位图。
// 用法:`node scripts/gen-pwa-icons.mjs`
// 这是构建期一次性脚本,不是运行时;sharp 用 --no-save 装,不入 package.json
//
// 产出:
//   public/icons/icon-{180,192,256,384,512}.png   通用 + Android maskable
//   public/icons/splash-{w}x{h}.png               iOS apple-touch-startup-image 多分辨率
//
// iOS PWA splash 必须按设备点阵分辨率精确匹配,媒体查询匹配的是 device-width / pixel-ratio。

import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'public', 'icons')
if (!existsSync(out)) mkdirSync(out, { recursive: true })

const markOnBlue = readFileSync(join(root, 'assets', 'brand', 'mark-on-blue.jpg'))
const markOnWhite = readFileSync(join(root, 'assets', 'brand', 'mark-on-white.jpg'))

// 标准图标使用蓝底，maskable 使用白底原图，避免裁切时露出旧的背景色。
async function genIcon(size, file, source = markOnBlue) {
  await sharp(source).resize(size, size).png().toFile(join(out, file))
  console.log('  ✓', file)
}

console.log('[icons] generating PWA icons...')
await genIcon(180, 'icon-180.png') // iOS 主屏幕图标
await genIcon(192, 'icon-192.png')
await genIcon(192, 'icon-192-maskable.png', markOnWhite)
await genIcon(256, 'icon-256.png')
await genIcon(384, 'icon-384.png')
await genIcon(512, 'icon-512.png')
await genIcon(512, 'icon-512-maskable.png', markOnWhite)

// 2) iOS apple-touch-startup-image:按 device-width × dpr 全套
// (Common iPhone/iPad lineups 2020-2025; portrait only)
const splashes = [
  // [w, h, label]
  [1170, 2532, 'iphone-12-pro-13-14'],
  [1284, 2778, 'iphone-12-13-14-pro-max'],
  [1179, 2556, 'iphone-15-15-pro'],
  [1290, 2796, 'iphone-15-pro-max'],
  [828, 1792, 'iphone-xr-11'],
  [1125, 2436, 'iphone-x-xs-11pro'],
  [1242, 2688, 'iphone-xs-max-11-pro-max'],
  [750, 1334, 'iphone-se-2'],
  [1640, 2360, 'ipad-air-11'],
  [2048, 2732, 'ipad-pro-12-9'],
]

console.log('[splash] generating apple-touch-startup-image...')
const iconSize = 256
for (const [w, h] of splashes) {
  const file = `splash-${w}x${h}.png`
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // 与 manifest.background_color 一致
    },
  })
    .composite([
      {
        input: await sharp(markOnBlue).resize(iconSize, iconSize).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(join(out, file))
  console.log('  ✓', file)
}

console.log('[done] PWA assets in public/icons/')
