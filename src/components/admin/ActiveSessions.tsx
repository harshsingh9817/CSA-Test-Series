
"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, query, where, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Monitor, UserX, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Real-time listener for active sessions
    const q = query(collection(db, "userSessions"), where("isActive", "==", true));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Sessions listener error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const terminateSession = async (uid: string, name: string) => {
    if (!uid) return;
    
    if (confirm(`Force logout ${name}?`)) {
      setTerminatingId(uid);
      try {
        const sessionRef = doc(db, "userSessions", uid);
        await updateDoc(sessionRef, { 
          isActive: false, 
          lastActive: Date.now(),
          terminatedAt: new Date().toISOString(),
          status: "terminated"
        });
        
        toast({ 
          title: "Session Terminated", 
          description: `${name} has been disconnected.` 
        });
      } catch (err: any) {
        console.error("Termination failed:", err);
        toast({ 
          variant: "destructive",
          title: "Action Failed", 
          description: "Permissions issue or session record error." 
        });
      } finally {
        setTerminatingId(null);
      }
    }
  };

  return (
    <Card className="border-t-4 border-t-secondary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-secondary" />
            <CardTitle>Active User Sessions</CardTitle>
          </div>
          <CardDescription>Monitor and manage currently logged-in users.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device Info</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="animate-spin h-5 w-5 mx-auto mb-2" />
                    Checking for active users...
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No active sessions found.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{session.name}</span>
                        <span className="text-xs text-muted-foreground">{session.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs max-w-[200px]">
                        <Monitor className="h-3 w-3 shrink-0" />
                        <span className="truncate" title={session.deviceInfo}>{session.deviceInfo}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.role === "admin" ? "default" : "secondary"} className="capitalize">
                        {session.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {session.lastActivityTime ? new Date(session.lastActivityTime).toLocaleTimeString() : 'Recently'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={terminatingId === session.id}
                        className="text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                        onClick={() => terminateSession(session.id, session.name)}
                      >
                        {terminatingId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />}
                        Terminate
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
  );
}
