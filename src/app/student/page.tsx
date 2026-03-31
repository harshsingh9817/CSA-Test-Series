
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, CheckCircle2, PlayCircle, LogOut, Clock } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export default function StudentDashboard() {
  const { user, userData, logout } = useAuth();
  const [papers, setPapers] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userData || userData.role !== "student") return;

    // Fetch Papers
    const unsub = onSnapshot(collection(db, "papers"), async (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPapers(list);

      // Fetch Progress for each paper from the /student/{regId}/progress/{paperId}/history
      const prog: Record<string, any> = {};
      for (const p of list) {
        try {
          const progressSnap = await getDocs(collection(db, "student", userData.regId, "progress", p.id, "history"));
          const completedIndices = new Set();
          progressSnap.forEach(doc => {
            const data = doc.data();
            if (data.completedIndices) {
              data.completedIndices.forEach((idx: number) => completedIndices.add(idx));
            }
          });
          prog[p.id] = {
            completedCount: completedIndices.size,
            total: p.count || 0
          };
        } catch (e) {
          console.error("Error fetching progress for paper", p.id, e);
          prog[p.id] = { completedCount: 0, total: p.count || 0 };
        }
      }
      setProgressData(prog);
      setLoading(false);
    });

    return () => unsub();
  }, [user, userData]);

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
        {/* Welcome & Overall Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-gradient-to-r from-primary to-primary/80 text-white border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Welcome back, {userData.name}!</CardTitle>
              <CardDescription className="text-white/80">Ready to continue your learning journey? Select a paper to begin.</CardDescription>
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
                <CheckCircle2 className="h-5 w-5 text-secondary" /> Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <span className="text-4xl font-bold text-primary">{totalQuestionsDone}</span>
                <p className="text-sm text-muted-foreground">Total Questions Completed</p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                <Clock className="h-3 w-3" />
                <span>Session auto-ends after 60 mins of inactivity.</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Papers List */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold font-headline">Available Question Papers</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed">
              <p className="text-muted-foreground italic">No question papers assigned yet. Please contact the administrator.</p>
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
                        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{paper.name}</CardTitle>
                        <Badge variant="outline">{paper.count} Qs</Badge>
                      </div>
                      <CardDescription className="flex flex-wrap gap-1 pt-1">
                        {paper.topics?.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span className="font-semibold">{prog.completedCount} / {prog.total}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </CardContent>
                    <CardFooter>
                      <Link href={`/student/quiz/${paper.id}`} className="w-full">
                        <Button className="w-full group-hover:bg-primary transition-colors flex items-center gap-2">
                          <PlayCircle className="h-4 w-4" /> 
                          {prog.completedCount >= prog.total && prog.total > 0 ? "Retake Paper" : "Start Quiz"}
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
