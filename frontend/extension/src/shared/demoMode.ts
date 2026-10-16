export const DEMO_PARAM = 'cside_demo';

/**
 * 演示模式：以普通网页形态（本地文件、静态托管）打开侧边栏时启用。
 * 扩展形态下 chrome.runtime 可用，永远走真实扩展链路，不会进入演示模式。
 */
export const isDemoMode = (search: string, hasExtensionApi: boolean): boolean => {
  if (hasExtensionApi) {
    return false;
  }

  try {
    return new URLSearchParams(search).get(DEMO_PARAM) === '1';
  } catch {
    return false;
  }
};
