# 💳 BTSBots 链上即时支付接入开发手册

本文档指导第三方商户（如电商、数字订阅、GameFi 等）如何基于 **BitShares（比特股）区块链** 接入零手续费、秒级确认的加密货币支付。

---

## 💡 一、链上支付架构与工作原理

```
[ 买家/用户 ] ---- (1) 在商户提交订单 ----> [ 商户网站 ]
     |                                          | (2) 生成带前缀的订单号 (Memo)
     |                                          v
     +---- (3) 发起链上转账 (附加 Memo) ----> [ 比特股区块链 (BitShares) ]
                                                        |
                                                        v (实时 WebSocket 推送)
[ 商户系统 ] <--- (5) HTTP POST 回调通知 --- [ 商户 BizBots 监听节点 ]
```

1. **订单生成**：商户生成带特定前缀前缀的订单标识，例如 `exa_order_883921`。
2. **扫码/发起转账**：用户使用 BTSBots Wallet App 扫描付款码，发起转账。
3. **链上监听与解密**：商户的 `biz_bots.py` 监听链上转账事件，自动解密链上 Memo。
4. **即时放行**：`biz_bots.py` 校验金额与资产无误后，向商户服务器发起强签名回调，自动完成履约交付。

---

## ⚙️ 二、配置 `biz_rules.json` 规则映射

在 `biz_bots.py` 根目录下配置 `biz_rules.json`，将不同的 Memo 前缀映射到商户的回调接口：

```json
{
  "description": "商户支付监听路由配置",
  "updated_at": "2026-08-12 20:00:00",
  "pay_endpoint": {
    "exa_": "https://api.my-shop.com/v1/payment/checkout-notify",
    "sub_": "https://api.my-shop.com/v1/payment/subscription-notify"
  }
}
```

* **解析规则**：凡是转账 Memo 以 `exa_` 开头的交易（如 Memo 为 `exa_2026081299`），`biz_bots` 将自动通知到对应的 URL。

---

## 🛠️ 三、方案 A：使用 `biz_proxy.py` 本地代理

如果商户希望通过内网 API 直接查询订单支付状态，可利用 `biz_proxy.py` 自带的数据库和状态 API。

### 查询订单支付状态 API
* **请求方式**：`GET /biz-internel/check-payment`
* **Query 参数**：`order_id=exa_2026081299&app_id=my-shop.com`
* **响应示例**：
```json
{
  "amount": "150.00000",
  "asset": "CNY",
  "tx_id": "1849201"
}
```

---

## 💻 四、方案 B：商户自主实现 Payment 回调 API

### 1. 回调 HTTP Payload 规范
当监听到买家打款成功后，`biz_bots` 会将解密后的交易明细打包发送至您的 `pay_endpoint`：

```json
{
  "data": "{\"type\":\"payment\",\"time\":1770800000,\"order_id\":\"exa_2026081299\",\"tx_id\":1849201,\"amount\":150.0,\"asset\":\"CNY\"}",
  "pubkey": "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV",
  "signature": "204b1a..."
}
```

### 2. 商户回调 API 实现 (Python / FastAPI)

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
    # 1. 验证公钥来源
    if payload.pubkey != TRUSTED_BOT_PUBKEY:
        raise HTTPException(status_code=403, detail="非法通知源")

    # 2. 验证加密签名
    if not bts_verify_message(payload.data, payload.signature, payload.pubkey):
        raise HTTPException(status_code=400, detail="支付签名验证错误")

    # 3. 解析支付明细
    pay_data = json.loads(payload.data)
    order_id = pay_data.get("order_id")
    tx_id = pay_data.get("tx_id")
    amount = float(pay_data.get("amount"))
    asset = pay_data.get("asset")

    print(f"💰 [收到付款]: 订单号 {order_id} | 链上TX: {tx_id} | 金额: {amount} {asset}")

    # 4. 幂等性处理：检查数据库中订单状态，避免重复发货
    # db_order = await db.find_order(order_id)
    # if db_order.status == 'PAID':
    #     return {"status": "ok", "message": "already processed"}

    # 5. 校验金额与资产类型是否匹配
    # if amount < db_order.expected_amount or asset != db_order.expected_asset:
    #     raise HTTPException(status_code=400, detail="支付金额或币种不足")

    # 6. 更新数据库并自动放行发货
    # await db.mark_as_paid(order_id, tx_id)

    return {"status": "ok"}
```

---

### 3. 商户回调 API 实现 (Node.js / Express)

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
    
    // 验证数字签名
    const isValid = sigObj.verifyBuffer(Buffer.from(data, 'utf8'), pubKeyObj);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const payData = JSON.parse(data);
    const { order_id, tx_id, amount, asset } = payData;

    console.log(`🎉 [Payment Verified] Order ${order_id} received ${amount} ${asset} (TX: ${tx_id})`);

    // 商户业务逻辑：更新数据库订单状态并履约放行
    // await orderService.fulfillOrder(order_id, tx_id, amount, asset);

    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Payment notification listener running on :3001'));
```

---

## 🔗 五、生成标准支付二维码协议

商户可在前端直接渲染符合 BTSBots URI 规范的二维码，供用户扫码支付：

```
btsbots://transfer?to=merchant_account&asset=CNY&amount=150&memo=exa_2026081299&goods=VIP%20Annual%20Subscription
```

* `to`: 商户的比特股接收账号。
* `asset`: 结算代币代码（如 `BTS`, `CNY`, `USD` 等）。
* `amount`: 支付金额。
* `memo`: 必填，带有配置前缀的商户唯一订单号。
* `goods`: 可选，显示在钱包支付界面上的商品简要描述。