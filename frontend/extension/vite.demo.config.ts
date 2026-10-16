import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * 静态演示构建：把侧边栏当成普通网页打包（base 用相对路径），
 * 产物直接落到仓库根目录的 demo/app，供 demo/index.html 与 GitHub Pages 在线演示使用。
 *
 * 演示模式下侧边栏走 Mock API，不需要后端与数据库。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: resolve(__dirname, '../../demo/app'),
    emptyOutDir: true,
  },
});
