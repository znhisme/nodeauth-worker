import { getSharePublicHeaders } from '@/features/share/shareSecurity';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toSafeScriptJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderSharePublicPage(token: string): Response {
    const safeToken = escapeHtml(token);
    const tokenJson = toSafeScriptJson(token);
    const headers = {
        ...getSharePublicHeaders(),
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
    };

    return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>NodeAuth Share</title>
    <style>
        :root {
            color-scheme: light dark;
            --bg: #f7f8fb;
            --panel: #ffffff;
            --text: #1f2937;
            --muted: #6b7280;
            --border: #d7dde8;
            --primary: #2563eb;
            --primary-strong: #1d4ed8;
            --danger: #b42318;
            --success: #067647;
            --code: #101828;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #101418;
                --panel: #171c22;
                --text: #eef2f6;
                --muted: #a7b0bd;
                --border: #303846;
                --primary: #6da8ff;
                --primary-strong: #8bbcff;
                --danger: #ff9b8f;
                --success: #7bdca4;
                --code: #ffffff;
            }
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--text);
        }
        main {
            width: min(100%, 560px);
            margin: 0 auto;
            padding: 48px 20px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 24px;
            font-weight: 700;
            font-size: 20px;
        }
        .mark {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--primary);
            color: #fff;
            display: grid;
            place-items: center;
            font-weight: 800;
        }
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--panel);
            padding: 24px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 24px;
            line-height: 1.25;
        }
        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
        }
        form {
            margin-top: 24px;
            display: grid;
            gap: 12px;
        }
        label {
            font-weight: 600;
        }
        input {
            width: 100%;
            min-height: 44px;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 0 12px;
            font: inherit;
            color: var(--text);
            background: transparent;
        }
        button {
            min-height: 44px;
            border: 0;
            border-radius: 6px;
            padding: 0 16px;
            font: inherit;
            font-weight: 700;
            color: #fff;
            background: var(--primary);
            cursor: pointer;
        }
        button:hover {
            background: var(--primary-strong);
        }
        button:disabled {
            opacity: 0.65;
            cursor: wait;
        }
        .status {
            margin-top: 16px;
            min-height: 24px;
            font-weight: 600;
        }
        .status.error {
            color: var(--danger);
        }
        .status.success {
            color: var(--success);
        }
        .result {
            display: none;
            margin-top: 20px;
            border-top: 1px solid var(--border);
            padding-top: 20px;
        }
        .result.visible {
            display: grid;
            gap: 14px;
        }
        .field {
            display: grid;
            gap: 4px;
        }
        .field span {
            color: var(--muted);
            font-size: 13px;
            font-weight: 600;
        }
        .field strong,
        .otp-code {
            color: var(--code);
            overflow-wrap: anywhere;
        }
        .otp-code {
            font-variant-numeric: tabular-nums;
            font-size: 32px;
            letter-spacing: 0;
            font-weight: 800;
        }
        .token {
            margin-top: 16px;
            font-size: 12px;
            overflow-wrap: anywhere;
        }
        @media (max-width: 480px) {
            main {
                padding: 28px 14px;
            }
            .panel {
                padding: 18px;
            }
        }
    </style>
</head>
<body>
    <main>
        <div class="brand"><div class="mark">N</div><div>NodeAuth</div></div>
        <section class="panel" aria-labelledby="share-title">
            <h1 id="share-title">共享账户访问</h1>
            <p>输入分享者提供的访问码查看此账户。</p>
            <form id="access-form">
                <label for="access-code">访问码</label>
                <input id="access-code" name="accessCode" type="password" autocomplete="one-time-code" required>
                <button id="submit-button" type="submit">查看账户</button>
            </form>
            <div id="status" class="status" role="status" aria-live="polite"></div>
            <section id="result" class="result" aria-label="共享账户详情">
                <div class="field"><span>服务</span><strong id="service"></strong></div>
                <div class="field"><span>账户</span><strong id="account"></strong></div>
                <div class="field" id="otp-field"><span>当前验证码</span><strong id="otp-code" class="otp-code"></strong><p id="otp-meta"></p></div>
                <div class="field" id="password-field"><span>密码</span><strong id="password"></strong></div>
            </section>
            <p class="token">Share token: ${safeToken}</p>
        </section>
    </main>
    <script>
        const shareToken = ${tokenJson};
        const form = document.getElementById('access-form');
        const input = document.getElementById('access-code');
        const button = document.getElementById('submit-button');
        const statusEl = document.getElementById('status');
        const resultEl = document.getElementById('result');
        const serviceEl = document.getElementById('service');
        const accountEl = document.getElementById('account');
        const otpFieldEl = document.getElementById('otp-field');
        const otpCodeEl = document.getElementById('otp-code');
        const otpMetaEl = document.getElementById('otp-meta');
        const passwordFieldEl = document.getElementById('password-field');
        const passwordEl = document.getElementById('password');

        function setStatus(message, kind) {
            statusEl.textContent = message;
            statusEl.className = kind ? 'status ' + kind : 'status';
        }

        function showResult(item) {
            serviceEl.textContent = item.service || '';
            accountEl.textContent = item.account || '';
            if (item.otp && item.otp.code) {
                otpFieldEl.style.display = '';
                otpCodeEl.textContent = item.otp.code;
                otpMetaEl.textContent = '刷新周期 ' + item.otp.period + ' 秒，剩余 ' + item.otp.remainingSeconds + ' 秒';
            } else {
                otpFieldEl.style.display = 'none';
            }
            if (item.password) {
                passwordFieldEl.style.display = '';
                passwordEl.textContent = item.password;
            } else {
                passwordFieldEl.style.display = 'none';
            }
            resultEl.classList.add('visible');
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const accessCode = input.value.trim();
            if (!accessCode) {
                setStatus('请输入访问码。', 'error');
                return;
            }

            button.disabled = true;
            resultEl.classList.remove('visible');
            setStatus('正在验证...', '');

            try {
                const response = await fetch('/api/share/public/' + encodeURIComponent(shareToken) + '/access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode }),
                    credentials: 'omit',
                });
                const body = await response.json().catch(() => null);
                if (!response.ok || !body || body.success !== true) {
                    setStatus('分享链接不可用或访问码错误。', 'error');
                    return;
                }
                showResult(body.data || {});
                setStatus('验证通过。', 'success');
            } catch (error) {
                setStatus('无法访问分享服务。', 'error');
            } finally {
                button.disabled = false;
            }
        });
    </script>
</body>
</html>`, {
        status: 200,
        headers,
    });
}
