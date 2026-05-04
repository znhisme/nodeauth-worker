# 使用登录 Token 通过 API 导入账户

本教程说明如何取得 NodeAuth 登录后的 `auth_token`，并用它调用现有的账户导入接口：

```text
POST /api/vault/import
Authorization: Bearer <auth_token>
Content-Type: application/json
```

这个功能复用现有导入逻辑，不新增单独解析器。导入结果只返回汇总信息，例如 `success`、`count`、`duplicates`、`pending`，不会返回密钥、账户 ID、用户信息或 session 信息。

## 重要安全说明

- `auth_token` 是登录用户的会话 JWT，等同于该用户的 API 访问凭证。
- 不要把 token 放进 Git、聊天记录、截图、日志或前端页面。
- token 默认来自登录 Cookie，有效期跟登录会话一致，当前登录路径设置为 7 天。
- 用户登出、session 被删除、被挤下线或过期后，这个 token 会失效。
- API 自动化调用时只发送 `Authorization: Bearer <token>`，不要同时发送浏览器 Cookie。代码里 Cookie 优先级更高，如果同时带 Cookie，会走浏览器 Cookie 模式并要求 CSRF。

## 方式一：从浏览器获取 auth_token

适合已经在浏览器里登录 NodeAuth 的场景。

1. 打开 NodeAuth 并完成登录。
2. 打开浏览器开发者工具。
3. 进入 Application 或 Storage 面板。
4. 找到当前 NodeAuth 域名下的 Cookies。
5. 找到名为 `auth_token` 的 Cookie。
6. 复制它的 Value，这个值就是 API 用的 token。

注意：`auth_token` 是 HttpOnly Cookie，JavaScript 不能用 `document.cookie` 读取它，这是正常的安全设计。需要从开发者工具的 Cookie 面板复制。

## 方式二：从登录响应的 Set-Cookie 获取 auth_token

适合调试或自己写登录自动化时使用。

登录成功的接口会设置：

- `auth_token`: HttpOnly JWT 会话 Cookie。
- `csrf_token`: 浏览器 Cookie 模式使用的 CSRF token。

常见登录成功接口包括：

- OAuth 回调：`POST /api/auth/callback/:provider`
- WebAuthn 登录验证：`POST /api/auth/webauthn/login/verify`
- Web3 登录验证：`POST /api/auth/web3/login/verify`

如果使用 curl 调试登录流程，可以用 `-i` 查看响应头，然后从 `Set-Cookie: auth_token=...;` 中复制 `auth_token` 的值。

## 准备导入文件

最简单的导入类型是 `text`，文件中每行一个 `otpauth://` URI：

```text
otpauth://totp/OpenAI:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=OpenAI
otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
```

保存为 `accounts.txt`。

当前 `/api/vault/import` 复用现有导入类型：

| type | content 内容 |
|------|--------------|
| `text` | 多行 `otpauth://` URI 文本 |
| `json` | NodeAuth 或兼容结构 JSON |
| `2fas` | 2FAS 导出 JSON |
| `raw` | 原始账户数组 JSON |
| `encrypted` | 加密导出 JSON，需要同时提供 `password` |

## 使用 curl 导入 text 文件

把下面三个变量改成你的实际值：

```bash
BASE_URL="https://nodeauth.example.com"
AUTH_TOKEN="粘贴从 auth_token Cookie 复制的值"
IMPORT_FILE="./accounts.txt"
```

调用导入接口：

```bash
curl -sS -X POST "$BASE_URL/api/vault/import" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(jq -n --rawfile content "$IMPORT_FILE" '{ type: "text", content: $content }')"
```

成功响应示例：

```json
{
  "success": true,
  "count": 2,
  "duplicates": 0,
  "pending": false
}
```

如果你的系统没有 `jq`，可以用 Node.js 脚本方式。

## 使用仓库脚本导入

仓库提供了脚本：

```text
scripts/import_accounts_with_token.js
```

导入 text 文件：

```bash
NODEAUTH_BASE_URL="https://nodeauth.example.com" \
NODEAUTH_AUTH_TOKEN="粘贴从 auth_token Cookie 复制的值" \
node scripts/import_accounts_with_token.js --type text --file ./accounts.txt
```

导入 JSON 文件：

```bash
NODEAUTH_BASE_URL="https://nodeauth.example.com" \
NODEAUTH_AUTH_TOKEN="粘贴从 auth_token Cookie 复制的值" \
node scripts/import_accounts_with_token.js --type json --file ./accounts.json
```

导入加密备份：

```bash
NODEAUTH_BASE_URL="https://nodeauth.example.com" \
NODEAUTH_AUTH_TOKEN="粘贴从 auth_token Cookie 复制的值" \
NODEAUTH_IMPORT_PASSWORD="备份密码" \
node scripts/import_accounts_with_token.js --type encrypted --file ./backup.json
```

也可以全部用参数传入：

```bash
node scripts/import_accounts_with_token.js \
  --base-url "https://nodeauth.example.com" \
  --token "粘贴从 auth_token Cookie 复制的值" \
  --type text \
  --file ./accounts.txt
```

## 验证 token 是否可用

可以先用 `/api/auth/me` 检查 token 是否有效：

```bash
curl -sS "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

如果 token 有效，会返回当前用户信息。如果返回 `no_session`、`token_expired`、`session_invalid_schema` 或 `session_kicked_out`，需要重新登录并复制新的 `auth_token`。

## 常见错误

| 错误码 | 含义 | 处理 |
|--------|------|------|
| `no_session` | 没有有效 Cookie，也没有有效 Bearer token | 确认 `Authorization: Bearer <token>` 格式正确 |
| `token_expired` | JWT 无效或已过期 | 重新登录并复制新的 `auth_token` |
| `session_invalid_schema` | token 缺少 sessionId | 使用最新登录产生的 token |
| `session_kicked_out` | DB 中 session 已失效 | 重新登录 |
| `missing_content_type` | 请求体缺少 `type` 或 `content` | 检查 JSON body |
| `import_password_required` | `type=encrypted` 但没有 `password` | 提供导入密码 |
| `parse_failed` | 导入内容无法解析 | 检查文件格式与 `type` 是否匹配 |
| `rate_limit_exceeded` | `/api/vault/import` 触发限流 | 当前导入接口每分钟最多 5 次，稍后重试 |

## 推荐操作流程

1. 在浏览器登录 NodeAuth。
2. 从开发者工具 Cookie 面板复制 `auth_token`。
3. 准备 `accounts.txt` 或其他支持格式的导入文件。
4. 先调用 `/api/auth/me` 验证 token。
5. 调用 `/api/vault/import` 导入。
6. 导入完成后，从 shell 历史、临时文件和 CI secret 中清理不再需要的 token。

