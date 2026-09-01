# 🤖 BTSBots Smart Wallet & Decentralized Client - User Manual

Welcome to the **BTSBots** ecosystem! BTSBots is a decentralized trading platform and smart wallet built on top of the BitShares blockchain. Designed with a **Zero-Trust Architecture**, it seamlessly combines an ultra-smooth web experience with cold-hot key separation security.

---

## 🛡️ 1. Hardcore Security Mechanisms Detailed

BTSBots solves common Web3 threats such as phishing attacks, private key leaks, malicious order-matching scripts, and user misoperations directly at the architectural level:

### 1. Zero-Key Web Architecture
* **No WIF Keys in Browsers**: Your physical BitShares Active/Owner WIF keys are never entered or stored in the browser's or mobile app's LocalStorage.
* **Local WebCrypto Session Signatures**: Upon initialization, the web client generates a dedicated ECDSA (P-256) temporary session keypair via standard browser `window.crypto.subtle` APIs in IndexedDB. All transactions submitted from the web (transfers, limit orders, OAuth authorizations) contain only **signed transaction intents**, which must be audited and approved by your local Python client or proxy before execution.

### 2. In-Memory Private Key Sandbox (`bots_key.py`)
* **AES Encrypted Key Buffer**: While running, physical WIF keys remain in memory encrypted as AES-256 byte buffers without ever touching the disk.
* **Unix Fork Process Isolation**: Whenever signing on-chain transactions or decrypting memos, an isolated worker process is spawned via Unix `multiprocessing.fork`.
* **Zero-Memory Residue Wiping**: After completing ECDSA calculations in isolated memory, the subprocess **overwrites the WIF byte buffer with 0x00 bytes and immediately exits**, preventing third-party Python dependencies from inspecting RAM.

### 3. Anti-Phishing & Cross-IP Verification
* During OAuth logins or QR payment requests, the system locks and records the public IP address of the initiating web client.
* Upon receiving a signature request, the Python client strictly matches the client's IP against the response IP. If a man-in-the-middle or proxy hijack is detected, the request is instantly rejected with an alert to prevent phishing sites from stealing identity proofs.

### 4. Automated Security Strategy & Policy Protection (`security_rules.json`)
* **Fee Limit Safeguard (`fee_limit`)**: Automatically rejects transactions if the required fee exceeds the threshold (e.g., 10 BTS).
* **Transfer & Market Whitelists**: Restricts outgoing transfers to approved accounts and trading to permitted asset pairs.
* **Sliding Timeframe Volatility Protection (`volatility_limit_1h/1d/1w`)**: Built-in multi-timeframe geometric deviation calculation. If a limit order price deviates severely from historical executed averages (possibly triggered by malicious scripts), the signing engine refuses to sign, protecting your assets from market manipulation.

### 5. Local Screen Locking & Account/Asset Filtering
* **Independent PIN Lock**: Set a 4-6 digit local PIN code (kept entirely on-device, never transmitted over the network) to authorize transactions or automatically lock after 5 minutes of inactivity.
* **Blacklists & Whitelists**: Blacklisted accounts are automatically hidden from transaction histories; spam tokens can be hidden from asset displays.

---

## 🚀 2. Environment Setup & Quick Installation

The BTSBots Python client is optimized to run using **`uv`**, the modern Python package manager, offering lightning-fast dependency sync and isolated virtual environments.

### 1. Install `uv`
```bash
# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionUrl https://astral.sh/uv/install.ps1
```

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/pch957/btsbots.git
cd btsbots

# One-step dependency sync with uv
uv sync
```

### 3. Configure Security Strategy `security_rules.json`
Copy the example file and edit it:
```bash
cp security_rules.json.example security_rules.json
```
`security_rules.json` overview:
```json
{ 
    "description": "BTSBots Account & Pricing Security Strategy Rules",
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
* **`authorized_keys`**: List of SHA-256 public key fingerprints (first 50 hex chars) of WebCrypto browser sessions allowed to send intents to your signer.
* **`user_whitelist`**: Permitted account names and corresponding `1.2.x` account IDs for outgoing transfers.

---

## 🔑 3. Launching Python Client & Key Management

The Python client supports two methods for key ingestion. **Using the standard Unix `pass` password store is highly recommended.**

### Method 1: Interactive Terminal (No Arguments)
Run the script and enter your BitShares username, Active WIF, and Memo WIF securely when prompted (echo hidden):
```bash
uv run python sign_bots.py
```
> **Note**: Ideal for quick debugging. Key memory is cleared upon process exit.

---

### Method 2: Using Unix `pass` Password Store (Recommended 🌟)

`pass` is the standard Unix password manager that utilizes GPG2 for asymmetric key encryption.

#### Why Use `--pass`?
1. **Zero Plaintext Storage**: Keys are GPG-encrypted in `~/.password-store` with zero plain text stored on disk.
2. **Daemon Automation**: Integrates seamlessly with GPG Agent to start background daemons without manual password entry.
3. **Structured Entry**: Create a `pass` entry where Line 1 is the **account name**, Line 2 is the **Active WIF**, and Line 3 is the **Memo WIF**.

#### Usage Example:
```bash
# 1. Insert credentials into pass
pass insert bts/my_account
# Enter in sequence:
# Line 1: my_bts_account
# Line 2: 5KQwr2A... (Active Key)
# Line 3: 5Jv3qP... (Memo Key)

# 2. Launch SignBots with --pass
uv run python sign_bots.py --pass bts/my_account
```

---

## 📱 4. Web & Mobile App Integration Guide

### 1. 8-Digit OTP Fast Login (No Private Keys Needed)
To log into web apps (`wallet.btsbots.com` or `market.btsbots.com`):
1. Run `get_otp.py` (or request an OTP via the BTSBots Telegram Bot):
   ```bash
   uv run python get_otp.py --pass bts/my_account
   ```
2. The terminal displays a temporary 8-digit OTP (e.g., `84920138`).
3. Enter your account name and this 8-digit OTP on the web login screen to start a secure session instantly without exposing keys!

### 2. Authorization & Auto-Signing Daemon (`sign_bots.py`)
Keep `sign_bots.py` running in the background:
* When placing orders, canceling, or sending funds from the Web or Market App, transaction intents are queued securely in the cloud.
* `sign_bots.py` fetches the request, validates security rules (IP, whitelists, fees, volatility limits), and invokes the local sandbox to broadcast to the BitShares mainnet.

### 3. QR Payments & URI Schemes
Scan standard URIs using the Wallet App or system camera:
* **Transfer URI**: `btsbots://transfer?to=receiver&asset=BTS&amount=100&memo=inv_001`
* **OAuth URI**: `btsbots://oauth?client_id=merchant&token=xxx&site=example.com&ip=1.2.3.4`