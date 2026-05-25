import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCKwoxiv3F9zZRLVPwpCUvH8AKmtgOVeUY",
  authDomain: "nowlny.firebaseapp.com",
  projectId: "nowlny",
  storageBucket: "nowlny.firebasestorage.app",
  messagingSenderId: "925474303083",
  appId: "1:925474303083:web:97a0a2bd70de764ce0d52e",
  measurementId: "G-F8VPLNNX09"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const messaging = async () => {
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};

export const fetchToken = async () => {
  try {
    const msg = await messaging();
    if (!msg) return null;
    return await getToken(msg, {
      vapidKey: "BK49omqD9s1sk0QoFoV7_gOT7Nxs8tqXA9vNKpMrvmWDu2TxxiAlXhhS2w3CylkbbiSjEuUrLlB3LGVvWTQxtf8",
    });
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
    return null;
  }
};

export const onMessageListener = async () => {
  const msg = await messaging();
  if (!msg) return;
  return new Promise((resolve) => {
    onMessage(msg, (payload) => {
      resolve(payload);
    });
  });
};
