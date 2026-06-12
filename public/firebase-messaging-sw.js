importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB7JZ-yRFNjmC2-urW53da0P8LPIfH69EI",
  authDomain: "nowlnylb-a4630.firebaseapp.com",
  projectId: "nowlnylb-a4630",
  storageBucket: "nowlnylb-a4630.firebasestorage.app",
  messagingSenderId: "995994818411",
  appId: "1:995994818411:web:b59d94338f8b99c6e2de2e",
  measurementId: "G-MF85CBVMHX"
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
