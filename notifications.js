import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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