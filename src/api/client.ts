import axios, { type AxiosRequestConfig } from 'axios'
import { applyApiInterceptors } from '@/api/interceptors'

const baseURL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

applyApiInterceptors(apiClient)

export async function get<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
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

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<T>(url, config)
  return data
}
