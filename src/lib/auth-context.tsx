"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
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
        setUser(firebaseUser);
        
        // Try to fetch profile
        try {
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

            // Session Tracking
            const sessionRef = doc(db, "userSessions", firebaseUser.uid);
            await setDoc(sessionRef, {
              id: firebaseUser.uid,
              userId: firebaseUser.uid,
              userType: role,
              loginTime: new Date().toISOString(),
              lastActivityTime: new Date().toISOString(),
              deviceInfo: navigator.userAgent,
              isActive: true,
              name: data.name || firebaseUser.email,
              email: firebaseUser.email,
              role: role,
              lastActive: Date.now(),
            }, { merge: true });
          } else {
            // Profile doesn't exist yet, but don't force sign out here
            // Let the LoginPage handle bootstrapping
            setUserData(null);
          }
        } catch (error) {
          console.error("Auth context error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
