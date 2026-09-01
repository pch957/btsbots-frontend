# 🔐 BTSBots Decentralized Identity (DID) OAuth Integration Developer Guide

This document is intended for third-party merchant developers and introduces how to integrate the **BTSBots** Decentralized Identity Verification (DID) service. Merchants can authenticate user identities without storing passwords or sending SMS verification codes, directly using BitShares blockchain accounts and Elliptic Curve Cryptography (ECDSA) signatures.

---

## ⚙️ 1. OAuth Workflow Architecture

```
[ User Browser / PC ] ------ (1) Initiate Login / Show QR -------> [ Merchant Web Site ]
        |                                                                 |
 (2) Redirect to OAuth                                            (3) Poll Login Status
     or Scan with Mobile App                                              |
        v                                                                 v
[ BTSBots Client / Web ] - (4) Sign Intent via WebCrypto -> [ BTSBots DDP Cloud Server ]
                                                                          |
 (5) Fetch & Verify Signature                                             v
[ Merchant BizBots Daemon ] <---- (6) HTTP POST Push Signed Proof --------+
```

1. The user clicks "Login with BitShares Account" on the merchant site or views a login QR code.
2. The merchant generates a temporary challenge code `token` (UUID) for this login session and redirects the user to the authentication gateway.
3. The user approves and signs the authorization in the BTSBots App or browser.
4. The BTSBots core server distributes verified identity credentials to the merchant's callback endpoint, allowing the merchant to issue a session.

---

## 🛠️ 2. Integration Option A: Zero-Code Proxy Mode with `biz_proxy.py` (Recommended)

If merchants want a fast integration without writing complex cryptographic verification code, they can directly run the `biz_proxy.py` agent program inside their internal server network.

### 1. Mandatory `biz_rules.json` Callback Routing Configuration
**Important**: When using `biz_proxy`, merchants MUST STILL configure `biz_rules.json` in the same directory as `biz_bots.py`, **pointing the `oauth_endpoint` callback URL directly to the `/biz-proxy/sync-login` endpoint provided by `biz_proxy.py`**:

```json
{
  "description": "BTSBots Login & Payment Invocation Rules",
  "updated_at": "2026-08-12 19:54:52",
  "oauth_endpoint": {
    "my-shop.com": "https://my-shop.com/biz-proxy/sync-login"
  }
}
```

### 2. Launch `biz_proxy.py`
```bash
uv run python biz_proxy.py \
  --host 127.0.0.1 \
  --port 9000 \
  <merchant_bts_account> \
  <merchant_bts_pubkey>
```

### 3. Nginx Reverse Proxy & Session Interception Example
Merchants can delegate all login authentication for specific domain names to `biz_proxy` via Nginx `auth_request`:

```nginx
server {
    listen 443 ssl;
    server_name my-shop.com;

    # 1. Primary business location: Add auth check
    location / {
        auth_request /biz-internal/check-login;
        error_page 401 = @go_to_login;
        
        # After authentication passes, proxy injects BitShares username in header
        auth_request_set $bts_user $upstream_http_x_user;
        proxy_set_header X-BTS-User $bts_user;
        
        proxy_pass http://127.0.0.1:8080;
    }

    # 2. Redirect unauthenticated users to proxy login gateway
    location @go_to_login {
        return 302 https://my-shop.com/biz-proxy/login?redirect=$scheme://$http_host$request_uri;
    }

    # 3. Auth verification route proxied to biz_proxy
    location /biz-internal/check-login {
        internal;
        proxy_pass http://127.0.0.1:9000/biz-internel/check-login;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-App-Id "my-shop.com";
        proxy_set_header X-Session-ID $cookie_bts_session;
    }

    # 4. Proxy gateway endpoints pass-through
    location /biz-proxy/ {
        proxy_pass http://127.0.0.1:9000/biz-proxy/;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

---

## 💻 3. Integration Option B: Custom Web API Callbacks

Merchants with custom backend stacks (Python FastAPI/Flask, Node.js, Go, etc.) can implement their own callback endpoints.

### 1. Configure `biz_rules.json` Mapping Rules
In the merchant's `biz_bots.py` configuration file `biz_rules.json`, map domains to your custom backend API endpoints:

```json
{
  "description": "Merchant App OAuth Rules",
  "updated_at": "2026-08-12 20:00:00",
  "oauth_endpoint": {
    "my-shop.com": "https://api.my-shop.com/v1/auth/bts-callback"
  }
}
```

### 2. Callback HTTP Payload Format
When authorization completes, `biz_bots` sends an HTTP POST request to your `oauth_endpoint` with the following body:

```json
{
  "data": "{\"username\":\"alice\",\"site\":\"my-shop.com\",\"ip\":\"203.0.113.195\",\"token\":\"550e8400-e29b-41d4-a716-446655440000\",\"time\":1770800000}",
  "pubkey": "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV",
  "signature": "1f3a2b..."
}
```

### 3. Merchant Backend Verification Example (Python / FastAPI)

The merchant needs to verify:
1. Whether `pubkey` matches the trusted BTSBots bot public key or belongs to the user's Active public key on-chain.
2. Use BitShares `graphene` ECDSA algorithms to verify the `signature` against `data`.
3. Match `data.ip` against the client IP initiating login to prevent phishing.

```python
import json
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
# Import lightweight BitShares ECDSA verification module
from btsbots.graphene_light import verify_message as bts_verify_message

app = FastAPI()

TRUSTED_BIZ_BOT_PUBKEY = "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"

class OAuthCallbackPayload(BaseModel):
    data: str
    pubkey: str
    signature: str

@app.post("/v1/auth/bts-callback")
async def bts_oauth_callback(payload: OAuthCallbackPayload):
    # 1. Verify public key source
    if payload.pubkey != TRUSTED_BIZ_BOT_PUBKEY:
        raise HTTPException(status_code=403, detail="Untrusted signature source")

    # 2. Cryptographic ECDSA signature verification
    is_valid = bts_verify_message(payload.data, payload.signature, payload.pubkey)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or forged cryptographic signature")

    # 3. Parse JSON business data
    auth_info = json.loads(payload.data)
    username = auth_info.get("username")
    token = auth_info.get("token")
    ip = auth_info.get("ip")
    auth_time = auth_info.get("time")

    # 4. Expiration & anti-replay checks (e.g. 5 minutes)
    if abs(time.time() - auth_time) > 300:
        raise HTTPException(status_code=400, detail="Authorization request expired")

    # 5. TODO: Update token status in Redis/database and issue session
    print(f"🎉 User {username} logged in successfully via BitShares DID! Token: {token}")

    return {"status": "success", "username": username}
```

---

### 4. Merchant Backend Verification Example (Node.js / Express)

For Node.js merchant stacks, verification can be implemented with `bitsharesjs`:

```javascript
const express = require('express');
const { Signature, PublicKey } = require('bitsharesjs');

const app = express();
app.use(express.json());

const TRUSTED_PUBKEY = 'BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

app.post('/v1/auth/bts-callback', (req, res) => {
  const { data, pubkey, signature } = req.body;

  if (pubkey !== TRUSTED_PUBKEY) {
    return res.status(403).json({ error: 'Untrusted public key' });
  }

  try {
    const pubKeyObj = PublicKey.fromPublicKeyString(pubkey);
    const sigObj = Signature.fromHex(signature);
    
    // Verify BitShares message signature
    const isValid = sigObj.verifyBuffer(Buffer.from(data, 'utf8'), pubKeyObj);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid cryptographic signature' });
    }

    const authInfo = JSON.parse(data);
    console.log(`✅ [OAuth Verified] User ${authInfo.username} authenticated!`);

    // Merchant internal session issuance logic
    return res.json({ status: 'ok', user: authInfo.username });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Merchant auth callback listener on :3000'));
```