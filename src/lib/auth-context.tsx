
"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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
  const [localSessionId] = useState(() => Math.random().toString(36).substring(7));
  const [forceLogoutHandled, setForceLogoutHandled] = useState(false);
  const router = useRouter();
  
  const isSessionSynced = useRef(false);

  const logout = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const sessionRef = doc(db, "userSessions", currentUser.uid);
        const snap = await getDoc(sessionRef);
        if (snap.exists() && snap.data().sessionId === localSessionId) {
          await updateDoc(sessionRef, { 
            isActive: false, 
            lastActive: Date.now(),
            status: "logged_out"
          });
        }
      } catch (e) {
        // Silently fail on permission errors
      }
    }
    await signOut(auth);
    setUser(null);
    setUserData(null);
    isSessionSynced.current = false;
    router.push("/login");
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeSession: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSession) unsubscribeSession();
      
      setForceLogoutHandled(false);
      isSessionSynced.current = false;

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);

        const sessionRef = doc(db, "userSessions", firebaseUser.uid);
        unsubscribeSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists() && !forceLogoutHandled) {
            const sessionData = snap.data();
            
            // 1. Force logout if admin set isActive to false for OUR session
            if (sessionData.sessionId === localSessionId && sessionData.isActive === false) {
              setForceLogoutHandled(true);
              logout();
              alert("Your session has been terminated by an administrator.");
              return;
            }

            // 2. Conflict check: Logout if another device logged in (ONLY after we synced our own)
            if (isSessionSynced.current && sessionData.sessionId !== localSessionId && sessionData.isActive === true) {
              setForceLogoutHandled(true);
              logout();
              alert("New login detected. You have been logged out from this device.");
              return;
            }
          }
        });

        // Load profile
        const adminRef = doc(db, "admins", firebaseUser.uid);
        unsubscribeProfile = onSnapshot(adminRef, (adminSnap) => {
          if (adminSnap.exists()) {
            const data = { ...adminSnap.data(), role: "admin", id: firebaseUser.uid };
            setUserData(data);
            syncSession(firebaseUser.uid, "admin", data.name, firebaseUser.email);
            setLoading(false);
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
        deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : "Unknown Device",
        isActive: true,
        sessionId: localSessionId,
        name: name || email || "Anonymous User",
        email: email,
        role: role,
        lastActive: Date.now(),
        status: "active"
      }, { merge: true });
      
      // Mark as synced so conflict detection can start
      isSessionSynced.current = true;
    } catch (e) {
      console.warn("Session sync failed:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
