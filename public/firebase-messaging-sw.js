importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCKwoxiv3F9zZRLVPwpCUvH8AKmtgOVeUY",
  authDomain: "nowlny.firebaseapp.com",
  projectId: "nowlny",
  storageBucket: "nowlny.firebasestorage.app",
  messagingSenderId: "925474303083",
  appId: "1:925474303083:web:97a0a2bd70de764ce0d52e",
  measurementId: "G-F8VPLNNX09"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.image || '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
