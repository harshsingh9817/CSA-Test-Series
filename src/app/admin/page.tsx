"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { UserPlus, Users, Activity, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudentManager from "@/components/admin/StudentManager";
import ActiveSessions from "@/components/admin/ActiveSessions";
import PaperManager from "@/components/admin/PaperManager";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { userData, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("students");
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!userData || userData.role !== "admin")) {
      router.push("/login");
    }
  }, [userData, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading Administrator Panel...</p>
        </div>
      </div>
    );
  }

  if (!userData || userData.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold font-headline text-primary">Admin Control Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{userData.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{userData.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-5 w-5 text-destructive" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="students" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2 rounded-xl border shadow-sm">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto h-auto p-1 bg-muted/50">
              <TabsTrigger value="students" className="flex items-center gap-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Users className="h-4 w-4" />
                <span>Students</span>
              </TabsTrigger>
              <TabsTrigger value="active" className="flex items-center gap-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Activity className="h-4 w-4" />
                <span>Current Active</span>
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex items-center gap-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <FileText className="h-4 w-4" />
                <span>Questions</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="students" className="mt-0">
            <StudentManager />
          </TabsContent>

          <TabsContent value="active" className="mt-0">
            <ActiveSessions />
          </TabsContent>

          <TabsContent value="questions" className="mt-0">
            <PaperManager />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configuration options for the QuizMaster platform.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                Settings are coming soon in the next update.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
