import axios, { type AxiosRequestConfig } from 'axios'
import { applyApiInterceptors } from '@/api/interceptors'
import { safeParseJson } from '@/utils/safeJson'

const baseURL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  // ADR-030 §D7：后端登录响应下发 HttpOnly cookie `batch_console_token`，浏览器自动随请求回带。
  // 同源场景 axios 默认不带 cookie,必须显式 withCredentials=true。
  // 兼容期 Authorization header 仍由 interceptor 注入(双轨),后续 PR 完成迁移后再删。
  withCredentials: true,
  // CSRF 纵深防御:axios 默认会读 cookie `XSRF-TOKEN` 透传到 header `X-XSRF-TOKEN`。
  // 显式声明避免被全局 defaults 覆盖。BE 侧若启用 Spring CookieCsrfTokenRepository
  // (或等价方案)在初始 GET 时下发 non-HttpOnly `XSRF-TOKEN` cookie,后续 mutating
  // 请求即可自动带上 token。BE 当前可能尚未配置,FE 先打底,无 cookie 时 axios
  // 不会注 header,无破坏性。TODO(BE):#csrf 启用 CookieCsrfTokenRepository。
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { 'Content-Type': 'application/json' },
  // 重写默认 transformResponse：axios 默认 JSON.parse 会静默截断 > 2^53 的 Long。
  // 用 json-bigint 把超大数转成 string，保住精度；blob/stream/非 JSON 原样返回。
  transformResponse: [
    (data, headers) => {
      const ct = (headers?.['content-type'] ?? headers?.['Content-Type'] ?? '').toString()
      if (!ct.includes('json')) return data
      return safeParseJson(data)
    },
  ],
})

applyApiInterceptors(apiClient)

export async function get<T>(
  url: string,
  params?: object,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await apiClient.get<T>(url, { params, ...config })
  return data
}

export async function post<T>(url: string, body?: object, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.post<T>(url, body, config)
  return data
}

export async function put<T>(url: string, body?: object, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.put<T>(url, body, config)
  return data
}

export async function patch<T>(
  url: string,
  body?: object,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await apiClient.patch<T>(url, body, config)
  return data
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<T>(url, config)
  return data
}
