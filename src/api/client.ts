import axios, { type AxiosRequestConfig } from 'axios'
import { applyApiInterceptors } from '@/api/interceptors'
import { safeParseJson } from '@/utils/safeJson'

const baseURL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
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
