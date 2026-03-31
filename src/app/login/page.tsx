
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
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let loginEmail = identifier.trim();
      const isRegId = !loginEmail.includes("@");
      
      // Automatic domain mapping as requested: regId@csa.com
      if (isRegId) {
        loginEmail = `${loginEmail.toLowerCase()}@csa.com`;
      }

      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // 2. Bootstrap Primary Admin if needed
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
        router.push("/admin");
        return;
      }

      // 3. Check for existing Admin
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (adminDoc.exists()) {
        router.push("/admin");
        return;
      }

      // 4. Check Student Profile
      // For students, we use the Reg ID (from email) as the Firestore Doc ID
      const regIdFromEmail = loginEmail.split("@")[0].toUpperCase();
      const studentDoc = await getDoc(doc(db, "student", regIdFromEmail));
      
      if (studentDoc.exists()) {
        router.push("/student");
        return;
      }

      // 5. Auth worked but no profile found
      setErrorMessage("Identity verified, but no profile was found in the database. Contact your administrator.");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMessage("Access Denied: Invalid Registration ID or Password.");
      } else {
        setErrorMessage(err.message || "A secure connection could not be established.");
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
          <CardDescription className="font-medium">Student & Admin Gateway</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Error</AlertTitle>
              <AlertDescription className="text-xs">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registration ID / Email</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="e.g. ST101"
                className="h-12 border-2 focus:ring-primary"
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
                className="h-12 border-2 focus:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : "Sign In to Portal"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-center text-xs text-muted-foreground border-t pt-6 bg-muted/20 rounded-b-lg">
          <div className="flex items-center justify-center gap-1.5 text-primary font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>SECURE SYSTEM ACCESS</span>
          </div>
          <p>Accounts are managed by the administrator. Registration is disabled for public users.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
