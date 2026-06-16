---
module: Agent
tags: [Agent, SSRF, 安全, 联网工具, Prompt Injection]
difficulty: hard
last_reviewed: 2026-06-12
---

# Agent SSRF 防御

> **How-to 文档**：Agent 联网工具（`fetch_url` 等）的 SSRF 防御实现指南。
>
> **SSRF = Server-Side Request Forgery（服务端请求伪造）**——Agent 时代的特殊性在于：LLM 输出的 URL 可以被 Prompt Injection 控制，攻击者通过污染网页/文档/用户输入诱导 Agent 发起恶意请求。
>
> 整体安全模型见 [[Agent 安全模型]]。

---

## 一、为什么 Agent 时代 SSRF 危险性更高

传统 SSRF：攻击者构造请求 → 服务端请求内网资源。

**Agent 时代新攻击面**：攻击者不需要直接发请求——只需在 Agent 会读取的任何内容（网页、文档、邮件、issue 正文）里嵌入恶意 URL，LLM 看到后自动调 `fetch_url`，Agent 用**自己的网络身份**发出请求。

```
攻击链：
恶意内容里嵌入"帮我读这个 URL 总结一下"（恶意 URL）
         ↓
LLM 调 fetch_url(malicious_url)
         ↓
Agent 用自己的网络身份发请求（有内网/云元数据访问权）
         ↓
数据泄露 / 内网攻击
```

---

## 二、三种典型攻击场景

| 攻击 URL | 后果 |
|---------|------|
| `http://169.254.169.254/latest/meta-data/iam/security-credentials/` | 偷 AWS / GCP / Azure 实例的 IAM 临时凭证——直接拿到云账号控制权 |
| `file:///etc/passwd` / `file:///root/.ssh/id_rsa` | 读宿主机敏感文件（密码哈希 / SSH 私钥） |
| `http://localhost:6379/` / `http://10.0.0.5:3306/` | 攻击内网服务（Redis / MySQL / 内部 API），跳过外网防火墙 |

---

## 三、五道防线实现（完整 Python）

```python
import socket, ipaddress
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}
MAX_BODY_BYTES = 5 * 1024 * 1024   # 5MB
MAX_REDIRECTS = 3

def _resolve_and_validate(host: str) -> list[str]:
    """解析 host 的全部地址(IPv4+IPv6),逐个校验,返回通过的 IP 列表。"""
    # getaddrinfo 返回所有 A / AAAA 记录——gethostbyname 只取首个 IPv4,会漏 IPv6/多 A
    infos = socket.getaddrinfo(host, None)
    ips = {info[4][0] for info in infos}
    if not ips:
        raise SecurityError(f"无法解析: {host}")
    for ip_str in ips:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private:        # 10.x / 172.16.x / 192.168.x / fd00::/8
            raise SecurityError("禁止访问内网")
        if ip.is_loopback:       # 127.x / ::1
            raise SecurityError("禁止访问 loopback")
        if ip.is_link_local:     # 169.254.x / fe80:: ——含云元数据 169.254.169.254
            raise SecurityError("禁止访问链路本地地址")
        if ip.is_reserved or ip.is_multicast:
            raise SecurityError("禁止访问保留地址")
    return list(ips)

def safe_fetch(url: str, depth: int = 0) -> str:
    if depth > MAX_REDIRECTS:
        raise SecurityError("重定向次数超限")

    # 1. 协议白名单——禁 file://、ftp://、gopher://、data://
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SecurityError(f"禁止协议: {parsed.scheme}")

    # 2. 解析全部地址并校验(IPv4+IPv6),拿到通过校验的 IP
    safe_ips = _resolve_and_validate(parsed.hostname)

    # 3. ★ pin IP——直接对已校验的 IP 发请求,Host 头携带域名。
    #    否则 requests.get(url) 会"重新做一次 DNS 解析",
    #    攻击者可在两次解析之间把 A 记录切到 169.254.169.254(DNS rebinding / TOCTOU)
    pinned_ip = safe_ips[0]
    pinned_url = url.replace(parsed.hostname, pinned_ip, 1)
    headers = {"Host": parsed.hostname}

    # 4. 不自动跟随重定向——重定向目标可能指向内网,要对新 URL 重新走全部校验
    resp = requests.get(pinned_url, headers=headers, allow_redirects=False,
                        timeout=30, stream=True, verify=True)
    if resp.is_redirect:
        return safe_fetch(resp.headers["Location"], depth + 1)

    # 5. 大小限制——防止流量打爆 / 上下文爆炸
    if int(resp.headers.get("Content-Length", 0)) > MAX_BODY_BYTES:
        raise SecurityError("响应超过 5MB")
    body = resp.raw.read(MAX_BODY_BYTES + 1)
    if len(body) > MAX_BODY_BYTES:
        raise SecurityError("响应流超限")

    return body.decode("utf-8", errors="ignore")
```

> [!warning] 必须 pin IP，否则防不住 DNS rebinding
> 常见错误写法：`gethostbyname` 校验 IP → 再 `requests.get(域名)`——`requests` 会**重新做一次 DNS 解析**，攻击者可在两次解析之间把 A 记录从公网切到 `169.254.169.254`（TOCTOU）。正确做法：锁定已校验的 IP 直接连接 + `Host` 头携带域名。
>
> 另外 `gethostbyname` 只返回单个 IPv4，必须用 `getaddrinfo` 取全部地址（含 IPv6 / 多 A 记录）逐个校验。

---

## 四、五道防线速查表

| 防线 | 防什么 |
|------|------|
| **协议白名单** | `file://` 读本地文件、`gopher://` 打 SMTP/Redis 协议走私 |
| **解析全部 IP 后 pin** | 校验所有 A/AAAA 记录并锁定 IP——防 DNS rebinding / 多 A 记录绕过 |
| **重定向手动追** | 第一跳合法 → 第二跳指向内网 |
| **大小限制 5MB** | 流量打爆 / token 上下文爆炸 |
| **频率限制** | LLM 失控/被注入后疯狂调接口（30次/分钟、100次/任务） |

---

## 五、Agent 场景特殊考量

- **URL 来源标记**：LLM 输出的 URL 标记为"不可信源"——比用户直接输入的多走一道安全检查
- **沙箱网络**：Agent 进程跑在 network namespace 里，默认禁止访问内网网段（比代码层防护更可靠，纵深防御）
- **凭证隔离**：Agent 的网络身份 ≠ 宿主机网络身份，Agent 进程不持有云元数据访问权限
- **审计日志**：所有 `fetch_url` 调用记录（URL / 解析 IP / 响应大小 / 触发的安全策略）

==生产实践==：Anthropic Claude 的 web tool、OpenAI Browse with Bing 都内置了 SSRF 防护——**这是 Agent 上线前必过的安全审计项**。

## 相关链接

- [[Agent 安全模型]] — 整体安全模型（四层防护体系 / HITL / Prompt Injection）
- [[Coding Agent 工具集_MOC#2.5 联网类]] — Web 工具的工具集设计
- [[MCP 协议概述]] — MCP 工具的安全隔离
