import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        // 采集脚本里的 page.evaluate 回调在浏览器上下文执行，需要浏览器全局变量
        ...globals.browser,
      },
    },
    rules: {
      // 命令行脚本需要直接打印进度
      'no-console': 'off',
    },
  },
);
