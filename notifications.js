import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// --- Notification Generation Logic ---

/**
 * Checks if a specific notification already exists to prevent duplicates.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 * @param {string} relatedId - The ID of the related document (e.g., despesaId).
 * @param {string} type - The type of the notification (e.g., 'aviso_vencimento_pagar').
 * @returns {Promise<boolean>} - True if the notification exists, false otherwise.
 */
async function notificationExists(db, userId, relatedId, type) {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, where("relatedId", "==", relatedId), where("type", "==", type));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
}

/**
 * Creates a new notification document in Firestore if it doesn't already exist.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 * @param {object} notificationData - The data for the new notification.
 */
async function createNotification(db, userId, notificationData) {
    const { relatedId, type } = notificationData;
    const exists = await notificationExists(db, userId, relatedId, type);
    if (!exists) {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        await addDoc(notificationsRef, {
            ...notificationData,
            read: false,
            createdAt: serverTimestamp(),
            adminId: userId
        });
        console.log(`Notification created: ${notificationData.message}`);
    }
}

/**
 * Checks for upcoming and overdue bills to pay and creates notifications.
 * This function uses targeted queries to remain efficient.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAPagar(db, userId) {
    const despesasRef = collection(db, 'users', userId, 'despesas');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const in3DaysStr = in3Days.toISOString().split('T')[0];

    // Query 1: For items due soon or today
    const qDueSoon = query(despesasRef, where("vencimento", ">=", todayStr), where("vencimento", "<=", in3DaysStr));
    const dueSoonSnapshot = await getDocs(qDueSoon);
    const relevantStatuses = new Set(["Pendente", "Pago Parcialmente"]);

    dueSoonSnapshot.forEach(doc => {
        const despesa = doc.data();
        if (!relevantStatuses.has(despesa.status)) {
            return;
        }

        const vencimentoDate = new Date(despesa.vencimento + 'T00:00:00');
        const diffTime = vencimentoDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const valor = despesa.valorSaldo ?? despesa.valorOriginal ?? 0;

        if (diffDays === 0) { // Due Today
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_vencimento_hoje_pagar',
                icon: 'event_busy',
                iconClass: 'notification-icon-danger',
                message: `A conta de "${despesa.favorecidoNome}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)} vence HOJE.`,
                link: `contas-a-pagar-page`
            });
        } else { // Due Soon (1-3 days)
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'aviso_vencimento_pagar',
                icon: 'calendar_month',
                iconClass: 'notification-icon-warning',
                message: `Sua provisão a pagar para "${despesa.favorecidoNome}" vence em ${vencimentoDate.toLocaleDateString('pt-BR')}.`,
                link: `contas-a-pagar-page`
            });
        }
    });

    // Query 2: For overdue items
    const qOverdue = query(despesasRef, where("status", "==", "Vencido"));
    const overdueSnapshot = await getDocs(qOverdue);

    overdueSnapshot.forEach(doc => {
        const despesa = doc.data();
        const valor = despesa.valorSaldo ?? despesa.valorOriginal ?? 0;
        createNotification(db, userId, {
            relatedId: doc.id,
            type: 'alerta_atraso_pagar',
            icon: 'error',
            iconClass: 'notification-icon-danger',
            message: `A conta de "${despesa.favorecidoNome}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)} venceu.`,
            link: `contas-a-pagar-page`
        });
    });
}

/**
 * Checks for upcoming and overdue receivables and creates notifications.
 * This function uses targeted queries to remain efficient.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAReceber(db, userId) {
    const receitasRef = collection(db, 'users', userId, 'receitas');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const in3DaysStr = in3Days.toISOString().split('T')[0];

    const vencimentoField = "dataVencimento";

    // Query 1: For items due soon or today
    const qDueSoon = query(receitasRef, where(vencimentoField, ">=", todayStr), where(vencimentoField, "<=", in3DaysStr));
    const dueSoonSnapshot = await getDocs(qDueSoon);
    const relevantStatuses = new Set(["Pendente", "Recebido Parcialmente"]);

    dueSoonSnapshot.forEach(doc => {
        const receita = doc.data();
        if (!relevantStatuses.has(receita.status)) {
            return;
        }

        const vencimentoDate = new Date(receita[vencimentoField] + 'T00:00:00');
        const diffTime = vencimentoDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) { // Due Today
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_vencimento_hoje_receber',
                icon: 'event_busy',
                iconClass: 'notification-icon-danger',
                message: `Título do cliente "${receita.clienteNome}" vence HOJE.`,
                link: `contas-a-receber-page`
            });
        } else { // Due Soon
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'aviso_vencimento_receber',
                icon: 'event_available',
                iconClass: 'notification-icon-info',
                message: `O título de "${receita.clienteNome}" está próximo do vencimento.`,
                link: `contas-a-receber-page`
            });
        }
    });

    // Query 2: For overdue items
    const qOverdue = query(receitasRef, where("status", "==", "Vencido"));
    const overdueSnapshot = await getDocs(qOverdue);

    overdueSnapshot.forEach(doc => {
        const receita = doc.data();
        createNotification(db, userId, {
            relatedId: doc.id,
            type: 'alerta_atraso_receber',
            icon: 'warning',
            iconClass: 'notification-icon-danger',
            message: `Título do cliente "${receita.clienteNome}" venceu. Deseja enviar um lembrete?`,
            link: `contas-a-receber-page`
        });
    });
}

/**
 * Runs all notification checks.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
function checkAllNotifications(db, userId) {
    console.log("Checking for notifications (targeted query method)...");
    checkContasAPagar(db, userId);
    checkContasAReceber(db, userId);
}

/**
 * Initializes the notification system.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
export function initializeNotifications(db, userId) {
    if (!userId) return;

    // Check notifications on startup
    checkAllNotifications(db, userId);

    // Then check every 5 minutes
    setInterval(() => checkAllNotifications(db, userId), 300000);
}

// --- Full Notification Page Logic ---

let allNotifications = [];
let notificationTypes = new Set();

/**
 * Groups notifications by date categories (Hoje, Ontem, Esta Semana, etc.).
 * @param {Array} notifications - The array of notification objects.
 * @returns {Object} - An object with keys as date categories and values as arrays of notifications.
 */
function groupNotificationsByDate(notifications) {
    const groups = {
        Hoje: [],
        Ontem: [],
        "Esta Semana": [],
        "Este Mês": [],
        "Mais Antigas": [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    notifications.forEach(notif => {
        const notifDate = notif.createdAt.toDate();
        notifDate.setHours(0, 0, 0, 0);

        if (notifDate.getTime() === today.getTime()) {
            groups.Hoje.push(notif);
        } else if (notifDate.getTime() === yesterday.getTime()) {
            groups.Ontem.push(notif);
        } else if (notifDate >= startOfWeek) {
            groups["Esta Semana"].push(notif);
        } else if (notifDate >= startOfMonth) {
            groups["Este Mês"].push(notif);
        } else {
            groups["Mais Antigas"].push(notif);
        }
    });

    return groups;
}

/**
 * Renders the grouped notifications into the container.
 * @param {Object} groupedNotifications - The object containing grouped notifications.
 */
function renderFullNotificationList(groupedNotifications) {
    const container = document.getElementById('full-notification-list-container');
    if (!container) return;
    container.innerHTML = '';
    let hasNotifications = false;

    for (const groupName in groupedNotifications) {
        const notifications = groupedNotifications[groupName];
        if (notifications.length > 0) {
            hasNotifications = true;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'space-y-4';
            groupDiv.innerHTML = `<h2 class="text-xl font-semibold text-gray-800">${groupName}</h2>`;

            notifications.forEach(notif => {
                const itemDiv = document.createElement('div');
                itemDiv.className = `p-4 rounded-lg border flex items-start gap-4 ${notif.read ? 'bg-white' : 'bg-blue-50 border-blue-200'}`;
                itemDiv.innerHTML = `
                    <div class="notification-icon ${notif.iconClass || 'notification-icon-info'}">
                        <span class="material-symbols-outlined">${notif.icon || 'notifications'}</span>
                    </div>
                    <div class="flex-grow">
                        <p class="notification-text">${notif.message}</p>
                        <p class="notification-time">${notif.createdAt.toDate().toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${!notif.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full" title="Não lida"></div>' : ''}
                        <button class="delete-notification-btn p-1 rounded-full hover:bg-gray-200" data-id="${notif.id}">
                            <span class="material-symbols-outlined text-base text-gray-500">delete</span>
                        </button>
                    </div>
                `;
                groupDiv.appendChild(itemDiv);
            });
            container.appendChild(groupDiv);
        }
    }

    if (!hasNotifications) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <span class="material-symbols-outlined text-5xl text-gray-400">notifications_off</span>
                <p class="mt-4">Nenhuma notificação encontrada.</p>
            </div>`;
    }
}

/**
 * Populates the filter dropdown with unique notification types.
 */
function populateTypeFilter() {
    const typeFilter = document.getElementById('notification-type-filter');
    if (!typeFilter) return;

    // Preserve the current selection
    const currentSelection = typeFilter.value;

    typeFilter.innerHTML = '<option value="all">Todos os tipos</option>';
    notificationTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        // Make the type more human-readable
        option.textContent = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        typeFilter.appendChild(option);
    });

    // Restore selection
    typeFilter.value = currentSelection;
}

/**
 * Applies all current filters to the notification list and re-renders it.
 */
function applyAndRenderFilters() {
    const searchInput = document.getElementById('notification-search-input').value.toLowerCase();
    const statusFilter = document.getElementById('notification-status-filter').value;
    const typeFilter = document.getElementById('notification-type-filter').value;

    const filtered = allNotifications.filter(notif => {
        const searchMatch = !searchInput || notif.message.toLowerCase().includes(searchInput);
        const statusMatch = statusFilter === 'all' || (statusFilter === 'read' && notif.read) || (statusFilter === 'unread' && !notif.read);
        const typeMatch = typeFilter === 'all' || notif.type === typeFilter;
        return searchMatch && statusMatch && typeMatch;
    });

    const grouped = groupNotificationsByDate(filtered);
    renderFullNotificationList(grouped);
}

/**
 * Fetches all notifications from Firestore and initializes the page.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function fetchAndDisplayAllNotifications(db, userId) {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));

    try {
        const snapshot = await getDocs(q);
        allNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Reset and populate notification types for the filter
        notificationTypes.clear();
        allNotifications.forEach(notif => notificationTypes.add(notif.type));
        populateTypeFilter();

        applyAndRenderFilters();
    } catch (error) {
        console.error("Error fetching all notifications:", error);
    }
}

/**
 * Initializes the functionality for the dedicated notifications page.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
export function initializeNotificationsPage(db, userId) {
    if (!userId) return;

    const markAllReadBtn = document.getElementById('mark-all-as-read-btn');
    const searchInput = document.getElementById('notification-search-input');
    const statusFilter = document.getElementById('notification-status-filter');
    const typeFilter = document.getElementById('notification-type-filter');

    // Event listener for when the notifications page becomes visible
    document.addEventListener('view-shown', (e) => {
        if (e.detail.viewId === 'notifications-page') {
            fetchAndDisplayAllNotifications(db, userId);
        }
    });

    // Add listeners for filter controls
    if(searchInput) searchInput.addEventListener('input', applyAndRenderFilters);
    if(statusFilter) statusFilter.addEventListener('change', applyAndRenderFilters);
    if(typeFilter) typeFilter.addEventListener('change', applyAndRenderFilters);

    // Add listener for "Mark all as read" button
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            const unreadIds = allNotifications.filter(n => !n.read).map(n => n.id);
            if (unreadIds.length === 0) {
                alert("Todas as notificações já foram lidas.");
                return;
            }

            const batch = writeBatch(db);
            unreadIds.forEach(id => {
                const docRef = doc(db, 'users', userId, 'notifications', id);
                batch.update(docRef, { read: true });
            });

            try {
                await batch.commit();
                console.log("All notifications marked as read.");
                // Refresh the view
                fetchAndDisplayAllNotifications(db, userId);
            } catch (error) {
                console.error("Error marking all notifications as read:", error);
            }
        });
    }

    // Add listener for deleting individual notifications
    const container = document.getElementById('full-notification-list-container');
    if (container) {
        container.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-notification-btn');
            if (deleteButton) {
                e.stopPropagation();
                const notifId = deleteButton.dataset.id;
                if (confirm("Tem certeza que deseja excluir esta notificação?")) {
                    try {
                        await deleteDoc(doc(db, 'users', userId, 'notifications', notifId));
                        // Refresh list after deletion
                        allNotifications = allNotifications.filter(n => n.id !== notifId);
                        applyAndRenderFilters();
                    } catch (error) {
                        console.error("Error deleting notification:", error);
                        alert("Não foi possível excluir a notificação.");
                    }
                }
            }
        });
    }
}