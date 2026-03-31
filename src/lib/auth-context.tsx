"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

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
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setUser(firebaseUser);

          // Unique Session Check
          const sessionRef = doc(db, "sessions", firebaseUser.uid);
          const currentSession = await getDoc(sessionRef);
          const deviceId = localStorage.getItem("quizmaster_device_id") || Math.random().toString(36).substring(7);
          localStorage.setItem("quizmaster_device_id", deviceId);

          if (currentSession.exists() && currentSession.data().deviceId !== deviceId) {
            // Already logged in elsewhere
            await signOut(auth);
            setUser(null);
            setUserData(null);
            router.push("/login?error=multiple_sessions");
          } else {
            // Update or Create Session
            await setDoc(sessionRef, {
              uid: firebaseUser.uid,
              name: data.name || data.email,
              email: firebaseUser.email,
              role: data.role,
              deviceId: deviceId,
              userAgent: navigator.userAgent,
              lastActive: Date.now(),
            });

            // Listen for session termination
            const sessionUnsub = onSnapshot(sessionRef, (docSnap) => {
              if (!docSnap.exists()) {
                logout();
              }
            });

            return () => sessionUnsub();
          }
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Activity & Auto-logout logic (1 hour)
  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      const sessionRef = doc(db, "sessions", user.uid);
      await updateDoc(sessionRef, { lastActive: Date.now() });
    };

    const handleInteraction = () => {
      updateActivity();
    };

    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("click", handleInteraction);

    const interval = setInterval(async () => {
      const sessionRef = doc(db, "sessions", user.uid);
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
      await deleteDoc(doc(db, "sessions", user.uid));
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