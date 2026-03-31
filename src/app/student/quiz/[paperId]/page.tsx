
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
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Flag, Loader2 } from "lucide-react";
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

        // Fetch user progress
        const progressSnap = await getDocs(collection(db, "student", userData.regId, "progress", paperId, "history"));
        const completedIndices = new Set<number>();
        progressSnap.forEach(doc => {
          doc.data().completedIndices?.forEach((idx: number) => completedIndices.add(idx));
        });

        // Fetch JSON Questions
        const res = await fetch(paperData.url);
        if (!res.ok) throw new Error("Failed to fetch questions");
        const allQuestionsRaw = await res.json();

        // Normalize questions (handle option1 vs optionA)
        const allQuestions = allQuestionsRaw.map((q: any, originalIndex: number) => {
          return {
            ...q,
            originalIndex,
            // Normalize options to A, B, C, D
            optA: q.optionA || q.option1 || q.opt1 || "",
            optB: q.optionB || q.option2 || q.opt2 || "",
            optC: q.optionC || q.option3 || q.opt3 || "",
            optD: q.optionD || q.option4 || q.opt4 || "",
            // Normalize answer mapping if it's numeric 1-4
            correctAnswer: q.answer === "1" ? "A" : q.answer === "2" ? "B" : q.answer === "3" ? "C" : q.answer === "4" ? "D" : q.answer
          };
        });

        // Filter uncompleted questions
        let availableQuestions = allQuestions.filter((q: any) => !completedIndices.has(q.originalIndex));

        // If paper completed, reset for retake
        if (availableQuestions.length === 0) {
          availableQuestions = allQuestions;
        }

        // Limit to 100 questions for performance
        setQuestions(availableQuestions.slice(0, 100));
        setLoading(false);
      } catch (err: any) {
        console.error("Quiz load error:", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to load quiz questions. Please check the JSON format." });
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
      if (answers[idx] === q.correctAnswer) {
        correct++;
      }
    });

    setScore(correct);
    setSubmitted(true);

    if (!userData?.regId) return;

    try {
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
        <Loader2 className="w-10 h-10 border-primary animate-spin mx-auto mb-4 text-primary" />
        <p className="text-primary font-medium">Preparing your exam paper...</p>
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
      <header className="bg-white border-b py-4 shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/student")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="text-center hidden sm:block">
            <h1 className="font-bold font-headline truncate max-w-[200px]">{paper?.name}</h1>
            <p className="text-xs text-muted-foreground">Q. {currentIndex + 1} of {questions.length}</p>
          </div>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/20" onClick={handleSubmit}>
            Finish
          </Button>
        </div>
        <div className="container mx-auto px-4 mt-4">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-lg border-none overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-8">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="mb-4">Question {currentIndex + 1}</Badge>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-xl md:text-2xl font-medium leading-relaxed">
              {currentQ?.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-12 space-y-4">
            <RadioGroup 
              value={answers[currentIndex] || ""} 
              onValueChange={(val) => setAnswers(prev => ({ ...prev, [currentIndex]: val }))}
              className="grid grid-cols-1 gap-4"
            >
              {[
                { id: "A", label: currentQ.optA },
                { id: "B", label: currentQ.optB },
                { id: "C", label: currentQ.optC },
                { id: "D", label: currentQ.optD },
              ].map((opt) => (
                <div 
                  key={opt.id} 
                  onClick={() => setAnswers(prev => ({ ...prev, [currentIndex]: opt.id }))}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${answers[currentIndex] === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-muted hover:border-primary/30'}`}
                >
                  <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="sr-only" />
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 transition-colors ${answers[currentIndex] === opt.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {opt.id}
                  </div>
                  <Label 
                    htmlFor={`opt-${opt.id}`} 
                    className="flex-1 cursor-pointer font-medium text-base md:text-lg leading-snug"
                  >
                    {opt.label}
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
            <ArrowLeft className="h-4 w-4" /> Prev
          </Button>
          
          <div className="text-sm font-bold bg-muted px-4 py-2 rounded-full">
            {currentIndex + 1} / {questions.length}
          </div>

          {currentIndex === questions.length - 1 ? (
            <Button size="lg" className="w-32 bg-secondary hover:bg-secondary/90 text-white font-bold" onClick={handleSubmit}>
              Finish
            </Button>
          ) : (
            <Button size="lg" onClick={handleNext} className="w-32 gap-2 font-bold">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
