import client from './client';
import type { ApiResponse, BrandResponse, BrandUpdateRequest } from './types';

export const getBrands = () =>
  client.get<ApiResponse<BrandResponse[]>>('/api/v1/brands');

export const getBrand = (id: number) =>
  client.get<ApiResponse<BrandResponse>>(`/api/v1/brands/${id}`);

export const updateBrand = (id: number, data: BrandUpdateRequest) =>
  client.put<ApiResponse<BrandResponse>>(`/api/v1/brands/${id}`, data);
