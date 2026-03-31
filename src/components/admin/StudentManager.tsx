"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, setDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Search, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
    // Real-time listener handles the data, this just provides visual feedback
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
      await createUserWithEmailAndPassword(secondaryAuth, studentEmail, password);
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      const studentDoc = {
        id: cleanRegId,
        name,
        course,
        regId: cleanRegId,
        notice,
        createdAt: Date.now(),
        email: studentEmail,
      };

      await setDoc(doc(db, "student", cleanRegId), studentDoc);

      toast({ 
        title: "Student Created", 
        description: `Account ${cleanRegId} is ready.` 
      });
      
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Creation Failed", 
        description: err.code === 'auth/email-already-in-use' 
          ? "This Student ID is already in use." 
          : err.message 
      });
      try { await deleteApp(secondaryApp); } catch (e) {}
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setName(""); setCourse(""); setRegId(""); setPassword(""); setNotice("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete student ${name}?`)) {
      try {
        await deleteDoc(doc(db, "student", id));
        toast({ title: "Profile Deleted", description: "Record removed." });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
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
                  Login will be <strong>[ID]@csa.com</strong>.
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
                  <Label htmlFor="new-password">Password</Label>
                  <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notice">Administrative Notice</Label>
                  <Textarea id="notice" placeholder="Notes..." value={notice} onChange={(e) => setNotice(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={adding} className="w-full">
                    {adding ? <Loader2 className="animate-spin" /> : "Save Account"}
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
          <CardDescription>Records linked to @csa.com emails.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Reg ID</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">Loading...</TableCell></TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">No students found.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.course}</TableCell>
                      <TableCell className="font-mono text-xs">{student.regId}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(student.id, student.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}