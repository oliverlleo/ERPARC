from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    return text[:start] + replacement + text[end:]


# -----------------------------------------------------------------------------
# auth-company.js — prevent duplicate company logins before creating/moving auth.
# -----------------------------------------------------------------------------
path = Path('auth-company.js')
text = path.read_text(encoding='utf-8')

helper = '''async function assertLoginAvailable(db, empresaId, login, expectedAccessId = null) {
    const ref = doc(db, 'loginDirectory', directoryId(empresaId, login));
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().accessId !== expectedAccessId) {
        const error = new Error('Já existe um acesso com este nome de login nesta empresa.');
        error.code = 'company-auth/login-in-use';
        throw error;
    }
    return ref;
}

'''
text = replace_once(
    text,
    "function authEmailForAccess(accessId) {\n    return `${accessId}@${COMPANY_AUTH_DOMAIN}`;\n}\n\n",
    "function authEmailForAccess(accessId) {\n    return `${accessId}@${COMPANY_AUTH_DOMAIN}`;\n}\n\n" + helper,
    'login availability helper'
)

text = replace_once(
    text,
    "    const accessRef = doc(collection(db, 'acessos'));\n    const authEmail = authEmailForAccess(accessRef.id);",
    "    const accessRef = doc(collection(db, 'acessos'));\n    const directoryRef = await assertLoginAvailable(db, empresaId, login);\n    const authEmail = authEmailForAccess(accessRef.id);",
    'new access duplicate guard'
)
text = replace_once(
    text,
    "        const profileRef = doc(db, 'accessProfiles', createdUser.uid);\n        const directoryRef = doc(db, 'loginDirectory', directoryId(empresaId, login));",
    "        const profileRef = doc(db, 'accessProfiles', createdUser.uid);",
    'reuse guarded directory ref'
)

text = replace_once(
    text,
    "    const oldDirectoryRef = doc(db, 'loginDirectory', directoryId(current.empresaId, current.login));\n    const newDirectoryRef = doc(db, 'loginDirectory', directoryId(current.empresaId, login));",
    "    const oldDirectoryRef = doc(db, 'loginDirectory', directoryId(current.empresaId, current.login));\n    const newDirectoryRef = await assertLoginAvailable(db, current.empresaId, login, accessId);",
    'edited access duplicate guard'
)

text = replace_once(
    text,
    "    const authEmail = data.authEmail || authEmailForAccess(accessDoc.id);\n    let authUid = data.authUid || null;",
    "    const directoryRef = await assertLoginAvailable(db, data.empresaId, data.login, accessDoc.id);\n    const authEmail = data.authEmail || authEmailForAccess(accessDoc.id);\n    let authUid = data.authUid || null;",
    'legacy migration duplicate guard'
)
text = replace_once(
    text,
    "    batch.set(doc(db, 'loginDirectory', directoryId(data.empresaId, data.login)), directoryData({",
    "    batch.set(directoryRef, directoryData({",
    'migration guarded directory ref'
)
path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# notifications.js — dedicated page listeners must also be torn down on logout/
# auth switch, just like the sidebar listener and timer.
# -----------------------------------------------------------------------------
path = Path('notifications.js')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "let activeNotificationCleanup = null;\n\nexport function cleanupNotifications() {\n    if (activeNotificationCleanup) {\n        activeNotificationCleanup();\n        activeNotificationCleanup = null;\n    }\n}",
    "let activeNotificationCleanup = null;\nlet activeNotificationPageCleanup = null;\n\nexport function cleanupNotifications() {\n    if (activeNotificationCleanup) {\n        activeNotificationCleanup();\n        activeNotificationCleanup = null;\n    }\n    if (activeNotificationPageCleanup) {\n        activeNotificationPageCleanup();\n        activeNotificationPageCleanup = null;\n    }\n    allNotifications = [];\n    notificationTypes.clear();\n}",
    'notification page cleanup state'
)

new_page_init = '''export function initializeNotificationsPage(db, userId) {
    if (activeNotificationPageCleanup) {
        activeNotificationPageCleanup();
        activeNotificationPageCleanup = null;
    }
    if (!userId) return () => {};

    const markAllReadBtn = document.getElementById('mark-all-as-read-btn');
    const searchInput = document.getElementById('notification-search-input');
    const statusFilter = document.getElementById('notification-status-filter');
    const typeFilter = document.getElementById('notification-type-filter');
    const container = document.getElementById('full-notification-list-container');

    const viewShownHandler = (e) => {
        if (e.detail.viewId === 'notifications-page') {
            fetchAndDisplayAllNotifications(db, userId);
        }
    };
    const filterHandler = () => applyAndRenderFilters();
    const markAllReadHandler = async () => {
        const unreadIds = allNotifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) {
            alert('Todas as notificações já foram lidas.');
            return;
        }

        const batch = writeBatch(db);
        unreadIds.forEach(id => {
            batch.update(doc(db, 'users', userId, 'notifications', id), { read: true });
        });

        try {
            await batch.commit();
            await fetchAndDisplayAllNotifications(db, userId);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };
    const containerClickHandler = async (e) => {
        const deleteButton = e.target.closest('.delete-notification-btn');
        if (!deleteButton) return;
        e.stopPropagation();
        const notifId = deleteButton.dataset.id;
        if (!confirm('Tem certeza que deseja excluir esta notificação?')) return;

        try {
            await deleteDoc(doc(db, 'users', userId, 'notifications', notifId));
            allNotifications = allNotifications.filter(n => n.id !== notifId);
            applyAndRenderFilters();
        } catch (error) {
            console.error('Error deleting notification:', error);
            alert('Não foi possível excluir a notificação.');
        }
    };

    document.addEventListener('view-shown', viewShownHandler);
    searchInput?.addEventListener('input', filterHandler);
    statusFilter?.addEventListener('change', filterHandler);
    typeFilter?.addEventListener('change', filterHandler);
    markAllReadBtn?.addEventListener('click', markAllReadHandler);
    container?.addEventListener('click', containerClickHandler);

    activeNotificationPageCleanup = () => {
        document.removeEventListener('view-shown', viewShownHandler);
        searchInput?.removeEventListener('input', filterHandler);
        statusFilter?.removeEventListener('change', filterHandler);
        typeFilter?.removeEventListener('change', filterHandler);
        markAllReadBtn?.removeEventListener('click', markAllReadHandler);
        container?.removeEventListener('click', containerClickHandler);
    };
    return activeNotificationPageCleanup;
}
'''
start = text.find("export function initializeNotificationsPage(db, userId) {")
if start < 0:
    raise RuntimeError('notifications page initializer not found')
text = text[:start] + new_page_init + '\n'
text = text.replace(
    "        const searchMatch = !searchInput || notif.message.toLowerCase().includes(searchInput);",
    "        const searchMatch = !searchInput || String(notif.message || '').toLowerCase().includes(searchInput);"
)
path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# index.html — finish Stored XSS audit for dynamic strings still embedded in
# HTML templates. Values written through textContent are already safe.
# -----------------------------------------------------------------------------
path = Path('index.html')
text = path.read_text(encoding='utf-8')

text = text.replace('<span>${accountName}</span>', '<span>${escapeHtml(accountName)}</span>')
text = text.replace('data-id="${node.id}"', 'data-id="${escapeHtml(node.id)}"')
text = text.replace('data-id="${doc.id}"', 'data-id="${escapeHtml(doc.id)}"')
text = text.replace("${data.numeroDocumento || ''}</td>", "${escapeHtml(data.numeroDocumento || '')}</td>")
text = text.replace('${formaPagamentoText}</td>', '${escapeHtml(formaPagamentoText)}</td>')
text = text.replace('>${statusText}</span>', '>${escapeHtml(statusText)}</span>')
text = text.replace('data-recebimento-id="${recebimentoDoc.id}"', 'data-recebimento-id="${escapeHtml(recebimentoDoc.id)}"')
text = text.replace('data-receita-id="${receitaId}"', 'data-receita-id="${escapeHtml(receitaId)}"')
text = text.replace('data-pagamento-id="${pagamentoDoc.id}"', 'data-pagamento-id="${escapeHtml(pagamentoDoc.id)}"')
text = text.replace('data-despesa-id="${despesaId}"', 'data-despesa-id="${escapeHtml(despesaId)}"')

text = replace_once(
    text,
    "                                  `<td colspan=\"7\" class=\"px-4 py-2 text-sm text-gray-500\"><del>${new Date(mov.dataTransacao + 'T00:00:00').toLocaleDateString('pt-BR')} - ${mov.descricao} [ESTORNADO]</del></td>`;",
    "                                  `<td colspan=\"7\" class=\"px-4 py-2 text-sm text-gray-500\"><del>${new Date(mov.dataTransacao + 'T00:00:00').toLocaleDateString('pt-BR')} - ${escapeHtml(mov.descricao)} [ESTORNADO]</del></td>`;",
    'legacy bank movement reversed description'
)
text = text.replace('>${mov.descricao}</td>', '>${escapeHtml(mov.descricao)}</td>')
text = text.replace(">${mov.origemDescricao || 'N/A'}</a>", ">${escapeHtml(mov.origemDescricao || 'N/A')}</a>")
text = text.replace('data-id="${mov.id}"', 'data-id="${escapeHtml(mov.id)}"')

# Input attribute in split-receivable table: escape quotes/markup from the old
# document number before assigning it as a value attribute.
text = replace_once(
    text,
    "value=\"Ref. Título ${originalReceitaData.numeroDocumento || originalReceitaData.id.substring(0,4)} - Parc. ${i + 1}/${numParcelas}\"",
    "value=\"Ref. Título ${escapeHtml(originalReceitaData.numeroDocumento || originalReceitaData.id.substring(0,4))} - Parc. ${i + 1}/${numParcelas}\"",
    'split receivable document number'
)

# Guard against the specific unescaped Firestore-derived values found by the
# manual review. If a later edit reintroduces one, the patch fails loudly.
for unsafe in [
    '<span>${accountName}</span>',
    '${data.numeroDocumento || \'\'}</td>',
    '${formaPagamentoText}</td>',
    '>${statusText}</span>',
    '${mov.descricao}</td>',
    "${mov.origemDescricao || 'N/A'}</a>",
    'originalReceitaData.numeroDocumento || originalReceitaData.id.substring(0,4)} - Parc.'
]:
    if unsafe in text:
        raise RuntimeError(f'unescaped dynamic HTML remains: {unsafe}')

path.write_text(text, encoding='utf-8')

print('Final security hardening review patch applied successfully')
