# 🔐 BTSBots 去中心化身份 (DID) OAuth 接入开发手册

本文档面向第三方商户开发者，介绍如何接入 **BTSBots** 去中心化身份验证服务。商户可以无需存储用户密码、无需发送短信验证码，直接利用比特股区块链上的账号与椭圆曲线密码学（ECDSA）签名证明用户身份。

---

## ⚙️ 一、OAuth 认证工作原理与流程

```
[ 用户浏览器 / PC ] ------ (1) 请求登录 / 展现二维码 -------> [ 商户 Web 网站 ]
        |                                                              |
 (2) 跳转至 OAuth                                                (3) 轮询登录状态
     或 手机 App 扫码                                                   |
        v                                                              v
[ BTSBots 客户端/Web ] -- (4) 用 WebCrypto 签署意图 --> [ BTSBots DDP 核心服务器 ]
                                                                       |
 (5) 抓取并校验签名                                                    v
[ 商户 BizBots 机器人 ] <------- (6) HTTP POST 推送签名证明 --------+
```

---

## 🛠️ 二、接入方案 A：使用 `biz_proxy.py` 零代码代理模式（推荐）

如果商户希望快速接入，无需编写复杂的密码学验签代码，可以直接在商户服务器内网运行 `biz_proxy.py` 代理程序。

### 1. 必须配置 `biz_rules.json` 回调路由
**重要**：启用 `biz_proxy` 方案时，依然必须在 `biz_bots.py` 同级目录下的 `biz_rules.json` 中配置路由，**将 `oauth_endpoint` 回调地址直接指向 `biz_proxy` 提供的同步接口 `/biz-proxy/sync-login`**：

```json
{
  "description": "BTSBots 登录与支付调用规则",
  "updated_at": "2026-08-12 19:54:52",
  "oauth_endpoint": {
    "my-shop.com": "https://my-shop.com/biz-proxy/sync-login"
  }
}
```

### 2. 启动 `biz_proxy.py` 代理
```bash
uv run python biz_proxy.py \
  --host 127.0.0.1 \
  --port 9000 \
  <商户比特股账号> \
  <商户比特股公钥>
```

### 3. Nginx 反向代理配置示例
```nginx
server {
    listen 443 ssl;
    server_name my-shop.com;

    location / {
        auth_request /biz-internal/check-login;
        error_page 401 = @go_to_login;
        
        auth_request_set $bts_user $upstream_http_x_user;
        proxy_set_header X-BTS-User $bts_user;
        
        proxy_pass http://127.0.0.1:8080;
    }

    location @go_to_login {
        return 302 https://my-shop.com/biz-proxy/login?redirect=$scheme://$http_host$request_uri;
    }

    location /biz-internal/check-login {
        internal;
        proxy_pass http://127.0.0.1:9000/biz-internel/check-login;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-App-Id "my-shop.com";
        proxy_set_header X-Session-ID $cookie_bts_session;
    }

    location /biz-proxy/ {
        proxy_pass http://127.0.0.1:9000/biz-proxy/;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

---

## 💻 三、接入方案 B：商户自主实现 Web API 回调接口

### 1. 配置 `biz_rules.json` 映射规则
在 `biz_rules.json` 中将域名配置为商户自建后端 API 地址：

```json
{
  "description": "商户应用 OAuth 规则",
  "updated_at": "2026-08-12 20:00:00",
  "oauth_endpoint": {
    "my-shop.com": "https://api.my-shop.com/v1/auth/bts-callback"
  }
}
```

### 2. 商户后端验签实现示例 (Python / FastAPI)

```python
import json
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from btsbots.graphene_light import verify_message as bts_verify_message

app = FastAPI()

TRUSTED_BIZ_BOT_PUBKEY = "BTS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"

class OAuthCallbackPayload(BaseModel):
    data: str
    pubkey: str
    signature: str

@app.post("/v1/auth/bts-callback")
async def bts_oauth_callback(payload: OAuthCallbackPayload):
    if payload.pubkey != TRUSTED_BIZ_BOT_PUBKEY:
        raise HTTPException(status_code=403, detail="不受信任的签名来源")

    is_valid = bts_verify_message(payload.data, payload.signature, payload.pubkey)
    if not is_valid:
        raise HTTPException(status_code=400, detail="签名凭证伪造或无效")

    auth_info = json.loads(payload.data)
    username = auth_info.get("username")
    token = auth_info.get("token")
    auth_time = auth_info.get("time")

    if abs(time.time() - auth_time) > 300:
        raise HTTPException(status_code=400, detail="授权请求已过期")

    print(f"🎉 用户 {username} 成功通过比特股身份凭证登录！Token: {token}")

    return {"status": "success", "username": username}
```