"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, query, where } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Monitor, UserX, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Only show sessions that are explicitly active
    const q = query(collection(db, "userSessions"), where("isActive", "==", true));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSessions(list);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener handles the data, this just provides visual feedback
    setTimeout(() => setRefreshing(false), 500);
  };

  const terminateSession = (id: string, name: string) => {
    if (confirm(`Force logout ${name}?`)) {
      const sessionRef = doc(db, "userSessions", id);
      // We update the session to be inactive instead of deleting it.
      // This is more reliable as the admin has 'update' permissions in the rules.
      updateDocumentNonBlocking(sessionRef, { isActive: false, lastActive: Date.now() });
      toast({ 
        title: "Termination Initiated", 
        description: `Request to log out ${name} sent to server.` 
      });
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
          <CardDescription>Real-time platform access monitoring.</CardDescription>
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
                <TableHead className="text-right">Access Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Tracking active users...</TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No active sessions currently.
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
                      <div className="flex items-center gap-2 text-xs max-w-xs">
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
                        className="text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                        onClick={() => terminateSession(session.id, session.name)}
                      >
                        <UserX className="h-4 w-4 mr-2" /> Terminate
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
