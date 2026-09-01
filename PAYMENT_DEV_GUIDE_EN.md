# 💳 BTSBots On-Chain Instant Payment Integration Guide

This document guides third-party merchants (e-commerce, digital subscriptions, GameFi) on integrating zero-fee, instant crypto payments on the BitShares blockchain via **BTSBots**.

---

## 💡 1. Payment Architecture & Workflow

```
[ Buyer / User ] ---- (1) Submit Order ----> [ Merchant Web ]
     |                                             | (2) Generate Prefixed Memo
     |                                             v
     +---- (3) Send On-Chain Transfer (Memo) ---> [ BitShares Blockchain ]
                                                        |
                                                        v (WebSocket Stream)
[ Merchant System ] <--- (5) HTTP Notification --- [ BizBots Listener ]
```

1. **Order Generation**: Merchant generates an order ID with a designated prefix (e.g., `exa_order_883921`).
2. **Transfer**: The buyer scans the payment QR code and executes the transfer using the BTSBots App.
3. **On-Chain Monitoring & Decryption**: `biz_bots.py` listens for incoming transfers, decrypting on-chain memos in real-time.
4. **Fulfillment**: `biz_bots.py` verifies amounts and assets, notifying the merchant API via signed POST callbacks for automated fulfillment.

---

## ⚙️ 2. Configuring `biz_rules.json`

In the `biz_bots.py` directory, map memo prefixes to merchant payment endpoints:

```json
{
  "description": "Merchant Payment Endpoint Configuration",
  "updated_at": "2026-08-12 20:00:00",
  "pay_endpoint": {
    "exa_": "https://api.my-shop.com/v1/payment/checkout-notify",
    "sub_": "https://api.my-shop.com/v1/payment/subscription-notify"
  }
}
```

---

## 🛠️ 3. Option A: Querying Status via `biz_proxy.py`

Merchants can query payment statuses via internal APIs provided by `biz_proxy.py`:

### Status Query Endpoint
* **Method**: `GET /biz-internel/check-payment`
* **Query Params**: `order_id=exa_2026081299&app_id=my-shop.com`
* **Response**:
```json
{
  "amount": "150.00000",
  "asset": "CNY",
  "tx_id": "1849201"
}
```

---

## 💻 4. Option B: Custom Web Payment Callback

### 1. HTTP Payload Specification
`biz_bots` posts payment details to the configured `pay_endpoint`:

```json
{
  "data": "{\"type\":\"payment\",\"time\":1770800000,\"order_id\":\"exa_2026081299\",\"tx_id\":1849201,\"amount\":150.0,\"asset\":\"CNY\"}",
  "pubkey": "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV",
  "signature": "204b1a..."
}
```

### 2. Python Callback Handler Example (FastAPI)

```python
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from btsbots.graphene_light import verify_message as bts_verify_message

app = FastAPI()

TRUSTED_BOT_PUBKEY = "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"

class PaymentCallbackPayload(BaseModel):
    data: str
    pubkey: str
    signature: str

@app.post("/v1/payment/checkout-notify")
async def handle_payment_notification(payload: PaymentCallbackPayload):
    if payload.pubkey != TRUSTED_BOT_PUBKEY:
        raise HTTPException(status_code=403, detail="Untrusted notification source")

    if not bts_verify_message(payload.data, payload.signature, payload.pubkey):
        raise HTTPException(status_code=400, detail="Invalid cryptographic signature")

    pay_data = json.loads(payload.data)
    order_id = pay_data.get("order_id")
    tx_id = pay_data.get("tx_id")
    amount = float(pay_data.get("amount"))
    asset = pay_data.get("asset")

    print(f"💰 [Payment Received]: Order {order_id} | TX: {tx_id} | Amount: {amount} {asset}")

    # TODO: Check idempotency, verify expected amount, and fulfill order
    return {"status": "ok"}
```

---

### 3. Node.js Callback Handler Example (Express)

```javascript
const express = require('express');
const { Signature, PublicKey } = require('bitsharesjs');

const app = express();
app.use(express.json());

const TRUSTED_BOT_PUBKEY = 'BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

app.post('/v1/payment/checkout-notify', (req, res) => {
  const { data, pubkey, signature } = req.body;

  if (pubkey !== TRUSTED_BOT_PUBKEY) {
    return res.status(403).json({ error: 'Untrusted notification source' });
  }

  try {
    const pubKeyObj = PublicKey.fromPublicKeyString(pubkey);
    const sigObj = Signature.fromHex(signature);
    
    const isValid = sigObj.verifyBuffer(Buffer.from(data, 'utf8'), pubKeyObj);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const payData = JSON.parse(data);
    const { order_id, tx_id, amount, asset } = payData;

    console.log(`🎉 [Payment Verified] Order ${order_id} received ${amount} ${asset} (TX: ${tx_id})`);

    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Payment notification listener running on :3001'));
```

---

## 🔗 5. Standard Payment QR Code Scheme

Merchants can render standard URI QR codes for instant scanning:

```
btsbots://transfer?to=merchant_account&asset=CNY&amount=150&memo=exa_2026081299&goods=VIP%20Annual%20Subscription
```