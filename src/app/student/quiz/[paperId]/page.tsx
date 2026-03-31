
"use client";

import React, { useState, useEffect, use } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Flag, Loader2, Trophy, Target, XCircle, Info } from "lucide-react";
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
  
  // Detailed Results State
  const [results, setResults] = useState({
    correct: 0,
    attempted: 0,
    incorrect: 0,
    total: 0,
    percentage: 0
  });

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

        // Fetch user progress (all unique completed indices)
        const progressSnap = await getDocs(collection(db, "student", userData.regId, "progress", paperId, "history"));
        const completedIndices = new Set<number>();
        progressSnap.forEach(doc => {
          const data = doc.data();
          if (data.completedIndices) {
            data.completedIndices.forEach((idx: number) => completedIndices.add(idx));
          }
        });

        // Fetch Questions
        const res = await fetch(paperData.url);
        if (!res.ok) throw new Error("Failed to fetch questions");
        const allQuestionsRaw = await res.json();

        // Normalize questions
        const allQuestions = allQuestionsRaw.map((q: any, originalIndex: number) => {
          const isBilingual = q.question_en && q.options;
          
          return {
            originalIndex,
            question: isBilingual ? q.question_en : (q.question || q.question_hi || "Question text missing"),
            optA: isBilingual ? (q.options?.A?.en || q.options?.A?.hi || "") : (q.optionA || q.option1 || q.opt1 || ""),
            optB: isBilingual ? (q.options?.B?.en || q.options?.B?.hi || "") : (q.optionB || q.option2 || q.opt2 || ""),
            optC: isBilingual ? (q.options?.C?.en || q.options?.C?.hi || "") : (q.optionC || q.option3 || q.opt3 || ""),
            optD: isBilingual ? (q.options?.D?.en || q.options?.D?.hi || "") : (q.optionD || q.option4 || q.opt4 || ""),
            correctAnswer: isBilingual ? q.correct_option : (q.answer === "1" ? "A" : q.answer === "2" ? "B" : q.answer === "3" ? "C" : q.answer === "4" ? "D" : q.answer)
          };
        });

        // Filter out already completed questions
        let remainingQuestions = allQuestions.filter((q: any) => !completedIndices.has(q.originalIndex));

        // If paper is fully completed, reset it for a fresh take
        if (remainingQuestions.length === 0) {
          remainingQuestions = allQuestions;
        }

        // Limit to 100 for performance, but usually it will be whatever is left
        setQuestions(remainingQuestions.slice(0, 100));
        setLoading(false);
      } catch (err: any) {
        console.error("Quiz load error:", err);
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
    let attempted = 0;
    
    questions.forEach((q, idx) => {
      if (answers[idx]) {
        attempted++;
        if (answers[idx] === q.correctAnswer) {
          correct++;
        }
      }
    });

    const incorrect = attempted - correct;
    const percentage = questions.length > 0 ? (correct / questions.length) * 100 : 0;

    setResults({
      correct,
      attempted,
      incorrect,
      total: questions.length,
      percentage: Math.round(percentage)
    });

    setSubmitted(true);

    if (!userData?.regId) return;

    try {
      // Save only the questions that were part of this specific session
      const completedIndices = questions.map(q => q.originalIndex);
      
      await addDoc(collection(db, "student", userData.regId, "progress", paperId, "history"), {
        score: correct,
        total: questions.length,
        attempted: attempted,
        completedIndices: completedIndices,
        timestamp: Date.now()
      });
      
      toast({ title: "Result Saved", description: `You answered ${correct} correctly.` });
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
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <Card className="w-full max-w-2xl shadow-2xl border-t-8 border-t-primary overflow-hidden">
        <CardHeader className="text-center bg-primary/5 pb-8 pt-10">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-full shadow-md">
              <Trophy className="h-12 w-12 text-yellow-500" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black font-headline text-primary">Examination Result</CardTitle>
          <CardDescription className="text-base font-medium mt-2">
            Paper: <span className="text-foreground font-bold">{paper?.name}</span>
          </CardDescription>
          <div className="mt-2 text-sm font-bold text-primary bg-primary/10 inline-block px-4 py-1 rounded-full">
            Candidate: {userData?.name}
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-muted/30 p-4 rounded-xl text-center border">
              <Target className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Total Questions</p>
              <p className="text-2xl font-black">{results.total}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl text-center border">
              <Info className="h-5 w-5 mx-auto mb-2 text-gray-500" />
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Attempted</p>
              <p className="text-2xl font-black">{results.attempted}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p className="text-[10px] uppercase font-bold text-green-700 tracking-tighter">Correct</p>
              <p className="text-2xl font-black text-green-600">{results.correct}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl text-center border border-red-100">
              <XCircle className="h-5 w-5 mx-auto mb-2 text-red-500" />
              <p className="text-[10px] uppercase font-bold text-red-700 tracking-tighter">Incorrect</p>
              <p className="text-2xl font-black text-red-600">{results.incorrect}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <p className="text-sm font-bold text-muted-foreground">Overall Performance</p>
              <p className="text-3xl font-black text-primary">{results.percentage}%</p>
            </div>
            <Progress value={results.percentage} className="h-4 rounded-full" />
            <p className="text-xs text-center text-muted-foreground italic">
              {results.percentage >= 60 ? "Excellent work! You have shown great command over the subject." : "Keep practicing! Every attempt is a step closer to mastery."}
            </p>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 flex flex-col sm:flex-row gap-4">
          <Button className="w-full h-12 font-bold text-lg" onClick={() => router.push("/student")}>
            Back to Dashboard
          </Button>
          <Button variant="outline" className="w-full h-12 font-bold" onClick={() => window.location.reload()}>
            Retake Remaining
          </Button>
        </CardFooter>
      </Card>
      <p className="mt-8 text-xs text-muted-foreground">Detailed history is available in your student profile records.</p>
    </div>
  );

  const currentQ = questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b py-4 shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/student")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Exit
          </Button>
          <div className="text-center hidden sm:block">
            <h1 className="font-bold font-headline truncate max-w-[200px]">{paper?.name}</h1>
            <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {questions.length}</p>
          </div>
          <Button variant="default" size="sm" className="bg-secondary hover:bg-secondary/90 text-white font-bold" onClick={handleSubmit}>
            Finish & Submit
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
              <Badge variant="secondary" className="mb-4">Section: {currentQ?.topic || "General"}</Badge>
              <span className="text-xs font-mono text-muted-foreground">ID: #{currentQ?.originalIndex}</span>
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
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${answers[currentIndex] === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' : 'border-muted hover:border-primary/20'}`}
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
          
          <div className="text-sm font-bold bg-muted px-4 py-2 rounded-full hidden sm:block">
            {currentIndex + 1} / {questions.length}
          </div>

          {currentIndex === questions.length - 1 ? (
            <Button size="lg" className="w-32 bg-primary text-white font-bold" onClick={handleSubmit}>
              Submit
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
