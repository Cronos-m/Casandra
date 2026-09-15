import { registerUser, loginUser, loginWithGoogle, resetPassword, logoutUser, onAuthChange } from './auth.js';
import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("Ksandra: Iniciando aplicación...");

function showFatalError(msg) {
    const authMsg = document.getElementById('authMessage');
    if (authMsg) {
        authMsg.textContent = "Error crítico: " + msg;
        authMsg.className = "message error";
        authMsg.classList.remove('hidden');
    }
    console.error("FATAL ERROR:", msg);
}

try {
    const authSection = document.getElementById('authSection');
    const mainApp = document.getElementById('mainApp');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetForm = document.getElementById('resetForm');
    const authMessage = document.getElementById('authMessage');
    const userEmailDisplay = document.getElementById('userEmail');

    if (!authSection || !mainApp) throw new Error("No se encontraron los elementos HTML principales.");

    let currentUser = null;
    let currentAnagram = '';
    let currentSteps = [];
    let currentWords = '';
    window.savedAnagramsData = {};

    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const showReset = document.getElementById('showReset');
    const backToLogin = document.getElementById('backToLogin');

    if (showRegister) showRegister.addEventListener('click', () => toggleForm('register'));
    if (showLogin) showLogin.addEventListener('click', () => toggleForm('login'));
    if (showReset) showReset.addEventListener('click', () => toggleForm('reset'));
    if (backToLogin) backToLogin.addEventListener('click', () => toggleForm('login'));

    function toggleForm(formName) {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        resetForm.classList.add('hidden');
        authMessage.classList.add('hidden');
        if (formName === 'login' && loginForm) loginForm.classList.remove('hidden');
        if (formName === 'register' && registerForm) registerForm.classList.remove('hidden');
        if (formName === 'reset' && resetForm) resetForm.classList.remove('hidden');
    }

    function showMessage(msg, type) {
        authMessage.textContent = msg;
        authMessage.className = `message ${type}`;
        authMessage.classList.remove('hidden');
    }

    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
                button.textContent = input.type === 'password' ? 'Ver' : 'Ocultar';
            }
        });
    });

    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    const btnReset = document.getElementById('btnReset');
    const btnLogout = document.getElementById('btnLogout');

    if (btnLogin) btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) return showMessage("Ingresa correo y contraseña.", "error");
        btnLogin.textContent = "Entrando..."; btnLogin.disabled = true;
        const res = await loginUser(email, password);
        btnLogin.textContent = "Iniciar Sesión"; btnLogin.disabled = false;
        if (!res.success) showMessage(res.error, 'error');
    });

    if (btnRegister) btnRegister.addEventListener('click', async () => {
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (!email || !password) return showMessage("Ingresa correo y contraseña.", "error");
        btnRegister.textContent = "Creando..."; btnRegister.disabled = true;
        const res = await registerUser(email, password);
        btnRegister.textContent = "Crear Cuenta"; btnRegister.disabled = false;
        if (res.success) showMessage('Cuenta creada. Iniciando sesión...', 'success');
        else showMessage(res.error, 'error');
    });

    if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', async () => {
        showMessage('Conectando con Google...', 'success');
        const res = await loginWithGoogle();
        if (!res.success) showMessage(res.error, 'error');
    });

    if (btnReset) btnReset.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value;
        if (!email) return showMessage("Ingresa tu correo.", "error");
        const res = await resetPassword(email);
        showMessage(res.success ? res.message : res.error, res.success ? 'success' : 'error');
    });

    if (btnLogout) btnLogout.addEventListener('click', async () => { await logoutUser(); });

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

    const generateBtn = document.getElementById('generateBtn');
    const saveBtn = document.getElementById('saveBtn');
    const shareBtn = document.getElementById('shareBtn');

    if (generateBtn) generateBtn.addEventListener('click', () => {
        const words = document.getElementById('wordList').value.trim();
        if (!words) return;
        currentWords = words;
        generateSystem(words);
        if (saveBtn) saveBtn.disabled = false;
    });

    if (saveBtn) saveBtn.addEventListener('click', saveToCloud);

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
        const resultsSection = document.getElementById('results');
        if (resultsSection) resultsSection.classList.remove('hidden');
        const anagramDisplay = document.getElementById('anagramDisplay');
        if (anagramDisplay) anagramDisplay.textContent = anagram;
        const tree = document.getElementById('decisionTree');
        if (!tree) return;
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

    async function saveToCloud() {
        if (!currentUser || !currentAnagram) return;
        try {
            await addDoc(collection(db, "users", currentUser.uid, "anagrams"), {
                words: currentWords, anagram: currentAnagram, steps: currentSteps, date: new Date().toISOString()
            });
            const btn = document.getElementById('saveBtn');
            btn.textContent = 'Guardado';
            setTimeout(() => btn.textContent = 'Guardar en Nube', 2000);
            loadSavedAnagramsFromCloud();
        } catch (e) {
            console.error("Error guardando: ", e);
            alert("Error al guardar: " + e.message);
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
                const li = document.createElement('li');
                li.className = 'saved-item';
                li.innerHTML = `
                    <div class="saved-item-info" onclick="window.loadAnagramFromMemory('${docSnap.id}')">
                        <div class="saved-item-title">${data.anagram}</div>
                        <div class="saved-item-date">${new Date(data.date).toLocaleDateString()} - ${data.words.split('\n').length} palabras</div>
                    </div>
                    <div class="saved-item-actions">
                        <button onclick="window.deleteAnagram('${docSnap.id}')">Eliminar</button>
                    </div>`;
                savedList.appendChild(li);
            });
        } catch (e) { console.error("Error cargando: ", e); }
    }

    window.loadAnagramFromMemory = function(id) {
        const data = window.savedAnagramsData[id];
        if (!data) return;
        document.getElementById('wordList').value = data.words;
        currentWords = data.words; currentAnagram = data.anagram; currentSteps = data.steps;
        renderResults(currentAnagram, currentSteps);
        document.getElementById('saveBtn').disabled = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.deleteAnagram = async function(id) {
        if (!confirm('¿Eliminar este anagrama permanentemente?')) return;
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "anagrams", id));
            loadSavedAnagramsFromCloud();
        } catch (e) { console.error("Error eliminando: ", e); }
    };

    if (shareBtn) shareBtn.addEventListener('click', () => {
        if (!currentAnagram) return;
        const dataToShare = { w: currentWords, a: currentAnagram, s: currentSteps };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(dataToShare))));
        const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            shareBtn.textContent = 'Link Copiado';
            setTimeout(() => shareBtn.textContent = 'Compartir Link', 2000);
        }).catch(() => alert('No se pudo copiar. URL: ' + shareUrl));
    });

    if (window.location.hash.startsWith('#data=')) {
        try {
            const encoded = window.location.hash.substring(6);
            const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
            document.getElementById('wordList').value = data.w;
            currentWords = data.w; currentAnagram = data.a; currentSteps = data.s;
        } catch (e) { console.error("Error al decodificar URL", e); }
    }
    console.log("Ksandra: Inicialización completa y exitosa.");
} catch (error) {
    showFatalError(error.message);
}