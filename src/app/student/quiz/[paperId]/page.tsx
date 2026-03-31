
"use client";

import React, { useState, useEffect, use } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Flag } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function QuizPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = use(params);
  const { user, userData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!user || !userData || userData.role !== "student") return;

    const loadQuiz = async () => {
      try {
        const paperRef = doc(db, "papers", paperId);
        const paperSnap = await getDoc(paperRef);
        
        if (!paperSnap.exists()) {
          toast({ variant: "destructive", title: "Error", description: "Paper not found." });
          router.push("/student");
          return;
        }

        const paperData = paperSnap.data();
        setPaper(paperData);

        // Fetch user progress to exclude completed questions from /student/{regId}/progress/{paperId}
        const progressSnap = await getDocs(collection(db, "student", userData.regId, "progress", paperId, "history"));
        const completedIndices = new Set<number>();
        progressSnap.forEach(doc => {
          doc.data().completedIndices?.forEach((idx: number) => completedIndices.add(idx));
        });

        // Fetch JSON Questions
        const res = await fetch(paperData.url);
        const allQuestions = await res.json();

        // Filter uncompleted questions
        let availableQuestions = allQuestions
          .map((q: any, originalIndex: number) => ({ ...q, originalIndex }))
          .filter((q: any) => !completedIndices.has(q.originalIndex));

        // If paper completed, reset for retake
        if (availableQuestions.length === 0) {
          availableQuestions = allQuestions.map((q: any, originalIndex: number) => ({ ...q, originalIndex }));
        }

        // Subset of 100 questions or all if less than 100
        const quizSubset = availableQuestions.slice(0, 100);
        setQuestions(quizSubset);
        setLoading(false);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load quiz questions." });
        router.push("/student");
      }
    };

    loadQuiz();
  }, [paperId, user, userData, toast, router]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.answer) {
        correct++;
      }
    });

    setScore(correct);
    setSubmitted(true);

    if (!userData?.regId) return;

    try {
      // Save progress to /student/{regId}/progress/{paperId}/history
      const completedIndices = questions.map(q => q.originalIndex);
      await addDoc(collection(db, "student", userData.regId, "progress", paperId, "history"), {
        score: correct,
        total: questions.length,
        completedIndices: completedIndices,
        timestamp: Date.now()
      });
      toast({ title: "Quiz Submitted", description: `You scored ${correct}/${questions.length}` });
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-primary font-medium">Preparing your questions...</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-xl border-t-8 border-t-primary">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-secondary" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">Quiz Completed!</CardTitle>
          <CardDescription className="text-lg">Paper: {paper?.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-primary/5 p-8 rounded-2xl border border-primary/10 text-center">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-1">Your Final Score</p>
            <div className="text-6xl font-black text-primary">{score} <span className="text-2xl font-normal text-muted-foreground">/ {questions.length}</span></div>
            <p className="mt-4 text-sm font-medium text-primary">Progress has been saved to your profile.</p>
          </div>
          <Button className="w-full h-12 text-lg" onClick={() => router.push("/student")}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const currentQ = questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/student")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Portal
          </Button>
          <div className="text-center hidden sm:block">
            <h1 className="font-bold font-headline">{paper?.name}</h1>
            <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {questions.length}</p>
          </div>
          <Button variant="outline" className="text-destructive border-destructive/20" onClick={handleSubmit}>
            Finish Quiz
          </Button>
        </div>
        <div className="container mx-auto px-4 mt-4">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-lg border-none">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="mb-2">Q. {currentIndex + 1}</Badge>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-xl font-medium leading-relaxed">
              {currentQ?.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-12">
            <RadioGroup 
              value={answers[currentIndex] || ""} 
              onValueChange={(val) => setAnswers(prev => ({ ...prev, [currentIndex]: val }))}
              className="space-y-4"
            >
              {['A', 'B', 'C', 'D'].map((opt) => (
                <div key={opt} className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:bg-primary/5 ${answers[currentIndex] === opt ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-muted hover:border-primary/30'}`}>
                  <RadioGroupItem value={opt} id={`opt-${opt}`} className="sr-only" />
                  <Label 
                    htmlFor={`opt-${opt}`} 
                    className="flex-1 cursor-pointer font-medium flex gap-4"
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${answers[currentIndex] === opt ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {opt}
                    </span>
                    <span className="flex-1 py-1">{currentQ[`option${opt}` as keyof any]}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-8">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="w-32 gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          
          <div className="text-sm font-medium text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </div>

          {currentIndex === questions.length - 1 ? (
            <Button size="lg" className="w-32 bg-secondary hover:bg-secondary/90 text-white" onClick={handleSubmit}>
              Submit Quiz
            </Button>
          ) : (
            <Button size="lg" onClick={handleNext} className="w-32 gap-2">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
