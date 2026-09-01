# build-win.ps1
# 🌟 Windows 专属多端独立运行 exe/msi 安装包爆破编译器

Clear-Host
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "📦 btsbots Windows 专属全平台绿色离线产物编译器" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "1) 编译打包: [Wallet 钱包] Windows 独立桌面软件 (.exe/.msi)"
Write-Host "2) 编译打包: [Market 交易所] Windows 独立桌面软件 (.exe/.msi)"
Write-Host "==================================================" -ForegroundColor Yellow

$choice = Read-Host "请分配你当前的编译分流目标目标 (1-2)"

switch ($choice) {
    "1" {
        Write-Host "🧱 正在为您离线编译编译 [Wallet 钱包] Windows 安装包..." -ForegroundColor Green
        $env:APP_MODE="wallet"
        npm run build:wallet
        npm exec tauri build
    }
    "2" {
        Write-Host "🧱 正在为您离线编译编译 [Market 交易所] Windows 安装包..." -ForegroundColor Green
        $env:APP_MODE="market"
        npm run build:market
        # 🌟 精准告知微软 C++ 编译器，强制读取交易所专属的主打配置
        npm exec tauri build -- --config src-tauri/tauri.market.conf.json
    }
    Default {
        Write-Host "❌ 输入错误，编译已终止。" -ForegroundColor Red
    }
}
