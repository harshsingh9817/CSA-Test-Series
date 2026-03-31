"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);

        // First, check the admins collection
        const adminRef = doc(db, "admins", firebaseUser.uid);
        unsubscribeProfile = onSnapshot(adminRef, (adminSnap) => {
          if (adminSnap.exists()) {
            setUserData({ ...adminSnap.data(), role: "admin", id: firebaseUser.uid });
            setLoading(false);
            
            // Sync Session
            const sessionRef = doc(db, "userSessions", firebaseUser.uid);
            setDoc(sessionRef, {
              id: firebaseUser.uid,
              userId: firebaseUser.uid,
              userType: "admin",
              loginTime: new Date().toISOString(),
              lastActivityTime: new Date().toISOString(),
              deviceInfo: navigator.userAgent,
              isActive: true,
              name: adminSnap.data().name || firebaseUser.email,
              email: firebaseUser.email,
              role: "admin",
              lastActive: Date.now(),
            }, { merge: true });
          } else {
            // If not an admin, check the students collection
            const studentRef = doc(db, "students", firebaseUser.uid);
            // We need a second nested listener or a more complex approach, but for simplicity:
            onSnapshot(studentRef, (studentSnap) => {
              if (studentSnap.exists()) {
                setUserData({ ...studentSnap.data(), role: "student", id: firebaseUser.uid });
                
                // Sync Session for Student
                const sessionRef = doc(db, "userSessions", firebaseUser.uid);
                setDoc(sessionRef, {
                  id: firebaseUser.uid,
                  userId: firebaseUser.uid,
                  userType: "student",
                  loginTime: new Date().toISOString(),
                  lastActivityTime: new Date().toISOString(),
                  deviceInfo: navigator.userAgent,
                  isActive: true,
                  name: studentSnap.data().name || firebaseUser.email,
                  email: firebaseUser.email,
                  role: "student",
                  lastActive: Date.now(),
                }, { merge: true });
              } else {
                setUserData(null);
              }
              setLoading(false);
            });
          }
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
    };
  }, []);

  const logout = async () => {
    if (user) {
      const sessionRef = doc(db, "userSessions", user.uid);
      try {
        await updateDoc(sessionRef, { isActive: false });
      } catch (e) {}
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
