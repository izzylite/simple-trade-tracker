import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyCcIgXUCcuWmlmf9Vapvg_wpcQllHQBc-o",
  authDomain: "tradetracker-30ec1.firebaseapp.com",
  projectId: "tradetracker-30ec1",
  storageBucket: "tradetracker-30ec1.firebasestorage.app",
  messagingSenderId: "89378078918",
  appId: "1:89378078918:web:f341f8039c0834247657c7",
  measurementId: "G-GQ8HJCWK7Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

// Initialize App Check
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LdtDHYrAAAAAJQOQhrUoTjaDvC2K6w-1Q83TDpF'),
  isTokenAutoRefreshEnabled: true
});

// For development debugging only
if (process.env.NODE_ENV === 'development') {
  // @ts-expect-error: FIREBASE_APPCHECK_DEBUG_TOKEN is used for local AppCheck debugging
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export { app, analytics, auth, db, storage, functions, appCheck };