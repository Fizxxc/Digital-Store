import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

// Konfigurasi Firebase Anda
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyACkIZUx50LbxfgvW606eLaD6XhwNxIOuM",
  authDomain: "memberr-card.firebaseapp.com",
  databaseURL: "https://memberr-card-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "memberr-card",
  storageBucket: "memberr-card.firebasestorage.app",
  messagingSenderId: "532758260849",
  appId: "1:532758260849:web:309f8d8db5df773e64ffd0",
  measurementId: "G-CRH5Z9NQ6S"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Inisialisasi layanan Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export semua fungsi yang diperlukan
export {
  app,
  analytics,
  auth,
  db,
  storage,
  // Auth functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  // Firestore functions
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  // Storage functions
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};