import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsnN1B5e86MEsmd4nAoyArD-n82giWYvM",
  authDomain: "ksandramas.firebaseapp.com",
  databaseURL: "https://ksandramas-default-rtdb.firebaseio.com",
  projectId: "ksandramas",
  storageBucket: "ksandramas.firebasestorage.app",
  messagingSenderId: "1078253543292",
  appId: "1:1078253543292:web:f851e2020529fe6bd04ef9",
  measurementId: "G-7BX3SQFJBF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);