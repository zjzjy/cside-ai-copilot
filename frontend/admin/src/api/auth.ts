import client from './client';
import type { ApiResponse, LoginRequest, LoginResponse } from './types';

export const loginApi = (data: LoginRequest) =>
  client.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', data);
