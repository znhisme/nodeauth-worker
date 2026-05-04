(function () {
    'use strict';

    const STATE = {
        shares: [],
        filter: 'all',
        loading: false,
        oneTimeResults: [],
        failures: [],
        batchBusy: false,
        observerStarted: false,
        tickScheduled: false,
        previousActiveTab: '',
    };

    const SELECTORS = {
        navInserted: 'na-share-nav',
        batchButton: 'na-share-batch-button',
    };

    function t(key) {
        const lang = (document.documentElement.lang || navigator.language || '').toLowerCase();
        const zh = lang.startsWith('zh') || document.body.textContent.includes('我的账号');
        const copy = {
            manageShares: zh ? '管理分享' : 'Manage Shares',
            manageSharesEn: 'Manage Shares',
            close: zh ? '关闭' : 'Close',
            refresh: zh ? '刷新' : 'Refresh',
            all: zh ? '全部' : 'All',
            active: zh ? '可访问' : 'Active',
            expired: zh ? '已过期' : 'Expired',
            revoked: zh ? '已撤销' : 'Revoked',
            account: zh ? '账户' : 'Account',
            status: zh ? '状态' : 'Status',
            expires: zh ? '过期时间' : 'Expires',
            lastAccessed: zh ? '最近访问' : 'Last accessed',
            accesses: zh ? '访问次数' : 'Accesses',
            actions: zh ? '操作' : 'Actions',
            revoke: zh ? '撤销' : 'Revoke',
            share: zh ? '分享' : 'Share',
            delete: zh ? '删除' : 'Delete',
            cancel: zh ? '取消' : 'Cancel',
            noShares: zh ? '还没有分享链接。创建分享后会显示状态、过期时间、最近访问和访问次数。' : 'No share links yet. Created links will appear here with status, expiration, last access, and access count.',
            safeMeta: zh ? '这里只显示安全元数据，不显示访问码、令牌、密码或 OTP 种子。' : 'Only safe metadata is shown here. Access codes, tokens, passwords, and OTP seeds are not displayed.',
            revokeWarning: zh ? '撤销只能阻止未来访问，不能收回已经查看或复制的凭据。' : 'Revocation blocks future access, but cannot retract credentials already viewed or copied.',
            offline: zh ? 'Sharing requires a network connection. Reconnect and try again.' : 'Sharing requires a network connection. Reconnect and try again.',
            batchConfirm: zh ? 'Creating new links will replace any current active links for selected accounts. Old links will stop working.' : 'Creating new links will replace any current active links for selected accounts. Old links will stop working.',
            shareConfirmTitle: zh ? '分享' : 'Share',
            shareConfirmButton: zh ? '分享' : 'Share',
            oneTimeTitle: zh ? '批量分享结果' : 'Batch Share Results',
            oneTimeText: zh ? 'Copy each link and access code now. Access codes are shown only once.' : 'Copy each link and access code now. Access codes are shown only once.',
            copy: zh ? '复制' : 'Copy',
            copyAll: zh ? '复制全部链接和访问码' : 'Copy all links and codes',
            copied: zh ? '已复制' : 'Copied',
            failedTitle: zh ? 'Some accounts were not shared' : 'Some accounts were not shared',
            failedBody: zh ? 'Successful links are ready to copy. Review the failed rows and try again if needed.' : 'Successful links are ready to copy. Review the failed rows and try again if needed.',
            selectFirst: zh ? '请先选择要分享的账号。' : 'Select accounts to share first.',
            loadFailed: zh ? '加载分享管理失败' : 'Failed to load share management.',
            createFailed: zh ? '创建批量分享失败' : 'Failed to create batch shares.',
            revokedOk: zh ? '分享链接已撤销' : 'Share link revoked.',
        };
        return copy[key] || key;
    }

    function getAppMainContent() {
        return document.querySelector('.main-content');
    }

    function getShareOverlay(root = document) {
        return root.querySelector('.na-share-overlay') || document.querySelector('.na-share-overlay');
    }

    function getActiveTab() {
        const active = document.querySelector('.side-menu .is-active, .side-menu .el-menu-item.is-active');
        return active?.getAttribute('index') || active?.dataset?.index || active?.textContent?.trim() || '';
    }

    function dispatchMenuSelect(index) {
        const menu = document.querySelector('.side-menu');
        if (!menu || !index) return;
        const item = menu.querySelector(`[index="${CSS.escape(index)}"]`);
        if (item instanceof HTMLElement) item.click();
    }

    function mountManagerInMainContent(root) {
        const mainContent = getAppMainContent();
        const overlay = getShareOverlay(root);
        if (!mainContent || !overlay) return false;

        if (overlay.parentElement !== mainContent) {
            mainContent.appendChild(overlay);
        }
        Array.from(mainContent.children).forEach((child) => {
            if (child !== overlay) child.classList.add('na-share-view-hidden');
        });
        return true;
    }

    function unmountManagerFromMainContent(root) {
        const overlay = getShareOverlay(root);
        const mainContent = getAppMainContent();
        if (mainContent) {
            Array.from(mainContent.children).forEach((child) => {
                child.classList.remove('na-share-view-hidden');
            });
        }
        if (overlay && overlay.parentElement !== root) {
            root.insertBefore(overlay, root.querySelector('.na-share-dialog-backdrop'));
        }
    }

    function isManagerOpen() {
        return !!document.querySelector('.na-share-overlay.is-open');
    }

    function handleNativeMenuClick(event) {
        const menuItem = event.target.closest?.('.side-menu .el-menu-item, .side-menu .el-sub-menu__title');
        if (!menuItem || menuItem.classList.contains(SELECTORS.navInserted)) return;
        if (isManagerOpen()) closeManager({ restorePrevious: false });
    }

    function isAuthenticatedSurface() {
        return !location.pathname.startsWith('/login') && !!document.querySelector('#app');
    }

    function getCsrfToken() {
        const cookie = `; ${document.cookie}`;
        const parts = cookie.split('; csrf_token=');
        return parts.length === 2 ? parts.pop().split(';').shift() : undefined;
    }

    async function api(path, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        const csrf = getCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;

        const response = await fetch(path, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (response.status === 204) return { success: true };

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || payload.error || 'request_failed');
        }
        return payload;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    function formatTime(value) {
        if (!value) return '-';
        const numeric = Number(value);
        const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
        return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
    }

    function statusLabel(status) {
        if (status === 'active') return t('active');
        if (status === 'expired') return t('expired');
        if (status === 'revoked') return t('revoked');
        return status || '-';
    }

    function ensureRoot() {
        let root = document.querySelector('.na-share-ui-root');
        if (root) return root;

        root = document.createElement('div');
        root.className = 'na-share-ui-root na-share-ui';
        root.innerHTML = `
            <button class="na-share-floating" type="button" data-na-share-open>
                <span>🔗</span><span>${escapeHtml(t('manageShares'))}</span>
            </button>
            <section class="na-share-overlay" aria-hidden="true">
                <div class="na-share-shell">
                    <header class="na-share-header">
                        <div>
                            <h1 class="na-share-title">${escapeHtml(t('manageShares'))}</h1>
                            <p class="na-share-subtitle">${escapeHtml(t('safeMeta'))}</p>
                        </div>
                        <div class="na-share-actions">
                            <button class="na-share-button" type="button" data-na-share-refresh>${escapeHtml(t('refresh'))}</button>
                            <button class="na-share-button" type="button" data-na-share-close>${escapeHtml(t('close'))}</button>
                        </div>
                    </header>
                    <div class="na-share-panel">
                        <div class="na-share-toolbar">
                            <div class="na-share-filter" role="tablist" aria-label="Share status">
                                <button type="button" data-na-share-filter="all">${escapeHtml(t('all'))}</button>
                                <button type="button" data-na-share-filter="active">${escapeHtml(t('active'))}</button>
                                <button type="button" data-na-share-filter="expired">${escapeHtml(t('expired'))}</button>
                                <button type="button" data-na-share-filter="revoked">${escapeHtml(t('revoked'))}</button>
                            </div>
                            <span class="na-share-muted">${escapeHtml(t('revokeWarning'))}</span>
                        </div>
                        <div class="na-share-list" data-na-share-list></div>
                    </div>
                </div>
            </section>
            <div class="na-share-dialog-backdrop" role="dialog" aria-modal="true" aria-hidden="true">
                <div class="na-share-dialog">
                    <div class="na-share-dialog__header">
                        <strong>${escapeHtml(t('oneTimeTitle'))}</strong>
                        <button class="na-share-button" type="button" data-na-share-dialog-close>${escapeHtml(t('close'))}</button>
                    </div>
                    <div class="na-share-dialog__body" data-na-share-dialog-body></div>
                    <div class="na-share-dialog__footer">
                        <span class="na-share-muted">${escapeHtml(t('oneTimeText'))}</span>
                        <button class="na-share-button primary" type="button" data-na-share-copy-all>${escapeHtml(t('copyAll'))}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        root.querySelector('[data-na-share-open]').addEventListener('click', openManager);
        root.querySelector('[data-na-share-close]').addEventListener('click', closeManager);
        root.querySelector('[data-na-share-refresh]').addEventListener('click', loadShares);
        root.querySelector('[data-na-share-dialog-close]').addEventListener('click', closeDialog);
        root.querySelector('[data-na-share-copy-all]').addEventListener('click', copyAllResults);
        root.querySelectorAll('[data-na-share-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                STATE.filter = button.dataset.naShareFilter || 'all';
                renderShares();
            });
        });

        return root;
    }

    function notify(message, type = 'info') {
        const event = new CustomEvent('na-share-ui-message', { detail: { message, type } });
        window.dispatchEvent(event);
        if (type === 'error') console.error(`[share-ui] ${message}`);
    }

    function getElementPlusConfirm() {
        const appGlobals = document.querySelector('#app')?.__vue_app__?.config?.globalProperties;
        const candidates = [
            window.ElMessageBox?.confirm,
            window.ElementPlus?.ElMessageBox?.confirm,
            appGlobals?.$confirm,
            appGlobals?.$messageBox?.confirm,
            appGlobals?.$msgbox?.confirm,
        ];
        return candidates.find((candidate) => typeof candidate === 'function') || null;
    }

    async function confirmShareCreation() {
        const confirm = getElementPlusConfirm();
        if (!confirm) return window.confirm(t('batchConfirm'));

        try {
            await confirm(t('batchConfirm'), t('shareConfirmTitle'), {
                type: 'warning',
                confirmButtonText: t('shareConfirmButton'),
                cancelButtonText: t('cancel'),
            });
            return true;
        } catch (error) {
            if (error !== 'cancel' && error !== 'close') {
                console.error('[share-ui] share confirmation failed', error);
            }
            return false;
        }
    }

    function injectNav() {
        if (!isAuthenticatedSurface()) return;
        if (document.querySelector(`.${SELECTORS.navInserted}`)) return;

        const sideMenu = document.querySelector('.side-menu');
        const aside = document.querySelector('.left-aside');
        const target = sideMenu || aside;
        if (!target) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${SELECTORS.navInserted} na-share-nav`;
        button.setAttribute('data-na-share-open', 'nav');
        button.innerHTML = `<span class="na-share-nav__icon">🔗</span><span class="na-share-nav__text">${escapeHtml(t('manageShares'))}</span>`;
        button.addEventListener('click', openManager);

        const settingsItem = Array.from(target.children).find((child) => /settings|系统设置|Settings/.test(child.textContent || ''));
        if (settingsItem) {
            target.insertBefore(button, settingsItem);
        } else {
            target.appendChild(button);
        }
    }

    function selectedVaultIds() {
        const ids = new Set();
        const selectedCards = document.querySelectorAll('[data-id] .vault-card.is-selected, [data-id].is-selected, [data-id][aria-selected="true"]');
        selectedCards.forEach((node) => {
            const holder = node.closest('[data-id]');
            const id = holder?.getAttribute('data-id');
            if (id && !id.startsWith('tmp_')) ids.add(id);
        });

        document.querySelectorAll('[data-id]').forEach((node) => {
            const id = node.getAttribute('data-id');
            if (!id || id.startsWith('tmp_') || ids.has(id)) return;
            if (
                node.classList.contains('is-selected') ||
                node.matches('.vault-card.is-selected') ||
                node.querySelector('.vault-card.is-selected, .is-selected')
            ) {
                ids.add(id);
            }
        });
        return Array.from(ids);
    }

    function findBulkToolbar() {
        const batchActions = Array.from(document.querySelectorAll('.vault-list-toolbar .batch-actions, .batch-actions')).find((node) => {
            const buttons = Array.from(node.querySelectorAll('button'));
            return buttons.length >= 2
                && buttons.some((button) => isDeleteButton(button))
                && buttons.some((button) => isCancelButton(button));
        });
        if (batchActions) return batchActions;

        const candidates = Array.from(document.querySelectorAll('div, section, header')).filter((node) => {
            const text = node.textContent || '';
            return /selected|已选择|选中|Delete|删除/.test(text) && node.querySelector('button');
        });
        return candidates
            .sort((a, b) => a.querySelectorAll('button').length - b.querySelectorAll('button').length)
            .find((node) => {
                const buttons = Array.from(node.querySelectorAll('button'));
                return buttons.some((button) => isDeleteButton(button))
                    && buttons.some((button) => isCancelButton(button));
            });
    }

    function isDeleteButton(button) {
        const text = button.textContent || '';
        return /Delete|删除/.test(text)
            || button.classList.contains('el-button--danger')
            || button.getAttribute('type') === 'danger';
    }

    function isCancelButton(button) {
        return /Cancel|取消/.test(button.textContent || '');
    }

    function injectBatchButton() {
        if (!isAuthenticatedSurface()) return;
        const selected = selectedVaultIds();
        const existing = document.querySelector(`.${SELECTORS.batchButton}`);
        if (!selected.length) {
            existing?.remove();
            return;
        }

        const toolbar = findBulkToolbar();
        if (!toolbar) return;

        const buttons = Array.from(toolbar.querySelectorAll('button'));
        const deleteButton = buttons.find((button) => isDeleteButton(button));
        const cancelButton = buttons.find((button) => isCancelButton(button));
        if (!deleteButton || !cancelButton) return;

        const button = existing || document.createElement('button');
        button.type = 'button';
        button.className = SELECTORS.batchButton;
        button.textContent = t('share');
        button.disabled = STATE.batchBusy;
        button.onclick = createBatchShares;

        const desiredNext = deleteButton.nextSibling;
        if (!existing || button.parentElement !== toolbar || desiredNext !== button) {
            toolbar.insertBefore(button, desiredNext);
        }
    }

    async function loadShares() {
        ensureRoot();
        STATE.loading = true;
        renderShares();
        try {
            const response = await api('/api/share');
            const shares = response.shares || response.data?.shares || response.data || [];
            STATE.shares = Array.isArray(shares) ? shares : [];
        } catch (error) {
            notify(t('loadFailed'), 'error');
            STATE.error = error.message || t('loadFailed');
        } finally {
            STATE.loading = false;
            renderShares();
        }
    }

    function openManager() {
        const root = ensureRoot();
        const overlay = getShareOverlay(root);
        STATE.previousActiveTab = getActiveTab();
        mountManagerInMainContent(root);
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.querySelectorAll(`.${SELECTORS.navInserted}`).forEach((node) => node.classList.add('is-active'));
        loadShares();
    }

    function closeManager({ restorePrevious = true } = {}) {
        const root = ensureRoot();
        const overlay = getShareOverlay(root);
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.querySelectorAll(`.${SELECTORS.navInserted}`).forEach((node) => node.classList.remove('is-active'));
        unmountManagerFromMainContent(root);
        if (restorePrevious) dispatchMenuSelect(STATE.previousActiveTab || 'vault');
    }

    function renderShares() {
        const root = ensureRoot();
        const overlay = getShareOverlay(root);
        overlay.querySelectorAll('[data-na-share-filter]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.naShareFilter === STATE.filter);
        });

        const list = overlay.querySelector('[data-na-share-list]');
        if (STATE.loading) {
            list.innerHTML = `<div class="na-share-empty">${escapeHtml(t('refresh'))}...</div>`;
            return;
        }
        if (STATE.error) {
            list.innerHTML = `<div class="na-share-error">${escapeHtml(STATE.error)}</div>`;
            STATE.error = '';
            return;
        }

        const rows = STATE.shares.filter((share) => STATE.filter === 'all' || share.status === STATE.filter);
        if (!rows.length) {
            list.innerHTML = `<div class="na-share-empty">${escapeHtml(t('noShares'))}</div>`;
            return;
        }

        list.innerHTML = `
            <div class="na-share-row header">
                <div>${escapeHtml(t('account'))}</div>
                <div>${escapeHtml(t('status'))}</div>
                <div>${escapeHtml(t('expires'))}</div>
                <div>${escapeHtml(t('lastAccessed'))}</div>
                <div>${escapeHtml(t('accesses'))}</div>
                <div>${escapeHtml(t('actions'))}</div>
            </div>
            ${rows.map((share) => `
                <div class="na-share-row" data-na-share-id="${escapeHtml(share.id)}">
                    <div class="na-share-account">
                        <strong>${escapeHtml(share.item?.service || '-')}</strong>
                        <span>${escapeHtml(share.item?.account || '')}</span>
                    </div>
                    <div><span class="na-share-status ${escapeHtml(share.status)}">${escapeHtml(statusLabel(share.status))}</span></div>
                    <div class="na-share-muted">${escapeHtml(formatTime(share.expiresAt))}</div>
                    <div class="na-share-muted">${escapeHtml(formatTime(share.lastAccessedAt))}</div>
                    <div class="na-share-muted">${Number(share.accessCount || 0)}</div>
                    <div>
                        ${share.status === 'active'
                            ? `<button class="na-share-button danger" type="button" data-na-revoke-share="${escapeHtml(share.id)}">${escapeHtml(t('revoke'))}</button>`
                            : `<span class="na-share-muted">-</span>`}
                    </div>
                </div>
            `).join('')}
        `;
        list.querySelectorAll('[data-na-revoke-share]').forEach((button) => {
            button.addEventListener('click', () => revokeShare(button.dataset.naRevokeShare));
        });
    }

    async function revokeShare(id) {
        if (!id) return;
        try {
            await api(`/api/share/${encodeURIComponent(id)}`, { method: 'DELETE' });
            notify(t('revokedOk'), 'success');
            await loadShares();
        } catch (error) {
            notify(error.message || t('loadFailed'), 'error');
        }
    }

    async function createBatchShares() {
        const vaultItemIds = selectedVaultIds();
        if (!vaultItemIds.length) {
            notify(t('selectFirst'), 'error');
            return;
        }
        if (!navigator.onLine) {
            notify(t('offline'), 'error');
            return;
        }
        if (!await confirmShareCreation()) return;

        STATE.batchBusy = true;
        injectBatchButton();
        try {
            const response = await api('/api/share/batch', {
                method: 'POST',
                body: JSON.stringify({ vaultItemIds }),
            });
            const result = response.result || response.data?.result || response.data || {};
            STATE.oneTimeResults = Array.isArray(result.successes) ? result.successes : [];
            STATE.failures = Array.isArray(result.failures) ? result.failures : [];
            openDialog();
            await loadShares();
        } catch (error) {
            notify(error.message || t('createFailed'), 'error');
        } finally {
            STATE.batchBusy = false;
            injectBatchButton();
        }
    }

    function openDialog() {
        const root = ensureRoot();
        const backdrop = root.querySelector('.na-share-dialog-backdrop');
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
        renderDialog();
    }

    function closeDialog() {
        const root = ensureRoot();
        const backdrop = root.querySelector('.na-share-dialog-backdrop');
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        STATE.oneTimeResults = [];
        STATE.failures = [];
        renderDialog();
    }

    function renderDialog() {
        const root = ensureRoot();
        const body = root.querySelector('[data-na-share-dialog-body]');
        const successHtml = STATE.oneTimeResults.map((row, index) => {
            const share = row.share || {};
            const publicUrl = share.publicUrl || share.url || share.shareUrl || '';
            const accessCode = share.rawAccessCode || share.accessCode || '';
            const label = `${share.item?.service || t('account')} ${share.item?.account || ''}`.trim();
            return `
                <div class="na-share-result-row">
                    <strong>${escapeHtml(label || `${t('account')} ${index + 1}`)}</strong>
                    <div class="na-share-result-grid">
                        <div class="na-share-code">${escapeHtml(publicUrl)}</div>
                        <button class="na-share-button" type="button" data-copy-value="${escapeHtml(publicUrl)}">${escapeHtml(t('copy'))}</button>
                        <div class="na-share-code">${escapeHtml(accessCode)}</div>
                        <button class="na-share-button" type="button" data-copy-value="${escapeHtml(accessCode)}">${escapeHtml(t('copy'))}</button>
                    </div>
                </div>
            `;
        }).join('');
        const failureHtml = STATE.failures.length
            ? `<div class="na-share-result-row"><strong>${escapeHtml(t('failedTitle'))}</strong><p class="na-share-muted">${escapeHtml(t('failedBody'))}</p><div>${STATE.failures.map((row) => `#${Number(row.requestIndex) + 1}: ${escapeHtml(row.error || 'could_not_create_share')}`).join('<br>')}</div></div>`
            : '';
        body.innerHTML = `<p class="na-share-muted">${escapeHtml(t('oneTimeText'))}</p>${successHtml}${failureHtml}`;
        body.querySelectorAll('[data-copy-value]').forEach((button) => {
            button.addEventListener('click', () => copyText(button.dataset.copyValue || ''));
        });
    }

    async function copyText(value) {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        notify(t('copied'), 'success');
    }

    async function copyAllResults() {
        const text = STATE.oneTimeResults.map((row) => {
            const share = row.share || {};
            const label = `${share.item?.service || t('account')} ${share.item?.account || ''}`.trim();
            const publicUrl = share.publicUrl || share.url || share.shareUrl || '';
            const accessCode = share.rawAccessCode || share.accessCode || '';
            return `${label}\n${publicUrl}\n${accessCode}`;
        }).join('\n\n');
        await copyText(text);
    }

    function tick() {
        if (!isAuthenticatedSurface()) {
            document.querySelector('.na-share-ui-root')?.remove();
            document.querySelector(`.${SELECTORS.navInserted}`)?.remove();
            document.querySelector(`.${SELECTORS.batchButton}`)?.remove();
            return;
        }
        ensureRoot();
        injectNav();
        injectBatchButton();
        const overlay = document.querySelector('.na-share-overlay.is-open');
        if (overlay) {
            mountManagerInMainContent(ensureRoot());
        }
    }

    function scheduleTick() {
        if (STATE.tickScheduled) return;
        STATE.tickScheduled = true;
        requestAnimationFrame(() => {
            STATE.tickScheduled = false;
            tick();
        });
    }

    function start() {
        if (STATE.observerStarted) return;
        STATE.observerStarted = true;
        scheduleTick();
        const observer = new MutationObserver(scheduleTick);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('click', handleNativeMenuClick);
        window.addEventListener('online', scheduleTick);
        window.addEventListener('resize', scheduleTick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
}());
