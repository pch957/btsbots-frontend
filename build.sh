#!/bin/bash
# build.sh - BTSBots 工业级跨端离线独立产物全自动编译器

echo "=================================================="
echo "📦 BTSBots 跨端独立产物编译器"
echo "=================================================="
echo "1) 编译打包: [Wallet 钱包] Linux 桌面版 (.deb)"
echo "2) 编译打包: [Market 交易所] Linux 桌面版 (.deb)"
echo "3) 编译打包: [Wallet 钱包] Android 手机原生 APK"
echo "4) 编译打包: [Market 交易所] Android 手机原生 APK"
echo "=================================================="
read -p "请分配你当前的编译分流目标 (1-4): " choice

if [ -d "/opt/android-sdk" ]; then
  export ANDROID_HOME=/opt/android-sdk
fi

case $choice in
  1)
    echo "🧱 正在编译钱包 Linux 桌面安装包..."
    npm run build:wallet
    npm exec tauri build
    ;;
  2)
    echo "🧱 正在编译交易所 Linux 桌面安装包..."
    npm run build:market
    npm exec tauri build -- --config src-tauri/tauri.market.conf.json
    ;;
  3)
    echo "📱 正在编译生成 [Wallet 钱包] Android APK..."
    npm run build:wallet
    # 强制将 Capacitor 切换同步为钱包专属配置
    npx cap sync android --config capacitor.config.ts
    cd android && ./gradlew assembleRelease
    echo "✅ 钱包 APK 生成完毕: android/app/build/outputs/apk/release/"
    ;;
  4)
    echo "📱 正在编译生成 [Market 交易所] Android APK..."
    npm run build:market
    # 强制将 Capacitor 切换同步为交易所专属配置
    npx cap sync android --config capacitor.market.config.ts
    cd android && ./gradlew assembleRelease
    echo "✅ 交易所 APK 生成完毕: android/app/build/outputs/apk/release/"
    ;;
  *)
    echo "❌ 暂不支持该编译选项。"
    exit 1
    ;;
esac