// app.js
import { registerUser, loginUser, loginWithGoogle, resetPassword, logoutUser, onAuthChange } from './auth.js';
import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias DOM
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const resetForm = document.getElementById('resetForm');
const authMessage = document.getElementById('authMessage');
const userEmailDisplay = document.getElementById('userEmail');

let currentUser = null;
let currentAnagram = '';
let currentSteps = [];
let currentWords = '';

// Almacenamiento temporal seguro para datos cargados
window.savedAnagramsData = {};

// Manejo de UI de formularios
document.getElementById('showRegister').addEventListener('click', () => toggleForm('register'));
document.getElementById('showLogin').addEventListener('click', () => toggleForm('login'));
document.getElementById('showReset').addEventListener('click', () => toggleForm('reset'));
document.getElementById('backToLogin').addEventListener('click', () => toggleForm('login'));

function toggleForm(formName) {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    resetForm.classList.add('hidden');
    authMessage.classList.add('hidden');
    
    if (formName === 'login') loginForm.classList.remove('hidden');
    if (formName === 'register') registerForm.classList.remove('hidden');
    if (formName === 'reset') resetForm.classList.remove('hidden');
}

function showMessage(msg, type) {
    authMessage.textContent = msg;
    authMessage.className = `message ${type}`;
    authMessage.classList.remove('hidden');
}

// Eventos de Autenticación
document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const res = await loginUser(email, password);
    if (!res.success) showMessage(res.error, 'error');
});

document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const res = await registerUser(email, password);
    if (res.success) showMessage('Cuenta creada. Iniciando sesión...', 'success');
    else showMessage(res.error, 'error');
});

document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
    showMessage('Conectando con Google...', 'success');
    const res = await loginWithGoogle();
    if (!res.success) showMessage(res.error, 'error');
});

document.getElementById('btnReset').addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value;
    const res = await resetPassword(email);
    showMessage(res.success ? res.message : res.error, res.success ? 'success' : 'error');
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    await logoutUser();
});

// Observador de Autenticación
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

// Lógica de la Aplicación
document.getElementById('generateBtn').addEventListener('click', () => {
    const words = document.getElementById('wordList').value.trim();
    if (!words) return;
    currentWords = words;
    generateSystem(words);
    document.getElementById('saveBtn').disabled = false;
});

document.getElementById('saveBtn').addEventListener('click', saveToCloud);

function generateSystem(input) {
    const rawWords = input.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    let pool = rawWords.map(w => ({
        original: w,
        normalized: w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, '')
    }));

    if (pool.length < 2) { alert("Ingresa al menos 2 palabras."); return; }

    const anagramLetters = [];
    const steps = [];

    while (pool.length > 3) {
        let bestLetter = null, bestNoGroup = [], bestYesGroup = [], bestScore = -Infinity;
        const letters = new Set(pool.map(item => item.normalized).join('').split(''));

        for (let letter of letters) {
            const noGroup = pool.filter(item => !item.normalized.includes(letter));
            const yesGroup = pool.filter(item => item.normalized.includes(letter));
            if (noGroup.length === 0 || yesGroup.length === 0) continue;

            let score = (noGroup.length >= 1 && noGroup.length <= 3) ? 100 - noGroup.length : 50 - Math.abs(noGroup.length - yesGroup.length);
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

// Gestión en la Nube (Firestore)
async function saveToCloud() {
    if (!currentUser || !currentAnagram) return;
    try {
        await addDoc(collection(db, "users", currentUser.uid, "anagrams"), {
            words: currentWords,
            anagram: currentAnagram,
            steps: currentSteps,
            date: new Date().toISOString()
        });
        const btn = document.getElementById('saveBtn');
        btn.textContent = 'Guardado';
        setTimeout(() => btn.textContent = 'Guardar en Nube', 2000);
        loadSavedAnagramsFromCloud();
    } catch (e) {
        console.error("Error guardando: ", e);
        alert("Error al guardar en la nube.");
    }
}

async function loadSavedAnagramsFromCloud() {
    if (!currentUser) return;
    const savedSection = document.getElementById('savedSection');
    const savedList = document.getElementById('savedList');
    
    try {
        const q = query(collection(db, "users", currentUser.uid, "anagrams"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            savedSection.classList.add('hidden');
            return;
        }

        savedSection.classList.remove('hidden');
        savedList.innerHTML = '';
        window.savedAnagramsData = {}; // Limpiar memoria

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.savedAnagramsData[docSnap.id] = data; // Guardar en memoria segura

            const li = document.createElement('li');
            li.className = 'saved-item';
            li.innerHTML = `
                <div class="saved-item-info" onclick="loadAnagramFromMemory('${docSnap.id}')">
                    <div class="saved-item-title">${data.anagram}</div>
                    <div class="saved-item-date">${new Date(data.date).toLocaleDateString()} - ${data.words.split('\n').length} palabras</div>
                </div>
                <div class="saved-item-actions">
                    <button onclick="deleteAnagram('${docSnap.id}')">Eliminar</button>
                </div>
            `;
            savedList.appendChild(li);
        });
    } catch (e) {
        console.error("Error cargando: ", e);
    }
}

// Funciones globales para la UI
window.loadAnagramFromMemory = function(id) {
    const data = window.savedAnagramsData[id];
    if (!data) return;

    document.getElementById('wordList').value = data.words;
    currentWords = data.words;
    currentAnagram = data.anagram;
    currentSteps = data.steps;
    renderResults(currentAnagram, currentSteps);
    document.getElementById('saveBtn').disabled = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteAnagram = async function(id) {
    if (!confirm('¿Eliminar este anagrama de la nube permanentemente?')) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "anagrams", id));
        loadSavedAnagramsFromCloud();
    } catch (e) {
        console.error("Error eliminando: ", e);
    }
};

document.getElementById('shareBtn').addEventListener('click', () => {
    if (!currentAnagram) return;
    const dataToShare = { w: currentWords, a: currentAnagram, s: currentSteps };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(dataToShare))));
    const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = document.getElementById('shareBtn');
        btn.textContent = 'Link Copiado';
        setTimeout(() => btn.textContent = 'Compartir Link', 2000);
    }).catch(() => {
        alert('No se pudo copiar. URL: ' + shareUrl);
    });
});

// Cargar datos compartidos por URL al iniciar
if (window.location.hash.startsWith('#data=')) {
    try {
        const encoded = window.location.hash.substring(6);
        const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
        document.getElementById('wordList').value = data.w;
        currentWords = data.w;
        currentAnagram = data.a;
        currentSteps = data.s;
        // Se renderizará automáticamente cuando el usuario complete el login
    } catch (e) { console.error("Error al decodificar URL", e); }
}