# 🤖 BTSBots 智能钱包与去中心化客户端 - 用户使用手册

欢迎使用 **BTSBots** 生态系统！BTSBots 是基于比特股（BitShares）区块链打造的去中心化交易与智能钱包系统。它采用了**零信任架构（Zero-Trust Architecture）**，兼顾了 Web 端极致流畅的用户体验与冷热分离级的密钥安全保护。

---

## 🛡️ 一、硬核安全防护机制详解

BTSBots 从架构设计层面彻底解决了传统 Web3 钱包易受钓鱼、私钥泄漏、恶意刷单和误操作等安全隐患：

### 1. Web 前端无私钥 (Zero-Key Web Architecture)
* **浏览器不接触 WIF 私钥**：您的比特股 Active/Owner 物理私钥永远无需输入或存储在浏览器/手机 App 的 LocalStorage 中。
* **本地 WebCrypto 会话签名**：Web 端在初始化时通过浏览器原生 `window.crypto.subtle` API 在 IndexedDB 中生成并锁定一对专用的 ECDSA (P-256) 临时会话公私钥。Web 端提交的所有交易（转账、限价下单、OAuth 授权）仅包含**操作意图签名**，必须经过您的 Python 客户端或本地代理二次审核放行。

### 2. Python 客户端内存级私钥沙盒保护 (`bots_key.py`)
* **AES 动态密文常驻内存**：主进程运行时，物理 WIF 私钥在内存中以 AES-256 密文形态存在，不写磁盘。
* **Unix Fork 独立沙盒**：每当需要进行链上交易加签或 Memo 解密时，系统通过 `multiprocessing` 的 `fork` 机制创建孤立的子进程。
* **零内存残留擦除**：子进程在隔离内存中解密 WIF、完成 ECDSA 密码学计算后，**自动用 0x00 覆写擦除字节缓冲区并立即销毁进程**，杜绝第三方 Python 依赖库窥探内存。

### 3. 反钓鱼与异地 IP 双向核对
* 在发起第三方 OAuth 授权登录或扫码支付时，系统会记录并锁定 Web 发起端的公网 IP。
* Python 客户端在收到授权请求时，会强制核对发起端 IP 与后端响应 IP 是否完全一致。若检测到异地/代理劫持，将自动拦截并报警，防止钓鱼网站套取您的身份证书。

### 4. 自动化风控与策略防线 (`security_rules.json`)
* **手续费上限限制 (`fee_limit`)**：单笔交易手续费若超过设定阈值（如 10 BTS），签名守护进程自动拒绝。
* **转账与市场白名单**：仅允许向白名单内的账户转账；限价下单仅允许在许可的交易对中操作。
* **滑动时间窗口套利保护 (`volatility_limit_1h/1d/1w`)**：系统内置多时区几何偏离计算。若某一笔限价单的价格严重偏离该账号近期历史成交均价（可能由恶意刷单脚本触发），Python 签名端将拒绝签署私钥，保护您的资产不被低卖高买窃取。

### 5. 客户端本地安全锁屏与黑白名单
* **独立 PIN 码保护**：在前端设置独立的 4-6 位数字 PIN 码（完全保存在本地，不经过网络），用于每次关键签名放行前验证或 5 分钟无操作自动锁屏。
* **账号与资产黑名单**：被拉黑的恶意账号转账记录将被自动屏蔽；被拉黑的垃圾代币将从钱包资产面板中彻底隐藏。

---

## 🚀 二、环境准备与极速安装

BTSBots Python 客户端全面推荐使用现代化的 Python 包管理器 **`uv`** 运行，享受秒级依赖安装与隔离运行环境。

### 1. 安装 `uv` 工具
```bash
# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionUrl https://astral.sh/uv/install.ps1
```

### 2. 克隆项目并初始化依赖
```bash
git clone https://github.com/pch957/btsbots.git
cd btsbots

# 使用 uv 一键安装依赖并同步环境
uv sync
```

### 3. 配置风控策略 `security_rules.json`
复制示例文件并编辑：
```bash
cp security_rules.json.example security_rules.json
```
`security_rules.json` 内容说明：
```json
{ 
    "description": "BTSBots 账号与资产定价风控策略",
    "updated_at": "2026-08-12 19:54:52",
    "fee_limit": 10,
    "authorized_keys": [
        "f928a9f76a372caf489e999b5e2c4eec9fcablbj49bcef9b4a"
    ],
    "user_whitelist": {
        "angel": "1.2.1000",
        "dan": "1.2.2000"
    },
    "market_whitelist": [
        "CNY/USD", "CNY/BTS", "BTS/USD"
    ],
    "volatility_limit_1h": 0.97,
    "volatility_limit_1d": 0.95,
    "volatility_limit_1w": 0.90
}
```
* **`authorized_keys`**：允许请求您签名机的 WebCrypto 浏览器公钥特征指纹（前 50 位 SHA-256 哈希）。
* **`user_whitelist`**：允许转账的比特股账号及其对应的 1.2.x 账号 ID。

---

## 🔑 三、启动 Python 客户端与密钥管理

Python 客户端支持两种密钥加载方式。**强烈推荐使用 Linux/Unix 标准密码管理器 `pass`** 结合参数启动。

### 方式 1：标准交互式启动（无参数）
运行程序后，终端会安全地隐藏回显，提示您手动输入比特股账号及 Active / Memo WIF 私钥：
```bash
uv run python sign_bots.py
```
> **提示**：此方式适合临时调试，程序关闭后内存自动释放。

---

### 方式 2：使用 `pass` 密码管理器（推荐方案 🌟）

`pass` 是遵循 Unix 哲学的标准密码管理器，使用 GPG2 对密钥文件进行非对称加密存储。

#### 为什么推荐 `--pass`？
1. **零明文存储**：私钥文件经 GPG 强加密存储在 `~/.password-store` 中，硬盘上没有任何明文。
2. **免交互无缝启动**：配合 GPG Agent，守护进程（Daemon）开机自动启动时无需人工干预输入密码。
3. **格式规范**：在 `pass` 中建立对应条目，第一行为**比特股账号**，第二行为 **Active WIF**，第三行为 **Memo WIF**。

#### 使用示例：
```bash
# 1. 在 pass 中录入您的凭证条目
pass insert bts/my_account
# 依次输入：
# Line 1: my_bts_account
# Line 2: 5KQwr2A... (Active Key)
# Line 3: 5Jv3qP... (Memo Key)

# 2. 使用 --pass 参数一键优雅启动 SignBots
uv run python sign_bots.py --pass bts/my_account
```

---

## 📱 四、Web 端与 Mobile App 配合使用指南

### 1. 8 位 OTP 免私钥快速登录
当您需要在新的电脑浏览器或手机端登录 BTSBots 前端（`wallet.btsbots.com` 或 `market.btsbots.com`）时：
1. 运行 `get_otp.py` 脚本（或向 BTSBots Telegram 机器人发送登录请求）：
   ```bash
   uv run python get_otp.py --pass bts/my_account
   ```
2. 终端将输出一个 8 位数字一次性验证码（OTP），例如：`84920138`。
3. 在网页端登录界面输入您的比特股账号与该 8 位 OTP，即可快速建立安全登录会话，完全无需导入 WIF 私钥！

### 2. 授权管理与自动签名 (`sign_bots.py`)
在后台保持运行 `sign_bots.py`：
* 当您在 Web 端或 Market App 进行下单、取消挂单或发起转账时，Web 端会将加密的签名意图推送到云端队列。
* `sign_bots.py` 自动抓取请求，完成安全策略审核（风控、IP、白名单、套利计算）后，调用本地沙盒完成真正的比特股链上广播。

### 3. 扫码支付与二元协议
使用 Wallet App 的“扫码”功能或系统摄像头，可直接识别标准 URIs：
* **转账协议**：`btsbots://transfer?to=receiver&asset=BTS&amount=100&memo=inv_001`
* **OAuth 授权**：`btsbots://oauth?client_id=merchant&token=xxx&site=example.com&ip=1.2.3.4`