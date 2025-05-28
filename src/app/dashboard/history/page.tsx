"use client";

import { useEffect, useState } from "react";
import { getSessionHistory, getSummaryById } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAuthData } from "@/lib/auth";
import { Session, Summary } from "@/types";

interface SessionWithSummary extends Session {
  summary?: Summary;
}

interface PageState {
  sessions: SessionWithSummary[] | null;
  loading: boolean;
  error: string | null;
  openDialogIndex: number | null;
}

const formatDate = (isoString: string): string => {
  try {
    const dt = new Date(isoString.replace("Z", "+00:00"));
    return dt
      .toLocaleString("en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  } catch {
    return isoString;
  }
};

const loadData =
  (
    setState: React.Dispatch<React.SetStateAction<PageState>>,
    baseURL: string,
    token: string | null,
    doctorId: string
  ) =>
  async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const sessionResult = await getSessionHistory(token)(doctorId);
    if (!sessionResult.ok) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: sessionResult.error,
        sessions: [],
      }));
      return;
    }

    const sessions = sessionResult.value;
    const sessionsWithSummaries: SessionWithSummary[] = await Promise.all(
      sessions.map(async (session: Session) => {
        if (session.summaryid) {
          const summaryResult = await getSummaryById(token)(session.summaryid);
          return {
            ...session,
            summary: summaryResult.ok ? summaryResult.value : undefined,
          };
        }
        return session;
      })
    );

    setState((prev) => ({
      ...prev,
      loading: false,
      sessions: sessionsWithSummaries,
    }));
  };

export default function HistoryPage() {
  const [state, setState] = useState<PageState>({
    sessions: null,
    loading: true,
    error: null,
    openDialogIndex: null,
  });

  useEffect(() => {
    const authData = getAuthData();
    if (!authData.ok) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Authentication data not found",
        sessions: [],
      }));
      return;
    }
    const { token, user } = authData.value;
    if (!user.id) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Invalid auth token format: missing doctor ID",
        sessions: [],
      }));
      return;
    }
    const baseURL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "";
    if (!baseURL) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Backend API URL not configured",
        sessions: [],
      }));
      return;
    }
    loadData(setState, baseURL, token, user.id)();
  }, []);

  const toggleDialog = (index: number | null) => {
    setState((prev) => ({ ...prev, openDialogIndex: index }));
  };

  const authData = getAuthData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <style jsx>{`
        .conversation-modal-dark {
          padding: 20px;
          background-color: #1e293b;
          border-radius: 12px;
          border: 1px solid #334155;
          color: #f1f5f9;
          font-size: 15px;
          line-height: 1.6;
        }
        .conversation-modal-dark pre {
          background-color: transparent;
          color: #f1f5f9;
          white-space: pre-wrap;
          font-family: "Courier New", monospace;
          margin-top: 10px;
        }
        .styled-button {
          background-color: #4f46e5 !important;
          color: white !important;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 14px;
        }
        .styled-button:hover {
          background-color: #4338ca !important;
        }
        .table-header {
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 15px;
          color: #374151;
        }
        .audio-player {
          width: 100%;
          max-width: 400px;
          min-width: 300px;
        }
      `}</style>
      <p className="font-bold text-xl mb-6">History</p>
      <Card className="mt-6 w-full max-w-7xl mx-auto min-h-[35rem] h-auto">
        <CardHeader>
          <CardTitle>
            🩺 Doctor ID: {authData.ok ? authData.value.user.id : "N/A"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <p>Loading...</p>
          ) : state.error ? (
            <p className="text-red-500">❌ {state.error}</p>
          ) : !state.sessions || state.sessions.length === 0 ? (
            <p>ℹ️ No session history available yet for this doctor.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <div className="grid grid-cols-[3.5fr_1fr_3fr_2fr_1.5fr] gap-4 mb-4">
                <div className="table-header">Audio</div>
                <div className="table-header">Conversation</div>
                <div className="table-header">Patient Summary</div>
                <div className="table-header">Diagnostic Summary</div>
                <div className="table-header">Created At</div>
              </div>
              {state.sessions.map(
                (session: SessionWithSummary, index: number) => (
                  <div key={session.id}>
                    <div className="grid grid-cols-[3.5fr_1fr_3fr_2fr_1.5fr] gap-4 items-center py-2">
                      <div>
                        {session.audio_url ? (
                          <audio
                            controls
                            className="audio-player"
                            src={session.audio_url}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                      <div>
                        <Button
                          className="styled-button"
                          onClick={() => toggleDialog(index)}
                        >
                          Convo
                        </Button>
                      </div>
                      <div>{session.summary?.patient || "-"}</div>
                      <div>{session.summary?.doctor || "-"}</div>
                      <div>{formatDate(session.created_at)}</div>
                    </div>
                    <Dialog
                      open={state.openDialogIndex === index}
                      onOpenChange={(open) => toggleDialog(open ? index : null)}
                    >
                      <DialogContent className="conversation-modal-dark">
                        <DialogHeader>
                          <DialogTitle>Conversation Transcript</DialogTitle>
                        </DialogHeader>
                        <p>
                          {session.conversation || "No transcript available"}
                        </p>
                      </DialogContent>
                    </Dialog>
                    <hr className="my-2" />
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
