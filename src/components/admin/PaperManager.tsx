"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, Github, Info, BrainCircuit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeQuestionPaperContent } from "@/ai/flows/analyze-question-paper-content";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PaperManager() {
  const [papers, setPapers] = useState<any[]>([]);
  const [paperName, setPaperName] = useState("");
  const [githubLink, setGithubLink] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "papers"), (snapshot) => {
      setPapers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddPaper = async () => {
    if (!paperName || !githubLink) return;
    setLoading(true);

    try {
      const res = await fetch(githubLink);
      if (!res.ok) throw new Error("Could not fetch JSON from link.");
      const questions = await res.json();
      
      if (!Array.isArray(questions)) throw new Error("JSON is not an array of questions.");

      // Run AI Analysis
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

      toast({ title: "Paper Added", description: `Added ${paperName} with ${questions.length} questions.` });
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
      toast({ title: "Deleted", description: "Question paper removed." });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg">Add Question Paper</CardTitle>
            <CardDescription>Upload a Github JSON link to import questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Paper Name</Label>
              <Input 
                placeholder="e.g., Mathematics Midterm 2024" 
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>GitHub JSON URL</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="https://raw.githubusercontent.com/..." 
                  className="font-mono text-xs"
                  value={githubLink}
                  onChange={(e) => setGithubLink(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddPaper} disabled={loading || !paperName || !githubLink}>
              {loading ? "Processing..." : "Import & Analyze"}
            </Button>
          </CardContent>
        </Card>

        {analyzing && (
          <Card className="border-accent bg-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 animate-pulse text-accent">
                <BrainCircuit className="h-6 w-6" />
                <span className="font-semibold">AI is analyzing question content...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <Alert className="bg-white border-primary/20 shadow-sm">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary font-bold">Latest Analysis Results</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <div className="flex flex-wrap gap-1">
                {analysis.topics.map((t: string) => <Badge key={t} variant="outline" className="bg-primary/5">{t}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">{analysis.summary}</p>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Papers</CardTitle>
            <CardDescription>Manage your repository of question banks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Paper Name</TableHead>
                    <TableHead>Total Questions</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {papers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No papers imported yet.</TableCell>
                    </TableRow>
                  ) : (
                    papers.map((paper) => (
                      <TableRow key={paper.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{paper.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{paper.url}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">{paper.count}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {paper.topics?.slice(0, 2).map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1 h-5">{t}</Badge>
                            ))}
                            {paper.topics?.length > 2 && <span className="text-[10px] text-muted-foreground">+{paper.topics.length - 2} more</span>}
                          </div>
                        </TableCell>
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