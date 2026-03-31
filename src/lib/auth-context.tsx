"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check Admin collection first
        let userDoc = await getDoc(doc(db, "admins", firebaseUser.uid));
        let role = "admin";

        if (!userDoc.exists()) {
          // Then check Student collection
          userDoc = await getDoc(doc(db, "students", firebaseUser.uid));
          role = "student";
        }

        if (userDoc.exists()) {
          const data = { ...userDoc.data(), role, id: firebaseUser.uid };
          setUserData(data);
          setUser(firebaseUser);

          // Unique Session Check
          const sessionRef = doc(db, "userSessions", firebaseUser.uid);
          const deviceId = localStorage.getItem("quizmaster_device_id") || Math.random().toString(36).substring(7);
          localStorage.setItem("quizmaster_device_id", deviceId);

          // Update or Create Session
          await setDoc(sessionRef, {
            id: firebaseUser.uid,
            userId: firebaseUser.uid,
            userType: role,
            loginTime: new Date().toISOString(),
            lastActivityTime: new Date().toISOString(),
            deviceInfo: navigator.userAgent,
            isActive: true,
            // Keeping fields used by UI
            name: data.name || firebaseUser.email,
            email: firebaseUser.email,
            role: role,
            deviceId: deviceId,
            userAgent: navigator.userAgent,
            lastActive: Date.now(),
          }, { merge: true });

          // Listen for session termination
          const sessionUnsub = onSnapshot(sessionRef, (docSnap) => {
            if (docSnap.exists() && !docSnap.data().isActive) {
              logout();
            }
          });

          setLoading(false);
          return () => sessionUnsub();
        } else {
          // If authenticated but no Firestore record, logout
          await signOut(auth);
          setUser(null);
          setUserData(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Activity & Auto-logout logic (1 hour)
  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      const sessionRef = doc(db, "userSessions", user.uid);
      await updateDoc(sessionRef, { 
        lastActivityTime: new Date().toISOString(),
        lastActive: Date.now() 
      });
    };

    const handleInteraction = () => {
      updateActivity();
    };

    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("click", handleInteraction);

    const interval = setInterval(async () => {
      const sessionRef = doc(db, "userSessions", user.uid);
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        const lastActive = snap.data().lastActive;
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - lastActive > oneHour) {
          logout();
        }
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("click", handleInteraction);
      clearInterval(interval);
    };
  }, [user]);

  const logout = async () => {
    if (user) {
      const sessionRef = doc(db, "userSessions", user.uid);
      await updateDoc(sessionRef, { isActive: false });
    }
    await signOut(auth);
    setUser(null);
    setUserData(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
