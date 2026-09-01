# Btsbots Frontend (Vite 7 + React 19 + TS + Oxlint)

100% 本地化、高性能、防篡改的数字资产量化客户端。

## 🛠️ 开发环境配置
1. 复制 `.env.example` 为 `.env` 并配置你的独立后端 API 地址。
2. 运行 `npm install` 安装依赖。

## 🚀 常用指令

### 1. 前端网页端开发
```bash
npm run dev
```

### 2. 桌面端 (Windows / Linux)
> 需确保本地已配置 Rust 开发环境。
```bash
# 启动桌面端联调测试 (支持热重载)
npx tauri dev

# 打包纯二进制防篡改安装包 (EXE / AppImage)
npx tauri build
```

### 3. 安卓移动端 (Android)
> 需确保本地已安装 Android Studio 和 SDK。
```bash
# 同步前端代码并调起安卓工程
npm run build
npx cap sync android
npx cap open android
```
