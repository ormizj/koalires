interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | null | undefined>
}

type RequestBody = BodyInit | Record<string, unknown> | null

interface ApiClient {
  get: <T>(url: string, options?: RequestOptions) => Promise<T>
  post: <T>(url: string, body?: RequestBody, options?: RequestOptions) => Promise<T>
  put: <T>(url: string, body?: RequestBody, options?: RequestOptions) => Promise<T>
  delete: <T>(url: string, options?: RequestOptions) => Promise<T>
}

function getToken(): string | null {
  if (import.meta.client) {
    return localStorage.getItem('token')
  }
  return null
}

function buildUrl(url: string, params?: Record<string, string | number | null | undefined>): string {
  if (!params) return url

  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `${url}?${queryString}` : url
}

function createHeaders(customHeaders?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (customHeaders) {
    Object.assign(headers, customHeaders)
  }

  return headers
}

export const apiClient: ApiClient = {
  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    const fullUrl = buildUrl(url, options?.params)
    const { params: _, headers: __, ...rest } = options ?? {}
    return await $fetch(fullUrl, {
      ...rest,
      method: 'GET',
      headers: createHeaders(options?.headers as HeadersInit),
    }) as T
  },

  async post<T>(url: string, body?: RequestBody, options?: RequestOptions): Promise<T> {
    const fullUrl = buildUrl(url, options?.params)
    const { params: _, headers: __, ...rest } = options ?? {}
    return await $fetch(fullUrl, {
      ...rest,
      method: 'POST',
      headers: createHeaders(options?.headers as HeadersInit),
      body,
    }) as T
  },

  async put<T>(url: string, body?: RequestBody, options?: RequestOptions): Promise<T> {
    const fullUrl = buildUrl(url, options?.params)
    const { params: _, headers: __, ...rest } = options ?? {}
    return await $fetch(fullUrl, {
      ...rest,
      method: 'PUT',
      headers: createHeaders(options?.headers as HeadersInit),
      body,
    }) as T
  },

  async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    const fullUrl = buildUrl(url, options?.params)
    const { params: _, headers: __, ...rest } = options ?? {}
    return await $fetch(fullUrl, {
      ...rest,
      method: 'DELETE',
      headers: createHeaders(options?.headers as HeadersInit),
    }) as T
  },
}
