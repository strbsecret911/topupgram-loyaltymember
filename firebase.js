import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_NiR3Z-CoBn87f5UVKsP7rWTo0R8BJ8g",
  authDomain: "topupgramloyalty.firebaseapp.com",
  projectId: "topupgramloyalty",
  storageBucket: "topupgramloyalty.firebasestorage.app",
  messagingSenderId: "844269587396",
  appId: "1:844269587396:web:912aafe0d7fa7405bff291",
  measurementId: "G-CPZ72XENLV"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export async function adminLogin(){
  return signInWithPopup(auth, provider);
}
export async function adminLogout(){
  return signOut(auth);
}
