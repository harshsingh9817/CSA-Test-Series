
"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, ShieldCheck, AlertCircle, Loader2, Code2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const GATEWAY_PASS = "csa_secure_gateway_pass";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let loginEmail = identifier.trim();
      const isRegId = !loginEmail.includes("@");
      const cleanRegId = isRegId ? loginEmail.toUpperCase() : loginEmail.split("@")[0].toUpperCase();
      
      if (isRegId) {
        loginEmail = `${cleanRegId.toLowerCase()}@csa.com`;
      }

      if (loginEmail.endsWith("@csa.com")) {
        // 1. Internal Authentication via Gateway
        try {
          await signInWithEmailAndPassword(auth, loginEmail, GATEWAY_PASS);
        } catch (authErr: any) {
          throw new Error("Student account not active or Registration ID incorrect.");
        }

        // 2. Direct Password Verification from Firestore
        const studentRef = doc(db, "student", cleanRegId);
        const studentSnap = await getDoc(studentRef);
        
        if (!studentSnap.exists()) {
          await signOut(auth);
          throw new Error("Profile document not found. Contact Admin.");
        }
        
        const studentData = studentSnap.data();
        if (studentData.password !== password) {
          await signOut(auth);
          throw new Error("Invalid system password.");
        }
        
        // Verified - Proceed to portal
        router.push("/student");
      } else {
        // Administrator Login Logic
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        // Ensure owner email is registered as an admin in Firestore
        const primaryAdminEmail = "sunilsingh8896@gmail.com";
        if (loginEmail.toLowerCase() === primaryAdminEmail.toLowerCase()) {
          const adminRef = doc(db, "admins", user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              id: user.uid,
              email: loginEmail,
              name: "Sunil Singh",
              role: "admin",
              createdAt: Date.now()
            });
          }
        }
        router.push("/admin");
      }
    } catch (err: any) {
      console.error("Login process error:", err);
      setErrorMessage(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 space-y-6">
      <Card className="w-full max-w-md shadow-2xl border-t-8 border-t-primary">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black font-headline text-primary">CSA QUIZMASTER</CardTitle>
          <CardDescription className="font-medium">Company Assessment Gateway</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reg ID / Email</Label>
              <Input
                id="identifier"
                placeholder="e.g. ST101"
                className="h-12 border-2"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 border-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Verify Identity"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-center text-xs text-muted-foreground border-t pt-6">
          <div className="flex items-center justify-center gap-1.5 text-primary font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>PROTECTED PRIVATE SYSTEM</span>
          </div>
          <p>Managed exclusively by CSA Administrators.</p>
        </CardFooter>
      </Card>
      
      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border shadow-sm">
        <Code2 className="h-4 w-4 text-primary" />
        <span>Developed by <span className="text-primary font-bold">Harsh Singh</span></span>
      </div>
    </div>
  );
}
