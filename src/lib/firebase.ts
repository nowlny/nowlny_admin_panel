import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB7JZ-yRFNjmC2-urW53da0P8LPIfH69EI",
  authDomain: "nowlnylb-a4630.firebaseapp.com",
  projectId: "nowlnylb-a4630",
  storageBucket: "nowlnylb-a4630.firebasestorage.app",
  messagingSenderId: "995994818411",
  appId: "1:995994818411:web:b59d94338f8b99c6e2de2e",
  measurementId: "G-MF85CBVMHX"
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
      vapidKey: "BHlJMV7uMHHhw4KAteXbK3y4G1Q7z-vJx8vx7te_HP4v3Bz8oJgm2phGNvVLUKv6-Ga9MtRcRxouKFhVCcApoP4",
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
