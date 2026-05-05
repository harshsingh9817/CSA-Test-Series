
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, Github, Info, Trash2, RefreshCw, Loader2, Tag, BrainCircuit, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { analyzeQuestionPaperContent } from "@/ai/flows/analyze-question-paper-content";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function PaperManager() {
  const [papers, setPapers] = useState<any[]>([]);
  const [paperName, setPaperName] = useState("");
  const [githubLink, setGithubLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const getRawGithubUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed.includes("github.com") && trimmed.includes("/blob/")) {
      return trimmed
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");
    }
    return trimmed;
  };

  const handleAddPaper = async () => {
    if (!paperName || !githubLink) return;
    setLoading(true);

    const rawUrl = getRawGithubUrl(githubLink);

    try {
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JSON: ${response.statusText}. Ensure the link is correct and public.`);
      }
      
      const jsonData = await response.json();
      if (!Array.isArray(jsonData)) {
        throw new Error("Invalid format: The JSON file must be an array of questions.");
      }

      const topicSet = new Set<string>();
      jsonData.forEach((q: any) => {
        if (q.topic) topicSet.add(q.topic);
      });
      const topics = Array.from(topicSet);

      await addDoc(collection(db, "papers"), {
        name: paperName,
        url: rawUrl,
        count: jsonData.length,
        createdAt: Date.now(),
        topics: topics,
      });

      toast({ 
        title: "Paper Imported", 
        description: `"${paperName}" added with ${jsonData.length} questions.` 
      });
      setPaperName("");
      setGithubLink("");
    } catch (err: any) {
      console.error("Import failed:", err);
      toast({ 
        variant: "destructive", 
        title: "Import Failed", 
        description: err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async (paper: any) => {
    setAnalyzingId(paper.id);
    try {
      const result = await analyzeQuestionPaperContent({ githubJsonLink: paper.url });
      
      const paperRef = doc(db, "papers", paper.id);
      await updateDoc(paperRef, {
        aiAnalysis: result,
        lastAnalyzed: Date.now()
      });

      toast({
        title: "Analysis Complete",
        description: `AI has successfully analyzed "${paper.name}".`
      });
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "The AI service encountered an error."
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const deletePaper = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "papers", id));
        toast({ title: "Paper Deleted", description: "The question paper has been removed." });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-primary" /> Add New Paper
            </CardTitle>
            <CardDescription>Import a JSON question bank from GitHub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paper-name">Paper Name</Label>
              <Input 
                id="paper-name"
                placeholder="e.g. Computer Awareness" 
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-url">GitHub JSON URL</Label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="github-url"
                  placeholder="Paste GitHub link here..." 
                  className="pl-10 font-mono text-xs"
                  value={githubLink}
                  onChange={(e) => setGithubLink(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full font-bold" onClick={handleAddPaper} disabled={loading || !paperName || !githubLink}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Import Paper"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle className="text-lg">Question Bank</CardTitle>
              <CardDescription>Manage papers and AI insights.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {papers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground italic border rounded-xl">
                  No papers found.
                </div>
              ) : (
                papers.map((paper) => (
                  <Card key={paper.id} className="overflow-hidden">
                    <div className="p-4 flex items-center justify-between bg-muted/20 border-b">
                      <div className="flex flex-col">
                        <span className="font-bold">{paper.name}</span>
                        <span className="text-xs text-muted-foreground">{paper.count} Questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-2" 
                          onClick={() => handleAIAnalysis(paper)}
                          disabled={analyzingId === paper.id}
                        >
                          {analyzingId === paper.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />}
                          {paper.aiAnalysis ? "Re-Analyze" : "AI Insight"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
                          onClick={() => deletePaper(paper.id, paper.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {paper.aiAnalysis && (
                      <div className="p-4 bg-white">
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                            <Sparkles className="h-4 w-4" /> View AI Report <ChevronDown className="h-3 w-3" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Key Topics</p>
                                <div className="flex flex-wrap gap-1">
                                  {paper.aiAnalysis.topics.map((t: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Formatting Status</p>
                                {paper.aiAnalysis.formattingIssues.length > 0 ? (
                                  <ul className="text-xs text-destructive list-disc list-inside">
                                    {paper.aiAnalysis.formattingIssues.map((issue: string, i: number) => (
                                      <li key={i}>{issue}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-green-600 font-medium">Clear of issues</p>
                                )}
                              </div>
                            </div>
                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                              <p className="text-[10px] font-bold text-primary uppercase mb-1">AI Summary</p>
                              <p className="text-xs italic leading-relaxed text-muted-foreground">
                                {paper.aiAnalysis.summary}
                              </p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
