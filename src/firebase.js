import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyC4unZEgEtrwYjiQM0tbSMU5Ql3oQaTIi0",
    authDomain: "chat-us-d889d.firebaseapp.com",
    projectId: "chat-us-d889d",
    storageBucket: "chat-us-d889d.firebasestorage.app",
    messagingSenderId: "374869790470",
    appId: "1:374869790470:web:54a3875bebca830f92d887",
    measurementId: "G-9SQXGYXF0X"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
