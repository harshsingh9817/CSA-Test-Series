
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, setDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Search, Loader2, RefreshCw, KeyRound, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function StudentManager() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New Student Form
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [regId, setRegId] = useState(""); 
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);

  // Password Update State
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedStudentForPassword, setSelectedStudentForPassword] = useState<any>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "student"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);

    const cleanRegId = regId.trim().toUpperCase();
    const studentEmail = `${cleanRegId.toLowerCase()}@csa.com`;

    if (!cleanRegId) {
      toast({ variant: "destructive", title: "Error", description: "Registration ID is required." });
      setAdding(false);
      return;
    }

    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp-" + Date.now());
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 1. Ensure Auth account exists with a fixed internal password
      try {
        await createUserWithEmailAndPassword(secondaryAuth, studentEmail, "csa_secure_gateway_pass");
        await signOut(secondaryAuth);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          console.log("Auth account already exists, continuing to update Firestore profile.");
        } else {
          throw authErr;
        }
      } finally {
        await deleteApp(secondaryApp);
      }

      // 2. Save complete profile to Firestore (including the direct password)
      const studentDoc = {
        id: cleanRegId,
        name,
        course,
        regId: cleanRegId,
        password, // Stored directly in Firestore for admin management
        notice,
        createdAt: Date.now(),
        email: studentEmail,
      };

      await setDoc(doc(db, "student", cleanRegId), studentDoc);

      toast({ 
        title: "Account Created", 
        description: `Student ${cleanRegId} has been added to the directory.` 
      });
      
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Creation Failed", 
        description: err.message 
      });
      try { await deleteApp(secondaryApp); } catch (e) {}
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setName(""); setCourse(""); setRegId(""); setPassword(""); setNotice("");
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Revoke access for ${name}? \n\nThis will remove their profile and instantly log them out.`)) {
      deleteDocumentNonBlocking(doc(db, "student", id));
      toast({ 
        title: "Access Revoked", 
        description: `${name}'s profile has been removed.` 
      });
    }
  };

  const openPasswordDialog = (student: any) => {
    setSelectedStudentForPassword(student);
    setNewPasswordInput(student.password || "");
    setIsPasswordDialogOpen(true);
  };

  const handleSaveNewPassword = async () => {
    if (!newPasswordInput) {
      toast({ 
        variant: "destructive", 
        title: "Invalid Password", 
        description: "Password cannot be empty." 
      });
      return;
    }

    setUpdatingPassword(true);
    
    try {
      const studentRef = doc(db, "student", selectedStudentForPassword.id);
      await updateDoc(studentRef, { password: newPasswordInput });
      
      toast({
        title: "Password Updated",
        description: `Credentials for ${selectedStudentForPassword.name} have been changed.`
      });
      
      setIsPasswordDialogOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.regId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search students..." 
            className="pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Student Account</DialogTitle>
                <DialogDescription>
                  Registration IDs are unique. User will login with ID and Password.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course">Course</Label>
                    <Input id="course" value={course} onChange={(e) => setCourse(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regId">Registration ID</Label>
                  <Input id="regId" placeholder="e.g. ST101" value={regId} onChange={(e) => setRegId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Login Password</Label>
                  <Input id="new-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notice">Notice</Label>
                  <Textarea id="notice" placeholder="Administrative notes..." value={notice} onChange={(e) => setNotice(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={adding} className="w-full">
                    {adding ? <Loader2 className="animate-spin" /> : "Save Profile"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-primary font-bold">Student Directory</CardTitle>
          <CardDescription>Direct password management for assessment accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Reg ID</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">Loading...</TableCell></TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">No students found.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{student.name}</span>
                          <span className="text-[10px] text-muted-foreground">{student.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.course}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary">{student.regId}</TableCell>
                      <TableCell className="font-mono text-xs">{student.password}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-primary hover:bg-primary/10" 
                            title="Direct Password Update"
                            onClick={() => openPasswordDialog(student)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10" 
                            title="Revoke Access"
                            onClick={() => handleDelete(student.id, student.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Login Password</DialogTitle>
            <DialogDescription>
              Directly modify credentials for <strong>{selectedStudentForPassword?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-password">New Password</Label>
              <Input 
                id="manual-password" 
                type="text" 
                placeholder="Enter new password..." 
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="flex-1 sm:flex-none">
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSaveNewPassword} disabled={updatingPassword} className="flex-1 sm:flex-none">
              {updatingPassword ? <Loader2 className="animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
