
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
  const router = useRouter();

  const logout = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const sessionRef = doc(db, "userSessions", currentUser.uid);
      try {
        await updateDoc(sessionRef, { isActive: false, lastActive: Date.now() });
      } catch (e) {
        console.warn("Could not deactivate session on logout:", e);
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

        // Listen for session termination from Admin (FORCE LOGOUT)
        const sessionRef = doc(db, "userSessions", firebaseUser.uid);
        unsubscribeSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists()) {
            const sessionData = snap.data();
            if (sessionData.isActive === false) {
              console.log("Session terminated by administrator.");
              logout();
            }
          }
        });

        // 1. Check admins collection
        const adminRef = doc(db, "admins", firebaseUser.uid);
        unsubscribeProfile = onSnapshot(adminRef, (adminSnap) => {
          if (adminSnap.exists()) {
            const data = { ...adminSnap.data(), role: "admin", id: firebaseUser.uid };
            setUserData(data);
            setLoading(false);
            syncSession(firebaseUser.uid, "admin", data.name, firebaseUser.email);
          } else {
            // 2. Check student collection (matching regId@csa.com)
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
                console.error("Student profile listener error:", err);
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
          console.error("Admin profile listener error:", err);
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
  }, []);

  const syncSession = async (uid: string, role: string, name: string, email: string | null) => {
    const sessionRef = doc(db, "userSessions", uid);
    try {
      // Only set session if not already explicitly terminated by admin in this lifecycle
      const existing = await getDoc(sessionRef);
      if (existing.exists() && existing.data().isActive === false) return;

      await setDoc(sessionRef, {
        id: uid,
        userId: uid,
        userType: role,
        loginTime: new Date().toISOString(),
        lastActivityTime: new Date().toISOString(),
        deviceInfo: navigator?.userAgent || "Unknown Device",
        isActive: true,
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
