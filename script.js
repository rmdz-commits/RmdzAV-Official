import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// TAMBAHAN: sendEmailVerification
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, onDisconnect, limitToLast, query as rtdbQuery } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCdtm-NUkdihmIztpecTfAjTOchaGGs_0Q",
  authDomain: "rmdzav-official-pro.firebaseapp.com",
  databaseURL: "https://rmdzav-official-pro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rmdzav-official-pro",
  storageBucket: "rmdzav-official-pro.firebasestorage.app",
  messagingSenderId: "170049951214",
  appId: "1:170049951214:web:b6885229b89bcdb96eaaff",
  measurementId: "G-7TVX813RRZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// --- GLOBAL & SECURITY ---
const _0xSEC = "cmFtb2R6b2ZmaWNpYWxAZ21haWwuY29t"; // Base64 Admin Email
let allProjects = [], uploadDates = [], currentFilter = 'All', currentSort = 'dateDesc', currentSearch = '', myChart;

// --- HELPER ---
function isSuperAdmin(user) {
    if (!user || !user.email) return false;
    return btoa(user.email) === _0xSEC;
}

function maskEmail(email) {
    if(!email) return "user****";
    const parts = email.split('@');
    if(parts.length < 2) return email;
    return `${parts[0].substring(0, 4)}****@${parts[1]}`;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Listeners
    document.addEventListener('click', (e) => {
        if(!e.target.closest('#filterBtn') && !e.target.closest('#filterMenu')) document.getElementById('filterMenu')?.classList.remove('show');
        if(!e.target.closest('#sortBtn') && !e.target.closest('#sortMenu')) document.getElementById('sortMenu')?.classList.remove('show');
        if(!e.target.closest('.avatar-container')) document.getElementById('avatarDropdown')?.classList.remove('show');
    });

    const monthSel = document.getElementById('monthSelector');
    if(monthSel) {
        monthSel.addEventListener('change', () => {
            renderCalendar(); renderGraph();
            const f = document.getElementById('graphFooter');
            if(f) f.innerText = monthSel.options[monthSel.selectedIndex].text;
        });
    }

    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        updateAvatarDropdown(user);
        initChatSystem(user);
    });

    if(document.getElementById('project-container')) { initIndex(); initRealtimeVisitors(); }
    if(document.getElementById('d-title')) { initDetail(); initRealtimeVisitors(); }

    setInterval(() => {
        const m = new Date().getMinutes();
        if (m === 20 || m === 40 || m === 0) { if(document.getElementById('project-container')) initIndex(); }
    }, 60000);
});

// --- FITUR: REGISTER DENGAN LINK VERIFIKASI ---
window.handleRegister = async () => {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const passConf = document.getElementById('regPassConf').value;
    const err = document.getElementById('regError');
    const btn = document.querySelector('#regForm .modal-btn');

    if(!name || !email || !pass || !passConf) { err.innerText = "Isi semua data!"; return; }
    if(pass !== passConf) { err.innerText = "Password tidak cocok!"; return; }
    if(pass.length < 6) { err.innerText = "Password minimal 6 karakter!"; return; }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENDAFTAR...';
    btn.disabled = true;

    try {
        // 1. Buat Akun
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // 2. Update Nickname
        await updateProfile(user, { displayName: name });

        // 3. KIRIM LINK VERIFIKASI KE EMAIL
        await sendEmailVerification(user);

        alert(`Registrasi Berhasil!\n\nKami telah mengirim Link Verifikasi ke: ${email}\n\nSilakan Buka Email Anda dan Klik Link tersebut agar bisa menggunakan Chat.`);
        
        closeRegisterModal();
        window.switchTab('Community'); // Arahkan ke tab community untuk melihat status

    } catch (error) {
        console.error(error);
        if(error.code === 'auth/email-already-in-use') {
            err.innerText = "Email sudah terdaftar! Silakan Login.";
        } else {
            err.innerText = "Error: " + error.message;
        }
    } finally {
        btn.innerHTML = 'DAFTAR SEKARANG <i class="fas fa-user-plus"></i>';
        btn.disabled = false;
    }
}

// Fungsi Resend Link (Jika user kehilangan email)
window.resendVerification = async () => {
    const user = auth.currentUser;
    if(user && !user.emailVerified) {
        try {
            await sendEmailVerification(user);
            alert("Link Verifikasi Baru Telah Dikirim! Cek Inbox/Spam.");
        } catch(e) {
            alert("Terlalu banyak permintaan. Tunggu sebentar.");
        }
    }
}

// Fungsi Reload setelah Verifikasi
window.checkVerificationStatus = async () => {
    const user = auth.currentUser;
    if(user) {
        await user.reload(); // Refresh status user dari Firebase
        if(user.emailVerified) {
            alert("Akun Terverifikasi! Selamat Datang.");
            initChatSystem(user); // Load chat
        } else {
            alert("Email belum diverifikasi. Cek inbox anda.");
        }
    }
}

window.closeRegisterModal = () => {
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPass').value = '';
    document.getElementById('regPassConf').value = '';
    document.getElementById('regError').innerText = '';
}

// --- FITUR: LOGIN & LOGOUT ---
window.handleLogin = async () => {
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        closeLoginModal(); 
    } catch(e) { document.getElementById('loginError').innerText = "Email atau Password Salah."; }
}
window.handleLogout = async () => { await signOut(auth); location.reload(); }

// --- LOGIC CHAT GATEKEEPER (PENTING!) ---
let chatListener = null;

function initChatSystem(user) {
    const gate = document.getElementById('chat-gate');
    const ui = document.getElementById('chat-interface');
    if(!gate || !ui) return;

    // KONDISI 1: User Belum Login
    if(!user) {
        gate.style.display = 'flex';
        ui.style.display = 'none';
        gate.innerHTML = `
            <div class="gate-icon"><i class="fas fa-comments"></i></div>
            <h3>GLOBAL COMMUNITY</h3>
            <p>Bergabunglah dengan diskusi. Silakan Login atau Daftar.</p>
            <div class="gate-actions">
                <button class="btn-gate login" onclick="openLoginModal()">LOG IN</button>
                <button class="btn-gate register" onclick="openRegisterModal()">SIGN UP</button>
            </div>
        `;
        if(chatListener) { chatListener(); chatListener = null; }
        return;
    }

    // KONDISI 2: User Login TAPI Belum Verifikasi Email
    // (Inilah yang mencegah Email Bodong spamming chat)
    if(!user.emailVerified) {
        gate.style.display = 'flex';
        ui.style.display = 'none';
        gate.innerHTML = `
            <div class="gate-icon"><i class="fas fa-envelope-open-text" style="color:#ffcc00"></i></div>
            <h3 style="color:#ffcc00">VERIFIKASI EMAIL</h3>
            <p>Halo <b>${user.displayName}</b>, akun Anda belum aktif.</p>
            <p style="font-size:0.8rem; margin-top:5px;">Cek email <b>${user.email}</b> dan klik link verifikasi.</p>
            
            <div class="gate-actions" style="flex-direction:column; gap:10px;">
                <button class="btn-gate login" onclick="checkVerificationStatus()">
                    <i class="fas fa-sync"></i> SAYA SUDAH VERIFIKASI
                </button>
                <button class="btn-gate register" onclick="resendVerification()">
                    <i class="fas fa-paper-plane"></i> KIRIM ULANG LINK
                </button>
                <button class="text-btn" onclick="handleLogout()" style="background:none; border:none; color:#888; margin-top:10px; cursor:pointer; text-decoration:underline;">
                    Log Out / Ganti Akun
                </button>
            </div>
        `;
        if(chatListener) { chatListener(); chatListener = null; }
        return;
    }

    // KONDISI 3: User Login DAN Terverifikasi (Boleh Chat)
    gate.style.display = 'none';
    ui.style.display = 'flex';
    loadMessages(user);
}

// --- LOGIC LOAD CHAT ---
function loadMessages(currentUser) {
    const msgsBox = document.getElementById('chat-messages');
    if(chatListener) return; 

    const chatRef = rtdbQuery(ref(rtdb, 'global_chat'), limitToLast(50));
    msgsBox.innerHTML = '<p style="text-align:center; color:#555; margin-top:20px; font-size:0.8rem;">Memuat Percakapan...</p>';

    chatListener = onValue(chatRef, (snapshot) => {
        msgsBox.innerHTML = '';
        const data = snapshot.val();
        if(!data) {
             msgsBox.innerHTML = '<p style="text-align:center; color:#555; margin-top:20px;">Belum ada pesan.</p>';
             return;
        }

        Object.values(data).forEach(msg => {
            const isSelf = msg.uid === currentUser.uid;
            const isAdmin = msg.emailEncoded === _0xSEC;
            
            const rawEmail = msg.emailPlain || "anon@user.com";
            const maskedEmail = maskEmail(rawEmail);
            const displayName = msg.sender || "User";

            const div = document.createElement('div');
            div.className = `msg ${isSelf ? 'self' : 'other'} ${isAdmin ? 'admin' : ''} animate-msg`;
            
            const identityHtml = `<span class="chat-identity">${displayName} (${maskedEmail})</span>`;
            const separator = `<span class="chat-identity"> : </span>`;
            const messageHtml = `<span class="chat-content">${msg.text}</span>`;
            
            div.innerHTML = `
                <div class="msg-bubble single-line">
                    ${isAdmin ? '<i class="fas fa-crown" style="color:#ffcc00; margin-right:5px;"></i>' : ''}
                    ${identityHtml}${separator}${messageHtml}
                </div>
            `;
            msgsBox.appendChild(div);
        });
        msgsBox.scrollTop = msgsBox.scrollHeight;
    });
}

window.handleEnter = (e) => { if(e.key === 'Enter') sendMessage(); }
window.sendMessage = async () => {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    const user = auth.currentUser;
    
    // Double Check saat kirim pesan
    if(!user || !user.emailVerified) {
        alert("Anda harus verifikasi email dulu!");
        return;
    }
    if(!text) return;

    const chatRef = ref(rtdb, 'global_chat');
    await push(chatRef, {
        text: text,
        sender: user.displayName || 'Member',
        uid: user.uid,
        emailPlain: user.email, 
        emailEncoded: btoa(user.email), 
        timestamp: Date.now()
    });
    input.value = '';
}

// --- UI HELPERS & REST OF CODE ---
window.toggleAvatarMenu = () => document.getElementById('avatarDropdown').classList.toggle('show');
function updateAvatarDropdown(user) {
    const d = document.getElementById('avatarDropdown');
    let html = '';
    if(user) {
        if(isSuperAdmin(user)) {
             html += `<a href="admin.html" class="dropdown-item" style="color:var(--primary)">ADMIN PANEL</a>`;
             html += `<button class="dropdown-item" onclick="openBackupModal()" style="color:#ffcc00">BACKUP DB</button>`;
        }
        // Tambahkan Status Verifikasi di Menu
        const verifStatus = user.emailVerified ? '<span style="color:#00ff9d">✔</span>' : '<span style="color:red">✖</span>';
        
        html += `<div class="dropdown-item" style="font-size:0.7rem; color:#ccc; cursor:default;">${user.displayName} ${verifStatus}</div>`;
        html += `<button class="dropdown-item" onclick="handleLogout()" style="color:#ff4444">LOG OUT</button>`;
    } else {
        html += `<button class="dropdown-item" onclick="openLoginModal()">LOG IN</button>`;
        html += `<button class="dropdown-item" onclick="openRegisterModal()">SIGN UP</button>`;
    }
    d.innerHTML = html;
}

window.toggleMenu = (id) => document.getElementById(id).classList.toggle('show');
window.toggleSearch = () => {
    const el = document.getElementById('searchContainer');
    el.style.display = (el.style.display==='block')?'none':'block';
    if(el.style.display==='block') document.getElementById('searchInput').focus();
}
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(e=>e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => { 
        if(b.innerText.includes(id.toUpperCase())) b.classList.add('active'); 
    });
    if(id==='Stats') setTimeout(renderGraph, 100);
}

// --- PROJECT DATA LOGIC (ASLI) ---
async function initIndex() {
    const container = document.getElementById('project-container');
    const totalEl = document.getElementById('total-projects');
    try {
        const q = query(collection(db, "projects"));
        const s = await getDocs(q);
        allProjects = []; uploadDates = [];
        s.forEach(doc => {
            const data = doc.data();
            allProjects.push({ id: doc.id, ...data });
            if(data.date) uploadDates.push(data.date);
        });
        totalEl.innerText = allProjects.length;
        renderProjects(); renderCalendar(); renderGraph();
    } catch (e) { console.error(e); }
}

window.handleSearch = (val) => { currentSearch = val.toLowerCase(); if(val) window.switchTab('Project'); renderProjects(); }
window.setFilter = (c, b) => { currentFilter=c; updateActiveMenu('#filterMenu', b); renderProjects(); };
window.setSort = (s, b) => { currentSort=s; updateActiveMenu('#sortMenu', b); renderProjects(); };
function updateActiveMenu(menuId, btn) { document.querySelectorAll(`${menuId} .menu-item`).forEach(x=>x.classList.remove('active')); if(btn) btn.classList.add('active'); }

function renderProjects() {
    const container = document.getElementById('project-container');
    if(!container) return;
    let filtered = allProjects.filter(p => {
        const mCat = currentFilter==='All' || p.category===currentFilter;
        const mSearch = p.title.toLowerCase().includes(currentSearch);
        return mCat && mSearch;
    });
    filtered.sort((a, b) => {
        if(currentSort==='dateDesc') return new Date(b.date)-new Date(a.date);
        if(currentSort==='dateAsc') return new Date(a.date)-new Date(b.date);
        if(currentSort==='nameAsc') return a.title.localeCompare(b.title);
        return 0; 
    });
    if(filtered.length===0) { container.innerHTML = "<p style='color:#888; grid-column:1/-1; text-align:center;'>Tidak ada project ditemukan.</p>"; return; }
    container.innerHTML = filtered.map(p => `
        <div class="project-card">
            <div class="card-img-box">
                <img src="${p.image_url}" class="card-img" onerror="this.src='https://via.placeholder.com/300'">
                <div class="card-overlay">${p.category||'APP'}</div>
            </div>
            <div class="card-title">${p.title}</div>
            <div class="card-sub">${p.date}</div>
            <i class="fa fa-ellipsis-h card-dots"></i>
            <a href="detail.html?id=${p.id}" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2;"></a>
        </div>
    `).join('');
}

// --- CALENDAR & GRAPH ---
function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    const selector = document.getElementById('monthSelector');
    if(!grid || !selector) return;
    const selectedVal = selector.value;
    const [year, month] = selectedVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let html = '';
    for(let i=1; i<=daysInMonth; i++) {
        let d = i < 10 ? `0${i}` : `${i}`;
        let fullDate = `${selectedVal}-${d}`;
        let active = uploadDates.includes(fullDate) ? 'active' : '';
        html += `<div class="cal-day ${active}">${i}</div>`;
    }
    grid.innerHTML = html;
}

function renderGraph() {
    const ctx = document.getElementById('uploadChart');
    const selector = document.getElementById('monthSelector');
    if(!ctx || !selector) return;
    const selectedVal = selector.value;
    const [year, month] = selectedVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyCounts = Array(daysInMonth).fill(0);
    const labels = Array.from({length: daysInMonth}, (_,i) => i+1);
    uploadDates.forEach(dateStr => {
        if(dateStr.startsWith(selectedVal)) {
            const day = parseInt(dateStr.split('-')[2]);
            if(day >= 1 && day <= daysInMonth) dailyCounts[day-1]++;
        }
    });
    const maxVal = Math.max(...dailyCounts);
    const yMax = (maxVal === 0) ? 2 : maxVal + 1;
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: dailyCounts,
                borderColor: '#00ff9d',
                backgroundColor: 'rgba(0, 255, 157, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: {display:false} },
            scales: { x: { display: false }, y: { display: false, min: 0, max: yMax } }
        }
    });
}

// --- DETAIL, BACKUP, VISUALS ---
async function initDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if(!id) { location.href='index.html'; return; }
    const docRef = doc(db, "projects", id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        const data = snap.data();
        document.getElementById('d-title').innerText = `${data.title} : ${data.category||'APP'}`;
        document.getElementById('d-img').src = data.image_url;
        const tbody = document.getElementById('file-tbody');
        if(data.files) {
            tbody.innerHTML = data.files.map(f => {
                const isPaid = f.status.toLowerCase() !== 'free';
                const style = isPaid ? 'status-paid' : '';
                const btnText = (f.link && f.link.includes('password')) ? 'UNLOCK' : 'DOWNLOAD';
                return `<tr><td>${f.name}</td><td>${f.size}</td><td>${f.note}</td><td class="${style}">${f.status}</td><td><button class="dl-btn" onclick="startDL(this, '${f.link}')">${btnText}</button></td></tr>`;
            }).join('');
        }
    } else { alert("Project not found."); location.href='index.html'; }
}

window.startDL = (btn, url) => {
    // Jika link adalah fitur unlock password
    if (url === 'unlock' || url.includes('rz-password')) {
        window.open(url, '_blank');
        return;
    }

    // Jika tombol sedang loading, abaikan
    if (btn.classList.contains('counting') || btn.classList.contains('ready')) return;

    // Efek Hitung Mundur Simple
    let count = 3; // Cukup 3 detik biar gak kelamaan nunggu
    btn.classList.add('counting');
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${count}`;
    
    let t = setInterval(() => {
        count--;
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${count}`;
        
        if(count <= 0) {
            clearInterval(t);
            btn.classList.remove('counting');
            btn.classList.add('ready');
            btn.innerHTML = `<i class="fas fa-external-link-alt"></i> OPENING...`;
            
            // LANGSUNG BUKA LINK (Yaitu Bicolink)
            setTimeout(() => {
                window.open(url, '_blank');
                // Reset tombol setelah dibuka
                setTimeout(() => {
                    btn.classList.remove('ready');
                    btn.innerHTML = `<i class="fas fa-download"></i> DOWNLOAD`;
                }, 2000);
            }, 500);
        }
    }, 1000);
}

window.openBackupModal = () => document.getElementById('backupModal').style.display = 'flex';
window.closeBackupModal = () => document.getElementById('backupModal').style.display = 'none';
window.handleBackup = async () => {
    const email = document.getElementById('backupEmail').value;
    const pass = document.getElementById('backupPass').value;
    const errText = document.getElementById('backupError');
    if(!email || !pass) { errText.innerText = "Isi kredensial Admin!"; return; }
    if(btoa(email) !== _0xSEC) { errText.innerText = "Hanya Admin Utama yang berhak backup!"; return; }
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        const q = query(collection(db, "projects"));
        const snapshot = await getDocs(q);
        const backupData = [];
        snapshot.forEach(doc => { backupData.push({ _id: doc.id, ...doc.data() }); });
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        alert("Backup Downloaded!"); closeBackupModal();
    } catch (error) { errText.innerText = "Gagal: " + error.message; }
}

window.openLoginModal = () => document.getElementById('loginModal').style.display = 'flex';
window.closeLoginModal = () => document.getElementById('loginModal').style.display = 'none';
window.openRegisterModal = () => document.getElementById('registerModal').style.display = 'flex';

function initRealtimeVisitors() {
    const visitorEl = document.getElementById('visitors');
    if (!visitorEl) return;

    let deviceId = null;

    // COBA AKSES LOCALSTORAGE (Biasanya Error di WebView jika belum diaktifkan)
    try {
        deviceId = localStorage.getItem('unique_device_id');
        if (!deviceId) {
            deviceId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('unique_device_id', deviceId);
        }
    } catch (e) {
        console.warn("LocalStorage tidak aktif di WebView ini. Menggunakan ID Sementara.");
        // Fallback: Jika LocalStorage error, pakai ID sementara (hilang saat app ditutup)
        deviceId = 'guest_' + Math.random().toString(36).substr(2, 9);
    }

    // LOGIKA DATABASE
    const myStatusRef = ref(rtdb, 'visitors/' + deviceId);
    const connectedRef = ref(rtdb, '.info/connected');

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            // Kita set status online
            set(myStatusRef, {
                state: 'online',
                last_changed: Date.now(),
                platform: navigator.userAgent.includes('wv') ? 'WebView' : 'Browser' // Deteksi WebView
            });

            // Hapus data jika koneksi putus (tutup aplikasi)
            onDisconnect(myStatusRef).remove();
        }
    });

    // HITUNG JUMLAH PENGUNJUNG
    onValue(ref(rtdb, 'visitors'), (snap) => {
        visitorEl.innerText = snap.exists() ? snap.size : 0;
    });
}

function initNeonWorms() {
    const cvs = document.getElementById('worm-canvas') || document.createElement('canvas');
    if(!cvs.id) { cvs.id = 'worm-canvas'; document.body.appendChild(cvs); }
    const ctx = cvs.getContext('2d');
    let width, height;
    function resize() { width = cvs.width = window.innerWidth; height = cvs.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    class Worm {
        constructor() { this.reset(); }
        reset() { this.x = Math.random() * width; this.y = Math.random() * height; this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2; this.history = []; this.len = 20; }
        update() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>width)this.vx*=-1; if(this.y<0||this.y>height)this.vy*=-1; this.history.unshift({x:this.x,y:this.y}); if(this.history.length>this.len)this.history.pop(); }
        draw() { ctx.beginPath(); if(this.history.length>0)ctx.moveTo(this.history[0].x,this.history[0].y); this.history.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.strokeStyle='#00ff9d'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); }
    }
    const worms = Array.from({length:6}, ()=>new Worm());
    function animate() { ctx.clearRect(0,0,width,height); worms.forEach(w=>{w.update(); w.draw();}); requestAnimationFrame(animate); }
    animate();
}
initNeonWorms();
