export type Platform = 'taobao' | 'jd' | 'pdd' | 'douyin' | 'unknown';

export type Brand = 'vivo' | 'huawei' | 'oppo' | 'xiaomi' | 'unknown';

export interface StoreContext {
  brand: Brand;
  platform: Platform;
  storeId: string;
  storeName: string;
  source: 'auto' | 'manual';
  confirmed: boolean;
  url?: string;
}

export interface TabState {
  capturedSelection?: {
    text: string;
    pageUrl: string;
    capturedAt: string;
  };
  pageContext?: StoreContext;
}

export interface FiveStepResult {
  step1Intent: string;
  step2Strategy: string;
  step3Script: string;
  step4Hook: string;
  step5Close: string;
}

export interface GenerateRequest {
  customerMessage: string;
  conversationId?: number;
  brand?: string;
  platform?: string;
  storeId?: string;
}

export interface KnowledgeChunk {
  sourceId: string;
  sourceType: string;
  level: string;
  brand: string | null;
  scene: string;
  content: string;
  score: number;
}

export interface GenerateData {
  conversationId: number;
  brand: string;
  platform: string;
  storeId: string;
  fiveStep: FiveStepResult;
  retrievedChunks?: KnowledgeChunk[];
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type StepType = '1' | '2' | '3' | '4' | '5' | 'full';

export interface CollectionRequest {
  stepType: StepType;
  content: string;
  conversationId?: number;
  customerMessage?: string;
}

export interface CollectionData {
  id: string;
  createdAt: string;
}
