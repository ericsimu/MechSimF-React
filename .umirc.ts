import { defineConfig } from '@umijs/max';
import { resolve } from 'path';

export default defineConfig({
  title: 'MechSimF - 用例管理',
  favicons: ['/MechSimHomeIcon.png'],
  routes: [
    { path: '/', component: 'Home' },
    { path: '/cases', component: 'CaseList' },
    { path: '/tasks', component: 'Tasks' },
    { path: '/data', component: 'DataViewer' },
    { path: '/data-manage', component: 'DataManage' },
    { path: '/tools', component: 'Placeholder' },
    { path: '/manual', component: 'Manual' },
    { path: '/indicators', component: 'Placeholder' },
    { path: '/reports', component: 'Placeholder' },
    { path: '/logs', component: 'Placeholder' },
    { path: '/*', redirect: '/' },
  ],
  alias: {
    '@': resolve('src'),
  },
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
  npmClient: 'npm',
  mfsu: false,
  tailwindcss: {},
  plugins: [
    '@umijs/plugins/dist/tailwindcss',
  ],
});
