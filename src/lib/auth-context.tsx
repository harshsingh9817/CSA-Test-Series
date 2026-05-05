
"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getDatabase, ref, onValue, set, remove, onDisconnect } from "firebase/database";
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
  const router = useRouter();
  
  const isSessionSynced = useRef(false);
  const database = getDatabase();

  const logout = async (isSilent: boolean = false) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const sessionRef = ref(database, `userSessions/${currentUser.uid}`);
        await remove(sessionRef);
      } catch (e) {}
    }
    await signOut(auth);
    setUser(null);
    setUserData(null);
    isSessionSynced.current = false;
    if (!isSilent) router.push("/login");
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeSession: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSession) unsubscribeSession();
      
      isSessionSynced.current = false;

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);

        const sessionRef = ref(database, `userSessions/${firebaseUser.uid}`);
        unsubscribeSession = onValue(sessionRef, (snap) => {
          if (snap.exists() && isSessionSynced.current) {
            const sessionData = snap.val();
            if (sessionData.isActive === false || sessionData.sessionId !== localSessionId) {
              logout(true);
              return;
            }
          }
        });

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
                  logout(true);
                }
                setLoading(false);
              }, () => {
                setUserData(null);
                setLoading(false);
              });
              
              unsubscribeProfile = unsubStudent;
            } else {
              setUserData(null);
              setLoading(false);
            }
          }
        }, () => {
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
  }, [localSessionId, database]);

  const syncSession = async (uid: string, role: string, name: string, email: string | null) => {
    const sessionRef = ref(database, `userSessions/${uid}`);
    try {
      onDisconnect(sessionRef).remove();

      await set(sessionRef, {
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
      });
      
      isSessionSynced.current = true;
    } catch (e) {
      console.warn("RTDB Session sync failed:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
