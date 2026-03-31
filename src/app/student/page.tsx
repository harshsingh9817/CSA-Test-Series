
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, CheckCircle2, PlayCircle, LogOut, Clock, Loader2, History, Target } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentDashboard() {
  const { user, userData, loading: authLoading, logout } = useAuth();
  const [papers, setPapers] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<Record<string, any>>({});
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || !userData || userData.role !== "student")) {
      router.push("/login");
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (!user || !userData || userData.role !== "student") return;

    // Fetch Papers
    const unsubPapers = onSnapshot(collection(db, "papers"), async (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPapers(list);

      const prog: Record<string, any> = {};
      const allHistory: any[] = [];

      for (const p of list) {
        try {
          // Fetch history for each paper
          const hQuery = query(
            collection(db, "student", userData.regId, "progress", p.id, "history"),
            orderBy("timestamp", "desc")
          );
          const historySnap = await getDocs(hQuery);
          
          const answeredIndices = new Set<number>();
          historySnap.forEach(doc => {
            const hData = doc.data();
            allHistory.push({
              id: doc.id,
              paperName: p.name,
              paperId: p.id,
              ...hData
            });
            if (hData.answeredIndices) {
              hData.answeredIndices.forEach((idx: number) => answeredIndices.add(idx));
            }
          });
          
          prog[p.id] = {
            completedCount: answeredIndices.size,
            total: p.count || 0
          };
        } catch (e) {
          console.error("Error fetching progress for paper", p.id, e);
          prog[p.id] = { completedCount: 0, total: p.count || 0 };
        }
      }
      
      setProgressData(prog);
      setExamHistory(allHistory.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    });

    return () => unsubPapers();
  }, [user, userData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-primary font-medium">Loading Student Profile...</p>
        </div>
      </div>
    );
  }

  if (!userData || userData.role !== "student") return null;

  const totalQuestionsDone = Object.values(progressData).reduce((acc, curr) => acc + curr.completedCount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              < GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold font-headline text-primary">Student Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{userData.name}</p>
              <p className="text-xs text-muted-foreground capitalize">Reg ID: {userData.regId}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-5 w-5 text-destructive" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-gradient-to-r from-primary to-primary/80 text-white border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Welcome back, {userData.name}!</CardTitle>
              <CardDescription className="text-white/80">Continue your practice sessions below.</CardDescription>
            </CardHeader>
            <CardContent>
              {userData.notice && (
                <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                  <p className="text-sm font-semibold mb-1">Administrative Notice:</p>
                  <p className="text-sm italic text-white/90">{userData.notice}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-t-4 border-t-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-secondary" /> Mastery Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <span className="text-4xl font-bold text-primary">{totalQuestionsDone}</span>
                <p className="text-sm text-muted-foreground">Unique Questions Done</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue="papers" className="space-y-6">
          <TabsList className="bg-white border p-1 h-12">
            <TabsTrigger value="papers" className="flex items-center gap-2 px-6">
              <BookOpen className="h-4 w-4" /> Available Papers
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 px-6">
              <History className="h-4 w-4" /> Exam History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="papers">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
              </div>
            ) : papers.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed">
                <p className="text-muted-foreground italic">No papers assigned.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {papers.map((paper) => {
                  const prog = progressData[paper.id] || { completedCount: 0, total: paper.count || 0 };
                  const pct = Math.round((prog.completedCount / prog.total) * 100) || 0;
                  
                  return (
                    <Card key={paper.id} className="hover:shadow-md transition-shadow group border-t-4 border-t-transparent hover:border-t-primary">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg font-bold">{paper.name}</CardTitle>
                          <Badge variant="outline">{paper.count} Qs</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Unique Progress</span>
                          <span className="font-semibold">{prog.completedCount} / {prog.total}</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </CardContent>
                      <CardFooter>
                        <Link href={`/student/quiz/${paper.id}`} className="w-full">
                          <Button className="w-full group-hover:bg-primary transition-colors flex items-center gap-2">
                            <PlayCircle className="h-4 w-4" /> 
                            {prog.completedCount >= prog.total && prog.total > 0 ? "Retake Whole Paper" : "Start Practice"}
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-6 py-4">Paper Name</th>
                        <th className="px-6 py-4">Date & Time</th>
                        <th className="px-6 py-4">Attempted</th>
                        <th className="px-6 py-4">Score</th>
                        <th className="px-6 py-4 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">
                            No exam history found.
                          </td>
                        </tr>
                      ) : (
                        examHistory.map((entry) => (
                          <tr key={entry.id} className="border-b hover:bg-muted/20">
                            <td className="px-6 py-4 font-medium">{entry.paperName}</td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">{entry.attempted} Qs</td>
                            <td className="px-6 py-4 font-bold text-primary">
                              {entry.score} / {entry.totalInSession}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Badge variant={entry.score / entry.totalInSession >= 0.4 ? "default" : "destructive"}>
                                {Math.round((entry.score / entry.totalInSession) * 100)}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
