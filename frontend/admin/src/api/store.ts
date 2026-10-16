import client from './client';
import type { ApiResponse, StoreResponse, StoreUpdateRequest } from './types';

export const getStores = () =>
  client.get<ApiResponse<StoreResponse[]>>('/api/v1/stores');

export const getStore = (id: number) =>
  client.get<ApiResponse<StoreResponse>>(`/api/v1/stores/${id}`);

export const updateStore = (id: number, data: StoreUpdateRequest) =>
  client.put<ApiResponse<StoreResponse>>(`/api/v1/stores/${id}`, data);
