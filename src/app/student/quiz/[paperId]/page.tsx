
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
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Trophy, Target, XCircle, Info, Loader2, ListFilter } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
  
  const [results, setResults] = useState({
    correct: 0,
    attempted: 0,
    incorrect: 0,
    total: 0,
    percentage: 0,
    wrongQuestions: [] as any[]
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

        const progressSnap = await getDocs(collection(db, "student", userData.regId, "progress", paperId, "history"));
        const completedIndices = new Set<number>();
        progressSnap.forEach(doc => {
          const data = doc.data();
          if (data.answeredIndices) {
            data.answeredIndices.forEach((idx: number) => completedIndices.add(idx));
          }
        });

        const res = await fetch(paperData.url);
        if (!res.ok) throw new Error("Failed to fetch questions");
        const allQuestionsRaw = await res.json();

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

        let remainingQuestions = allQuestions.filter((q: any) => !completedIndices.has(q.originalIndex));

        // If paper is fully complete, offer to retake all
        if (remainingQuestions.length === 0) {
          remainingQuestions = allQuestions;
        }

        // Limit to chunks of 100 for better performance
        setQuestions(remainingQuestions.slice(0, 100));
        setLoading(false);
      } catch (err: any) {
        console.error("Quiz load error:", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to load quiz." });
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
    const answeredIndices: number[] = [];
    const wrongQuestions: any[] = [];
    
    questions.forEach((q, idx) => {
      const userChoice = answers[idx];
      if (userChoice) {
        attempted++;
        answeredIndices.push(q.originalIndex);
        if (userChoice === q.correctAnswer) {
          correct++;
        } else {
          wrongQuestions.push({
            ...q,
            userChoice,
            userChoiceText: q[`opt${userChoice}`]
          });
        }
      }
    });

    const incorrect = attempted - correct;
    const percentage = attempted > 0 ? (correct / attempted) * 100 : 0;

    setResults({
      correct,
      attempted,
      incorrect,
      total: questions.length,
      percentage: Math.round(percentage),
      wrongQuestions
    });

    setSubmitted(true);

    if (!userData?.regId || answeredIndices.length === 0) return;

    try {
      await addDoc(collection(db, "student", userData.regId, "progress", paperId, "history"), {
        score: correct,
        totalInSession: questions.length,
        attempted: attempted,
        answeredIndices: answeredIndices,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-10 h-10 border-primary animate-spin mx-auto mb-4 text-primary" />
        <p className="text-primary font-medium">Loading Quiz...</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <Card className="w-full max-w-4xl shadow-2xl border-t-8 border-t-primary overflow-hidden mb-8">
        <CardHeader className="text-center bg-primary/5 pb-8 pt-10">
          <div className="flex justify-center mb-4">
            <Trophy className="h-12 w-12 text-yellow-500" />
          </div>
          <CardTitle className="text-3xl font-black text-primary">Result for {userData?.name}</CardTitle>
          <CardDescription className="text-base font-medium">Paper: {paper?.name}</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-muted/30 p-4 rounded-xl text-center border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Session Total</p>
              <p className="text-2xl font-black">{results.total}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl text-center border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Attempted</p>
              <p className="text-2xl font-black">{results.attempted}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <p className="text-[10px] uppercase font-bold text-green-700">Correct</p>
              <p className="text-2xl font-black text-green-600">{results.correct}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl text-center border border-red-100">
              <p className="text-[10px] uppercase font-bold text-red-700">Incorrect</p>
              <p className="text-2xl font-black text-red-600">{results.incorrect}</p>
            </div>
          </div>

          <div className="space-y-4 mb-10">
            <div className="flex justify-between items-end">
              <p className="text-sm font-bold text-muted-foreground">Accuracy</p>
              <p className="text-3xl font-black text-primary">{results.percentage}%</p>
            </div>
            <Progress value={results.percentage} className="h-4 rounded-full" />
          </div>

          {results.wrongQuestions.length > 0 && (
            <div className="space-y-6">
              <h3 className="font-black text-xl border-b pb-2 flex items-center gap-2">
                <XCircle className="text-red-500 h-5 w-5" /> Incorrect Answers Review
              </h3>
              <div className="space-y-4">
                {results.wrongQuestions.map((q, i) => (
                  <Card key={i} className="border-l-4 border-l-red-500">
                    <CardContent className="p-4 space-y-3">
                      <p className="font-bold text-sm">Q: {q.question}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-2 rounded bg-red-50 border border-red-100">
                          <p className="text-[10px] font-bold text-red-600 uppercase">Your Answer ({q.userChoice})</p>
                          <p className="text-sm">{q[`opt${q.userChoice}`]}</p>
                        </div>
                        <div className="p-2 rounded bg-green-50 border border-green-100">
                          <p className="text-[10px] font-bold text-green-600 uppercase">Correct Answer ({q.correctAnswer})</p>
                          <p className="text-sm">{q[`opt${q.correctAnswer}`]}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 flex flex-col sm:flex-row gap-4">
          <Button className="w-full h-12 font-bold" onClick={() => router.push("/student")}>
            Back to Dashboard
          </Button>
          <Button variant="outline" className="w-full h-12 font-bold" onClick={() => window.location.reload()}>
            Start New Session
          </Button>
        </CardFooter>
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
            <ChevronLeft className="h-4 w-4" /> Exit
          </Button>
          
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ListFilter className="h-4 w-4" /> Navigator
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Question Navigator</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {questions.map((_, idx) => (
                      <Button
                        key={idx}
                        variant={currentIndex === idx ? "default" : answers[idx] ? "secondary" : "outline"}
                        className={`h-10 w-full p-0 font-bold ${currentIndex === idx ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        onClick={() => setCurrentIndex(idx)}
                      >
                        {idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="default" className="bg-secondary text-white font-bold" onClick={handleSubmit}>
              Finish
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-4">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-lg border-none">
          <CardHeader className="border-b bg-muted/20 pb-8">
            <div className="flex justify-between items-start mb-4">
              <Badge variant="secondary">Question {currentIndex + 1}</Badge>
              <span className="text-xs font-mono text-muted-foreground">Original Index: #{currentQ?.originalIndex}</span>
            </div>
            <CardTitle className="text-xl md:text-2xl font-medium leading-relaxed">
              {currentQ?.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-12">
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
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${answers[currentIndex] === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-muted hover:border-primary/20'}`}
                >
                  <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="sr-only" />
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 ${answers[currentIndex] === opt.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {opt.id}
                  </div>
                  <Label htmlFor={`opt-${opt.id}`} className="flex-1 cursor-pointer font-medium text-base leading-snug">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" size="lg" onClick={handlePrev} disabled={currentIndex === 0} className="w-32">
            <ArrowLeft className="h-4 w-4 mr-2" /> Prev
          </Button>
          
          <div className="text-sm font-bold bg-muted px-4 py-2 rounded-full">
            {currentIndex + 1} / {questions.length}
          </div>

          {currentIndex === questions.length - 1 ? (
            <Button size="lg" className="w-32 bg-primary text-white font-bold" onClick={handleSubmit}>
              Submit
            </Button>
          ) : (
            <Button size="lg" onClick={handleNext} className="w-32">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
