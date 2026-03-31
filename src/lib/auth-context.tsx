
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
  
  // Ref to track if we've successfully established our current session in Firestore
  const isSessionSynced = useRef(false);

  const logout = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const sessionRef = doc(db, "userSessions", currentUser.uid);
        const snap = await getDoc(sessionRef);
        // Only mark inactive if it's explicitly our session calling the logout
        if (snap.exists() && snap.data().sessionId === localSessionId) {
          await updateDoc(sessionRef, { 
            isActive: false, 
            lastActive: Date.now(),
            status: "logged_out"
          });
        }
      } catch (e) {
        // Silently fail on permission errors during logout
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
      // Clean up previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSession) unsubscribeSession();
      
      setForceLogoutHandled(false);
      isSessionSynced.current = false;

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);

        // 1. Session Enforcement Listener
        const sessionRef = doc(db, "userSessions", firebaseUser.uid);
        unsubscribeSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists() && !forceLogoutHandled) {
            const sessionData = snap.data();
            
            // Scenario A: This IS our session ID, but it was set to inactive (Admin termination)
            if (sessionData.sessionId === localSessionId && sessionData.isActive === false) {
              setForceLogoutHandled(true);
              logout();
              alert("Your session has been terminated by an administrator.");
              return;
            }

            // Scenario B: This is NOT our session ID, but it is ACTIVE (Someone else logged in)
            // We only trigger this if WE have already established our session at least once
            if (isSessionSynced.current && sessionData.sessionId !== localSessionId && sessionData.isActive === true) {
              setForceLogoutHandled(true);
              logout();
              alert("You have been logged out because a new login was detected on another device.");
              return;
            }
          }
        });

        // 2. Fetch User Profile
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
      
      // Mark that we have established our identity for this browser instance
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
