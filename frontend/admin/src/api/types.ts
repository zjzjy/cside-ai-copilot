export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface BrandResponse {
  id: number;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BrandUpdateRequest {
  config: Record<string, unknown>;
}

export interface StoreResponse {
  id: number;
  name: string;
  brandId: number;
  brandName: string;
  platform: string;
  urlPattern: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreUpdateRequest {
  name?: string;
  urlPattern?: string;
  config?: Record<string, unknown>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: string;
}
