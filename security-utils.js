export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function safeCssTokenList(value, fallback = '') {
    const normalized = String(value ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .filter(token => /^[a-zA-Z0-9:_-]+$/.test(token))
        .join(' ');
    return normalized || fallback;
}

export function safeMaterialIcon(value, fallback = 'notifications') {
    const normalized = String(value ?? '');
    return /^[a-z0-9_]+$/.test(normalized) ? normalized : fallback;
}
