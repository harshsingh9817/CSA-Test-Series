import { initializeFirebase } from "@/firebase";

const { auth, firestore: db } = initializeFirebase();

export { auth, db };
