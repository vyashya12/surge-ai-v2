"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  labelConversation,
  getSuggestions,
  getSummary,
  getDiagnosis,
  getKeypoints,
} from "@/lib/api";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  TooltipItem,
} from "chart.js";

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Get supported MIME type
const getSupportedMimeType = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const mimeTypes = ["audio/ogg", "audio/webm", "audio/mp4"];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return undefined;
};

// Format text for display
const formatText = (text: string): string => {
  if (!text) return "";
  const trimmed = text.trim();
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capitalized.endsWith(".") || capitalized.endsWith("?")
    ? capitalized
    : capitalized + ".";
};

interface LabeledSegment {
  text: string;
  speaker: string;
}

// interface Suggestion {
//   suggestion: string;
// }

interface Summary {
  patient_summary: string;
  doctor_summary: string;
}

interface Diagnosis {
  diagnoses: { diagnosis: string; likelihood: number }[];
  symptoms: string[];
  source: string;
  similarity: number;
}

// interface Keypoint {
//   keypoint: string;
// }

type RecorderState = {
  isRecording: boolean;
  isPaused: boolean;
  labeledSegments: LabeledSegment[];
  suggestions: string[];
  summary: Summary | null;
  diagnosis: Diagnosis | null;
  keypoints: string[];
  error: string | null;
  isSending: boolean;
  doctorsNotes: string;
};

export default function AudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    labeledSegments: [],
    suggestions: [],
    summary: null,
    diagnosis: null,
    keypoints: [],
    error: null,
    isSending: false,
    doctorsNotes: "",
  });
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const allAudioChunksRef = useRef<Blob[]>([]);
  const isFinalSendRef = useRef<boolean>(false);

  // Get token from localStorage
  const token =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;

  // Set hydrated state and cleanup
  useEffect(() => {
    setIsHydrated(true);
    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
      }
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  // Handle doctor’s notes input
  const handleDoctorsNotesChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, doctorsNotes: e.target.value }));
  };

  // Chart.js data for diagnosis bar
  const getChartData = () => {
    if (
      !isHydrated ||
      !state.diagnosis?.diagnoses ||
      state.diagnosis.diagnoses.length === 0
    ) {
      return null;
    }

    const labels = ["Diagnosis"];
    const colors = [
      "#4ade80",
      "#60a5fa",
      "#facc15",
      "#f87171",
      "#a78bfa",
      "#fb923c",
    ];

    const datasets = state.diagnosis.diagnoses.map((diag, index) => ({
      label: diag.diagnosis,
      data: [diag.likelihood],
      backgroundColor: colors[index % colors.length],
      barThickness: 30,
    }));

    return {
      labels,
      datasets,
    };
  };

  // Chart.js options
  const chartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        min: 0,
        max: 100,
        grid: { display: false },
        ticks: { display: false },
      },
      y: {
        stacked: true,
        display: false,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const label = context.dataset.label || "";
            const value = context.parsed.x;
            return `${label}: ${value}%`;
          },
        },
      },
    },
    layout: {
      padding: { left: 20, right: 20, top: 20, bottom: 20 },
    },
  };

  const sendAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!isHydrated) return;
      setState((prev) => ({ ...prev, isSending: true }));
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "chunk.webm");

        console.log("Sending audio to /api/deepgram/transcribe");
        const response = await fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `Transcription failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();
        const segments: LabeledSegment[] = data.data || [];

        if (segments && segments.length > 0) {
          console.log("Sending segments to labelConversation:", segments);
          const labelResult = await labelConversation(token)({
            data: segments,
          });
          if (!labelResult.ok) {
            throw new Error(
              labelResult.error ||
                "Failed to label conversation. Please try again."
            );
          }

          const labeledData = labelResult.value?.data || [];
          if (!Array.isArray(labeledData)) {
            throw new Error("labelConversation returned invalid data");
          }

          const conversationData = {
            data: labeledData.reduce(
              (acc: { doctor: string; patient: string }[], segment, index) => {
                if (index % 2 === 0) {
                  const nextSegment = labeledData[index + 1];
                  acc.push({
                    doctor:
                      segment.speaker === "doctor"
                        ? segment.text
                        : nextSegment?.speaker === "doctor"
                        ? nextSegment.text
                        : "",
                    patient:
                      segment.speaker === "patient"
                        ? segment.text
                        : nextSegment?.speaker === "patient"
                        ? nextSegment.text
                        : "",
                  });
                }
                return acc;
              },
              []
            ),
          };

          const doctorsNotes = state.doctorsNotes;

          const suggestionsResult = await getSuggestions(token)(
            conversationData
          );
          if (!suggestionsResult.ok) {
            throw new Error(
              suggestionsResult.error || "Failed to fetch suggestions"
            );
          }
          const suggestionsData = suggestionsResult.value?.suggestions || [];

          const summaryResult = await getSummary(token)(conversationData);
          if (!summaryResult.ok) {
            throw new Error(summaryResult.error || "Failed to fetch summary");
          }
          const summaryData = summaryResult.value || null;

          const diagnosisRequest = {
            conversation_input: conversationData,
            doctors_notes: doctorsNotes,
            threshold: 0.7,
          };
          const diagnosisResult = await getDiagnosis(token)(diagnosisRequest);
          if (!diagnosisResult.ok) {
            throw new Error(
              diagnosisResult.error ||
                "Failed to fetch diagnosis. Please try again."
            );
          }
          const diagnosisData = diagnosisResult.value || null;

          const keypointsRequest = {
            conversation_input: conversationData,
            doctors_notes: doctorsNotes,
          };
          const keypointsResult = await getKeypoints(token)(keypointsRequest);
          const keypointsData = keypointsResult.ok
            ? keypointsResult.value?.keypoints || []
            : [];

          setState((prev) => ({
            ...prev,
            labeledSegments: labeledData,
            suggestions: suggestionsData,
            summary: summaryData,
            diagnosis: diagnosisData,
            keypoints: keypointsData,
            error: null,
            isSending: false,
          }));
        } else {
          throw new Error("No segments received from Deepgram");
        }
      } catch (error: unknown) {
        let errorMessage =
          "An unexpected error occurred during audio processing.";
        let api = "unknown";

        if (error instanceof Error) {
          errorMessage = error.message;
          api = error.message.includes("labelConversation")
            ? "labelConversation"
            : error.message.includes("diagnosis")
            ? "getDiagnosis"
            : "unknown";
          console.error("sendAudio error:", {
            message: error.message,
            stack: error.stack,
            api,
          });
        } else {
          console.error("sendAudio error:", { error, api });
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isSending: false,
        }));
      }
    },
    [isHydrated, state.doctorsNotes, token, state.isPaused, state.isSending]
  );

  const startRecording = useCallback(async () => {
    if (!isHydrated) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType() || "audio/webm";
      const newMediaRecorder = new MediaRecorder(stream, { mimeType });

      allAudioChunksRef.current = [];
      isFinalSendRef.current = false;

      newMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          allAudioChunksRef.current.push(event.data);
        }
      };

      newMediaRecorder.onstart = () => {
        sendIntervalRef.current = setInterval(() => {
          if (
            newMediaRecorder.state === "recording" &&
            !state.isSending &&
            !state.isPaused &&
            !isFinalSendRef.current
          ) {
            const audioBlob = new Blob(allAudioChunksRef.current, {
              type: mimeType,
            });
            sendAudio(audioBlob);
          }
        }, 10000);
      };

      newMediaRecorder.onpause = () => {
        if (sendIntervalRef.current) {
          clearInterval(sendIntervalRef.current);
          sendIntervalRef.current = null;
        }
      };

      newMediaRecorder.onresume = () => {
        isFinalSendRef.current = false;
        sendIntervalRef.current = setInterval(() => {
          if (
            newMediaRecorder.state === "recording" &&
            !state.isSending &&
            !state.isPaused &&
            !isFinalSendRef.current
          ) {
            const audioBlob = new Blob(allAudioChunksRef.current, {
              type: mimeType,
            });
            sendAudio(audioBlob);
          }
        }, 10000);
      };

      newMediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (sendIntervalRef.current) {
          clearInterval(sendIntervalRef.current);
          sendIntervalRef.current = null;
        }
      };

      newMediaRecorder.start(1000);
      setMediaRecorder(newMediaRecorder);
      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        labeledSegments: [],
        suggestions: [],
        summary: null,
        diagnosis: null,
        keypoints: [],
        error: null,
        isSending: false,
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      console.error("startRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [isHydrated, sendAudio]);

  const pauseRecording = useCallback(async () => {
    if (!isHydrated || !mediaRecorder || mediaRecorder.state !== "recording") {
      setState((prev) => ({ ...prev, error: "No active recording to pause" }));
      return;
    }
    try {
      if (allAudioChunksRef.current.length > 0 && !isFinalSendRef.current) {
        isFinalSendRef.current = true;
        const audioBlob = new Blob(allAudioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await sendAudio(audioBlob);
      }

      mediaRecorder.pause();
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
      setState((prev) => ({ ...prev, isPaused: true, isSending: false }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to pause recording";
      console.error("pauseRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isSending: false,
      }));
    }
  }, [isHydrated, mediaRecorder, sendAudio]);

  const resumeRecording = useCallback(() => {
    if (!isHydrated || !mediaRecorder || mediaRecorder.state !== "paused") {
      setState((prev) => ({ ...prev, error: "No paused recording to resume" }));
      return;
    }
    try {
      mediaRecorder.resume();
      setState((prev) => ({ ...prev, isPaused: false }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to resume recording";
      console.error("resumeRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [isHydrated, mediaRecorder]);

  const stopRecording = useCallback(async () => {
    if (!isHydrated || !mediaRecorder) {
      setState((prev) => ({ ...prev, error: "No active recorder" }));
      return;
    }
    try {
      if (allAudioChunksRef.current.length > 0 && !isFinalSendRef.current) {
        isFinalSendRef.current = true;
        const audioBlob = new Blob(allAudioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await sendAudio(audioBlob);
      }

      mediaRecorder.stop();
      setMediaRecorder(null);
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        isSending: false,
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop recording";
      console.error("stopRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isSending: false,
      }));
    }
  }, [isHydrated, mediaRecorder, sendAudio]);

  const clearResults = useCallback(() => {
    setState((prev) => ({
      ...prev,
      labeledSegments: [],
      suggestions: [],
      summary: null,
      diagnosis: null,
      keypoints: [],
      error: null,
      doctorsNotes: "",
    }));
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (!isHydrated) return;
    if (state.isRecording) {
      if (state.isPaused) {
        resumeRecording();
      } else {
        await pauseRecording();
      }
    } else {
      await startRecording();
    }
  }, [
    isHydrated,
    state.isRecording,
    state.isPaused,
    startRecording,
    pauseRecording,
    resumeRecording,
  ]);

  if (!isHydrated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex-1 p-8 relative">
      <h1 className="text-3xl font-bold mb-8 text-center">Surge AI</h1>
      <div className="max-w-2xl mx-auto">
        <h3 className="font-bold mb-2">Notes</h3>
        <Textarea
          value={state.doctorsNotes}
          onChange={handleDoctorsNotesChange}
          placeholder="Enter doctor’s notes and physical evaluation results here..."
          rows={6}
          className="w-full p-4 border rounded-md"
        />
        <div className="flex justify-center space-x-4 mt-6">
          <Button
            onClick={handleToggleRecording}
            className={
              state.isRecording
                ? state.isPaused
                  ? "bg-yellow-400 hover:bg-yellow-500"
                  : "bg-yellow-400 hover:bg-yellow-500"
                : "bg-green-500 hover:bg-green-600"
            }
          >
            {state.isRecording
              ? state.isPaused
                ? "Resume Recording"
                : "Pause Recording"
              : "Start Recording"}
          </Button>
          {state.isRecording && (
            <Button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600"
            >
              Stop Recording
            </Button>
          )}
          {!state.isRecording && (
            <Button
              onClick={clearResults}
              className="bg-red-500 hover:bg-red-600"
              disabled={state.isSending || state.labeledSegments.length === 0}
            >
              Clear Results
            </Button>
          )}
        </div>

        {state.suggestions.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold mb-2">Doctor Reply Suggestions</h3>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <ul className="list-disc pl-5">
                {state.suggestions.map((suggestion, index) => (
                  <li key={index} className="mb-2">
                    {formatText(suggestion)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {state.diagnosis && (
          <div className="mt-8">
            <h3 className="font-bold mb-2">Diagnosis</h3>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <p className="mb-2">
                <strong>Diagnoses:</strong>
              </p>
              <ul className="list-disc pl-5 mb-2">
                {state.diagnosis.diagnoses.map((diag, index) => (
                  <li key={index}>
                    {formatText(diag.diagnosis)} (Likelihood: {diag.likelihood}
                    %)
                  </li>
                ))}
              </ul>
              {getChartData() && (
                <div style={{ height: "120px" }}>
                  <Bar data={getChartData()!} options={chartOptions} />
                </div>
              )}
            </div>
          </div>
        )}

        {state.summary && (
          <div className="mt-8">
            <h3 className="font-bold mb-2">Conversation Summary</h3>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <p className="mb-2">
                <strong>Patient Summary:</strong>{" "}
                {formatText(state.summary.patient_summary)}
              </p>
              <p className="mb-2">
                <strong>Doctor Summary:</strong>{" "}
                {formatText(state.summary.doctor_summary)}
              </p>
            </div>
          </div>
        )}

        {state.labeledSegments.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold mb-2">Labeled Conversation</h3>
            <div className="bg-white p-4 rounded-md shadow-sm">
              {state.isSending && (
                <p className="text-gray-500">Processing audio chunk...</p>
              )}
              {state.labeledSegments.map((segment, index) => (
                <p key={index} className="mb-2">
                  <strong>
                    {segment.speaker.charAt(0).toUpperCase() +
                      segment.speaker.slice(1)}
                    :
                  </strong>{" "}
                  {formatText(segment.text)}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Keypoints Sidebar */}
      <div className="w-64 bg-white shadow-md fixed right-0 top-0 h-full p-4">
        <h3 className="font-bold mb-2">Key Points</h3>
        {state.keypoints.length > 0 ? (
          <ul className="list-disc pl-5">
            {state.keypoints.map((keypoint, index) => (
              <li key={index} className="mb-2">
                {formatText(keypoint)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No key points available.</p>
        )}
      </div>
    </div>
  );
}
