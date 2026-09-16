import { registerUser, loginUser, loginWithGoogle, resetPassword, logoutUser, onAuthChange } from './auth.js';
import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("Ksandra: Iniciando aplicación...");

/* ============================================================
   SECCION 1: REFERENCIAS Y ESTADO GLOBAL
   ============================================================ */
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const resetForm = document.getElementById('resetForm');
const userEmailDisplay = document.getElementById('userEmail');
const kasandra = document.getElementById('kasandra');

let currentUser = null;
let currentAnagram = '';
let currentSteps = [];
let currentWords = '';
let editingId = null;
let popupConfirmCallback = null;

window.savedAnagramsData = {};

/* ============================================================
   SECCION 2: UTILIDADES DE POPUP
   ============================================================ */
const popupOverlay = document.getElementById('popupOverlay');
const popupBox = document.getElementById('popupBox');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupClose = document.getElementById('popupClose');
const popupConfirm = document.getElementById('popupConfirm');

function showPopup(title, message, type = 'info') {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupBox.className = 'popup-box type-' + type;
    popupConfirm.classList.add('hidden');
    popupConfirmCallback = null;
    popupOverlay.classList.remove('hidden');
}

function showConfirm(title, message, onConfirm) {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupBox.className = 'popup-box type-error';
    popupConfirm.classList.remove('hidden');
    popupConfirmCallback = onConfirm;
    popupOverlay.classList.remove('hidden');
}

function closePopup() {
    popupOverlay.classList.add('hidden');
    popupConfirmCallback = null;
}

popupClose.addEventListener('click', closePopup);
popupConfirm.addEventListener('click', () => {
    const cb = popupConfirmCallback;
    closePopup();
    if (cb) cb();
});

/* ============================================================
   SECCION 3: KASANDRA, ESTADOS Y REACCIONES
   Regla única:
   - switch encendido               -> peek  (espía de reojo)
   - switch apagado y foco dentro
     de un campo de contraseña      -> cover (imagen central)
   - cualquier otro caso            -> idle  (reposo)
   ============================================================ */
function setKasandra(state) {
    if (!kasandra) {
        console.warn("Kasandra: no se encontró el contenedor #kasandra en el HTML.");
        return;
    }
    kasandra.classList.remove('state-idle', 'state-cover', 'state-peek');
    kasandra.classList.add('state-' + state);
    console.log("Ksandra: estado activo ->", state);
}

/* ============================================================
   SECCION 4: NAVEGACION ENTRE FORMULARIOS DE AUTENTICACION
   ============================================================ */
function toggleForm(formName) {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    resetForm.classList.add('hidden');
    setKasandra('idle');
    if (formName === 'login') loginForm.classList.remove('hidden');
    if (formName === 'register') registerForm.classList.remove('hidden');
    if (formName === 'reset') resetForm.classList.remove('hidden');
}

document.getElementById('showRegister').addEventListener('click', () => toggleForm('register'));
document.getElementById('showLogin').addEventListener('click', () => toggleForm('login'));
document.getElementById('showReset').addEventListener('click', () => toggleForm('reset'));
document.getElementById('backToLogin').addEventListener('click', () => toggleForm('login'));

/* ============================================================
   SECCION 5: SWITCH DE CONTRASENA Y REACCION DE KASANDRA
   ============================================================ */
document.querySelectorAll('.toggle-password').forEach(toggle => {
    const targetId = toggle.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) {
        console.warn("Kasandra: no existe el input", targetId);
        return;
    }

    /* Recalcula el estado correcto según switch y foco */
    const refresh = () => {
        if (toggle.checked) {
            setKasandra('peek');
            return;
        }
        setKasandra(document.activeElement === input ? 'cover' : 'idle');
    };

    toggle.addEventListener('change', () => {
        input.type = toggle.checked ? 'text' : 'password';
        refresh();
    });

    /* Al entrar al campo de contraseña: imagen central */
    input.addEventListener('focus', refresh);

    /* Al salir del campo: reposo, salvo switch encendido */
    input.addEventListener('blur', refresh);

    /* Refuerzo mientras teclea */
    input.addEventListener('input', refresh);
});

/* ============================================================
   SECCION 6: EVENTOS DE AUTENTICACION CON POPUPS
   ============================================================ */
const WRONG_CREDENTIAL_CODES = ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'];

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return showPopup('Falta información', 'Escribe tu correo y tu contraseña para continuar.', 'error');

    const btn = document.getElementById('btnLogin');
    btn.textContent = "Entrando..."; btn.disabled = true;
    const res = await loginUser(email, password);
    btn.textContent = "Iniciar Sesión"; btn.disabled = false;

    if (!res.success) {
        if (WRONG_CREDENTIAL_CODES.includes(res.code)) {
            showPopup('Vaya, algo no coincide', 'No parece que nos conozcamos, ¿estás seguro que te registraste así?', 'error');
        } else {
            showPopup('No pudimos iniciar sesión', res.error, 'error');
        }
    }
});

document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!email || !password) return showPopup('Falta información', 'Escribe un correo y una contraseña de al menos 6 caracteres.', 'error');

    const btn = document.getElementById('btnRegister');
    btn.textContent = "Creando..."; btn.disabled = true;
    const res = await registerUser(email, password);
    btn.textContent = "Crear Cuenta"; btn.disabled = false;

    if (res.success) {
        showPopup('Bienvenido a Ksandra', 'Agradecemos mucho que te unas a nuestra herramienta! Tu cuenta está lista.', 'success');
    } else {
        showPopup('No pudimos crear tu cuenta', res.error, 'error');
    }
});

document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
    const res = await loginWithGoogle();
    if (!res.success && res.code !== 'auth/popup-closed-by-user') {
        showPopup('No pudimos continuar con Google', res.error, 'error');
    }
});

document.getElementById('btnReset').addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) return showPopup('Falta información', 'Escribe tu correo para enviarte el enlace de recuperación.', 'error');
    const res = await resetPassword(email);
    if (res.success) showPopup('Correo enviado', res.message, 'success');
    else showPopup('No pudimos enviar el correo', res.error, 'error');
});

document.getElementById('btnLogout').addEventListener('click', async () => { await logoutUser(); });

/* ============================================================
   SECCION 7: OBSERVADOR DE SESION
   ============================================================ */
onAuthChange((user) => {
    if (user) {
        currentUser = user;
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
        loadSavedAnagramsFromCloud();
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
        toggleForm('login');
    }
});

/* ============================================================
   SECCION 8: GENERADOR DEL SISTEMA DE PESCA
   ============================================================ */
function normalizeWord(w) {
    return w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, '');
}

function parsePool(wordsText) {
    return wordsText.split('\n').map(w => w.trim()).filter(Boolean).map(w => ({
        original: w,
        normalized: normalizeWord(w)
    }));
}

function generateSystem(input) {
    let pool = parsePool(input);
    if (pool.length < 2) {
        showPopup('Lista muy corta', 'Ingresa al menos 2 palabras para construir un sistema de pesca.', 'error');
        return;
    }

    const anagramLetters = [];
    const steps = [];

    while (pool.length > 3) {
        let bestLetter = null, bestNoGroup = [], bestYesGroup = [], bestScore = -Infinity;
        const letters = new Set(pool.map(item => item.normalized).join('').split(''));

        for (const letter of letters) {
            const noGroup = pool.filter(item => !item.normalized.includes(letter));
            const yesGroup = pool.filter(item => item.normalized.includes(letter));
            if (noGroup.length === 0 || yesGroup.length === 0) continue;
            const score = (noGroup.length >= 1 && noGroup.length <= 3)
                ? 100 - noGroup.length
                : 50 - Math.abs(noGroup.length - yesGroup.length);
            if (score > bestScore) { bestScore = score; bestLetter = letter; bestNoGroup = noGroup; bestYesGroup = yesGroup; }
        }
        if (!bestLetter) break;

        anagramLetters.push(bestLetter);
        steps.push({ letter: bestLetter, noGroup: bestNoGroup.map(item => item.original) });
        pool = bestYesGroup;
    }
    steps.push({ letter: "FINAL", yesGroup: pool.map(item => item.original) });

    currentAnagram = anagramLetters.join('');
    currentSteps = steps;
    renderResults(currentAnagram, steps);
}

/* Reconstruye los pasos usando las letras de un anagrama editado, en orden. */
function rebuildSteps(wordsText, anagramText) {
    let pool = parsePool(wordsText);
    const letters = normalizeWord(anagramText).split('');
    const steps = [];

    for (const letter of letters) {
        if (pool.length <= 3) break;
        const noGroup = pool.filter(item => !item.normalized.includes(letter));
        const yesGroup = pool.filter(item => item.normalized.includes(letter));
        if (noGroup.length === 0 || yesGroup.length === 0) continue;
        steps.push({ letter, noGroup: noGroup.map(item => item.original) });
        pool = yesGroup;
    }
    steps.push({ letter: "FINAL", yesGroup: pool.map(item => item.original) });
    return steps;
}

function renderResults(anagram, steps) {
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('anagramDisplay').textContent = anagram;
    const tree = document.getElementById('decisionTree');
    tree.innerHTML = '';
    steps.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = 'step';
        if (step.letter === "FINAL") {
            div.innerHTML = `<div class="step-question final-result">Grupo Final:</div><div class="step-result">${step.yesGroup.join(', ')}</div>`;
        } else {
            div.innerHTML = `<div class="step-question">Pregunta ${index + 1}: ¿Tiene "${step.letter}"?</div><div class="step-result">NO &rarr; ${step.noGroup.join(', ')}</div><div class="step-result">SÍ &rarr; Continuar</div>`;
        }
        tree.appendChild(div);
    });
}

document.getElementById('generateBtn').addEventListener('click', () => {
    const words = document.getElementById('wordList').value.trim();
    if (!words) return showPopup('Lista vacía', 'Escribe primero las palabras que quieres pescar, una por línea.', 'error');
    currentWords = words;
    generateSystem(words);
    document.getElementById('saveBtn').disabled = false;
});

document.getElementById('saveBtn').addEventListener('click', saveToCloud);

/* ============================================================
   SECCION 9: CRUD EN LA NUBE (FIRESTORE)
   ============================================================ */
async function saveToCloud() {
    if (!currentUser || !currentAnagram) return;
    try {
        await addDoc(collection(db, "users", currentUser.uid, "anagrams"), {
            title: currentAnagram,
            words: currentWords,
            anagram: currentAnagram,
            steps: currentSteps,
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        const btn = document.getElementById('saveBtn');
        btn.textContent = 'Guardado';
        setTimeout(() => btn.textContent = 'Guardar en Nube', 2000);
        showPopup('Guardado', 'Tu anagrama quedó guardado en tu colección personal.', 'success');
        loadSavedAnagramsFromCloud();
    } catch (e) {
        console.error("Error guardando: ", e);
        showPopup('Error al guardar', 'No pudimos guardar en la nube. Revisa tu conexión e intenta de nuevo.', 'error');
    }
}

async function loadSavedAnagramsFromCloud() {
    if (!currentUser) return;
    const savedSection = document.getElementById('savedSection');
    const savedList = document.getElementById('savedList');
    try {
        const q = query(collection(db, "users", currentUser.uid, "anagrams"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { savedSection.classList.add('hidden'); return; }

        savedSection.classList.remove('hidden');
        savedList.innerHTML = '';
        window.savedAnagramsData = {};

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.savedAnagramsData[docSnap.id] = data;
            const displayTitle = data.title || data.anagram;
            const li = document.createElement('li');
            li.className = 'saved-item';
            li.innerHTML = `
                <div class="saved-item-info" data-id="${docSnap.id}">
                    <div class="saved-item-title">${displayTitle}</div>
                    <div class="saved-item-date">${new Date(data.date).toLocaleDateString()} - ${data.words.split('\n').length} palabras</div>
                </div>
                <div class="saved-item-actions">
                    <button class="btn btn-ghost btn-small" data-action="edit" data-id="${docSnap.id}">Editar</button>
                    <button class="btn btn-danger btn-small" data-action="delete" data-id="${docSnap.id}">Eliminar</button>
                </div>`;
            savedList.appendChild(li);
        });
    } catch (e) {
        console.error("Error cargando: ", e);
    }
}

/* Delegación de eventos para la lista: cargar, editar, eliminar */
document.getElementById('savedList').addEventListener('click', (event) => {
    const info = event.target.closest('.saved-item-info');
    const actionBtn = event.target.closest('button[data-action]');

    if (actionBtn) {
        const id = actionBtn.getAttribute('data-id');
        if (actionBtn.getAttribute('data-action') === 'edit') openEdit(id);
        if (actionBtn.getAttribute('data-action') === 'delete') deleteAnagram(id);
        return;
    }
    if (info) loadAnagramFromMemory(info.getAttribute('data-id'));
});

function loadAnagramFromMemory(id) {
    const data = window.savedAnagramsData[id];
    if (!data) return;
    document.getElementById('wordList').value = data.words;
    currentWords = data.words;
    currentAnagram = data.anagram;
    currentSteps = data.steps;
    renderResults(currentAnagram, currentSteps);
    document.getElementById('saveBtn').disabled = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --- Actualizar (Update) --- */
const editOverlay = document.getElementById('editOverlay');

function openEdit(id) {
    const data = window.savedAnagramsData[id];
    if (!data) return;
    editingId = id;
    document.getElementById('editTitle').value = data.title || data.anagram;
    document.getElementById('editWords').value = data.words;
    document.getElementById('editAnagram').value = data.anagram;
    editOverlay.classList.remove('hidden');
}

document.getElementById('editCancel').addEventListener('click', () => {
    editingId = null;
    editOverlay.classList.add('hidden');
});

document.getElementById('editSave').addEventListener('click', async () => {
    if (!editingId || !currentUser) return;
    const title = document.getElementById('editTitle').value.trim();
    const words = document.getElementById('editWords').value.trim();
    const anagram = document.getElementById('editAnagram').value.trim();

    if (!title || !words || !anagram) {
        return showPopup('Campos incompletos', 'El título, las palabras y el anagrama no pueden quedar vacíos.', 'error');
    }

    const steps = rebuildSteps(words, anagram);

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "anagrams", editingId), {
            title, words, anagram, steps,
            updatedAt: new Date().toISOString()
        });
        editOverlay.classList.add('hidden');
        editingId = null;
        showPopup('Cambios guardados', 'Tu anagrama fue actualizado y el árbol de decisiones se recalculó.', 'success');
        loadSavedAnagramsFromCloud();
    } catch (e) {
        console.error("Error actualizando: ", e);
        showPopup('Error al actualizar', 'No pudimos guardar los cambios. Intenta de nuevo.', 'error');
    }
});

/* --- Eliminar (Delete) con popup de confirmación --- */
function deleteAnagram(id) {
    showConfirm('Eliminar anagrama', 'Esta acción no se puede deshacer. ¿Deseas eliminarlo permanentemente?', async () => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "anagrams", id));
            showPopup('Eliminado', 'El anagrama fue eliminado de tu colección.', 'success');
            loadSavedAnagramsFromCloud();
        } catch (e) {
            console.error("Error eliminando: ", e);
            showPopup('Error al eliminar', 'No pudimos eliminar el anagrama. Intenta de nuevo.', 'error');
        }
    });
}

/* ============================================================
   SECCION 10: COMPARTIR POR LINK Y LECTURA DE LINKS
   ============================================================ */
document.getElementById('shareBtn').addEventListener('click', () => {
    if (!currentAnagram) return;
    const dataToShare = { w: currentWords, a: currentAnagram, s: currentSteps };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(dataToShare))));
    const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showPopup('Link copiado', 'El enlace de tu sistema de pesca está en tu portapapeles. Compártelo con quien quieras.', 'success');
    }).catch(() => {
        showPopup('No se pudo copiar', 'Copia manualmente este enlace: ' + shareUrl, 'error');
    });
});

if (window.location.hash.startsWith('#data=')) {
    try {
        const encoded = window.location.hash.substring(6);
        const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
        document.getElementById('wordList').value = data.w;
        currentWords = data.w;
        currentAnagram = data.a;
        currentSteps = data.s;
    } catch (e) { console.error("Error al decodificar URL", e); }
}

console.log("Ksandra: Inicialización completa y exitosa.");