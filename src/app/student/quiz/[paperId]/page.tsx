
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
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Trophy, Target, XCircle, Loader2, ListFilter, User } from "lucide-react";
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

    const loadQuizData = async () => {
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
        const doneIndices = new Set<number>();
        progressSnap.forEach(doc => {
          const data = doc.data();
          if (data.answeredIndices) {
            data.answeredIndices.forEach((idx: number) => doneIndices.add(idx));
          }
        });

        const res = await fetch(paperData.url);
        if (!res.ok) throw new Error("Failed to fetch questions");
        const raw = await res.json();

        const allProcessed = raw.map((q: any, originalIndex: number) => {
          const isBilingual = q.question_en && q.options;
          return {
            originalIndex,
            topic: q.topic || "General",
            question: isBilingual ? q.question_en : (q.question || q.question_hi || "Question text missing"),
            optA: isBilingual ? (q.options?.A?.en || q.options?.A?.hi || "") : (q.optionA || q.option1 || q.opt1 || ""),
            optB: isBilingual ? (q.options?.B?.en || q.options?.B?.hi || "") : (q.optionB || q.option2 || q.opt2 || ""),
            optC: isBilingual ? (q.options?.C?.en || q.options?.C?.hi || "") : (q.optionC || q.option3 || q.opt3 || ""),
            optD: isBilingual ? (q.options?.D?.en || q.options?.D?.hi || "") : (q.optionD || q.option4 || q.opt4 || ""),
            correctAnswer: isBilingual ? q.correct_option : (q.answer === "1" ? "A" : q.answer === "2" ? "B" : q.answer === "3" ? "C" : q.answer === "4" ? "D" : q.answer)
          };
        });

        let pool = allProcessed.filter((q: any) => !doneIndices.has(q.originalIndex));
        if (pool.length === 0) pool = allProcessed;

        const topicGroups: Record<string, any[]> = {};
        pool.forEach(q => {
          if (!topicGroups[q.topic]) topicGroups[q.topic] = [];
          topicGroups[q.topic].push(q);
        });

        const selectedQuestions: any[] = [];
        const MAX_SESSION_SIZE = 100;

        const topicWeights = Object.keys(topicGroups).map(topic => {
          const count = topicGroups[topic].length;
          const weight = Math.sqrt(count);
          return { topic, count, weight };
        });

        const totalWeight = topicWeights.reduce((acc, tw) => acc + tw.weight, 0);
        
        topicWeights.forEach(tw => {
          let quota = Math.ceil((tw.weight / totalWeight) * MAX_SESSION_SIZE);
          quota = Math.min(quota, tw.count);
          const shuffledGroup = [...topicGroups[tw.topic]].sort(() => Math.random() - 0.5);
          selectedQuestions.push(...shuffledGroup.slice(0, quota));
        });

        const finalSession = selectedQuestions
          .sort(() => Math.random() - 0.5)
          .slice(0, MAX_SESSION_SIZE);

        setQuestions(finalSession);
        setLoading(false);
      } catch (err: any) {
        console.error("Load error:", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to load quiz data." });
        router.push("/student");
      }
    };

    loadQuizData();
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
    let attemptedCount = 0;
    const answeredIndices: number[] = [];
    const wrongQuestions: any[] = [];
    
    questions.forEach((q, idx) => {
      const userChoice = answers[idx];
      if (userChoice) {
        attemptedCount++;
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

    const incorrect = attemptedCount - correct;
    const percentage = attemptedCount > 0 ? (correct / attemptedCount) * 100 : 0;

    setResults({
      correct,
      attempted: attemptedCount,
      incorrect,
      total: questions.length,
      percentage: Math.round(percentage),
      wrongQuestions
    });

    setSubmitted(true);

    if (!userData?.regId || attemptedCount === 0) return;

    try {
      const timestamp = Date.now();
      await addDoc(collection(db, "student", userData.regId, "progress", paperId, "history"), {
        score: correct,
        totalInSession: questions.length,
        attempted: attemptedCount,
        answeredIndices: answeredIndices,
        timestamp
      });

      await addDoc(collection(db, "student", userData.regId, "report"), {
        paperId: paperId,
        paperName: paper?.name || "Practice Set",
        attempted: attemptedCount,
        correct,
        incorrect,
        percentage: Math.round(percentage),
        timestamp
      });
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-10 h-10 border-primary animate-spin mx-auto mb-4 text-primary" />
        <p className="text-primary font-medium">Preparing Session...</p>
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
          <CardTitle className="text-3xl font-black text-primary flex items-center justify-center gap-2">
            <User className="h-6 w-6" /> {userData?.name}
          </CardTitle>
          <p className="text-sm font-medium mt-1">Practice Results Summary</p>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-muted/30 p-4 rounded-xl text-center border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Total in Set</p>
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

          <div className="text-center space-y-2 mb-10">
            <p className="text-sm font-bold text-muted-foreground">Accuracy Score</p>
            <p className="text-5xl font-black text-primary">{results.percentage}%</p>
          </div>

          {results.wrongQuestions.length > 0 && (
            <div className="space-y-6">
              <h3 className="font-black text-xl border-b pb-2 flex items-center gap-2">
                <XCircle className="text-red-500 h-5 w-5" /> Mistake Analysis
              </h3>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {results.wrongQuestions.map((q, i) => (
                    <Card key={i} className="border-l-4 border-l-red-500">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-sm">Q: {q.question}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{q.topic}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-2 rounded bg-red-50 border border-red-100">
                            <p className="text-[10px] font-bold text-red-600 uppercase">You Chose ({q.userChoice})</p>
                            <p className="text-sm">{q[`opt${q.userChoice}`]}</p>
                          </div>
                          <div className="p-2 rounded bg-green-50 border border-green-100">
                            <p className="text-[10px] font-bold text-green-600 uppercase">Correct ({q.correctAnswer})</p>
                            <p className="text-sm">{q[`opt${q.correctAnswer}`]}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 p-6 flex flex-col sm:flex-row gap-4">
          <Button className="w-full h-12 font-bold" onClick={() => window.location.reload()}>
            Try New Set
          </Button>
          <Button variant="outline" className="w-full h-12 font-bold" onClick={() => router.push("/student")}>
            Finish Review
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b py-4 shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/student")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Exit
          </Button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-primary uppercase">{paper?.name}</span>
            <span className="text-[10px] text-muted-foreground">Mixed Balanced Set</span>
          </div>

          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                  <ListFilter className="h-4 w-4" /> Navigator
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Practice Navigator</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <ScrollArea className="h-[70vh]">
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pr-4">
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
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="default" size="sm" className="bg-secondary text-white font-bold" onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-lg border-none overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-8">
            <div className="flex justify-between items-start mb-4">
              <Badge variant="secondary">Q {currentIndex + 1} of {questions.length}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">{currentQ?.topic}</Badge>
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
                { id: "A", label: currentQ?.optA },
                { id: "B", label: currentQ?.optB },
                { id: "C", label: currentQ?.optC },
                { id: "D", label: currentQ?.optD },
              ].map((opt) => (
                <div 
                  key={opt.id} 
                  onClick={() => setAnswers(prev => ({ ...prev, [currentIndex]: opt.id }))}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${answers[currentIndex] === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' : 'border-muted hover:border-primary/20'}`}
                >
                  <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="sr-only" />
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 ${answers[currentIndex] === opt.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {opt.id}
                  </div>
                  <Label htmlFor={`opt-${opt.id}`} className="flex-1 cursor-pointer font-medium text-base">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" size="lg" onClick={handlePrev} disabled={currentIndex === 0} className="w-32 font-bold">
            <ArrowLeft className="h-4 w-4 mr-2" /> Prev
          </Button>
          
          <div className="text-[10px] font-black bg-muted px-4 py-2 rounded-full text-muted-foreground hidden sm:block">
            {questions.length - Object.keys(answers).length} Left
          </div>

          {currentIndex === questions.length - 1 ? (
            <Button size="lg" className="w-32 bg-primary text-white font-bold" onClick={handleSubmit}>
              Finish
            </Button>
          ) : (
            <Button size="lg" onClick={handleNext} className="w-32 font-bold">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
