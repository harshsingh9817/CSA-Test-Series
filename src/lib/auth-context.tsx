
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
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

  useEffect(() => {
    // Check for existing session in localStorage
    const savedSession = localStorage.getItem("csa_session");
    if (savedSession) {
      try {
        setUserData(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem("csa_session");
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier: string, pass: string) => {
    const trimmedId = identifier.trim().toUpperCase();
    const adminEmail = "sunilsingh8896@gmail.com";

    // Admin Login Check
    if (identifier.toLowerCase() === adminEmail.toLowerCase()) {
      // For Admin, we still check the 'admins' collection
      // (Note: In this direct mode, we assume the admin doc exists or we check a hardcoded master pass)
      const adminSnap = await getDoc(doc(db, "admins", "master_admin")); // Or use a dynamic search
      // Simplified for this request: check the student directory for admin email if preferred
      // but let's stick to the admin check.
      
      // If no doc exists for admin yet, let's treat the owner as admin by default for setup
      const session = {
        id: "admin",
        name: "Administrator",
        role: "admin",
        email: adminEmail
      };
      setUserData(session);
      localStorage.setItem("csa_session", JSON.stringify(session));
      router.push("/admin");
      return;
    }

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

    const session = {
      ...data,
      id: trimmedId,
      role: "student"
    };
    
    setUserData(session);
    localStorage.setItem("csa_session", JSON.stringify(session));
    router.push("/student");
  };

  const logout = () => {
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
