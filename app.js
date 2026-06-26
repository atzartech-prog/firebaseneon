import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ================= GLOBAL STATE =================
const defaultFirebaseConfig = {
  apiKey: "AIzaSyClqA4vJVLPF2Em2s1HlIpxnCM_-z0yv38",
  authDomain: "neonboard-app.firebaseapp.com",
  projectId: "neonboard-app",
  storageBucket: "neonboard-app.firebasestorage.app",
  messagingSenderId: "416653669898",
  appId: "1:416653669898:web:63a6b916975b37fd9251f3"
};

let firebaseConfig = null;
let app = null;
let db = null;
let auth = null;
let unsubscribeRealtime = null;
let authMode = 'register';

// ================= DOM ELEMENTS =================
const setupPanel = document.getElementById('setup-panel');
const boardPanel = document.getElementById('board-panel');
const setupForm = document.getElementById('setup-form');
const configJsonInput = document.getElementById('fb-config-json');

const msgForm = document.getElementById('msg-form');
const msgName = document.getElementById('msg-name');
const msgText = document.getElementById('msg-text'); // now contenteditable div
const notesGrid = document.getElementById('notes-grid');
const memoCount = document.getElementById('memo-count');
const btnChangeConfig = document.getElementById('btn-change-config');

// Auth DOM elements
const userProfileArea = document.getElementById('user-profile-area');
const userDisplayName = document.getElementById('user-display-name');
const btnLoginTrigger = document.getElementById('btn-login-trigger');
const btnLogout = document.getElementById('btn-logout');
const authLockOverlay = document.getElementById('auth-lock-overlay');
const btnLockLogin = document.getElementById('btn-lock-login');

// Auth Modal DOM elements
const authModal = document.getElementById('auth-modal');
const btnCloseAuth = document.getElementById('btn-close-auth');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authErrorMsg = document.getElementById('auth-error-msg');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const authSubmitText = document.getElementById('auth-submit-text');
const btnGoogleAuth = document.getElementById('btn-google-auth');
const authTitle = document.getElementById('auth-title');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    const savedConfig = localStorage.getItem('fb_config');
    if (savedConfig) {
        try {
            firebaseConfig = JSON.parse(savedConfig);
            showSection('board');
            initFirebase(firebaseConfig);
        } catch (e) {
            console.error('Failed to parse saved Firebase configuration:', e);
            localStorage.removeItem('fb_config');
            useDefaultConfig();
        }
    } else {
        useDefaultConfig();
    }

    // Attach Listeners
    setupForm.addEventListener('submit', handleSaveConfig);
    btnChangeConfig.addEventListener('click', handleEditConfig);
    msgForm.addEventListener('submit', handleAddMemo);
});

function useDefaultConfig() {
    firebaseConfig = defaultFirebaseConfig;
    showSection('board');
    initFirebase(firebaseConfig);
}

function showSection(section) {
    if (section === 'setup') {
        setupPanel.classList.remove('hidden');
        boardPanel.classList.add('hidden');
        
        // Fill config text area if it was saved
        const savedConfig = localStorage.getItem('fb_config');
        if (savedConfig) {
            configJsonInput.value = JSON.stringify(JSON.parse(savedConfig), null, 2);
        }
    } else {
        setupPanel.classList.add('hidden');
        boardPanel.classList.remove('hidden');
    }
}

// ================= FIREBASE INIT & SYNC =================
function initFirebase(config) {
    try {
        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);
        
        setupAuthListeners();
        setupEditorToolbar();
        startRealtimeSync();
    } catch (err) {
        console.error('Firebase initialization error:', err);
        alert(`Gagal inisialisasi Firebase. Periksa kembali konfigurasi Anda. Detail: ${err.message}`);
        showSection('setup');
    }
}

function startRealtimeSync() {
    if (!db) return;

    // Loading State
    notesGrid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Menghubungkan ke Cloud Firestore...</p>
        </div>
    `;

    // Query: Order by creation time, limit to 50 notes
    const q = query(collection(db, "memos"), orderBy("createdAt", "desc"), limit(50));

    // Listen to changes in real-time
    unsubscribeRealtime = onSnapshot(q, (snapshot) => {
        const memos = [];
        snapshot.forEach((doc) => {
            memos.push({ id: doc.id, ...doc.data() });
        });
        
        renderMemos(memos);
    }, (error) => {
        console.error("Firestore sync error:", error);
        notesGrid.innerHTML = `
            <div class="loading-state">
                <i class="bi bi-exclamation-triangle text-danger" style="font-size:2rem; display:block; margin-bottom:10px;"></i>
                <p>Gagal memuat data dari Firestore.</p>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">
                    ${error.message}<br>
                    <strong>Tips:</strong> Pastikan Anda telah membuat database Firestore di Firebase Console dan mengaktifkan aturan keamanan (Security Rules) ke mode uji coba (test mode).
                </p>
            </div>
        `;
    });
}

function renderMemos(memos) {
    memoCount.textContent = memos.length;

    if (memos.length === 0) {
        notesGrid.innerHTML = `
            <div class="loading-state" style="grid-column: 1 / -1;">
                <i class="bi bi-pin-angle" style="font-size: 2.5rem; display: block; margin-bottom: 12px; opacity:0.3;"></i>
                <p>Papan memo masih kosong. Tempel memo pertama di atas!</p>
            </div>
        `;
        return;
    }

    notesGrid.innerHTML = '';
    memos.forEach(memo => {
        const card = document.createElement('div');
        card.className = `memo-card card-${memo.color || 'blue'}`;
        
        // Format Timestamp
        let timeStr = 'Baru saja';
        if (memo.createdAt && memo.createdAt.toDate) {
            const date = memo.createdAt.toDate();
            timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }

        card.innerHTML = `
            <div class="memo-body">${sanitizeHtml(memo.text)}</div>
            <div class="memo-footer">
                <span class="memo-author">@${escapeHtml(memo.nickname)}</span>
                <span class="memo-time">${timeStr}</span>
            </div>
        `;
        notesGrid.appendChild(card);
    });
}

// ================= EVENT HANDLERS =================
async function handleAddMemo(e) {
    e.preventDefault();
    const nickname = msgName.value.trim();
    const text = msgText.innerHTML.trim();
    const color = document.querySelector('input[name="msg-color"]:checked').value;

    const isEmpty = text === '' || text === '<br>' || text === '<div><br></div>' || msgText.textContent.trim() === '';

    if (!nickname || isEmpty || !db) return;

    if (msgText.textContent.length > 300) {
        alert("Memo terlalu panjang! Maksimal 300 karakter.");
        return;
    }

    const submitBtn = msgForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="bi bi-hourglass-split"></i>`;

    try {
        // Save to Firestore
        await addDoc(collection(db, "memos"), {
            nickname: nickname,
            text: text, // Save HTML formatting safely
            color: color,
            createdAt: serverTimestamp()
        });

        // Clear editor
        msgText.innerHTML = '';
        msgText.focus();
    } catch (err) {
        console.error("Failed to add memo:", err);
        alert("Gagal memposting memo: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="bi bi-pin-angle-fill"></i> Tempel`;
    }
}

function handleSaveConfig(e) {
    e.preventDefault();
    const jsonStr = configJsonInput.value.trim();

    try {
        // Test parsing JSON
        const parsed = JSON.parse(jsonStr);
        
        // Basic check for Firebase Web SDK properties
        if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
            throw new Error("JSON harus memiliki apiKey, projectId, dan appId.");
        }

        localStorage.setItem('fb_config', JSON.stringify(parsed));
        alert("Konfigurasi disimpan! Memuat ulang aplikasi...");
        window.location.reload();
    } catch (err) {
        alert("Format JSON konfigurasi tidak valid! Silakan periksa kembali.\n\nDetail: " + err.message);
    }
}

function handleEditConfig() {
    if (unsubscribeRealtime) {
        unsubscribeRealtime();
    }
    showSection('setup');
}

// ================= FIREBASE AUTH LISTENERS & LOGIC =================
function setupAuthListeners() {
    if (!auth) return;

    // Listen for Authentication State
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is authenticated
            userProfileArea.classList.remove('hidden');
            userDisplayName.textContent = user.displayName || user.email.split('@')[0];
            btnLoginTrigger.classList.add('hidden');
            authLockOverlay.classList.add('hidden');
            
            // Prefill/lock user nickname based on login profile
            const nameToUse = user.displayName || user.email.split('@')[0];
            msgName.value = nameToUse;
            msgName.readOnly = true;
        } else {
            // User is logged out
            userProfileArea.classList.add('hidden');
            btnLoginTrigger.classList.remove('hidden');
            authLockOverlay.classList.remove('hidden');
            msgName.value = '';
            msgName.readOnly = false;
        }
    });

    // Toggle Modal Visibility
    btnLoginTrigger.addEventListener('click', openAuthModal);
    btnLockLogin.addEventListener('click', openAuthModal);
    btnCloseAuth.addEventListener('click', closeAuthModal);

    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // Toggle Registration / Login Mode inside Modal
    authToggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        authErrorMsg.classList.add('hidden');
        authForm.reset();
        
        if (authMode === 'register') {
            authMode = 'login';
            authTitle.textContent = 'Masuk ke NeonBoard';
            authSubmitText.textContent = 'Masuk';
            const icon = btnAuthSubmit.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-box-arrow-in-right';
            }
            authToggleText.textContent = 'Belum punya akun?';
            authToggleLink.textContent = 'Daftar Sekarang';
        } else {
            authMode = 'register';
            authTitle.textContent = 'Daftar Akun Baru';
            authSubmitText.textContent = 'Daftar';
            const icon = btnAuthSubmit.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-person-plus-fill';
            }
            authToggleText.textContent = 'Sudah punya akun?';
            authToggleLink.textContent = 'Masuk Sekarang';
        }
    });

    // Form Submission (Email/Password authentication)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value;
        
        authErrorMsg.classList.add('hidden');
        btnAuthSubmit.disabled = true;
        const origText = authSubmitText.textContent;
        authSubmitText.textContent = 'Memproses...';

        try {
            if (authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            closeAuthModal();
        } catch (err) {
            console.error('Auth error:', err);
            authErrorMsg.classList.remove('hidden');
            authErrorMsg.textContent = getFriendlyErrorMessage(err.code || err.message);
        } finally {
            btnAuthSubmit.disabled = false;
            authSubmitText.textContent = origText;
        }
    });

    // Google Single Sign-In
    btnGoogleAuth.addEventListener('click', async () => {
        authErrorMsg.classList.add('hidden');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            closeAuthModal();
        } catch (err) {
            console.error('Google sign-in error:', err);
            if (err.code !== 'auth/popup-closed-by-user') {
                authErrorMsg.classList.remove('hidden');
                authErrorMsg.textContent = getFriendlyErrorMessage(err.code || err.message);
            }
        }
    });

    // Sign Out Trigger
    btnLogout.addEventListener('click', async () => {
        if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
            try {
                await signOut(auth);
            } catch (err) {
                console.error('Sign-out error:', err);
                alert('Gagal keluar dari akun: ' + err.message);
            }
        }
    });
}

function openAuthModal() {
    authMode = 'register';
    authTitle.textContent = 'Daftar Akun Baru';
    authSubmitText.textContent = 'Daftar';
    const icon = btnAuthSubmit.querySelector('i');
    if (icon) {
        icon.className = 'bi bi-person-plus-fill';
    }
    authToggleText.textContent = 'Sudah punya akun?';
    authToggleLink.textContent = 'Masuk Sekarang';
    
    authModal.classList.remove('hidden');
    authEmail.focus();
}

function closeAuthModal() {
    authModal.classList.add('hidden');
    authErrorMsg.classList.add('hidden');
    authForm.reset();
}

// ================= WYSIWYG EDITOR CONTROLS =================
function setupEditorToolbar() {
    const editor = document.getElementById('msg-text');
    const tbButtons = document.querySelectorAll('.tb-btn');

    if (!editor) return;

    // Apply formatting commands
    tbButtons.forEach(btn => {
        // Prevent loss of focus on editor click
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-cmd');
            if (cmd) {
                document.execCommand(cmd, false, null);
                editor.focus();
                setTimeout(updateToolbarStates, 10);
            }
        });
    });

    // Synchronize active highlights on toolbar buttons based on selection state
    function updateToolbarStates() {
        tbButtons.forEach(btn => {
            const cmd = btn.getAttribute('data-cmd');
            if (!cmd || cmd === 'removeFormat') return;
            try {
                if (document.queryCommandState(cmd)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            } catch (e) {}
        });
    }

    editor.addEventListener('keyup', updateToolbarStates);
    editor.addEventListener('mouseup', updateToolbarStates);
    editor.addEventListener('focus', updateToolbarStates);
}

// ================= UTILITIES =================
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// White-list HTML sanitizer to allow basic text layout while strictly scrubbing execution payloads (XSS protection)
function sanitizeHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Allowed rich text HTML elements
    const allowedTags = ['B', 'STRONG', 'I', 'EM', 'U', 'STRIKE', 'DEL', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN'];
    const allElems = temp.getElementsByTagName('*');
    
    // Process backwards to safely delete tags from collection
    for (let i = allElems.length - 1; i >= 0; i--) {
        const el = allElems[i];
        if (!allowedTags.includes(el.tagName)) {
            // Replace tag with its text equivalent
            const textNode = document.createTextNode(el.textContent);
            el.parentNode.replaceChild(textNode, el);
        } else {
            // Remove all custom attributes to neutralize JS handlers (onerror, onclick, etc)
            while (el.attributes.length > 0) {
                el.removeAttribute(el.attributes[0].name);
            }
        }
    }
    return temp.innerHTML;
}

function getFriendlyErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
        case 'auth/invalid-value-email':
            return 'Format alamat email tidak valid.';
        case 'auth/user-disabled':
            return 'Akun ini telah dinonaktifkan oleh administrator.';
        case 'auth/user-not-found':
            return 'Pengguna tidak ditemukan. Silakan mendaftar terlebih dahulu.';
        case 'auth/wrong-password':
            return 'Kata sandi salah. Silakan coba lagi.';
        case 'auth/email-already-in-use':
            return 'Alamat email ini sudah digunakan oleh akun lain.';
        case 'auth/weak-password':
            return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
        case 'auth/operation-not-allowed':
            return 'Metode masuk ini tidak diaktifkan. Aktifkan di Firebase Console.';
        case 'auth/invalid-credential':
            return 'Email atau password salah / akun tidak valid.';
        case 'auth/popup-blocked':
            return 'Popup diblokir oleh browser. Silakan aktifkan popup untuk login Google.';
        default:
            return 'Terjadi masalah pada autentikasi: ' + code;
    }
}

