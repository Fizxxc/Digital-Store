import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';

// Helper function to show alerts
function showAlert(icon, title, text) {
    Swal.fire({
        icon,
        title,
        text,
        timer: 2000,
        showConfirmButton: false
    });
}

// Get all products
async function getAllProducts() {
    try {
        const productsCol = collection(db, 'products');
        const productSnapshot = await getDocs(productsCol);
        return productSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            name: doc.data().name,
            category: doc.data().category,
            price: doc.data().price,
            description: doc.data().description,
            details: doc.data().details || [],
            stock: doc.data().stock || 0
        }));
    } catch (error) {
        console.error("Error getting products:", error);
        return [];
    }
}

// Get products by category
async function getProductsByCategory(category) {
    try {
        const q = query(collection(db, 'products'), where("category", "==", category));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error getting products by category:", error);
        return [];
    }
}

// Get product by ID
async function getProductById(id) {
    try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { 
                id: docSnap.id, 
                name: docSnap.data().name,
                category: docSnap.data().category,
                price: docSnap.data().price,
                description: docSnap.data().description,
                details: docSnap.data().details || [],
                stock: docSnap.data().stock || 0
            };
        }
        return null;
    } catch (error) {
        console.error("Error getting product:", error);
        return null;
    }
}

// Display products on homepage
async function displayProducts() {
    const appProductsContainer = document.getElementById('app-products');
    const serviceProductsContainer = document.getElementById('service-products');
    
    if (!appProductsContainer && !serviceProductsContainer) return;

    try {
        const [apps, services] = await Promise.all([
            getProductsByCategory('app'),
            getProductsByCategory('service')
        ]);

        if (appProductsContainer) {
            appProductsContainer.innerHTML = apps.map(createProductCard).join('');
        }

        if (serviceProductsContainer) {
            serviceProductsContainer.innerHTML = services.map(createProductCard).join('');
        }

        // Add event listeners to all add-to-cart buttons
        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', function() {
                const productId = this.getAttribute('data-id');
                addToCart(productId);
            });
        });
    } catch (error) {
        console.error("Error displaying products:", error);
        showAlert('error', 'Error', 'Gagal memuat produk');
    }
}

// Create product card HTML
function createProductCard(product) {
    return `
        <div class="product-card" data-id="${product.id}">
            <div class="product-icon">
                <i class="fas ${product.category === 'app' ? 'fa-mobile-alt' : 'fa-edit'}"></i>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-meta">
                    <span class="price">Rp ${product.price.toLocaleString()}</span>
                    <span class="category">${product.category === 'app' ? 'Aplikasi' : 'Jasa'}</span>
                </div>
                <p>${product.description.substring(0, 100)}...</p>
                <div class="product-actions">
                    <a href="product-detail.html?id=${product.id}" class="btn">Detail</a>
                    <button class="btn btn-primary add-to-cart" data-id="${product.id}">Beli</button>
                </div>
            </div>
        </div>
    `;
}

// Display product detail
async function displayProductDetail() {
    if (!window.location.pathname.includes('product-detail.html')) return;

    try {
        const productId = new URLSearchParams(window.location.search).get('id');
        if (!productId) throw new Error('Product ID not found');

        const product = await getProductById(productId);
        if (!product) throw new Error('Product not found');

        // Update DOM elements
        document.getElementById('product-title').textContent = product.name;
        document.getElementById('product-price').textContent = `Rp ${product.price.toLocaleString()}`;
        document.getElementById('product-category').textContent = product.category === 'app' ? 'Aplikasi' : 'Jasa';
        document.getElementById('product-description').textContent = product.description;
        
        // Set product icon
        document.getElementById('product-icon').className = `fas ${product.category === 'app' ? 'fa-mobile-alt' : 'fa-edit'}`;

        // Set product details
        const detailsList = document.getElementById('product-details-list');
        detailsList.innerHTML = product.details.map(detail => `<li>${detail}</li>`).join('');

        // Quantity controls
        const qtyInput = document.getElementById('product-qty');
        document.getElementById('increase-qty').addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
        });
        document.getElementById('decrease-qty').addEventListener('click', () => {
            if (parseInt(qtyInput.value) > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
        });

        // Add to cart buttons
        document.getElementById('add-to-cart').addEventListener('click', () => {
            addToCart(product.id, parseInt(qtyInput.value));
        });
        document.getElementById('buy-now').addEventListener('click', () => {
            addToCart(product.id, parseInt(qtyInput.value), true);
        });

        // Display related products
        displayRelatedProducts(product.category, product.id);
    } catch (error) {
        console.error("Error displaying product detail:", error);
        window.location.href = 'index.html';
    }
}

// Display related products
async function displayRelatedProducts(category, excludeId) {
    const container = document.getElementById('related-products');
    if (!container) return;

    try {
        const relatedProducts = (await getProductsByCategory(category))
            .filter(p => p.id !== excludeId)
            .slice(0, 4);

        container.innerHTML = relatedProducts.length > 0 
            ? relatedProducts.map(createProductCard).join('')
            : '<p>Tidak ada produk terkait</p>';
    } catch (error) {
        console.error("Error loading related products:", error);
        container.innerHTML = '<p>Gagal memuat produk terkait</p>';
    }
}

// Add product to cart
async function addToCart(productId, quantity = 1, redirect = false) {
    try {
        const product = await getProductById(productId);
        if (!product) throw new Error('Product not found');
        
        if (product.stock > 0 && product.stock < quantity) {
            throw new Error('Insufficient stock');
        }

        const { auth } = await import('./firebase.js');
        if (!auth.currentUser) {
            showAlert('warning', 'Login Required', 'Please login to add items to cart');
            return;
        }

        await addDoc(collection(db, 'carts'), {
            userId: auth.currentUser.uid,
            productId,
            quantity,
            createdAt: serverTimestamp()
        });

        showAlert('success', 'Success', `${product.name} added to cart`);
        
        if (redirect) {
            setTimeout(() => window.location.href = 'checkout.html', 1500);
        }
    } catch (error) {
        console.error("Error adding to cart:", error);
        showAlert('error', 'Error', error.message || 'Failed to add to cart');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    displayProducts();
    displayProductDetail();
});