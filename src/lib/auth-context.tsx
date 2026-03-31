
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceLogoutHandled, setForceLogoutHandled] = useState(false);
  const [localSessionId] = useState(() => Math.random().toString(36).substring(7));
  const router = useRouter();

  const logout = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const sessionRef = doc(db, "userSessions", currentUser.uid);
      try {
        // Only mark inactive if it's our session
        const snap = await getDoc(sessionRef);
        if (snap.exists() && snap.data().sessionId === localSessionId) {
          await updateDoc(sessionRef, { isActive: false, lastActive: Date.now() });
        }
      } catch (e) {
        // Handle potential permission errors
      }
    }
    await signOut(auth);
    setUser(null);
    setUserData(null);
    router.push("/login");
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeSession: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSession) unsubscribeSession();

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);

        // Single Session Enforcement: Listen for session changes
        const sessionRef = doc(db, "userSessions", firebaseUser.uid);
        unsubscribeSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists()) {
            const sessionData = snap.data();
            
            // Check if another device logged in (sessionId mismatch) or admin terminated
            const isTerminated = sessionData.isActive === false;
            const isNewSessionElsewhere = sessionData.sessionId && sessionData.sessionId !== localSessionId;

            if ((isTerminated || isNewSessionElsewhere) && !forceLogoutHandled) {
              setForceLogoutHandled(true);
              logout();
              if (isNewSessionElsewhere) {
                alert("You have been logged out because a new login was detected on another device.");
              } else {
                alert("Your session has been terminated by an administrator.");
              }
            }
          }
        });

        // Fetch User Profile
        const adminRef = doc(db, "admins", firebaseUser.uid);
        unsubscribeProfile = onSnapshot(adminRef, (adminSnap) => {
          if (adminSnap.exists()) {
            const data = { ...adminSnap.data(), role: "admin", id: firebaseUser.uid };
            setUserData(data);
            setLoading(false);
            syncSession(firebaseUser.uid, "admin", data.name, firebaseUser.email);
          } else {
            const email = firebaseUser.email || "";
            if (email.toLowerCase().endsWith("@csa.com")) {
              const regId = email.split("@")[0].toUpperCase();
              const studentRef = doc(db, "student", regId);
              
              const unsubStudent = onSnapshot(studentRef, (studentSnap) => {
                if (studentSnap.exists()) {
                  const data = { ...studentSnap.data(), role: "student", id: regId };
                  setUserData(data);
                  syncSession(firebaseUser.uid, "student", data.name, firebaseUser.email);
                } else {
                  setUserData(null);
                }
                setLoading(false);
              }, (err) => {
                setUserData(null);
                setLoading(false);
              });
              
              unsubscribeProfile = unsubStudent;
            } else {
              setUserData(null);
              setLoading(false);
            }
          }
        }, (err) => {
          setUserData(null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        setForceLogoutHandled(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSession) unsubscribeSession();
    };
  }, [localSessionId]);

  const syncSession = async (uid: string, role: string, name: string, email: string | null) => {
    const sessionRef = doc(db, "userSessions", uid);
    try {
      await setDoc(sessionRef, {
        id: uid,
        userId: uid,
        userType: role,
        loginTime: new Date().toISOString(),
        lastActivityTime: new Date().toISOString(),
        deviceInfo: navigator?.userAgent || "Unknown Device",
        isActive: true,
        sessionId: localSessionId, // Store the unique local session ID
        name: name || email || "Anonymous User",
        email: email,
        role: role,
        lastActive: Date.now(),
      }, { merge: true });
    } catch (e) {
      console.warn("Could not sync session to Firestore:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
