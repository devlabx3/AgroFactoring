export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new ApiError(
      data.error || `Request failed with status ${res.status}`,
      res.status,
      data.detail
    );
  }

  return data as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
