import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'; // 👈 引入插件

// https://vite.dev/config/
export default defineConfig(() => {
  // 读取当前启动或打包命令中的 APP_MODE 变量，默认为 wallet
  const appMode = process.env.APP_MODE || 'wallet';
  const outDir = appMode === 'market' ? 'dist-market' : 'dist-wallet';
  const port = appMode === 'market' ? 5174: 5173;

  console.log(`📦 [Vite Compiler] 当前正在全力为 [${appMode.toUpperCase()}] 分配专属打包管道 ➡️ 生成夹: ${outDir}`);

  return {
    base: './',
    plugins: [
      tailwindcss(), // 👈 挂载插件
      react()
    ],
    define:{
      'import.meta.env.VITE_APP_MODE': JSON.stringify(appMode)
    },
    server: {
      host: '0.0.0.0',       // 监听所有网卡，允许外部/局域网访问
      port: port,            // 锁定端口
      strictPort: true,      // 端口被占用时直接报错

      // 🔐 解决 Vite 7 域名拦截的核心配置
      allowedHosts: [
        'dev.btsbots.com',   // 🔴 允许你当前使用的自定义开发域名
        '.btsbots.com'       // 💡 可选：如果你有其他子域名（如 api.dev.btsbots.com），可以用点号匹配所有子域名
      ]
    },
    build: {
      // 1. 核心大招：100KB 以下的图片、字体等静态资源全部内联成 Base64 字符串
      // 这样可以消灭掉 assets 文件夹里成百上千个小图标文件
      assetsInlineLimit: 102400, 
      outDir: outDir,
      emptyOutDir: true,

      rollupOptions: {
        output: {
          // 2. 强行把 node_modules 里的第三方依赖合并成一个叫 vendor 的大文件
          // 阻止 Vite 将每个 npm 包都拆成独立的零碎 JS 块
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          // 3. 拍平打包后的文件结构，去掉不必要的深层嵌套夹
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
});
