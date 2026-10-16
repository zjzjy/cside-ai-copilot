import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { generateReply, saveCollection } from './mock';

describe('mock generate API', () => {
  it('returns the API document field names', async () => {
    const response = await generateReply({
      customerMessage: '耳机左边没有声音怎么办？',
      brand: 'vivo',
      platform: 'taobao',
      storeId: 'vivo-taobao-flagship',
    });

    expect(response.code).toBe(0);
    expect(response.data.storeId).toBe('vivo-taobao-flagship');
    expect(Object.keys(response.data.fiveStep)).toEqual([
      'step1Intent',
      'step2Strategy',
      'step3Script',
      'step4Hook',
      'step5Close',
    ]);
  });

  it('uses error code 3002 for an empty customer message', async () => {
    await expect(generateReply({ customerMessage: '  ' })).rejects.toMatchObject({
      code: 3002,
    } satisfies Partial<ApiError>);
  });

  it('uses error code 3003 when the message exceeds 500 characters', async () => {
    await expect(generateReply({ customerMessage: '客'.repeat(501) })).rejects.toMatchObject({
      code: 3003,
    } satisfies Partial<ApiError>);
  });

  it('supports the documented mock failure switch', async () => {
    await expect(generateReply({ customerMessage: '#mock-error' })).rejects.toMatchObject({
      code: 2001,
    } satisfies Partial<ApiError>);
  });

  it('does not silently invent missing store context', async () => {
    await expect(generateReply({ customerMessage: '请帮我查一下订单' })).rejects.toMatchObject({
      code: 1001,
    } satisfies Partial<ApiError>);
  });

  it('replays the brand knowledge-base scenario when the message matches', async () => {
    const response = await generateReply({
      customerMessage: '小米和联想的耳机哪个好？',
      brand: 'huawei',
      platform: 'taobao',
      storeId: 'huawei-taobao-flagship',
    });

    expect(response.data.fiveStep.step3Script).toContain('FreeBuds');
    expect(response.data.retrievedChunks).toHaveLength(3);
    expect(response.data.retrievedChunks?.[0]).toMatchObject({
      sourceId: 'HW-FAQ-002',
      level: 'brand',
      brand: 'huawei',
    });
  });

  it('falls back to the generic five-step script for unmatched messages', async () => {
    const response = await generateReply({
      customerMessage: '你们家包装盒里有说明书吗？',
      brand: 'oppo',
      platform: 'pdd',
      storeId: 'oppo-pdd-flagship',
    });

    expect(response.data.fiveStep.step3Script).toContain('OPPO');
    expect(response.data.fiveStep.step3Script).toContain('包装盒里有说明书吗');
    expect(response.data.retrievedChunks?.[0]?.level).toBe('common');
  });
});

describe('mock collection API', () => {
  it('creates a collection record', async () => {
    const response = await saveCollection({ stepType: '3', content: '推荐话术' });

    expect(response.code).toBe(0);
    expect(response.data.id).toMatch(/^collection-/);
  });
});
