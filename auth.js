import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, googleProvider } from './firebase-config.js';

export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, code: error.code, error: getAuthErrorMessage(error.code) };
    }
}

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, code: error.code, error: getAuthErrorMessage(error.code) };
    }
}

export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, code: error.code, error: getAuthErrorMessage(error.code) };
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Correo de recuperación enviado. Revisa tu bandeja de entrada." };
    } catch (error) {
        return { success: false, code: error.code, error: getAuthErrorMessage(error.code) };
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Este correo ya está registrado. Prueba iniciando sesión.',
        'auth/invalid-email': 'El formato del correo no es válido.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/user-not-found': 'No parece que nos conozcamos, ¿estás seguro que te registraste así?',
        'auth/wrong-password': 'No parece que nos conozcamos, ¿estás seguro que te registraste así?',
        'auth/invalid-credential': 'No parece que nos conozcamos, ¿estás seguro que te registraste así?',
        'auth/too-many-requests': 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
        'auth/popup-closed-by-user': 'El inicio de sesión con Google fue cancelado.',
        'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado.',
        'auth/network-request-failed': 'No hay conexión con el servidor. Revisa tu internet.'
    };
    return messages[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
}