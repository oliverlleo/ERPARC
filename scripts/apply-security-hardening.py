from pathlib import Path
import re


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
# index.html: Firebase Auth for company users, no plaintext/session identity,
# remove test bypass, remove password reveal, escape high-risk Firestore output.
# -----------------------------------------------------------------------------
path = Path('index.html')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "    import { initializeNotifications, initializeNotificationsPage } from './notifications.js';",
    "    import { initializeNotifications, initializeNotificationsPage, cleanupNotifications } from './notifications.js';",
    'notifications cleanup import'
)

text = replace_once(
    text,
    "    import { ensureFinancialLedger, fetchFinancialLedger, financialMovementDocId } from './financial-ledger.js';",
    "    import { ensureFinancialLedger, fetchFinancialLedger, financialMovementDocId } from './financial-ledger.js';\n"
    "    import { createCompanyAccess, updateCompanyAccessLogin, disableCompanyAccess, migrateLegacyCompanyAccesses, signInCompanyUser, getCompanyAccessProfile, completeCompanyFirstAccess, generateSecureRandomPassword, generateSecureCompanyCode, isCompanyAuthEmail } from './auth-company.js';\n"
    "    import { escapeHtml } from './security-utils.js';",
    'security imports'
)

text = replace_once(
    text,
    "    let effectiveUserId = null; // To store the UID for data operations (admin's UID)",
    "    let effectiveUserId = null; // To store the UID for data operations (admin's UID)\n    let currentCompanyProfile = null;",
    'company profile state'
)

random_block = '''    function generateRandomPassword(length = 10, numeric = false) {
        return generateSecureRandomPassword(length, numeric);
    }

    function generateCompanyCode(length = 6) {
        return generateSecureCompanyCode(length);
    }

'''
text = replace_between(
    text,
    "    function generateRandomPassword(length = 10, numeric = false) {",
    "    // --- Lógica de Geração de Número de Documento ---",
    random_block,
    'secure random generators'
)

text = replace_once(
    text,
    "    function setupListeners(userId) {\n        if (!userId && window.IS_TEST_RUN) {\n            userId = 'test-user-123';\n        }\n        if (!userId) return;",
    "    function setupListeners(userId) {\n        if (!userId) return;",
    'remove test listener bypass'
)

# The notifications module owns the real-time listener; remove the duplicate index listener.
notification_listener = '''        // --- Listener for Notifications ---
        const notificationsQuery = query(collection(db, 'users', userId, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
        notificationsUnsubscribe = onSnapshot(notificationsQuery, (querySnapshot) => {
            renderNotifications(querySnapshot);
        });

'''
if text.count(notification_listener) == 1:
    text = text.replace(notification_listener, '', 1)

# Remove dead duplicate renderer containing raw notification.innerHTML; keep mark-as-read.
if "    function renderNotifications(docs) {" in text:
    text = replace_between(
        text,
        "    function renderNotifications(docs) {",
        "    async function markNotificationsAsRead() {",
        "",
        'remove duplicate notification renderer'
    )

text = replace_once(
    text,
    "    function detachListeners() {",
    "    function detachListeners() {\n        cleanupNotifications();",
    'notification cleanup on detach'
)

# Access table: no password disclosure and all user-controlled text escaped.
old_access_render = '''                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${data.login}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${data.nomeUsuario}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <button class="view-password-btn bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" data-password="${data.senha}">Ver Senha</button>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button class="edit-acesso-btn text-indigo-600 hover:text-indigo-900 mr-4" data-id="${doc.id}">Editar</button>
                            <button class="delete-btn text-red-600 hover:text-red-900" data-id="${doc.id}">Excluir</button>
                        </td>
                    `;
                });
                perfisTableBody.querySelectorAll('.view-password-btn').forEach(btn => {
                    btn.addEventListener('click', () => alert(`A senha temporária é: ${btn.dataset.password}`));
                });'''
new_access_render = '''                    const authStatus = data.authUid ? 'Firebase Auth' : 'Migração pendente';
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${escapeHtml(data.login)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${escapeHtml(data.nomeUsuario)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs">${authStatus}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button class="edit-acesso-btn text-indigo-600 hover:text-indigo-900 mr-4" data-id="${escapeHtml(doc.id)}">Editar</button>
                            <button class="delete-btn text-red-600 hover:text-red-900" data-id="${escapeHtml(doc.id)}">Excluir</button>
                        </td>
                    `;
                });'''
text = replace_once(text, old_access_render, new_access_render, 'remove password reveal')

text = text.replace(
    '                           await deleteDoc(doc(db, "acessos", id));',
    '                           await disableCompanyAccess({ db, accessId: id });'
)

# High-risk CRUD tables that render Firestore strings through innerHTML.
replacements = {
    '${data.nome}</td>': '${escapeHtml(data.nome)}</td>',
    '${data.cnpj}</td>': '${escapeHtml(data.cnpj)}</td>',
    '${data.codigo}</td>': '${escapeHtml(data.codigo)}</td>',
    '${nome}</td>': '${escapeHtml(nome)}</td>',
    '${cpfCnpj}</td>': '${escapeHtml(cpfCnpj)}</td>',
    '${contato}</td>': '${escapeHtml(contato)}</td>',
    "${data.contratual?.matricula || ''}</td>": "${escapeHtml(data.contratual?.matricula || '')}</td>",
    "${data.pessoal?.nomeCompleto || 'N/A'}</td>": "${escapeHtml(data.pessoal?.nomeCompleto || 'N/A')}</td>",
    "${data.contratual?.cargo || ''}</td>": "${escapeHtml(data.contratual?.cargo || '')}</td>",
    '${data.descricao}</td>': '${escapeHtml(data.descricao)}</td>',
    "${data.clienteNome || 'N/A'}</td>": "${escapeHtml(data.clienteNome || 'N/A')}</td>",
    "${data.favorecidoNome || 'N/A'}</td>": "${escapeHtml(data.favorecidoNome || 'N/A')}</td>",
    '${installmentData.descricao}</td>': '${escapeHtml(installmentData.descricao)}</td>',
    '${pData.tipoTransacao} ${isEstornado ? \'(Estornado)\' : \'\'}': '${escapeHtml(pData.tipoTransacao)} ${isEstornado ? \'(Estornado)\' : \'\'}'
}
for old, new in replacements.items():
    text = text.replace(old, new)

workspace_helper = '''    function initializeAuthenticatedWorkspace(adminId, userName, commonUtils) {
        effectiveUserId = adminId;
        currentUserName = userName;
        updateUiForUser(currentUserName);
        setupListeners(effectiveUserId);
        initializeNotifications(db, effectiveUserId);
        initializeNotificationsPage(db, effectiveUserId);
        initializeFluxoDeCaixa(db, effectiveUserId, commonUtils);
        initializeMovimentacaoBancaria(db, effectiveUserId, commonUtils, currentUserName);
        initializeRelatorios(db, effectiveUserId, commonUtils);
        showView('main-page');
        updateStatusFilterUI();
        updateReceitaStatusFilterUI();
    }

'''
new_auth = workspace_helper + '''    onAuthStateChanged(auth, async (user) => {
        detachListeners();
        const commonUtils = { formatCurrency, toCents, fromCents, showFeedback };

        if (!user) {
            currentCompanyProfile = null;
            updateUiForUser(null);
            showView('login-page');
            return;
        }

        try {
            const companyProfile = await getCompanyAccessProfile(db, user.uid);
            if (companyProfile) {
                if (companyProfile.active === false || !companyProfile.adminId) {
                    await signOut(auth);
                    return;
                }

                currentCompanyProfile = companyProfile;
                effectiveUserId = companyProfile.adminId;
                currentUserName = companyProfile.nomeUsuario || companyProfile.login || user.email;

                if (companyProfile.primeiroAcesso === true) {
                    document.getElementById('change-password-userid').value = companyProfile.accessId || '';
                    changePasswordModal.classList.remove('hidden');
                    return;
                }

                initializeAuthenticatedWorkspace(effectiveUserId, currentUserName, commonUtils);
                return;
            }

            // A disabled/deleted company Firebase account must never fall through and
            // be treated as a new administrator.
            if (isCompanyAuthEmail(user.email)) {
                await signOut(auth);
                userLoginError.textContent = 'Este acesso foi desativado ou não está mais vinculado a uma empresa.';
                return;
            }

            currentCompanyProfile = null;
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, { primeiroAcesso: true, email: user.email });
                adminChangePasswordModal.classList.remove('hidden');
                return;
            }
            if (userDocSnap.data().primeiroAcesso === true) {
                adminChangePasswordModal.classList.remove('hidden');
                return;
            }

            const migration = await migrateLegacyCompanyAccesses({ db, firebaseConfig, adminId: user.uid });
            if (migration.failures.length > 0) {
                console.error('Alguns acessos legados não puderam ser migrados:', migration.failures);
            }

            initializeAuthenticatedWorkspace(user.uid, user.email, commonUtils);
        } catch (error) {
            console.error('Erro ao restaurar a sessão autenticada:', error);
            updateUiForUser(null);
            showView('login-page');
        }
    });

'''
text = replace_between(
    text,
    "    onAuthStateChanged(auth, async (user) => {",
    "    if (adminLoginLink) {",
    new_auth,
    'replace auth state flow'
)

admin_login = '''    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      adminLoginError.textContent = '';
      const email = document.getElementById('admin-login-email').value;
      const password = document.getElementById('admin-login-password').value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        adminLoginModal.classList.add('hidden');
      } catch (error) {
        adminLoginError.textContent = 'E-mail ou senha inválidos.';
      }
    });

'''
text = replace_between(
    text,
    "    adminLoginForm.addEventListener('submit', async (e) => {",
    "    userLoginForm.addEventListener('submit', async (e) => {",
    admin_login,
    'remove test auth bypass'
)

company_login = '''    userLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        userLoginError.textContent = '';
        const empresaId = loginEmpresaSelect.value;
        const nomeUsuario = document.getElementById('login-usuario').value;
        const senha = document.getElementById('login-password').value;

        if (!empresaId) {
            userLoginError.textContent = 'Por favor, selecione uma empresa.';
            return;
        }

        try {
            await signInCompanyUser({ auth, db, empresaId, login: nomeUsuario, password: senha });
        } catch (error) {
            console.error('Erro no login do usuário da empresa:', error);
            userLoginError.textContent = error?.code === 'company-auth/access-not-ready'
                ? 'Este acesso ainda precisa ser migrado. Entre uma vez como administrador desta empresa e tente novamente.'
                : 'Empresa, usuário ou senha inválidos.';
        }
    });

'''
text = replace_between(
    text,
    "    userLoginForm.addEventListener('submit', async (e) => {",
    "    changePasswordForm.addEventListener('submit', async (e) => {",
    company_login,
    'company Firebase login'
)

company_password = '''    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        changePasswordError.textContent = '';
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentCompanyProfile || !auth.currentUser) {
            changePasswordError.textContent = 'Sessão do usuário não encontrada. Faça login novamente.';
            return;
        }
        if (newPassword !== confirmPassword) {
            changePasswordError.textContent = 'As senhas não conferem.';
            return;
        }
        if (newPassword.length < 6) {
            changePasswordError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            return;
        }

        try {
            await completeCompanyFirstAccess({ auth, db, profile: currentCompanyProfile, newPassword });
            currentCompanyProfile = { ...currentCompanyProfile, primeiroAcesso: false };
            changePasswordModal.classList.add('hidden');
            initializeAuthenticatedWorkspace(
                currentCompanyProfile.adminId,
                currentCompanyProfile.nomeUsuario || currentCompanyProfile.login,
                { formatCurrency, toCents, fromCents, showFeedback }
            );
        } catch (error) {
            console.error('Erro ao alterar senha do usuário da empresa:', error);
            changePasswordError.textContent = 'Não foi possível alterar a senha. Faça login novamente e tente de novo.';
        }
    });

'''
text = replace_between(
    text,
    "    changePasswordForm.addEventListener('submit', async (e) => {",
    "    adminChangePasswordForm.addEventListener('submit', async (e) => {",
    company_password,
    'company password change via Firebase Auth'
)

logout_block = '''    const performLogout = async () => {
        console.log('Performing logout...');
        detachListeners();
        currentCompanyProfile = null;
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Erro ao sair:', error);
            updateUiForUser(null);
            showView('login-page');
        }
    };

'''
text = replace_between(
    text,
    "    const performLogout = () => {",
    "    logoutButton.addEventListener('click', performLogout);",
    logout_block,
    'Firebase logout for all users'
)

text = replace_once(
    text,
    "                const docRef = doc(db, 'acessos', acessoId);\n                await updateDoc(docRef, { login: login });",
    "                await updateCompanyAccessLogin({ db, accessId: acessoId, login });",
    'access login update'
)

creation_start = "                const tempPassword = generateRandomPassword(6, true);"
creation_end = "                showFeedback(feedbackId, `Acesso para '${nomeUsuario}' criado! Login: ${login}, Senha Temporária: ${tempPassword}`, false, true);"
start = text.find(creation_start)
end = text.find(creation_end, start)
if start < 0 or end < 0:
    raise RuntimeError('access creation block not found')
end += len(creation_end)
new_creation = '''                const tempPassword = generateRandomPassword(12, false);

                await createCompanyAccess({
                    db,
                    firebaseConfig,
                    adminId,
                    empresaId: empresa.id,
                    systemUserId,
                    nomeUsuario,
                    login,
                    tempPassword
                });
                showFeedback(feedbackId, `Acesso para '${nomeUsuario}' criado! Login: ${login}, Senha Temporária: ${tempPassword}`, false, true);'''
text = text[:start] + new_creation + text[end:]

if 'sessionStorage' in text:
    raise RuntimeError('sessionStorage remains in index.html after auth replacement')
if 'test.user@email.com' in text or 'window.IS_TEST_RUN' in text:
    raise RuntimeError('test auth bypass remains in index.html')
if 'data-password=' in text or 'Ver Senha' in text:
    raise RuntimeError('password disclosure UI remains in index.html')

path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# notifications.js: cleanup interval/listener lifecycle + safe HTML rendering.
# -----------------------------------------------------------------------------
path = Path('notifications.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy, deleteDoc, writeBatch, updateDoc, doc, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";\n',
    'import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy, deleteDoc, writeBatch, updateDoc, doc, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";\nimport { escapeHtml, safeCssTokenList, safeMaterialIcon } from \'./security-utils.js\';\n'
)

new_init = '''let activeNotificationCleanup = null;

export function cleanupNotifications() {
    if (activeNotificationCleanup) {
        activeNotificationCleanup();
        activeNotificationCleanup = null;
    }
}

export function initializeNotifications(db, userId) {
    cleanupNotifications();
    if (!userId) return () => {};

    checkAllNotifications(db, userId);
    const intervalId = setInterval(() => checkAllNotifications(db, userId), 300000);
    let sidebarNotifications = [];

    const notificationsQuery = query(
        collection(db, 'users', userId, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    const unsubscribeSnapshot = onSnapshot(notificationsQuery, (querySnapshot) => {
        sidebarNotifications = querySnapshot.docs.map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
        renderSidebarNotifications(sidebarNotifications, db, userId);
    });

    const notificationList = document.getElementById('notification-list');
    const clearButton = document.getElementById('clear-notifications-btn');
    const clearPinnedCheckbox = document.getElementById('clear-pinned-checkbox');
    const clearImportantCheckbox = document.getElementById('clear-important-checkbox');

    const clearHandler = async () => {
        const clearPinned = clearPinnedCheckbox?.checked === true;
        const clearImportant = clearImportantCheckbox?.checked === true;
        const batch = writeBatch(db);
        let notificationsToClearCount = 0;
        const visibleNotifications = sidebarNotifications.filter(n => n.clearedFromSidebar !== true);

        visibleNotifications.forEach(notification => {
            const isPinned = notification.pinned === true;
            const isImportant = notification.important === true;
            if ((!isPinned || clearPinned) && (!isImportant || clearImportant)) {
                batch.update(doc(db, 'users', userId, 'notifications', notification.id), { clearedFromSidebar: true });
                notificationsToClearCount++;
            }
        });
        if (notificationsToClearCount > 0) await batch.commit();
    };

    const listHandler = async (e) => {
        const container = e.target.closest('.notification-item-container');
        if (!container) return;
        const notificationId = container.dataset.id;
        const notification = sidebarNotifications.find(n => n.id === notificationId);
        if (!notification) return;

        const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
        const pinButton = e.target.closest('.toggle-pin-btn');
        const importantButton = e.target.closest('.toggle-important-btn');
        const link = e.target.closest('.notification-item-link');

        if (pinButton) {
            e.stopPropagation();
            await updateDoc(notificationRef, { pinned: !notification.pinned });
        } else if (importantButton) {
            e.stopPropagation();
            await updateDoc(notificationRef, { important: !notification.important });
        } else if (link && !notification.read) {
            await updateDoc(notificationRef, { read: true });
        }
    };

    clearButton?.addEventListener('click', clearHandler);
    notificationList?.addEventListener('click', listHandler);

    activeNotificationCleanup = () => {
        clearInterval(intervalId);
        unsubscribeSnapshot();
        clearButton?.removeEventListener('click', clearHandler);
        notificationList?.removeEventListener('click', listHandler);
    };
    return activeNotificationCleanup;
}


'''
text = replace_between(
    text,
    "export function initializeNotifications(db, userId) {",
    "function formatTimeAgo(timestamp) {",
    new_init,
    'notification lifecycle'
)

text = text.replace("${notification.link || '#'}", "${escapeHtml(notification.link || '#')}")
text = text.replace("${notification.iconClass || 'notification-icon-info'}", "${safeCssTokenList(notification.iconClass, 'notification-icon-info')}")
text = text.replace("${notification.icon || 'notifications'}", "${safeMaterialIcon(notification.icon)}")
text = text.replace("${notification.message}", "${escapeHtml(notification.message)}")
text = text.replace("${timeAgo}", "${escapeHtml(timeAgo)}")
text = text.replace("${groupName}</h2>", "${escapeHtml(groupName)}</h2>")
text = text.replace("${notif.iconClass || 'notification-icon-info'}", "${safeCssTokenList(notif.iconClass, 'notification-icon-info')}")
text = text.replace("${notif.icon || 'notifications'}", "${safeMaterialIcon(notif.icon)}")
text = text.replace("${notif.message}", "${escapeHtml(notif.message)}")
text = text.replace("data-id=\"${notif.id}\"", "data-id=\"${escapeHtml(notif.id)}\"")
path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# relatorios.js: fix DRE category association and escape report data.
# -----------------------------------------------------------------------------
path = Path('relatorios.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";\n',
    'import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";\nimport { escapeHtml } from \'./security-utils.js\';\n'
)
text = text.replace(
    'const planosDeContas = planosDeContasSnap.docs.map(doc => doc.data());',
    'const planosDeContas = planosDeContasSnap.docs.map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));'
)
text = replace_once(
    text,
    "    function buildCashFlowTree(planosDeContas, lancamentos) {\n        const tree = {};",
    "    function buildCashFlowTree(planosDeContas, lancamentos) {\n        const tree = {};\n        const contasPorId = new Map(planosDeContas.map(conta => [conta.id, conta]));",
    'DRE account map'
)
text = replace_once(
    text,
    "            const codigo = lancamento.codigoPlanoDeContas;\n            if (tree[codigo]) {",
    "            const codigo = lancamento.codigoPlanoDeContas || contasPorId.get(lancamento.categoriaId)?.codigo;\n            if (codigo && tree[codigo]) {",
    'DRE category fallback'
)

# Report values coming from Firestore are always escaped before innerHTML.
for old, new in {
    '${d.clienteNome}': '${escapeHtml(d.clienteNome)}',
    '${d.favorecidoNome}': '${escapeHtml(d.favorecidoNome)}',
    '${d.descricao}': '${escapeHtml(d.descricao)}',
    "${d.numeroDocumento || 'N/A'}": "${escapeHtml(d.numeroDocumento || 'N/A')}",
    '${item.clienteNome}': '${escapeHtml(item.clienteNome)}',
    '${item.favorecidoNome}': '${escapeHtml(item.favorecidoNome)}',
    '${item.descricao}': '${escapeHtml(item.descricao)}',
    '${cat.nome}': '${escapeHtml(cat.nome)}',
    '${node.codigo}': '${escapeHtml(node.codigo)}',
    '${node.nome}': '${escapeHtml(node.nome)}',
    "${node.codigoPai || ''}": "${escapeHtml(node.codigoPai || '')}",
    '${error.message}': '${escapeHtml(error.message)}'
}.items():
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# movimentacao-bancaria.js: escape Firestore-origin text before table HTML.
# -----------------------------------------------------------------------------
path = Path('movimentacao-bancaria.js')
text = path.read_text(encoding='utf-8')
first_line_end = text.find('\n')
if "./security-utils.js" not in text:
    text = text[:first_line_end + 1] + "import { escapeHtml } from './security-utils.js';\n" + text[first_line_end + 1:]
text = replace_once(
    text,
    "            const descricaoHtml = isEstornado ? `<del>${mov.descricao}</del>` : mov.descricao;\n            const origemHtml = mov.origemId ? `<a href=\"#\" class=\"text-blue-600 hover:underline view-origin-link\" data-origin-id=\"${mov.origemId}\" data-origin-type=\"${mov.origemTipo}\">${mov.origemDescricao || 'Ver Origem'}</a>` : (mov.origemDescricao || 'N/A');",
    "            const descricaoSegura = escapeHtml(mov.descricao || '');\n            const descricaoHtml = isEstornado ? `<del>${descricaoSegura}</del>` : descricaoSegura;\n            const origemHtml = mov.origemId ? `<a href=\"#\" class=\"text-blue-600 hover:underline view-origin-link\" data-origin-id=\"${escapeHtml(mov.origemId)}\" data-origin-type=\"${escapeHtml(mov.origemTipo || '')}\">${escapeHtml(mov.origemDescricao || 'Ver Origem')}</a>` : escapeHtml(mov.origemDescricao || 'N/A');",
    'bank movement XSS'
)
text = text.replace('data-id="${mov.id}"', 'data-id="${escapeHtml(mov.id)}"')
path.write_text(text, encoding='utf-8')


# -----------------------------------------------------------------------------
# fluxo-de-caixa.js: escape transaction/category text before innerHTML.
# -----------------------------------------------------------------------------
path = Path('fluxo-de-caixa.js')
text = path.read_text(encoding='utf-8')
if "./security-utils.js" not in text:
    second_import = "import { fetchFinancialLedger, fetchDocumentsByIds, financialMovementDocId } from './financial-ledger.js';\n"
    text = text.replace(second_import, second_import + "import { escapeHtml } from './security-utils.js';\n", 1)
text = text.replace('data-id="${t.id}"', 'data-id="${escapeHtml(t.id)}"')
text = text.replace('data-parent-id="${t.parentId}"', 'data-parent-id="${escapeHtml(t.parentId || \'\')}"')
text = text.replace('data-type="${t.type}"', 'data-type="${escapeHtml(t.type)}"')
text = text.replace('>${t.descricao}</td>', '>${escapeHtml(t.descricao)}</td>')
text = text.replace('>${t.participante}</td>', '>${escapeHtml(t.participante)}</td>')
text = text.replace('>${t.planoDeConta}</td>', '>${escapeHtml(t.planoDeConta)}</td>')
text = text.replace('>${text}</td>', '>${escapeHtml(text)}</td>')
path.write_text(text, encoding='utf-8')

print('Security/auth/reporting hardening patch applied successfully')
