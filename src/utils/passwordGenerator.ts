/**
 * 随机密码生成 — 用 Web Crypto API 的 getRandomValues(密码学安全)
 *
 * 策略:
 *  - 长度 16(BE @Size(min=12),给富余)
 *  - 必含 大写 + 小写 + 数字 + 符号 各 1(防 BE/合规扫描器误判弱密)
 *  - 排除易混淆字符:0/O/I/l/1
 *  - 符号集排除 BE / SQL / shell 危险字符 ('"`\;)
 */

const CHARSET = {
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  lower: 'abcdefghjkmnpqrstuvwxyz',
  digit: '23456789',
  symbol: '!@#$%^&*-_=+',
} as const

function pickOne(charset: string): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return charset[buf[0]! % charset.length]!
}

function shuffle<T>(arr: T[]): T[] {
  // Fisher-Yates with crypto random
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0]! % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * 生成随机密码。length 必须 ≥ 4(每类字符至少 1 位),默认 16。
 */
export function generatePassword(length = 16): string {
  if (length < 4) throw new Error('password length must be >= 4')
  const all = Object.values(CHARSET).join('')
  const required = [
    pickOne(CHARSET.upper),
    pickOne(CHARSET.lower),
    pickOne(CHARSET.digit),
    pickOne(CHARSET.symbol),
  ]
  const rest: string[] = []
  for (let i = 0; i < length - required.length; i++) rest.push(pickOne(all))
  return shuffle([...required, ...rest]).join('')
}

/**
 * 检测密码强度(给前端 hint,BE 仍是权威)。
 * 返回 0-4(0=极弱, 4=强)
 */
export function passwordStrength(pw: string): number {
  if (!pw || pw.length < 8) return 0
  let score = 0
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

export const PASSWORD_STRENGTH_LABEL = ['极弱', '弱', '中', '强', '极强'] as const
