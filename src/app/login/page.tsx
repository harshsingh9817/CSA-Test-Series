
"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, AlertCircle, UserPlus, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const error = searchParams.get("error");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Process login identifier: if no @, assume it's a Reg ID
      let loginEmail = email.trim();
      if (!loginEmail.includes("@")) {
        loginEmail = `${loginEmail}@quizmaster.com`;
      }

      if (mode === "signup") {
        // Registration Logic
        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        // Default to student unless it's the primary admin email
        const adminEmail = "sunilsingh8896@gmail.com";
        const isAdmin = loginEmail === adminEmail;

        if (isAdmin) {
          await setDoc(doc(db, "admins", user.uid), {
            id: user.uid,
            email: loginEmail,
            name: name || "Primary Admin",
            role: "admin"
          });
          toast({ title: "Admin Created", description: "Welcome to the Hub." });
          router.push("/admin");
        } else {
          // For students, we expect the Admin to have created the record, 
          // but for this prototype signup we'll create a basic profile.
          await setDoc(doc(db, "students", user.uid), {
            id: user.uid,
            email: loginEmail,
            name: name || "New Student",
            regId: email.split("@")[0], // Use the prefix as regId
            role: "student",
            course: "General"
          });
          toast({ title: "Student Account Created", description: "Registration successful." });
          router.push("/student");
        }
      } else {
        // Login Logic
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        // The AuthProvider will handle routing based on firestore records
        // but we'll do a quick check here for immediate feedback
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        if (adminDoc.exists()) {
          router.push("/admin");
          return;
        }

        const studentDoc = await getDoc(doc(db, "students", user.uid));
        if (studentDoc.exists()) {
          router.push("/student");
          return;
        }

        // Special case for the first admin login if signup wasn't used
        const adminEmail = "sunilsingh8896@gmail.com";
        if (loginEmail === adminEmail) {
          await setDoc(doc(db, "admins", user.uid), {
            id: user.uid,
            email: loginEmail,
            name: "Sunil Singh",
            role: "admin"
          });
          router.push("/admin");
          return;
        }

        throw new Error("Profile not found. Please contact administrator.");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: mode === "login" ? "Login Failed" : "Signup Failed",
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
              <AlertDescription>Logged in elsewhere. This session was disconnected.</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="login" onValueChange={(v) => setMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" /> Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Sign Up
              </TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleAuth} className="space-y-4" autoComplete="off">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="identifier">{mode === "signup" ? "Email Address" : "Email or Registration ID"}</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder={mode === "signup" ? "email@example.com" : "Registration ID or Email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                />
              </div>
              <Button type="submit" className="w-full h-11 text-lg font-semibold" disabled={loading}>
                {loading ? "Please wait..." : (mode === "login" ? "Login" : "Create Account")}
              </Button>
            </form>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t pt-4">
          <p>Security enforced: One session per account.</p>
          <p>Registration ID login available for students.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
