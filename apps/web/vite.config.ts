import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 页面视图使用运行时模板，显式启用 Vue 的完整构建，避免 RouterView 渲染为空白。
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { vue: 'vue/dist/vue.esm-bundler.js' } },
  server: { port: 5173, host: '0.0.0.0' },
});
