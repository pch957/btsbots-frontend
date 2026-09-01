# 💳 BTSBots On-Chain Instant Payment Integration Developer Guide

This document guides third-party merchants (e-commerce, digital subscriptions, GameFi, etc.) on how to integrate zero-fee, instant crypto payments on the **BitShares blockchain** via **BTSBots**.

---

## 💡 1. Payment Architecture & Workflow

```
[ Buyer / User ] ---- (1) Submit Order on Merchant Web ----> [ Merchant Web ]
     |                                                           | (2) Generate Prefixed Memo
     |                                                           v
     +---- (3) Send On-Chain Transfer (Memo) ----> [ BitShares Blockchain ]
                                                         |
                                                         v (WebSocket Stream)
[ Merchant System ] <--- (5) HTTP POST Callback Notification --- [ BizBots Daemon ]
```

1. **Order Generation**: The merchant generates an order ID with a designated prefix, e.g. `exa_order_883921`.
2. **Scan / Transfer**: The user scans the payment QR code with the BTSBots Wallet App and submits the transfer.
3. **On-Chain Monitoring & Decryption**: The merchant's `biz_bots.py` monitors incoming transfers, automatically decrypting on-chain memos.
4. **Instant Fulfillment**: `biz_bots.py` verifies amounts and asset symbols, sending a signed POST callback to the merchant server for instant fulfillment.

---

## ⚙️ 2. Configuring `biz_rules.json`

In the `biz_bots.py` directory, map memo prefixes to merchant payment endpoints in `biz_rules.json`:

```json
{
  "description": "Merchant Payment Listener Routing",
  "updated_at": "2026-08-12 20:00:00",
  "pay_endpoint": {
    "exa_": "https://api.my-shop.com/v1/payment/checkout-notify",
    "sub_": "https://api.my-shop.com/v1/payment/subscription-notify"
  }
}
```

* **Routing Rule**: Any transaction with a Memo starting with `exa_` (e.g. Memo `exa_2026081299`) will automatically trigger a notification to the mapped URL.

---

## 🛠️ 3. Option A: Using Local Proxy `biz_proxy.py`

If merchants prefer querying order payment status directly via internal APIs, they can use `biz_proxy.py`:

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

## 💻 4. Option B: Custom Web Payment Callback API

### 1. HTTP Payload Specification
When payment is confirmed on-chain, `biz_bots` posts payment details to your `pay_endpoint`:

```json
{
  "data": "{\"type\":\"payment\",\"time\":1770800000,\"order_id\":\"exa_2026081299\",\"tx_id\":1849201,\"amount\":150.0,\"asset\":\"CNY\"}",
  "pubkey": "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV",
  "signature": "204b1a..."
}
```

### 2. Merchant Callback Implementation Example (Python / FastAPI)

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
    # 1. Verify public key source
    if payload.pubkey != TRUSTED_BOT_PUBKEY:
        raise HTTPException(status_code=403, detail="Untrusted notification source")

    # 2. Verify payment signature
    if not bts_verify_message(payload.data, payload.signature, payload.pubkey):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # 3. Parse payment details
    pay_data = json.loads(payload.data)
    order_id = pay_data.get("order_id")
    tx_id = pay_data.get("tx_id")
    amount = float(pay_data.get("amount"))
    asset = pay_data.get("asset")

    print(f"💰 [Payment Received]: Order {order_id} | On-Chain TX: {tx_id} | Amount: {amount} {asset}")

    # 4. Idempotency check: Ensure order is not processed repeatedly
    # db_order = await db.find_order(order_id)
    # if db_order.status == 'PAID':
    #     return {"status": "ok", "message": "already processed"}

    # 5. Verify expected amount and asset code
    # if amount < db_order.expected_amount or asset != db_order.expected_asset:
    #     raise HTTPException(status_code=400, detail="Insufficient payment amount")

    # 6. Update database & fulfill order
    # await db.mark_as_paid(order_id, tx_id)

    return {"status": "ok"}
```

---

### 3. Merchant Callback Implementation Example (Node.js / Express)

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
    
    // Verify signature
    const isValid = sigObj.verifyBuffer(Buffer.from(data, 'utf8'), pubKeyObj);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const payData = JSON.parse(data);
    const { order_id, tx_id, amount, asset } = payData;

    console.log(`🎉 [Payment Verified] Order ${order_id} received ${amount} ${asset} (TX: ${tx_id})`);

    // Merchant fulfillment logic
    // await orderService.fulfillOrder(order_id, tx_id, amount, asset);

    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Payment notification listener running on :3001'));
```

---

## 🔗 5. Standard Payment QR Code Scheme

Merchants can render standard URI QR codes on the frontend:

```
btsbots://transfer?to=merchant_account&asset=CNY&amount=150&memo=exa_2026081299&goods=VIP%20Annual%20Subscription
```

* `to`: Merchant's BitShares account.
* `asset`: Settlement token symbol (e.g., `BTS`, `CNY`, `USD`).
* `amount`: Required payment amount.
* `memo`: Required unique order ID with prefix.
* `goods`: Optional brief goods description displayed in the wallet interface.