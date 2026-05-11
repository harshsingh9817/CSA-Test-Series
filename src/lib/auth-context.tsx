
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { getDatabase, ref, set, onValue, onDisconnect } from "firebase/database";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: any | null;
  userData: any | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const rtdb = getDatabase();

  useEffect(() => {
    // 1. Initial Load of Session
    const savedSession = localStorage.getItem("csa_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setUserData(parsed);
      } catch (e) {
        localStorage.removeItem("csa_session");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // 2. Real-time Session Monitoring (Concurrent Login Check)
    if (!userData || !userData.id || !userData.sessionId) return;

    const sessionRef = ref(rtdb, `userSessions/${userData.id}`);
    
    // Check if current sessionId matches the one in RTDB
    const unsub = onValue(sessionRef, (snapshot) => {
      const serverSession = snapshot.val();
      
      // If session was terminated by admin or a new login occurred elsewhere
      if (serverSession) {
        if (!serverSession.isActive || serverSession.sessionId !== userData.sessionId) {
          // Silent logout
          setUserData(null);
          localStorage.removeItem("csa_session");
          router.push("/login");
        }
      }
    });

    // Cleanup on disconnect (Optional: could keep session active)
    // onDisconnect(sessionRef).update({ lastActive: Date.now() });

    return () => unsub();
  }, [userData, rtdb, router]);

  const login = async (identifier: string, pass: string) => {
    const trimmedId = identifier.trim().toUpperCase();
    const adminEmail = "sunilsingh8896@gmail.com";
    const newSessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    let session: any = null;

    // Admin Login Check
    if (identifier.toLowerCase() === adminEmail.toLowerCase()) {
      session = {
        id: "admin",
        name: "Administrator",
        role: "admin",
        email: adminEmail,
        sessionId: newSessionId
      };
    } else {
      // Student Login Check
      const studentRef = doc(db, "student", trimmedId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        throw new Error("Student Registration ID not found.");
      }

      const data = studentSnap.data();
      if (data.password !== pass) {
        throw new Error("Incorrect system password.");
      }

      session = {
        ...data,
        id: trimmedId,
        role: "student",
        sessionId: newSessionId
      };
    }

    if (session) {
      // Update RTDB with the NEW session ID to invalidate old ones
      const sessionRef = ref(rtdb, `userSessions/${session.id}`);
      await set(sessionRef, {
        ...session,
        isActive: true,
        lastActive: Date.now(),
        deviceInfo: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'
      });

      setUserData(session);
      localStorage.setItem("csa_session", JSON.stringify(session));
      router.push(session.role === "admin" ? "/admin" : "/student");
    }
  };

  const logout = () => {
    if (userData && userData.id) {
      const sessionRef = ref(rtdb, `userSessions/${userData.id}`);
      set(sessionRef, { isActive: false, lastActive: Date.now() });
    }
    setUserData(null);
    localStorage.removeItem("csa_session");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user: userData, userData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
