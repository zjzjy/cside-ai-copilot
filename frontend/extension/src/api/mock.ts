import type {
  ApiResponse,
  CollectionData,
  CollectionRequest,
  GenerateData,
  GenerateRequest,
  KnowledgeChunk,
} from '../shared/models';
import { ApiError } from './errors';
import {
  BRAND_LABELS,
  buildGenericChunks,
  buildGenericFiveStep,
  MOCK_SCENARIOS,
  PLATFORM_LABELS,
} from './mockFixtures';

const MOCK_DELAY_MS = 650;

const wait = (delay = MOCK_DELAY_MS) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, delay));

export const generateReply = async (
  request: GenerateRequest,
): Promise<ApiResponse<GenerateData>> => {
  await wait();

  const customerMessage = request.customerMessage.trim();
  if (!customerMessage) {
    throw new ApiError(3002, '客户消息不能为空');
  }

  if (customerMessage.length > 500) {
    throw new ApiError(3003, '客户消息超过500字限制');
  }

  if (customerMessage.includes('#mock-error')) {
    throw new ApiError(2001, '大模型调用失败，请稍后重试');
  }

  if (!request.brand || !request.platform || !request.storeId) {
    throw new ApiError(1001, 'Mock 模式需要明确的品牌、平台和店铺');
  }

  const brand = request.brand;
  const platform = request.platform;
  const brandLabel = BRAND_LABELS[brand] ?? brand;
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;

  // 命中品牌场景时返回该品牌的真实模板话术（数据取自 data/seed），
  // 未命中则走通用兜底，保证离线演示的生成质量与真实链路一致。
  const scenario = MOCK_SCENARIOS[brand]?.find((item) => item.keywords.test(customerMessage));
  const fiveStep = scenario?.fiveStep ?? buildGenericFiveStep(customerMessage, brandLabel);
  const retrievedChunks: KnowledgeChunk[] =
    scenario?.chunks ?? buildGenericChunks(brandLabel, platformLabel);

  return {
    code: 0,
    message: 'success',
    data: {
      conversationId: request.conversationId || 0,
      brand,
      platform,
      storeId: request.storeId,
      fiveStep,
      retrievedChunks,
    },
  };
};

export const saveCollection = async (
  request: CollectionRequest,
): Promise<ApiResponse<CollectionData>> => {
  await wait(250);

  if (!request.content.trim()) {
    throw new ApiError(4001, '收藏内容不能为空');
  }

  return {
    code: 0,
    message: 'success',
    data: {
      id: `collection-${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
  };
};
