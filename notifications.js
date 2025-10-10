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
 * Checks all unpaid bills and creates notifications for items due today, overdue, or due soon.
 * This function uses client-side filtering to avoid complex Firestore indexes.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAPagar(db, userId) {
    const despesasRef = collection(db, 'users', userId, 'despesas');
    // Simplified query to get all potentially relevant bills.
    const q = query(despesasRef, where("status", "in", ["Pendente", "Pago Parcialmente", "Vencido"]));

    const querySnapshot = await getDocs(q);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date

    querySnapshot.forEach(doc => {
        const despesa = doc.data();
        if (!despesa.vencimento) return; // Skip if no due date

        const vencimentoDate = new Date(despesa.vencimento + 'T00:00:00');
        const diffTime = vencimentoDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const valor = despesa.valorSaldo ?? despesa.valorOriginal ?? 0;

        if (diffDays === 0) {
            // Due Today
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_vencimento_hoje_pagar',
                icon: 'event_busy',
                iconClass: 'notification-icon-danger',
                message: `A conta de "${despesa.favorecidoNome}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)} vence HOJE.`,
                link: `contas-a-pagar-page`
            });
        } else if (diffDays < 0) {
            // Overdue
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_atraso_pagar',
                icon: 'error',
                iconClass: 'notification-icon-danger',
                message: `A conta de "${despesa.favorecidoNome}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)} venceu.`,
                link: `contas-a-pagar-page`
            });
        } else if (diffDays > 0 && diffDays <= 3) {
            // Due Soon
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
}

/**
 * Checks all unpaid receivables and creates notifications for items due today, overdue, or due soon.
 * This function uses client-side filtering to avoid complex Firestore indexes.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAReceber(db, userId) {
    const receitasRef = collection(db, 'users', userId, 'receitas');
    // Simplified query to get all potentially relevant receivables.
    const q = query(receitasRef, where("status", "in", ["Pendente", "Recebido Parcialmente", "Vencido"]));

    const querySnapshot = await getDocs(q);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date

    querySnapshot.forEach(doc => {
        const receita = doc.data();
        const vencimento = receita.dataVencimento || receita.vencimento;
        if (!vencimento) return; // Skip if no due date

        const vencimentoDate = new Date(vencimento + 'T00:00:00');
        const diffTime = vencimentoDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Due Today
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_vencimento_hoje_receber',
                icon: 'event_busy',
                iconClass: 'notification-icon-danger',
                message: `Título do cliente "${receita.clienteNome}" vence HOJE.`,
                link: `contas-a-receber-page`
            });
        } else if (diffDays < 0) {
            // Overdue
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_atraso_receber',
                icon: 'warning',
                iconClass: 'notification-icon-danger',
                message: `Título do cliente "${receita.clienteNome}" venceu. Deseja enviar um lembrete?`,
                link: `contas-a-receber-page`
            });
        } else if (diffDays > 0 && diffDays <= 3) {
            // Due Soon
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
}

/**
 * Runs all notification checks.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
function checkAllNotifications(db, userId) {
    console.log("Checking for notifications (client-side filter method)...");
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