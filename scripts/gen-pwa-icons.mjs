#!/usr/bin/env node
// 从public/icons/batch-mark.svg生成favicon、PWA图标和iOS启动图。
// 用法：准备sharp后执行 node scripts/gen-pwa-icons.mjs。
// compact路径保留兼容；maskable以满幅品牌色和安全留白避免系统裁切主体。

import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'public', 'icons')
if (!existsSync(out)) mkdirSync(out, { recursive: true })

const mark = readFileSync(join(out, 'batch-mark.svg'))
const brandBackground = '#1f4fd1'

async function genIcon(size, file) {
  await sharp(mark).resize(size, size).png().toFile(join(out, file))
  console.info('generated', file)
}

for (const size of [180, 192, 256, 384, 512]) {
  await genIcon(size, `icon-${size}.png`)
  await genIcon(size, `icon-${size}-compact.png`)
}
for (const size of [32, 64]) await genIcon(size, `favicon-${size}.png`)
for (const size of [192, 512]) {
  const safeSize = Math.floor(size * 0.8)
  await sharp({ create: { width: size, height: size, channels: 4, background: brandBackground } })
    .composite([
      { input: await sharp(mark).resize(safeSize, safeSize).png().toBuffer(), gravity: 'center' },
    ])
    .png()
    .toFile(join(out, `icon-${size}-maskable.png`))
}

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

console.info('generating apple-touch-startup-image')
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
        input: await sharp(mark).resize(iconSize, iconSize).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(join(out, file))
  console.info('generated', file)
}

console.info('PWA assets generated in public/icons/')
