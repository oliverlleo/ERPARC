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
 * Checks for bills (despesas) that are due soon.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAPagarVencimento(db, userId) {
    const despesasRef = collection(db, 'users', userId, 'despesas');
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    const q = query(despesasRef,
        where("status", "in", ["Pendente", "Pago Parcialmente"]),
        where("vencimento", ">=", todayStr),
        where("vencimento", "<=", threeDaysStr)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
        const despesa = doc.data();
        createNotification(db, userId, {
            relatedId: doc.id,
            type: 'aviso_vencimento_pagar',
            icon: 'calendar_month',
            iconClass: 'notification-icon-warning',
            message: `Sua provisão a pagar para "${despesa.favorecidoNome}" vence em ${new Date(despesa.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}.`,
            link: `contas-a-pagar-page`
        });
    });
}

/**
 * Checks for overdue bills (despesas).
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAPagarAtraso(db, userId) {
    const despesasRef = collection(db, 'users', userId, 'despesas');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const q = query(despesasRef,
        where("status", "in", ["Pendente", "Pago Parcialmente", "Vencido"])
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
        const despesa = doc.data();
        if (despesa.vencimento < todayStr) {
             createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_atraso_pagar',
                icon: 'error',
                iconClass: 'notification-icon-danger',
                message: `A conta de "${despesa.favorecidoNome}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesa.valorSaldo/100)} venceu.`,
                link: `contas-a-pagar-page`
            });
        }
    });
}

/**
 * Checks for receivables that are due soon.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAReceberVencimento(db, userId) {
    const receitasRef = collection(db, 'users', userId, 'receitas');
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split('T')[0];
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    const q = query(receitasRef,
        where("status", "in", ["Pendente", "Recebido Parcialmente"]),
        where("dataVencimento", ">=", todayStr),
        where("dataVencimento", "<=", threeDaysStr)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
        const receita = doc.data();
        createNotification(db, userId, {
            relatedId: doc.id,
            type: 'aviso_vencimento_receber',
            icon: 'event_available',
            iconClass: 'notification-icon-info',
            message: `O título de "${receita.clienteNome}" está próximo do vencimento.`,
            link: `contas-a-receber-page`
        });
    });
}

/**
 * Checks for overdue receivables.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The ID of the user.
 */
async function checkContasAReceberAtraso(db, userId) {
    const receitasRef = collection(db, 'users', userId, 'receitas');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const q = query(receitasRef,
        where("status", "in", ["Pendente", "Recebido Parcialmente", "Vencido"])
    );
     const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
        const receita = doc.data();
        const vencimento = receita.dataVencimento || receita.vencimento;
        if (vencimento < todayStr) {
            createNotification(db, userId, {
                relatedId: doc.id,
                type: 'alerta_atraso_receber',
                icon: 'warning',
                iconClass: 'notification-icon-danger',
                message: `Título do cliente "${receita.clienteNome}" venceu. Deseja enviar um lembrete?`,
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
    console.log("Checking for notifications...");
    checkContasAPagarVencimento(db, userId);
    checkContasAPagarAtraso(db, userId);
    checkContasAReceberVencimento(db, userId);
    checkContasAReceberAtraso(db, userId);
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