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
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { DefaultPagination } from "@/components/ui/pagination";

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
    return dt.toLocaleString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
};

const formatTranscript = (raw: string) => {
  const lines = raw
    .split(/(?:^|\n)(doctor:|patient:)/gi)
    .map((line) => line.trim())
    .filter(Boolean);

  const formatted = [];

  for (let i = 0; i < lines.length; i += 2) {
    const speakerRaw = lines[i];
    const messageRaw = lines[i + 1] || "";

    const speaker = speakerRaw.toLowerCase().replace(":", "");
    const message = messageRaw.trim();

    if (!["doctor", "patient"].includes(speaker)) continue;

    formatted.push(
      <div key={i} className="mb-2 leading-relaxed">
        <span className="font-semibold">
          {speaker.charAt(0).toUpperCase() + speaker.slice(1)}:
        </span>{" "}
        <span>
          {message || <em className="text-gray-400">[no response]</em>}
        </span>
      </div>
    );
  }

  return formatted;
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
  const ITEMS_PER_PAGE = 5;
  const [active, setActive] = useState(1);
  const paginatedSessions =
    state.sessions?.slice(
      (active - 1) * ITEMS_PER_PAGE,
      active * ITEMS_PER_PAGE
    ) ?? [];

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
      <p className="font-bold text-xl mb-6">History</p>
      <Card className="mt-6 w-full max-w-7xl mx-auto min-h-[32rem]">
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
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-gray-600 border-b">
                    <th className="py-3 px-2 text-left">Audio</th>
                    <th className="py-3 px-2 text-left">Conversation</th>
                    <th className="py-3 px-2 text-left">Patient Summary</th>
                    <th className="py-3 px-2 text-left">Diagnostic Summary</th>
                    <th className="py-3 px-2 text-left">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.map((session, index) => (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        {session.audio_url ? (
                          <audio
                            controls
                            className="w-full max-w-lg h-10"
                            src={session.audio_url}
                          />
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          size="sm"
                          className="px-6 py-4 bg-gray-100 hover:bg-gray-300 text-black"
                          onClick={() =>
                            toggleDialog((active - 1) * ITEMS_PER_PAGE + index)
                          }
                        >
                          Convo
                        </Button>
                      </td>
                      <td className="py-3 px-2 align-top text-gray-700 max-w-xs">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="line-clamp-3 cursor-default">
                                {session.summary?.patient || "-"}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-sm whitespace-pre-line break-words text-sm leading-relaxed"
                            >
                              {session.summary?.patient}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="py-3 px-2 align-top text-gray-700 max-w-xs">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="line-clamp-3 cursor-default">
                                {session.summary?.doctor || "-"}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-sm whitespace-pre-line break-words text-sm leading-relaxed"
                            >
                              {session.summary?.doctor}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>

                      <td className="py-3 px-2 text-gray-500 whitespace-nowrap">
                        {formatDate(session.created_at)}
                      </td>
                      <Dialog
                        open={
                          state.openDialogIndex ===
                          (active - 1) * ITEMS_PER_PAGE + index
                        }
                        onOpenChange={(open) =>
                          toggleDialog(open ? index : null)
                        }
                      >
                        <DialogContent className="conversation-modal-dark">
                          <DialogHeader>
                            <DialogTitle>Conversation Transcript</DialogTitle>
                          </DialogHeader>
                          <div className="font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                            {session.conversation
                              ? formatTranscript(session.conversation)
                              : "No transcript available."}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end border-t p-4">
        <DefaultPagination
          active={active}
          setActive={setActive}
          totalItems={state.sessions?.length ?? 0}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </div>
  );
}
