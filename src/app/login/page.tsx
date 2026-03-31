
"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, AlertCircle, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const errorParam = searchParams.get("error");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let loginEmail = identifier.trim();
      // If the identifier doesn't contain an '@', treat it as a Student Registration ID
      if (!loginEmail.includes("@")) {
        loginEmail = `${loginEmail}@quizmaster.com`;
      }

      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // 2. Determine Role and Redirect
      // Check Admin collection
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (adminDoc.exists()) {
        router.push("/admin");
        return;
      }

      // Check Student collection
      const studentDoc = await getDoc(doc(db, "students", user.uid));
      if (studentDoc.exists()) {
        router.push("/student");
        return;
      }

      // 3. Bootstrap Primary Admin
      // If this is the primary admin email but they don't have a Firestore record yet, create it.
      const primaryAdminEmail = "sunilsingh8896@gmail.com";
      if (loginEmail.toLowerCase() === primaryAdminEmail.toLowerCase()) {
        await setDoc(doc(db, "admins", user.uid), {
          id: user.uid,
          email: loginEmail,
          name: "Sunil Singh",
          role: "admin"
        });
        router.push("/admin");
        return;
      }

      // 4. Handle account with no profile
      toast({
        variant: "destructive",
        title: "Profile Missing",
        description: "Your login is valid, but no Admin or Student profile was found. Please contact the system owner.",
      });
    } catch (err: any) {
      let message = "Invalid email/ID or password. Please try again.";
      
      // Provide more specific feedback for common auth errors
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        message = "No account found with these credentials.";
      } else if (err.code === 'auth/wrong-password') {
        message = "The password you entered is incorrect.";
      } else if (err.code === 'auth/too-many-requests') {
        message = "Too many failed attempts. Please try again later.";
      }
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold font-headline">QuizMaster Hub</CardTitle>
          <CardDescription>Secure Student & Admin Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorParam === "multiple_sessions" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Session Conflict</AlertTitle>
              <AlertDescription>You were automatically logged out because a new session was started on another device.</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Registration ID or Email</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="e.g., ST101 or admin@email.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 text-lg font-semibold" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center justify-center gap-1.5 text-primary/70 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Administrator-managed access only</span>
          </div>
          <p className="mt-1">For account issues, please contact your education coordinator.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
