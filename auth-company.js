import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    deleteUser,
    updatePassword
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp,
    deleteField
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const COMPANY_AUTH_DOMAIN = 'archsys-company.invalid';

export function normalizeCompanyLogin(login) {
    return String(login ?? '').normalize('NFKC').trim().toLowerCase();
}

function directoryId(empresaId, login) {
    return `${empresaId}__${encodeURIComponent(normalizeCompanyLogin(login))}`;
}

function authEmailForAccess(accessId) {
    return `${accessId}@${COMPANY_AUTH_DOMAIN}`;
}

export function isCompanyAuthEmail(email) {
    return String(email ?? '').toLowerCase().endsWith(`@${COMPANY_AUTH_DOMAIN}`);
}

export function generateSecureRandomPassword(length = 12, numeric = false) {
    const charset = numeric
        ? '0123456789'
        : 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[bytes[i] % charset.length];
    }
    return password;
}

export function generateSecureCompanyCode(length = 6) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    let code = 'EMP-';
    for (let i = 0; i < length; i++) {
        code += charset[bytes[i] % charset.length];
    }
    return code;
}

async function withSecondaryAuth(firebaseConfig, worker) {
    const appName = `archsys-secondary-${crypto.randomUUID()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
        return await worker(secondaryAuth);
    } finally {
        await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
    }
}

function profileData({ accessId, adminId, empresaId, systemUserId, nomeUsuario, login, primeiroAcesso }) {
    return {
        accessId,
        adminId,
        empresaId,
        systemUserId: systemUserId || null,
        nomeUsuario: nomeUsuario || login,
        login,
        normalizedLogin: normalizeCompanyLogin(login),
        primeiroAcesso: primeiroAcesso !== false,
        active: true,
        updatedAt: serverTimestamp()
    };
}

function directoryData({ accessId, adminId, empresaId, authEmail, login }) {
    return {
        accessId,
        adminId,
        empresaId,
        authEmail,
        normalizedLogin: normalizeCompanyLogin(login),
        active: true,
        updatedAt: serverTimestamp()
    };
}

export async function createCompanyAccess({
    db,
    firebaseConfig,
    adminId,
    empresaId,
    systemUserId,
    nomeUsuario,
    login,
    tempPassword
}) {
    const accessRef = doc(collection(db, 'acessos'));
    const authEmail = authEmailForAccess(accessRef.id);
    let createdUser = null;

    try {
        createdUser = await withSecondaryAuth(firebaseConfig, async secondaryAuth => {
            const credential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, tempPassword);
            return credential.user;
        });

        const batch = writeBatch(db);
        const profileRef = doc(db, 'accessProfiles', createdUser.uid);
        const directoryRef = doc(db, 'loginDirectory', directoryId(empresaId, login));

        batch.set(accessRef, {
            login,
            normalizedLogin: normalizeCompanyLogin(login),
            nomeUsuario,
            systemUserId,
            empresaId,
            adminId,
            authUid: createdUser.uid,
            authEmail,
            primeiroAcesso: true,
            authProvider: 'firebase-password',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        batch.set(profileRef, profileData({
            accessId: accessRef.id,
            adminId,
            empresaId,
            systemUserId,
            nomeUsuario,
            login,
            primeiroAcesso: true
        }));
        batch.set(directoryRef, directoryData({
            accessId: accessRef.id,
            adminId,
            empresaId,
            authEmail,
            login
        }));
        await batch.commit();

        return { accessId: accessRef.id, authUid: createdUser.uid, authEmail };
    } catch (error) {
        if (createdUser) {
            await withSecondaryAuth(firebaseConfig, async secondaryAuth => {
                try {
                    const credential = await signInWithEmailAndPassword(secondaryAuth, authEmail, tempPassword);
                    await deleteUser(credential.user);
                } catch (_) {}
            }).catch(() => {});
        }
        throw error;
    }
}

export async function updateCompanyAccessLogin({ db, accessId, login }) {
    const accessRef = doc(db, 'acessos', accessId);
    const accessSnap = await getDoc(accessRef);
    if (!accessSnap.exists()) throw new Error('Acesso não encontrado.');

    const current = accessSnap.data();
    const oldDirectoryRef = doc(db, 'loginDirectory', directoryId(current.empresaId, current.login));
    const newDirectoryRef = doc(db, 'loginDirectory', directoryId(current.empresaId, login));

    const batch = writeBatch(db);
    batch.update(accessRef, {
        login,
        normalizedLogin: normalizeCompanyLogin(login),
        updatedAt: serverTimestamp()
    });
    if (oldDirectoryRef.path !== newDirectoryRef.path) batch.delete(oldDirectoryRef);
    batch.set(newDirectoryRef, directoryData({
        accessId,
        adminId: current.adminId,
        empresaId: current.empresaId,
        authEmail: current.authEmail || authEmailForAccess(accessId),
        login
    }));
    if (current.authUid) {
        batch.set(doc(db, 'accessProfiles', current.authUid), {
            login,
            normalizedLogin: normalizeCompanyLogin(login),
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
    await batch.commit();
}

export async function disableCompanyAccess({ db, accessId }) {
    const accessRef = doc(db, 'acessos', accessId);
    const accessSnap = await getDoc(accessRef);
    if (!accessSnap.exists()) return;

    const data = accessSnap.data();
    const batch = writeBatch(db);
    batch.delete(accessRef);
    if (data.authUid) batch.delete(doc(db, 'accessProfiles', data.authUid));
    if (data.empresaId && data.login) {
        batch.delete(doc(db, 'loginDirectory', directoryId(data.empresaId, data.login)));
    }
    await batch.commit();
}

async function migrateOneLegacyAccess({ db, firebaseConfig, accessDoc }) {
    const data = accessDoc.data();
    if (!data.empresaId || !data.adminId || !data.login) {
        throw new Error(`Acesso ${accessDoc.id} sem empresa/admin/login.`);
    }

    const authEmail = data.authEmail || authEmailForAccess(accessDoc.id);
    let authUid = data.authUid || null;
    let createdCredential = null;

    if (!authUid) {
        if (!data.senha) throw new Error(`Acesso ${accessDoc.id} sem senha legada para migração.`);

        await withSecondaryAuth(firebaseConfig, async secondaryAuth => {
            try {
                createdCredential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, data.senha);
            } catch (error) {
                if (error?.code !== 'auth/email-already-in-use') throw error;
                createdCredential = await signInWithEmailAndPassword(secondaryAuth, authEmail, data.senha);
            }
            authUid = createdCredential.user.uid;
        });
    }

    const batch = writeBatch(db);
    batch.update(accessDoc.ref, {
        normalizedLogin: normalizeCompanyLogin(data.login),
        authUid,
        authEmail,
        authProvider: 'firebase-password',
        senha: deleteField(),
        updatedAt: serverTimestamp()
    });
    batch.set(doc(db, 'accessProfiles', authUid), profileData({
        accessId: accessDoc.id,
        adminId: data.adminId,
        empresaId: data.empresaId,
        systemUserId: data.systemUserId,
        nomeUsuario: data.nomeUsuario,
        login: data.login,
        primeiroAcesso: data.primeiroAcesso
    }), { merge: true });
    batch.set(doc(db, 'loginDirectory', directoryId(data.empresaId, data.login)), directoryData({
        accessId: accessDoc.id,
        adminId: data.adminId,
        empresaId: data.empresaId,
        authEmail,
        login: data.login
    }), { merge: true });
    await batch.commit();
}

export async function migrateLegacyCompanyAccesses({ db, firebaseConfig, adminId }) {
    const snapshot = await getDocs(query(collection(db, 'acessos'), where('adminId', '==', adminId)));
    const failures = [];
    let migrated = 0;

    for (const accessDoc of snapshot.docs) {
        const data = accessDoc.data();
        const needsMigration = Boolean(data.senha) || !data.authUid || !data.authEmail;
        if (!needsMigration) continue;
        try {
            await migrateOneLegacyAccess({ db, firebaseConfig, accessDoc });
            migrated++;
        } catch (error) {
            console.error('Falha ao migrar acesso legado:', accessDoc.id, error);
            failures.push({ accessId: accessDoc.id, message: error?.message || String(error) });
        }
    }

    return { migrated, failures };
}

export async function signInCompanyUser({ auth, db, empresaId, login, password }) {
    const directoryRef = doc(db, 'loginDirectory', directoryId(empresaId, login));
    const directorySnap = await getDoc(directoryRef);
    if (!directorySnap.exists() || directorySnap.data().active === false) {
        const error = new Error('Acesso não migrado ou desativado.');
        error.code = 'company-auth/access-not-ready';
        throw error;
    }

    const data = directorySnap.data();
    return signInWithEmailAndPassword(auth, data.authEmail, password);
}

export async function getCompanyAccessProfile(db, uid) {
    const snap = await getDoc(doc(db, 'accessProfiles', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function completeCompanyFirstAccess({ auth, db, profile, newPassword }) {
    if (!auth.currentUser || !profile?.id) throw new Error('Usuário da empresa não autenticado.');
    await updatePassword(auth.currentUser, newPassword);
    const batch = writeBatch(db);
    batch.set(doc(db, 'accessProfiles', profile.id), {
        primeiroAcesso: false,
        passwordChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });
    await batch.commit();
}
