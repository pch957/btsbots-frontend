# 🔐 BTSBots Decentralized Identity (DID) OAuth Developer Guide

This document details how third-party merchants can integrate **BTSBots Decentralized Identity (DID)** authentication. Merchants can authenticate users without storing passwords or sending SMS OTPs, using BitShares blockchain accounts and ECDSA signatures.

---

## 🛠️ Integration Option A: Zero-Code Proxy Mode with `biz_proxy.py` (Recommended)

### 1. Mandatory `biz_rules.json` Configuration
**Crucial Note**: When using `biz_proxy`, merchants MUST STILL configure `biz_rules.json` to **point the `oauth_endpoint` URL directly to the `/biz-proxy/sync-login` endpoint provided by `biz_proxy.py`**:

```json
{
  "description": "BTSBots OAuth Rules",
  "updated_at": "2026-08-12 19:54:52",
  "oauth_endpoint": {
    "my-shop.com": "https://my-shop.com/biz-proxy/sync-login"
  }
}
```

### 2. Start `biz_proxy.py`
```bash
uv run python biz_proxy.py \
  --host 127.0.0.1 \
  --port 9000 \
  <merchant_bts_account> \
  <merchant_bts_pubkey>
```

---

## 💻 Integration Option B: Custom Web API Callbacks

Point `oauth_endpoint` in `biz_rules.json` to your custom backend API:
```json
{
  "oauth_endpoint": {
    "my-shop.com": "https://api.my-shop.com/v1/auth/bts-callback"
  }
}
```