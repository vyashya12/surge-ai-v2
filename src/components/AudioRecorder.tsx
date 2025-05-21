"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  for (const mimetype of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimetype)) {
      return mimetype;
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
  physicalEvaluation: string;
  gender: string;
  age: string;
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
    physicalEvaluation: "",
    gender: "",
    age: "",
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

  // Handle doctor's notes input
  const handleDoctorsNotesChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, doctorsNotes: e.target.value }));
  };

  // Handle physical evaluation input
  const handlePhysicalEvaluationChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, physicalEvaluation: e.target.value }));
  };

  // Handle gender selection
  const handleGenderChange = (value: string) => {
    setState((prev) => ({ ...prev, gender: value }));
  };

  // Handle age selection
  const handleAgeChange = (value: string) => {
    setState((prev) => ({ ...prev, age: value }));
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
    async (audioBlob: Blob, isFinal: boolean = false, retries = 3) => {
      if (!isHydrated) return { success: false, message: "Not hydrated" };
      if (!audioBlob || audioBlob.size === 0) {
        console.warn("Invalid audio blob:", audioBlob);
        setState((prev) => ({
          ...prev,
          error: "Invalid audio input",
          isSending: false,
        }));
        return { success: false, message: "Invalid audio input" };
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        setState((prev) => ({ ...prev, isSending: true }));
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `chunk-${Date.now()}.webm`);

          const response = await fetch("/api/deepgram/transcribe", {
            method: "POST",
            body: formData,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.message ||
                `Transcription failed: HTTP ${response.status}`
            );
          }

          const data = await response.json();
          const segments: LabeledSegment[] = data.data || [];

          if (segments && segments.length > 0) {
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
            const formattedConversation = labeledData.map((segment) => ({
              text: segment.text.trim(),
              speaker: segment.speaker,
            }));

            const conversationData = {
              data: labeledData.reduce(
                (
                  acc: { doctor: string; patient: string }[],
                  segment,
                  index
                ) => {
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

            const summaryConversation = {
              data: formattedConversation.map((segment) => ({
                [segment.speaker]: segment.text,
              })),
            };

            const summaryResult = await getSummary(token)(summaryConversation);
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

            // Update state incrementally to show results immediately
            setState((prev) => ({
              ...prev,
              labeledSegments: isFinal
                ? formattedConversation
                : [...prev.labeledSegments, ...formattedConversation],
              suggestions: isFinal
                ? suggestionsData
                : [...new Set([...prev.suggestions, ...suggestionsData])],
              summary: summaryData || prev.summary,
              diagnosis: diagnosisData || prev.diagnosis,
              keypoints: isFinal
                ? keypointsData
                : [...new Set([...prev.keypoints, ...keypointsData])],
              error: null,
              isSending: false,
            }));

            // Clear chunks after successful send to prevent memory buildup
            if (!isFinal) {
              allAudioChunksRef.current = [];
            }

            return { success: true };
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
            console.error(`sendAudio attempt ${attempt} failed:`, {
              message: errorMessage,
              stack: error.stack || "No stack trace",
              api,
              input: audioBlob.size,
              timestamp: new Date().toISOString(),
              attempt,
            });
          } else {
            console.error(`sendAudio attempt ${attempt} failed:`, {
              error,
              api,
              input: audioBlob.size,
              timestamp: new Date().toISOString(),
              attempt,
            });
          }

          if (attempt === retries) {
            setState((prev) => ({
              ...prev,
              error: errorMessage,
              isSending: false,
            }));
            return { success: false, message: errorMessage };
          }
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
      return { success: false, message: "All retries failed" };
    },
    [isHydrated, state.doctorsNotes, token]
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
        // Clear any existing interval
        if (sendIntervalRef.current) {
          clearInterval(sendIntervalRef.current);
        }
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
        if (sendIntervalRef.current) {
          clearInterval(sendIntervalRef.current);
        }
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
        }, 10000); // Consistent 10-second interval
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
        await sendAudio(audioBlob, true);
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
        await sendAudio(audioBlob, true);
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
      physicalEvaluation: "",
      gender: "",
      age: "",
    }));
  }, []);

  // Placeholder handlers for Accept and Reject buttons
  const handleAccept = () => {
    // Add API call here later
  };

  const handleReject = () => {
    // Add API call here later
  };

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
    return (
      <div className="flex items-center justify-center h-screen text-gray-700">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto mt-8 sm:mt-16">
          {state.error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
              {state.error}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Textarea
              value={state.doctorsNotes}
              onChange={handleDoctorsNotesChange}
              placeholder="Enter doctor's notes here..."
              rows={6}
              className="w-full p-4 border rounded-md"
            />
            <Textarea
              value={state.physicalEvaluation}
              onChange={handlePhysicalEvaluationChange}
              placeholder="Enter physical evaluation (e.g., blood pressure, heart rate)..."
              rows={6}
              className="w-full p-4 border rounded-md"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Select onValueChange={handleGenderChange} value={state.gender}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={handleAgeChange} value={state.age}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Age Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-17">0-17</SelectItem>
                <SelectItem value="18-30">18-30</SelectItem>
                <SelectItem value="31-50">31-50</SelectItem>
                <SelectItem value="51-70">51-70</SelectItem>
                <SelectItem value="71+">71+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
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
              <h3 className="font-bold mb-2 text-lg sm:text-xl">
                Doctor Reply Suggestions
              </h3>
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
              <h3 className="font-bold mb-2 text-lg sm:text-xl">Diagnosis</h3>
              <div className="bg-white p-4 rounded-md shadow-sm">
                <p className="mb-2">
                  <strong>Diagnoses:</strong>
                </p>
                <ul className="list-disc pl-5 mb-2">
                  {state.diagnosis.diagnoses.map((diag, index) => (
                    <li key={index}>
                      {formatText(diag.diagnosis)} (Likelihood:{" "}
                      {diag.likelihood}
                      %)
                    </li>
                  ))}
                </ul>
                {getChartData() && (
                  <div className="h-32 sm:h-40">
                    <Bar data={getChartData()!} options={chartOptions} />
                  </div>
                )}
              </div>
            </div>
          )}

          {state.summary && (
            <div className="mt-8">
              <h3 className="font-bold mb-2 text-lg sm:text-xl">
                Conversation Summary
              </h3>
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

          {(state.keypoints.length > 0 || state.diagnosis || state.summary) && (
            <div className="mt-8 mb-4">
              <h3 className="font-bold mb-2 text-lg sm:text-xl">
                Summary and Actions
              </h3>
              <div className="bg-white p-4 rounded-md shadow-sm">
                {state.keypoints.length > 0 && (
                  <>
                    <p className="mb-2">
                      <strong>Key Points:</strong>
                    </p>
                    <ul className="list-disc pl-5 mb-4">
                      {state.keypoints.map((keypoint, index) => (
                        <li key={index} className="mb-2">
                          {formatText(keypoint)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {state.diagnosis && (
                  <>
                    <p className="mb-2">
                      <strong>Diagnosis:</strong>
                    </p>
                    <ul className="list-disc pl-5 mb-4">
                      {state.diagnosis.diagnoses.map((diag, index) => (
                        <li key={index}>
                          {formatText(diag.diagnosis)} (Likelihood:{" "}
                          {diag.likelihood}
                          %)
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {state.summary && (
                  <p className="mb-4">
                    <strong>Patient Summary:</strong>{" "}
                    {formatText(state.summary.patient_summary)}
                  </p>
                )}
                <div className="flex justify-end space-x-4">
                  <Button
                    onClick={handleAccept}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={handleReject}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}

          {state.labeledSegments.map((segment, index) => (
            <p key={index} className="mb-2">
              <strong>
                {segment.speaker.charAt(0).toUpperCase() +
                  segment.speaker.slice(1)}
                :
              </strong>{" "}
              {segment.text}
            </p>
          ))}
        </div>
      </div>

      {/* Keypoints Sidebar - Hidden on mobile */}
      <div className="hidden lg:block w-64 bg-white shadow-lg fixed right-0 top-0 h-full p-4">
        <h3 className="text-2xl font-bold mb-4 px-2 text-gray-900">
          Key Points
        </h3>
        {state.keypoints.length > 0 ? (
          <ul className="list-disc pl-6 space-y-2">
            {state.keypoints.map((keypoint, index) => (
              <li
                key={index}
                className="px-2 py-2 text-base font-medium text-gray-700 hover:bg-gray-600 hover:text-white rounded-md transition-colors duration-200"
              >
                {formatText(keypoint)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 px-2">No key points available.</p>
        )}
      </div>
    </div>
  );
}
