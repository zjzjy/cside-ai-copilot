export interface PageSnapshot {
  url: string;
  title: string;
}

export const hasPageSnapshotChanged = (previous: PageSnapshot, current: PageSnapshot) =>
  previous.url !== current.url || previous.title !== current.title;

export const watchUrlChanges = (onChange: (url: string) => void) => {
  let lastSnapshot: PageSnapshot = {
    url: window.location.href,
    title: document.title,
  };

  const checkPage = () => {
    const currentSnapshot: PageSnapshot = {
      url: window.location.href,
      title: document.title,
    };
    if (!hasPageSnapshotChanged(lastSnapshot, currentSnapshot)) {
      return;
    }

    lastSnapshot = currentSnapshot;
    onChange(currentSnapshot.url);
  };

  // 千牛、京麦等 SPA 可能在店铺切换时只改页面标题、不改 URL。
  // 同时观察 URL 和标题，仍保留 1 秒轮询作为平台事件不完整时的兜底。
  const intervalId = window.setInterval(checkPage, 1_000);
  window.addEventListener('popstate', checkPage);
  window.addEventListener('hashchange', checkPage);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('popstate', checkPage);
    window.removeEventListener('hashchange', checkPage);
  };
};
