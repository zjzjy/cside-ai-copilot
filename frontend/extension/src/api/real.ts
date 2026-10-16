import type {
  ApiResponse,
  CollectionData,
  CollectionRequest,
  FiveStepResult,
  GenerateData,
  GenerateRequest,
} from '../shared/models';
import { ApiError } from './errors';

const BASE_URL = 'http://localhost:8181/api/v1';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('cside_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
  });

  const body = await res.json();

  if (body.code !== 0) {
    throw new ApiError(body.code, body.message);
  }

  return body;
}

const SNAKE_TO_CAMEL: Record<string, keyof FiveStepResult> = {
  step1_intent: 'step1Intent',
  step2_strategy: 'step2Strategy',
  step3_script: 'step3Script',
  step4_hook: 'step4Hook',
  step5_close: 'step5Close',
};

function normalizeFiveStep(raw: Record<string, unknown>): FiveStepResult {
  const result: Record<string, string> = {};
  for (const [key, camelKey] of Object.entries(SNAKE_TO_CAMEL)) {
    result[camelKey] = (raw[key] as string) || (raw[camelKey] as string) || '';
  }
  return result as unknown as FiveStepResult;
}

export const generateReply = async (req: GenerateRequest): Promise<ApiResponse<GenerateData>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await request<any>('/generate', { method: 'POST', body: JSON.stringify(req) });

  if (resp.data?.fiveStep) {
    resp.data.fiveStep = normalizeFiveStep(resp.data.fiveStep);
  }

  return resp as ApiResponse<GenerateData>;
};

export const saveCollection = async (
  req: CollectionRequest,
): Promise<ApiResponse<CollectionData>> => {
  return request<CollectionData>('/collections', {
    method: 'POST',
    body: JSON.stringify(req),
  });
};
