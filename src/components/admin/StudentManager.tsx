
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Search, Loader2, RefreshCw, KeyRound, ShieldAlert, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const GATEWAY_PASS = "csa_secure_gateway_pass";

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

  // Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

    // Create a secondary app to handle auth without logging out the admin
    const secondaryApp = initializeApp(firebaseConfig, "AddApp-" + Date.now());
    const secondaryAuth = getAuth(secondaryApp);

    try {
      try {
        // Attempt to create the internal auth account
        await createUserWithEmailAndPassword(secondaryAuth, studentEmail, GATEWAY_PASS);
        await signOut(secondaryAuth);
      } catch (authErr: any) {
        // If user already exists in Auth, we ignore it and proceed to create/update Firestore doc
        // This allows reusing Registration IDs easily
        if (authErr.code !== 'auth/email-already-in-use') {
          throw authErr;
        }
      } finally {
        await deleteApp(secondaryApp);
      }

      const studentDoc = {
        id: cleanRegId,
        name,
        course,
        regId: cleanRegId,
        password,
        notice,
        createdAt: Date.now(),
        email: studentEmail,
      };

      // Create or overwrite the profile document
      await setDoc(doc(db, "student", cleanRegId), studentDoc);

      toast({ 
        title: "Profile Created", 
        description: `Student ${cleanRegId} has been added successfully.` 
      });
      
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Action Failed", 
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

  const handleDelete = async (studentId: string, studentName: string) => {
    // Direct and simple confirmation
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete the profile for ${studentName}?`)) {
      return;
    }

    setDeletingId(studentId);

    try {
      // Direct Firestore document deletion
      // This is the primary way to remove a student's access in this system
      await deleteDoc(doc(db, "student", studentId));
      
      toast({ 
        title: "Student Deleted", 
        description: `Profile for ${studentName} removed from directory.` 
      });
    } catch (err: any) {
      console.error("Deletion error:", err);
      toast({ 
        variant: "destructive", 
        title: "Delete Failed", 
        description: "Could not remove document. Check permissions." 
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openPasswordDialog = (student: any) => {
    setSelectedStudentForPassword(student);
    setNewPasswordInput(student.password || "");
    setIsPasswordDialogOpen(true);
  };

  const handleSaveNewPassword = async () => {
    if (!newPasswordInput) {
      toast({ variant: "destructive", title: "Invalid", description: "Password cannot be empty." });
      return;
    }

    setUpdatingPassword(true);
    try {
      const studentRef = doc(db, "student", selectedStudentForPassword.id);
      await updateDoc(studentRef, { password: newPasswordInput });
      toast({ title: "Updated", description: `Password changed for ${selectedStudentForPassword.name}.` });
      setIsPasswordDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message });
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
            placeholder="Search directory..." 
            className="pl-10 h-11" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 font-bold flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Register New Student</DialogTitle>
                <DialogDescription>
                  Enter company details. Passwords are managed directly in this panel.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStudent} className="space-y-4 pt-4">
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
                  <Label htmlFor="new-password">System Password</Label>
                  <Input id="new-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notice">Admin Remarks</Label>
                  <Textarea id="notice" placeholder="Optional notes..." value={notice} onChange={(e) => setNotice(e.target.value)} />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={adding} className="w-full font-bold">
                    {adding ? <Loader2 className="animate-spin" /> : "Save Profile"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-lg border-none">
        <CardHeader className="bg-primary/5 rounded-t-lg">
          <CardTitle className="text-xl text-primary font-black">Private Directory</CardTitle>
          <CardDescription>Direct management of student access and credentials.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Student Name</TableHead>
                  <TableHead className="font-bold">Course</TableHead>
                  <TableHead className="font-bold">Reg ID</TableHead>
                  <TableHead className="font-bold">Password</TableHead>
                  <TableHead className="text-right font-bold">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /> Syncing data...</TableCell></TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No student profiles found.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-base">{student.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{student.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{student.course}</TableCell>
                      <TableCell className="font-black text-primary">{student.regId}</TableCell>
                      <TableCell className="font-mono text-sm bg-muted/50 px-2 rounded">{student.password}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9 text-primary hover:bg-primary/10 border-primary/20" 
                            title="Direct Password Update"
                            onClick={() => openPasswordDialog(student)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={deletingId === student.id}
                            className="h-9 w-9 text-destructive hover:bg-destructive hover:text-white border-destructive/20" 
                            title="Permanent Deletion"
                            onClick={() => handleDelete(student.id, student.name)}
                          >
                            {deletingId === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Direct Password Update
            </DialogTitle>
            <DialogDescription>
              Changing system password for <strong>{selectedStudentForPassword?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-password">New Password</Label>
              <Input 
                id="manual-password" 
                type="text" 
                placeholder="Enter new system password..." 
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="h-11 font-mono"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveNewPassword} disabled={updatingPassword} className="flex-1 font-bold">
              {updatingPassword ? <Loader2 className="animate-spin" /> : "Save Directly"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
