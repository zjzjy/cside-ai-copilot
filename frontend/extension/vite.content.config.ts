import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * content script 单独构建。
 *
 * Manifest V3 的 content script 是普通脚本（不是 ES module），不能包含静态 import，
 * 而它和侧边栏会共用 src/shared 下的模块——如果和侧边栏放进同一次构建，
 * Rollup 会把共享模块抽成独立 chunk，content.js 就会静态 import 那个 chunk 而在浏览器里直接报错。
 * 因此这里用 IIFE 形式单独打包，产物 dist/content.js 自包含（scripts/check-dist.mjs 会校验）。
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'CSideContent',
      fileName: () => 'content.js',
    },
  },
});
