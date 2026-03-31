
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, Github, Info, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function PaperManager() {
  const [papers, setPapers] = useState<any[]>([]);
  const [paperName, setPaperName] = useState("");
  const [githubLink, setGithubLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
      // Direct fetch from raw URL to count questions
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JSON: ${response.statusText}. Ensure the link is correct and public.`);
      }
      
      const jsonData = await response.json();
      if (!Array.isArray(jsonData)) {
        throw new Error("Invalid format: The JSON file must be an array of questions.");
      }

      await addDoc(collection(db, "papers"), {
        name: paperName,
        url: rawUrl,
        count: jsonData.length,
        createdAt: Date.now(),
        topics: [], // AI removed as requested
        categories: [], // AI removed as requested
        summary: "" // AI removed as requested
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
        description: err.message || "An error occurred while fetching the question paper." 
      });
    } finally {
      setLoading(false);
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
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Automatically converts blob links to raw links.
              </p>
            </div>
            <Button className="w-full font-bold" onClick={handleAddPaper} disabled={loading || !paperName || !githubLink}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : "Import Paper"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle className="text-lg">Question Bank</CardTitle>
              <CardDescription>Available papers for students.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-xl border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Paper Name</TableHead>
                    <TableHead className="font-bold">Items</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {papers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-16 text-muted-foreground italic">
                        No papers found. Add one on the left.
                      </TableCell>
                    </TableRow>
                  ) : (
                    papers.map((paper) => (
                      <TableRow key={paper.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">{paper.name}</TableCell>
                        <TableCell><Badge variant="secondary">{paper.count} Qs</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10" 
                            onClick={() => deletePaper(paper.id, paper.name)}
                          >
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
