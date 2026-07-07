// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = { 
  apiKey : "AIzaSyBZWrzxjhV0PpcrqWXPLeIikS8IRd_CJyg" , 
  authDomain : "hrm-system-2cd50.firebaseapp.com" , 
  projectId : "hrm-system-2cd50" , 
  storageBucket : "hrm-system-2cd50.firebasestorage.app" , 
  messagingSenderId : "603988307102" , 
  appId : "1:603988307102:web:cfd06ea912ab07ebc11f8f" , 
  measurementId : "G-YN81ZJCWRF" 
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);   // Xuất 'db' để các file khác sử dụng
export const auth = getAuth(app);      // Xuất 'auth' cho đăng nhập/phân quyền thật qua Firebase Authentication
