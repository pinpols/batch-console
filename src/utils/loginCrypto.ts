/**
 * 登录请求体加密 (与 BE ConsoleLoginKeyPairService 对应)。
 *
 * 协议: RSA-OAEP-SHA256 包装 AES-256-GCM 一次性 key + AES-GCM 加密 JSON body。
 *   POST /api/console/auth/login body: { encryptedKey, iv, ciphertext } (全 base64)
 *
 * 失败处理: 公钥拿不到 / Web Crypto 不可用 → 返回 null,调用方回退明文路径。
 *   BE 默认 required=false 接受明文 (dev / CI 兼容); prod 强制 required=true 时
 *   服务端会 401 error.auth.encryption_required,前端拿到错误提示。
 *
 * 公钥缓存: sessionStorage 5min,会话结束自动清。
 */
import { get } from '@/api/client'

const CACHE_KEY = 'console:auth:public-key'
const CACHE_TTL_MS = 5 * 60 * 1000

interface PublicKeyResponse {
  algorithm: string
  publicKey: string
  fingerprint: string
}

interface CachedKey {
  fetchedAt: number
  payload: PublicKeyResponse
}

export interface EncryptedLoginBody {
  encryptedKey: string
  iv: string
  ciphertext: string
}

async function fetchPublicKey(): Promise<PublicKeyResponse | null> {
  const cachedRaw = sessionStorage.getItem(CACHE_KEY)
  if (cachedRaw) {
    try {
      const cached: CachedKey = JSON.parse(cachedRaw)
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.payload
      }
    } catch {
      // ignore
    }
  }
  try {
    const resp = await get<PublicKeyResponse>('/api/console/auth/public-key', {
      _silent: true,
    } as Record<string, unknown>)
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), payload: resp } satisfies CachedKey),
    )
    return resp
  } catch {
    return null
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export async function encryptLoginBody(
  plaintext: Record<string, unknown>,
): Promise<EncryptedLoginBody | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null
  }
  const pub = await fetchPublicKey()
  if (!pub) {
    return null
  }
  try {
    const rsaKey = await window.crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(pub.publicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
    ])
    const aesKeyRaw = await window.crypto.subtle.exportKey('raw', aesKey)
    const wrappedKey = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, aesKeyRaw)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      enc.encode(JSON.stringify(plaintext)),
    )
    return {
      encryptedKey: bufToBase64(wrappedKey),
      iv: bufToBase64(iv),
      ciphertext: bufToBase64(ciphertext),
    }
  } catch (err) {
    console.warn('[loginCrypto] encryption failed, falling back to plaintext', err)
    return null
  }
}

/** 清缓存: key 轮换 / 401 encryption_failed 时调用,下次登录重取公钥。 */
export function clearPublicKeyCache(): void {
  sessionStorage.removeItem(CACHE_KEY)
}
