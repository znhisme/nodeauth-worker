import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const readOverlaySource = () => readFileSync(
    new URL('../../frontend/src/share-ui/share-management-ui.js', import.meta.url),
    'utf8',
);

describe('share management UI overlay source contract', () => {
    it('detects selected vault ids from the current generated vault card structure', () => {
        const source = readOverlaySource();

        expect(source).toContain("document.querySelectorAll('[data-id] .vault-card.is-selected, [data-id].is-selected, [data-id][aria-selected=\"true\"]')");
        expect(source).toContain("node.closest('[data-id]')");
        expect(source).toContain("node.querySelector('.vault-card.is-selected, .is-selected')");
        expect(source).toContain("node.getAttribute('data-id')");
        expect(source).toContain("!id || id.startsWith('tmp_')");
    });

    it('inserts the batch share button immediately after the delete button', () => {
        const source = readOverlaySource();

        expect(source).toContain("document.querySelectorAll('.vault-list-toolbar .batch-actions, .batch-actions')");
        expect(source).toContain('const desiredNext = deleteButton.nextSibling;');
        expect(source).toContain('toolbar.insertBefore(button, desiredNext);');
        expect(source).not.toContain('toolbar.insertBefore(button, cancelButton);');
    });

    it('mounts the share manager in the SPA main content instead of using refresh-style full-screen navigation', () => {
        const source = readOverlaySource();

        expect(source).toContain("document.querySelector('.main-content')");
        expect(source).toContain('mainContent.appendChild(overlay);');
        expect(source).toContain("child.classList.add('na-share-view-hidden')");
    });
});
