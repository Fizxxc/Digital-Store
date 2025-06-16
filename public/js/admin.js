import { db } from './firebase.js';
import { 
    collection, getDocs, doc, getDoc,
    addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Global variables
let currentEditingProductId = null;
let currentEditingOrderId = null;
let currentEditingUserId = null;

// Helper function to show alerts
function showAlert(icon, title, text, timer = 2000) {
    Swal.fire({
        icon,
        title,
        text,
        timer,
        showConfirmButton: false
    });
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    if (!window.location.pathname.includes('admin.html')) return;

    // Load initial data
    loadDashboardData();
    loadProducts();
    loadOrders();
    loadUsers();

    // Setup navigation
    setupAdminNavigation();

    // Setup modals
    setupProductModal();
    setupOrderModal();
    setupUserModal();

    // Setup search functionality
    setupSearch();
});

// Dashboard functions
async function loadDashboardData() {
    try {
        const [usersSnapshot, productsSnapshot, ordersSnapshot] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "products")),
            getDocs(collection(db, "orders"))
        ]);

        // Calculate total revenue
        let totalRevenue = 0;
        ordersSnapshot.forEach(doc => {
            totalRevenue += doc.data().total || 0;
        });

        // Update UI
        document.getElementById('total-users').textContent = usersSnapshot.size;
        document.getElementById('total-products').textContent = productsSnapshot.size;
        document.getElementById('total-orders').textContent = ordersSnapshot.size;
        document.getElementById('total-revenue').textContent = `Rp ${totalRevenue.toLocaleString()}`;

        // Load recent orders
        loadRecentOrders();
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        showAlert('error', 'Error', 'Gagal memuat data dashboard');
    }
}

async function loadRecentOrders() {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('recent-orders-table').querySelector('tbody');
        tbody.innerHTML = '';

        for (const orderDoc of querySnapshot.docs) {
            const order = orderDoc.data();
            const [productDoc, userDoc] = await Promise.all([
                getDoc(doc(db, "products", order.productId)),
                getDoc(doc(db, "users", order.userId))
            ]);

            tbody.innerHTML += `
                <tr>
                    <td>#${orderDoc.id.substring(0, 8)}</td>
                    <td>${productDoc.exists() ? productDoc.data().name : 'Produk dihapus'}</td>
                    <td>${userDoc.exists() ? userDoc.data().name : 'Pengguna dihapus'}</td>
                    <td>Rp ${order.total.toLocaleString()}</td>
                    <td><span class="status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${orderDoc.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </td>
                </tr>
            `;
        }

        // Add event listeners to edit buttons
        document.querySelectorAll('#recent-orders-table .edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditOrderModal(btn.dataset.id));
        });
    } catch (error) {
        console.error("Error loading recent orders:", error);
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'completed': 'Selesai',
        'cancelled': 'Dibatalkan'
    };
    return statusMap[status] || status;
}

// Product management functions
async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const tbody = document.getElementById('products-table').querySelector('tbody');
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            tbody.innerHTML += createProductRow(doc.id, product);
        });

        // Add event listeners to action buttons
        addProductActionListeners();
    } catch (error) {
        console.error("Error loading products:", error);
        showAlert('error', 'Error', 'Gagal memuat daftar produk');
    }
}

function createProductRow(id, product) {
    const iconClass = product.category === 'app' ? 'fa-mobile-alt' : 'fa-edit';
    return `
        <tr data-id="${id}">
            <td><i class="fas ${iconClass}"></i></td>
            <td>${product.name}</td>
            <td>${product.category === 'app' ? 'Aplikasi' : 'Jasa'}</td>
            <td>Rp ${product.price.toLocaleString()}</td>
            <td>${product.stock === -1 ? 'Unlimited' : product.stock}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete-btn" data-id="${id}">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        </tr>
    `;
}

function addProductActionListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteProductHandler(btn.dataset.id));
    });
}

async function openEditProductModal(productId) {
    try {
        currentEditingProductId = productId;
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Produk tidak ditemukan');
        }

        const product = docSnap.data();
        const modal = document.getElementById('product-modal');

        // Fill form
        document.getElementById('product-id').value = productId;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-description').value = product.description;

        // Fill details
        const detailsContainer = document.getElementById('product-details-container');
        detailsContainer.innerHTML = '';
        (product.details || []).forEach(detail => {
            addDetailInput(detail);
        });

        // Update modal title
        document.getElementById('modal-title').textContent = 'Edit Produk';
        modal.style.display = 'block';
    } catch (error) {
        console.error("Error opening edit modal:", error);
        showAlert('error', 'Error', error.message);
    }
}

function setupProductModal() {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');

    // Close modal buttons
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    // Add detail button
    document.getElementById('add-detail-btn').addEventListener('click', () => {
        addDetailInput();
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProduct();
    });

    // Close when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function addDetailInput(value = '') {
    const container = document.getElementById('product-details-container');
    const div = document.createElement('div');
    div.className = 'detail-input';
    div.innerHTML = `
        <input type="text" class="product-detail" value="${value}" placeholder="Fitur produk">
        <button type="button" class="remove-detail-btn"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);

    // Add event to remove button
    div.querySelector('.remove-detail-btn').addEventListener('click', () => {
        div.remove();
    });
}

async function saveProduct() {
    const form = document.getElementById('product-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const productId = document.getElementById('product-id').value;

    try {
        // Get form values
        const name = document.getElementById('product-name').value.trim();
        const category = document.getElementById('product-category').value;
        const price = Number(document.getElementById('product-price').value);
        const stock = Number(document.getElementById('product-stock').value);
        const description = document.getElementById('product-description').value.trim();
        
        // Get details
        const details = [];
        document.querySelectorAll('.product-detail').forEach(input => {
            if (input.value.trim()) {
                details.push(input.value.trim());
            }
        });

        // Validate
        if (!name || !category || isNaN(price) || isNaN(stock) || !description) {
            throw new Error('Harap isi semua field yang wajib diisi');
        }

        if (details.length === 0) {
            throw new Error('Harap tambahkan minimal 1 detail produk');
        }

        // Prepare product data
        const productData = {
            name,
            category,
            price,
            stock,
            description,
            details,
            updatedAt: serverTimestamp()
        };

        // Disable button during save
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

        // Save to Firestore
        if (productId) {
            // Update existing product
            await updateDoc(doc(db, "products", productId), productData);
            showAlert('success', 'Berhasil', 'Produk berhasil diperbarui');
        } else {
            // Add new product
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, "products"), productData);
            showAlert('success', 'Berhasil', 'Produk baru berhasil ditambahkan');
        }

        // Refresh products list
        loadProducts();
        
        // Close modal
        modal.style.display = 'none';
    } catch (error) {
        console.error("Error saving product:", error);
        showAlert('error', 'Error', error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Produk';
    }
}

async function deleteProductHandler(productId) {
    try {
        const result = await Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Produk yang dihapus tidak dapat dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            await deleteDoc(doc(db, "products", productId));
            showAlert('success', 'Berhasil', 'Produk berhasil dihapus');
            loadProducts();
        }
    } catch (error) {
        console.error("Error deleting product:", error);
        showAlert('error', 'Error', 'Gagal menghapus produk');
    }
}

// Order management functions
async function loadOrders() {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('orders-table').querySelector('tbody');
        tbody.innerHTML = '';

        for (const orderDoc of querySnapshot.docs) {
            const order = orderDoc.data();
            const [productDoc, userDoc] = await Promise.all([
                getDoc(doc(db, "products", order.productId)),
                getDoc(doc(db, "users", order.userId))
            ]);

            const orderDate = order.createdAt?.toDate() || new Date();
            const formattedDate = orderDate.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            tbody.innerHTML += `
                <tr data-id="${orderDoc.id}">
                    <td>#${orderDoc.id.substring(0, 8)}</td>
                    <td>${productDoc.exists() ? productDoc.data().name : 'Produk dihapus'}</td>
                    <td>${userDoc.exists() ? userDoc.data().name : 'Pengguna dihapus'}</td>
                    <td>${formattedDate}</td>
                    <td>Rp ${order.total.toLocaleString()}</td>
                    <td><span class="status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${orderDoc.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="${orderDoc.id}">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        }

        // Add event listeners
        addOrderActionListeners();
    } catch (error) {
        console.error("Error loading orders:", error);
        showAlert('error', 'Error', 'Gagal memuat daftar pesanan');
    }
}

function addOrderActionListeners() {
    // Edit buttons
    document.querySelectorAll('#orders-table .edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditOrderModal(btn.dataset.id));
    });

    // Delete buttons
    document.querySelectorAll('#orders-table .delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteOrderHandler(btn.dataset.id));
    });
}

async function openEditOrderModal(orderId) {
    try {
        currentEditingOrderId = orderId;
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Pesanan tidak ditemukan');
        }

        const order = docSnap.data();
        const [productDoc, userDoc] = await Promise.all([
            getDoc(doc(db, "products", order.productId)),
            getDoc(doc(db, "users", order.userId))
        ]);

        const modal = document.getElementById('order-modal');

        // Fill form
        document.getElementById('order-id').value = orderId;
        document.getElementById('order-id-display').textContent = `#${orderId.substring(0, 8)}`;
        document.getElementById('order-product').textContent = productDoc.exists() ? productDoc.data().name : 'Produk dihapus';
        document.getElementById('order-customer').textContent = userDoc.exists() ? userDoc.data().name : 'Pengguna dihapus';
        document.getElementById('order-total').textContent = `Rp ${order.total.toLocaleString()}`;
        document.getElementById('order-status').value = order.status;

        // Update modal title
        document.getElementById('order-modal-title').textContent = 'Edit Pesanan';
        modal.style.display = 'block';
    } catch (error) {
        console.error("Error opening order modal:", error);
        showAlert('error', 'Error', error.message);
    }
}

function setupOrderModal() {
    const modal = document.getElementById('order-modal');
    const form = document.getElementById('order-form');

    // Close modal buttons
    document.querySelectorAll('#order-modal .close-modal, #order-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOrder();
    });

    // Close when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

async function saveOrder() {
    const form = document.getElementById('order-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const orderId = document.getElementById('order-id').value;

    try {
        const status = document.getElementById('order-status').value;

        // Validate
        if (!status) {
            throw new Error('Harap pilih status pesanan');
        }

        // Prepare order data
        const orderData = {
            status,
            updatedAt: serverTimestamp()
        };

        // Disable button during save
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

        // Update order
        await updateDoc(doc(db, "orders", orderId), orderData);
        showAlert('success', 'Berhasil', 'Status pesanan berhasil diperbarui');

        // Refresh orders list
        loadOrders();
        loadRecentOrders();
        
        // Close modal
        document.getElementById('order-modal').style.display = 'none';
    } catch (error) {
        console.error("Error saving order:", error);
        showAlert('error', 'Error', error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Perubahan';
    }
}

async function deleteOrderHandler(orderId) {
    try {
        const result = await Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Pesanan yang dihapus tidak dapat dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            await deleteDoc(doc(db, "orders", orderId));
            showAlert('success', 'Berhasil', 'Pesanan berhasil dihapus');
            loadOrders();
            loadRecentOrders();
        }
    } catch (error) {
        console.error("Error deleting order:", error);
        showAlert('error', 'Error', 'Gagal menghapus pesanan');
    }
}

// User management functions
async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const tbody = document.getElementById('users-table').querySelector('tbody');
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const joinDate = user.createdAt?.toDate() || new Date();
            const formattedDate = joinDate.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            tbody.innerHTML += `
                <tr data-id="${doc.id}">
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${formattedDate}</td>
                    <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${doc.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        ${doc.id !== currentUser?.uid ? `
                        <button class="action-btn delete-btn" data-id="${doc.id}">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        // Add event listeners
        addUserActionListeners();
    } catch (error) {
        console.error("Error loading users:", error);
        showAlert('error', 'Error', 'Gagal memuat daftar pengguna');
    }
}

function addUserActionListeners() {
    // Edit buttons
    document.querySelectorAll('#users-table .edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditUserModal(btn.dataset.id));
    });

    // Delete buttons
    document.querySelectorAll('#users-table .delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUserHandler(btn.dataset.id));
    });
}

async function openEditUserModal(userId) {
    try {
        currentEditingUserId = userId;
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Pengguna tidak ditemukan');
        }

        const user = docSnap.data();
        const modal = document.getElementById('user-modal');

        // Fill form
        document.getElementById('user-id').value = userId;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-role').value = user.role || 'user';

        // Update modal title
        document.getElementById('user-modal-title').textContent = 'Edit Pengguna';
        modal.style.display = 'block';
    } catch (error) {
        console.error("Error opening user modal:", error);
        showAlert('error', 'Error', error.message);
    }
}

function setupUserModal() {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');

    // Close modal buttons
    document.querySelectorAll('#user-modal .close-modal, #user-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });

    // Close when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

async function saveUser() {
    const form = document.getElementById('user-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const userId = document.getElementById('user-id').value;

    try {
        const name = document.getElementById('user-name').value.trim();
        const role = document.getElementById('user-role').value;

        // Validate
        if (!name || !role) {
            throw new Error('Harap isi semua field yang wajib diisi');
        }

        // Prepare user data
        const userData = {
            name,
            role,
            updatedAt: serverTimestamp()
        };

        // Disable button during save
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

        // Update user
        await updateDoc(doc(db, "users", userId), userData);
        showAlert('success', 'Berhasil', 'Data pengguna berhasil diperbarui');

        // Refresh users list
        loadUsers();
        
        // Close modal
        document.getElementById('user-modal').style.display = 'none';
    } catch (error) {
        console.error("Error saving user:", error);
        showAlert('error', 'Error', error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Perubahan';
    }
}

async function deleteUserHandler(userId) {
    try {
        const result = await Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Pengguna yang dihapus tidak dapat dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            // Delete user data from Firestore
            await deleteDoc(doc(db, "users", userId));
            
            // Note: In a real app, you might also want to delete the user's auth record
            // But that requires admin privileges on Firebase Auth
            
            showAlert('success', 'Berhasil', 'Pengguna berhasil dihapus');
            loadUsers();
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        showAlert('error', 'Error', 'Gagal menghapus pengguna');
    }
}

// Navigation and UI setup
function setupAdminNavigation() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active state
            document.querySelectorAll('.sidebar-nav a').forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add('active');
            
            // Show selected section
            const sectionId = this.dataset.section + '-section';
            document.querySelectorAll('.admin-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(sectionId).style.display = 'block';
            
            // Update title
            document.getElementById('admin-title').textContent = this.textContent.trim();
        });
    });

    // Add product button
    document.getElementById('add-product-btn').addEventListener('click', () => {
        currentEditingProductId = null;
        document.getElementById('product-form').reset();
        document.getElementById('product-details-container').innerHTML = '';
        addDetailInput();
        document.getElementById('modal-title').textContent = 'Tambah Produk Baru';
        document.getElementById('product-modal').style.display = 'block';
    });

    // Refresh buttons
    document.getElementById('refresh-products-btn')?.addEventListener('click', loadProducts);
    document.getElementById('refresh-orders-btn')?.addEventListener('click', loadOrders);
    document.getElementById('refresh-users-btn')?.addEventListener('click', loadUsers);
}

function setupSearch() {
    const searchInput = document.getElementById('admin-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim().toLowerCase();
        
        // Implement search logic based on current section
        const activeSection = document.querySelector('.sidebar-nav a.active')?.dataset.section;
        
        if (activeSection === 'products') {
            await searchProducts(searchTerm);
        } else if (activeSection === 'orders') {
            await searchOrders(searchTerm);
        } else if (activeSection === 'users') {
            await searchUsers(searchTerm);
        }
    });
}

async function searchProducts(searchTerm) {
    try {
        const productsCol = collection(db, 'products');
        const querySnapshot = await getDocs(productsCol);
        const tbody = document.getElementById('products-table').querySelector('tbody');
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const productName = product.name.toLowerCase();
            const productDesc = product.description.toLowerCase();

            if (productName.includes(searchTerm) || productDesc.includes(searchTerm)) {
                tbody.innerHTML += createProductRow(doc.id, product);
            }
        });

        addProductActionListeners();
    } catch (error) {
        console.error("Error searching products:", error);
    }
}

async function searchOrders(searchTerm) {
    try {
        const ordersCol = collection(db, 'orders');
        const querySnapshot = await getDocs(ordersCol);
        const tbody = document.getElementById('orders-table').querySelector('tbody');
        tbody.innerHTML = '';

        for (const orderDoc of querySnapshot.docs) {
            const order = orderDoc.data();
            const [productDoc, userDoc] = await Promise.all([
                getDoc(doc(db, "products", order.productId)),
                getDoc(doc(db, "users", order.userId))
            ]);

            const productName = productDoc.exists() ? productDoc.data().name.toLowerCase() : '';
            const userName = userDoc.exists() ? userDoc.data().name.toLowerCase() : '';
            const orderId = orderDoc.id.toLowerCase();

            if (orderId.includes(searchTerm) || productName.includes(searchTerm) || userName.includes(searchTerm)) {
                const orderDate = order.createdAt?.toDate() || new Date();
                const formattedDate = orderDate.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                tbody.innerHTML += `
                    <tr data-id="${orderDoc.id}">
                        <td>#${orderDoc.id.substring(0, 8)}</td>
                        <td>${productDoc.exists() ? productDoc.data().name : 'Produk dihapus'}</td>
                        <td>${userDoc.exists() ? userDoc.data().name : 'Pengguna dihapus'}</td>
                        <td>${formattedDate}</td>
                        <td>Rp ${order.total.toLocaleString()}</td>
                        <td><span class="status-${order.status}">${getStatusText(order.status)}</span></td>
                        <td>
                            <button class="action-btn edit-btn" data-id="${orderDoc.id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="action-btn delete-btn" data-id="${orderDoc.id}">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        </td>
                    </tr>
                `;
            }
        }

        addOrderActionListeners();
    } catch (error) {
        console.error("Error searching orders:", error);
    }
}

async function searchUsers(searchTerm) {
    try {
        const usersCol = collection(db, 'users');
        const querySnapshot = await getDocs(usersCol);
        const tbody = document.getElementById('users-table').querySelector('tbody');
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const userName = user.name.toLowerCase();
            const userEmail = user.email.toLowerCase();

            if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
                const joinDate = user.createdAt?.toDate() || new Date();
                const formattedDate = joinDate.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                tbody.innerHTML += `
                    <tr data-id="${doc.id}">
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${formattedDate}</td>
                        <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
                        <td>
                            <button class="action-btn edit-btn" data-id="${doc.id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            ${doc.id !== currentUser?.uid ? `
                            <button class="action-btn delete-btn" data-id="${doc.id}">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }
        });

        addUserActionListeners();
    } catch (error) {
        console.error("Error searching users:", error);
    }
}

// Initialize logout button
document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const { auth } = await import('./firebase.js');
        const { signOut } = await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js');
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error logging out:", error);
        showAlert('error', 'Error', 'Gagal logout');
    }
});