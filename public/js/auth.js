import { auth } from './firebase.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import { 
  doc, 
  setDoc, 
  getDoc 
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';
import { db } from './firebase.js';

// Deklarasikan currentUser sebagai variabel global
let currentUser = null;

// Fungsi untuk menampilkan notifikasi
function showAlert(icon, title, text) {
    Swal.fire({
        icon,
        title,
        text,
        timer: 2000,
        showConfirmButton: false
    });
}

// Fungsi untuk menambahkan user ke Firestore
async function addUserToFirestore(uid, name, email) {
    try {
        await setDoc(doc(db, "users", uid), {
            name,
            email,
            role: "user",
            joinDate: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error("Error adding user to Firestore:", error);
        return false;
    }
}

// Fungsi untuk mengecek role admin
async function checkAdminRole(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        return userDoc.exists() && userDoc.data().role === "admin";
    } catch (error) {
        console.error("Error checking admin role:", error);
        return false;
    }
}

// Cek status login saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // Update current user
        
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = user ? 'Logout' : 'Login';
            loginBtn.href = user ? '#' : 'login.html';
        }

        if (user) {
            // Cek apakah user admin
            const isAdmin = await checkAdminRole(user.uid);
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn) {
                adminBtn.style.display = isAdmin ? 'block' : 'none';
            }

            // Redirect admin ke halaman admin jika di halaman login/register
            if (isAdmin && (window.location.pathname.includes('login.html') || 
                           window.location.pathname.includes('register.html'))) {
                window.location.href = 'admin.html';
            }
        } else {
            // Redirect ke login jika mencoba akses admin tanpa login
            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'login.html';
            }
        }
    });
});

// Login Form
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = loginForm.querySelector('button[type="submit"]');
        
        try {
            // Tampilkan loading state
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const isAdmin = await checkAdminRole(user.uid);

            showAlert('success', 'Login Berhasil', 'Anda akan diarahkan...');
            
            setTimeout(() => {
                window.location.href = isAdmin ? 'admin.html' : 'index.html';
            }, 1500);
        } catch (error) {
            let errorMessage = 'Login Gagal';
            
            switch(error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Email tidak valid';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Akun dinonaktifkan';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage = 'Email atau password salah';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            showAlert('error', 'Login Gagal', errorMessage);
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });
}

// Register Form
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const registerBtn = registerForm.querySelector('button[type="submit"]');
        
        // Validasi
        if (password !== confirmPassword) {
            showAlert('error', 'Registrasi Gagal', 'Password tidak cocok');
            return;
        }
        
        if (password.length < 6) {
            showAlert('error', 'Registrasi Gagal', 'Password minimal 6 karakter');
            return;
        }
        
        try {
            // Tampilkan loading state
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat akun...';
            
            // Buat user di Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Tambahkan data user ke Firestore
            const success = await addUserToFirestore(user.uid, name, email);
            
            if (success) {
                showAlert('success', 'Registrasi Berhasil', 'Akun Anda berhasil dibuat');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                throw new Error('Gagal menyimpan data tambahan pengguna');
            }
        } catch (error) {
            let errorMessage = 'Registrasi Gagal';
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email sudah terdaftar';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email tidak valid';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password terlalu lemah';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            showAlert('error', 'Registrasi Gagal', errorMessage);
            registerBtn.disabled = false;
            registerBtn.textContent = 'Daftar';
        }
    });
}

// Logout
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                showAlert('error', 'Logout Gagal', error.message);
            }
        });
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn && currentUser) {
        loginBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (error) {
                showAlert('error', 'Logout Gagal', error.message);
            }
        });
    }
}

// Panggil setup logout saat halaman dimuat
document.addEventListener('DOMContentLoaded', setupLogout);