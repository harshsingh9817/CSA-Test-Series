"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      
      if (isRegId) {
        loginEmail = `${loginEmail.toLowerCase()}@csa.com`;
      }

      // 1. Authenticate
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // 2. Primary Admin Bootstrap
      const primaryAdminEmail = "sunilsingh8896@gmail.com";
      if (loginEmail.toLowerCase() === primaryAdminEmail.toLowerCase()) {
        try {
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
        } catch (rulesError) {
          console.warn("Bootstrap sync error - usually handled by rules:", rulesError);
        }
        router.push("/admin");
        return;
      }

      // 3. Check Admin/Student after Auth
      // We push to home, the AuthProvider handles the specific redirection based on role
      router.push("/");
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMessage("Invalid ID or Password. Ensure your account has been created by an administrator.");
      } else if (err.code === 'permission-denied') {
        setErrorMessage("Access Denied. Your profile could not be verified by the database.");
      } else {
        setErrorMessage(err.message || "A connection error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-t-8 border-t-primary">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black font-headline text-primary">CSA QUIZMASTER</CardTitle>
          <CardDescription className="font-medium">Secure Learning Gateway</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Issue</AlertTitle>
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ID / Email</Label>
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
              <Label htmlFor="password" title="Password provided by Admin" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Password</Label>
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
              {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-center text-xs text-muted-foreground border-t pt-6">
          <div className="flex items-center justify-center gap-1.5 text-primary font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>AUTHENTICATED ACCESS ONLY</span>
          </div>
          <p>Accounts managed by Admin. Public registration is disabled.</p>
        </CardFooter>
      </Card>
    </div>
  );
}