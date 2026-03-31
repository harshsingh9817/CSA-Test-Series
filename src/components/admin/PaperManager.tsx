"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, Github, Info, BrainCircuit, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeQuestionPaperContent } from "@/ai/flows/analyze-question-paper-content";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PaperManager() {
  const [papers, setPapers] = useState<any[]>([]);
  const [paperName, setPaperName] = useState("");
  const [githubLink, setGithubLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "papers"), (snapshot) => {
      setPapers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleAddPaper = async () => {
    if (!paperName || !githubLink) return;
    setLoading(true);

    try {
      const res = await fetch(githubLink);
      if (!res.ok) throw new Error("Could not fetch JSON.");
      const questions = await res.json();
      
      if (!Array.isArray(questions)) throw new Error("Invalid JSON format.");

      setAnalyzing(true);
      const aiResults = await analyzeQuestionPaperContent({ githubJsonLink: githubLink });
      setAnalysis(aiResults);

      await addDoc(collection(db, "papers"), {
        name: paperName,
        url: githubLink,
        count: questions.length,
        createdAt: Date.now(),
        topics: aiResults.topics,
        categories: aiResults.categories,
        summary: aiResults.summary
      });

      toast({ title: "Paper Added", description: `${paperName} imported.` });
      setPaperName("");
      setGithubLink("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const deletePaper = async (id: string) => {
    if (confirm("Delete this paper?")) {
      await deleteDoc(doc(db, "papers", id));
      toast({ title: "Deleted", description: "Removed." });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg">Import Paper</CardTitle>
            <CardDescription>Use GitHub JSON URL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Paper Name</Label>
              <Input 
                placeholder="Math Final..." 
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>GitHub JSON URL</Label>
              <Input 
                placeholder="https://..." 
                className="font-mono text-xs"
                value={githubLink}
                onChange={(e) => setGithubLink(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAddPaper} disabled={loading || !paperName || !githubLink}>
              {loading ? "Processing..." : "Import & Analyze"}
            </Button>
          </CardContent>
        </Card>

        {analyzing && (
          <div className="p-4 bg-accent/10 border border-accent rounded-lg flex items-center gap-2 animate-pulse">
            <BrainCircuit className="h-5 w-5 text-accent" />
            <span className="text-sm font-medium">AI Analyzing...</span>
          </div>
        )}

        {analysis && (
          <Alert className="bg-white">
            <BrainCircuit className="h-4 w-4" />
            <AlertTitle>Analysis Complete</AlertTitle>
            <AlertDescription className="text-xs">{analysis.summary}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Question Bank</CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {papers.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10">No papers.</TableCell></TableRow>
                  ) : (
                    papers.map((paper) => (
                      <TableRow key={paper.id}>
                        <TableCell className="font-semibold">{paper.name}</TableCell>
                        <TableCell><Badge variant="secondary">{paper.count}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deletePaper(paper.id)}>
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
    </div>
  );
}