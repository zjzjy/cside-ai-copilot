import type {
  ApiResponse,
  CollectionData,
  CollectionRequest,
  GenerateData,
  GenerateRequest,
} from '../shared/models';
import { generateReply as generateMockReply, saveCollection as saveMockCollection } from './mock';
import { generateReply as generateRealReply, saveCollection as saveRealCollection } from './real';

export { ApiError } from './errors';

export interface CustomerServiceApi {
  generateReply: (request: GenerateRequest) => Promise<ApiResponse<GenerateData>>;
  saveCollection: (request: CollectionRequest) => Promise<ApiResponse<CollectionData>>;
}

function getApi(): CustomerServiceApi {
  const useReal = localStorage.getItem('cside_use_real_api') === 'true';
  return {
    generateReply: useReal ? generateRealReply : generateMockReply,
    saveCollection: useReal ? saveRealCollection : saveMockCollection,
  };
}

export const customerServiceApi: CustomerServiceApi = {
  generateReply: (req) => getApi().generateReply(req),
  saveCollection: (req) => getApi().saveCollection(req),
};

export async function tryLogin(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:8181/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (body.code === 0 && body.data?.token) {
      localStorage.setItem('cside_token', body.data.token);
      localStorage.setItem('cside_use_real_api', 'true');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function useMockApi() {
  localStorage.removeItem('cside_token');
  localStorage.removeItem('cside_use_real_api');
}

export function useRealApi() {
  localStorage.setItem('cside_use_real_api', 'true');
}

export function isUsingRealApi(): boolean {
  return localStorage.getItem('cside_use_real_api') === 'true';
}
