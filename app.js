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

// ================= GLOBAL STATE =================
let firebaseConfig = null;
let app = null;
let db = null;
let unsubscribeRealtime = null;

// ================= DOM ELEMENTS =================
const setupPanel = document.getElementById('setup-panel');
const boardPanel = document.getElementById('board-panel');
const setupForm = document.getElementById('setup-form');
const configJsonInput = document.getElementById('fb-config-json');

const msgForm = document.getElementById('msg-form');
const msgName = document.getElementById('msg-name');
const msgText = document.getElementById('msg-text');
const notesGrid = document.getElementById('notes-grid');
const memoCount = document.getElementById('memo-count');
const btnChangeConfig = document.getElementById('btn-change-config');

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
            showSection('setup');
        }
    } else {
        showSection('setup');
    }

    // Attach Listeners
    setupForm.addEventListener('submit', handleSaveConfig);
    btnChangeConfig.addEventListener('click', handleEditConfig);
    msgForm.addEventListener('submit', handleAddMemo);
});

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
            <p class="memo-body">${escapeHtml(memo.text)}</p>
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
    const text = msgText.value.trim();
    const color = document.querySelector('input[name="msg-color"]:checked').value;

    if (!nickname || !text || !db) return;

    const submitBtn = msgForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="bi bi-hourglass-split"></i>`;

    try {
        // Save to Firestore
        await addDoc(collection(db, "memos"), {
            nickname: nickname,
            text: text,
            color: color,
            createdAt: serverTimestamp()
        });

        // Clear input message, but keep name for faster next post
        msgText.value = '';
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

// ================= UTILITIES =================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
