const firebaseConfig = {
    apiKey: "AIzaSyAt07lreoZ-R5fo-2dWc8PkGY8tUhKV-fI",
    authDomain: "rps-game-930e4.firebaseapp.com",
    databaseURL: "https://rps-game-930e4-default-rtdb.firebaseio.com",
    projectId: "rps-game-930e4",
    storageBucket: "rps-game-930e4.firebasestorage.app",
    messagingSenderId: "677056813811",
    appId: "1:677056813811:web:d1400848765a25a5c7b586",
    measurementId: "G-E5SS77X98Z"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();