"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const error = searchParams.get("error");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Custom Admin Handling
      const adminEmail = "sunilsingh8896@gmail.com";
      const adminPass = "sunil8896";

      let userCredential;
      if (email === adminEmail && password === adminPass) {
        // Special case for admin login if not in Firebase Auth yet, 
        // normally we should pre-create this user. 
        // For MVP, we'll try standard auth first.
      }

      userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        // Fallback for initial admin creation if needed
        if (email === adminEmail) {
          await setDoc(doc(db, "users", user.uid), {
            email: email,
            role: "admin",
            name: "Sunil Singh",
          });
          router.push("/admin");
          return;
        }
        throw new Error("User record not found in system.");
      }

      const role = userDoc.data().role;
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/student");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: err.message,
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
          {error === "multiple_sessions" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Session Conflict</AlertTitle>
              <AlertDescription>Your account was logged in on another device. You have been disconnected.</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Registration ID</Label>
              <Input
                id="email"
                type="text"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                data-lpignore="true"
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
                autoComplete="new-password"
                data-lpignore="true"
              />
            </div>
            <Button type="submit" className="w-full h-11 text-lg font-semibold" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </Button>
          </form>
          <div className="text-center text-xs text-muted-foreground pt-4">
            Security enforced: One session per account. Inactivity timeout 60 mins.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}