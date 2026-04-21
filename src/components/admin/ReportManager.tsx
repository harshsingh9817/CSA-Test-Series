
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BarChart3, ChevronRight, User, Calendar, Target, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ReportManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Search students as user types
  useEffect(() => {
    if (searchTerm.length < 2) {
      setStudents([]);
      return;
    }

    setSearching(true);
    const q = query(collection(db, "student"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
      setStudents(list);
      setSearching(false);
    });

    return () => unsub();
  }, [searchTerm]);

  const fetchReports = async (student: any) => {
    setSelectedStudent(student);
    setLoading(true);
    try {
      const q = query(
        collection(db, "student", student.regId, "report"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(list);
    } catch (e) {
      console.error("Error fetching reports:", e);
    } finally {
      setLoading(false);
    }
  };

  const calculateOverall = () => {
    if (reports.length === 0) return { attempted: 0, correct: 0, incorrect: 0, avg: 0 };
    const totals = reports.reduce((acc, r) => ({
      attempted: acc.attempted + (r.attempted || 0),
      correct: acc.correct + (r.correct || 0),
      incorrect: acc.incorrect + (r.incorrect || 0),
    }), { attempted: 0, correct: 0, incorrect: 0 });

    return {
      ...totals,
      avg: totals.attempted > 0 ? Math.round((totals.correct / totals.attempted) * 100) : 0
    };
  };

  const overall = calculateOverall();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Search Column */}
      <div className="md:col-span-1 space-y-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Search Student
            </CardTitle>
            <CardDescription>Enter name to view progress report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Student name..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[400px] rounded-md border p-2">
              {searching ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin h-5 w-5 text-primary" />
                </div>
              ) : students.length === 0 ? (
                <p className="text-center py-10 text-xs text-muted-foreground italic">
                  {searchTerm.length < 2 ? "Type to search..." : "No students found."}
                </p>
              ) : (
                <div className="space-y-1">
                  {students.map((s) => (
                    <Button
                      key={s.id}
                      variant={selectedStudent?.id === s.id ? "default" : "ghost"}
                      className="w-full justify-between text-left h-auto py-3 px-3"
                      onClick={() => fetchReports(s)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold truncate">{s.name}</span>
                        <span className="text-[10px] opacity-70">ID: {s.regId}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Report Column */}
      <div className="md:col-span-2 space-y-6">
        {selectedStudent ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-primary text-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Target className="h-5 w-5 mb-1 opacity-80" />
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Overall Accuracy</p>
                  <p className="text-2xl font-black">{overall.avg}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <BarChart3 className="h-5 w-5 mb-1 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Qs</p>
                  <p className="text-2xl font-black">{overall.attempted}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-100">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center text-green-700">
                  <CheckCircle2 className="h-5 w-5 mb-1 opacity-80" />
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Correct</p>
                  <p className="text-2xl font-black">{overall.correct}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-100">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center text-red-700">
                  <XCircle className="h-5 w-5 mb-1 opacity-80" />
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Incorrect</p>
                  <p className="text-2xl font-black">{overall.incorrect}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> {selectedStudent.name}&apos;s Performance History
                  </CardTitle>
                  <CardDescription>Detailed session summaries for {selectedStudent.regId}</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono">{reports.length} Sessions</Badge>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin h-8 w-8 text-primary mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">Compiling reports...</p>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-xl">
                    <p className="text-muted-foreground italic">No session reports found for this student.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="font-bold">Paper</TableHead>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="text-center font-bold">Attempted</TableHead>
                          <TableHead className="text-center font-bold">Score</TableHead>
                          <TableHead className="text-right font-bold">Accuracy</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{report.paperName}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(report.timestamp).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{report.attempted}</TableCell>
                            <TableCell className="text-center font-bold text-primary">{report.correct} / {report.attempted}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={report.percentage >= 70 ? "default" : report.percentage >= 40 ? "secondary" : "destructive"}>
                                {report.percentage}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-dashed border-primary/30">
            <div className="p-6 bg-primary/5 rounded-full mb-6">
              <BarChart3 className="h-16 w-16 text-primary/30" />
            </div>
            <h3 className="text-xl font-black text-primary mb-2">Student Progress Center</h3>
            <p className="text-muted-foreground max-w-sm">Select a student from the left directory to view their comprehensive exam reports and accuracy analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
