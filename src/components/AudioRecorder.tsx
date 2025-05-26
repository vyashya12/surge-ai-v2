"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@radix-ui/react-dialog";
import {
  labelConversation,
  getSuggestions,
  getSummary,
  getDiagnosis,
  getKeypoints,
  createCombined,
} from "@/lib/api";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  TooltipItem,
  ChartData,
} from "chart.js";
import { Menu } from "lucide-react";

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Get supported MIME type
const getSupportedMimeType = (): string => {
  if (typeof window === "undefined") return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  console.warn(
    "audio/webm;codecs=opus not supported, falling back to audio/wav"
  );
  if (MediaRecorder.isTypeSupported("audio/wav")) {
    return "audio/wav";
  }
  console.error("No supported audio format found, defaulting to audio/webm");
  return "audio/webm";
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
  isStopping: boolean;
  doctorsNotes: string;
  physicalEvaluation: string;
  gender: string;
  age: string;
};

interface CombinedCreateRequest {
  session_id: string;
  doctor_id: string;
  patient_summary: string;
  doctor_summary: string;
  notes_summary: string;
  diagnosis: Array<{ diagnosis: string; likelihood: number }>;
  data_json: {
    data: Array<{ [speaker: string]: string }>;
    patient_summary: string;
    doctor_summary: string;
    doctor_note_summary: string;
    diagnoses: Array<{ diagnosis: string; likelihood: number }>;
    symptoms: string[];
    physical_evaluation: string;
    gender: string;
    age: string;
  };
  audio_url: string;
  conversation: string;
  physical_evaluation: string;
  gender: string;
  age: string;
}

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
    isStopping: false,
    doctorsNotes: "",
    physicalEvaluation: "",
    gender: "",
    age: "",
  });
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isKeypointsOpen, setIsKeypointsOpen] = useState(false);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const allAudioChunksRef = useRef<Blob[]>([]);
  const newAudioChunksRef = useRef<Blob[]>([]);
  const isFinalSendRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(uuidv4());
  const isStopPendingRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioFilenameRef = useRef<string | null>(null);

  // Get token and doctor_id from localStorage
  let token: string | null = null;
  let doctorId: string | null = null;
  try {
    const userData =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const jwt =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (userData) {
      const parsed = JSON.parse(userData);
      token = jwt || null;
      doctorId = parsed?.id || null;
    }
    if (!token || !doctorId) {
      throw new Error("Missing authentication data");
    }
  } catch (error) {
    console.error("Failed to parse localStorage user:", error);
    setState((prev) => ({
      ...prev,
      error: "Authentication data not found. Please log in.",
    }));
    return null;
  }

  // Set hydrated state and cleanup
  useEffect(() => {
    setIsHydrated(true);
    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
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

  // Handle inputs
  const handleDoctorsNotesChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, doctorsNotes: e.target.value }));
  };

  const handlePhysicalEvaluationChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, physicalEvaluation: e.target.value }));
  };

  const handleGenderChange = (value: string) => {
    setState((prev) => ({ ...prev, gender: value }));
  };

  const handleAgeChange = (value: string) => {
    setState((prev) => ({ ...prev, age: value }));
  };

  // Chart.js data for diagnosis bar
  const getChartData = (): ChartData<"bar", number[], string> => {
    if (
      !isHydrated ||
      !state.diagnosis?.diagnoses ||
      state.diagnosis.diagnoses.length === 0
    ) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            label: "No Diagnosis",
            data: [0],
            backgroundColor: "#d1d5db",
            barThickness: 30,
          },
        ],
      };
    }

    const primaryDiagnosis = state.diagnosis.diagnoses.reduce((max, diag) =>
      diag.likelihood > max.likelihood ? diag : max
    );
    const labels = ["Diagnosis"];
    const colors = ["#4ade80"];

    const datasets = [
      {
        label: primaryDiagnosis.diagnosis,
        data: [primaryDiagnosis.likelihood],
        backgroundColor: colors[0],
        barThickness: 30,
      },
    ];

    return { labels, datasets };
  };

  // Chart.js options
  const chartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: "Likelihood (%)",
        },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: "Diagnosis",
        },
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
    layout: { padding: { left: 20, right: 20, top: 20, bottom: 20 } },
  };

  const sendAudio = useCallback(
    async (audioBlob: Blob, retryCount = 0) => {
      if (!isHydrated) return;
      const maxRetries = 2;
      setState((prev) => ({ ...prev, isSending: true }));
      try {
        console.log(
          `Sending audio blob, size: ${audioBlob.size} bytes, type: ${audioBlob.type}`
        );
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log("Blob header:", new Uint8Array(arrayBuffer.slice(0, 20)));
        const formData = new FormData();
        const extension = audioBlob.type.includes("webm") ? "webm" : "wav";
        formData.append(
          "audio",
          audioBlob,
          `chunk-${sessionIdRef.current}.${extension}`
        );

        const response = await fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (retryCount < maxRetries && response.status === 400) {
            console.warn(
              `Retry ${retryCount + 1}/${maxRetries} for Deepgram error:`,
              errorData
            );
            return sendAudio(audioBlob, retryCount + 1);
          }
          throw new Error(
            errorData.message || `Transcription failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();
        console.log("Deepgram API response:", JSON.stringify(data, null, 2));
        const segments: LabeledSegment[] = data.data || [];

        if (segments.length > 0) {
          console.log(
            "Segments from Deepgram:",
            JSON.stringify(segments, null, 2)
          );
          const labelResult = await labelConversation(token)({
            data: segments,
          });
          if (!labelResult.ok) {
            console.error("Label conversation failed:", labelResult.error);
            throw new Error(
              labelResult.error || "Failed to label conversation"
            );
          }

          const labeledData = labelResult.value?.data || [];
          console.log("Labeled data:", JSON.stringify(labeledData, null, 2));
          const formattedConversation = labeledData.map((segment) => ({
            text: segment.text.trim(),
            speaker: segment.speaker,
          }));

          const conversationData = {
            data: formattedConversation.map((segment) => ({
              [segment.speaker]: segment.text,
            })),
          };

          const suggestionsResult = await getSuggestions(token)(
            conversationData
          );
          const suggestionsData = suggestionsResult.ok
            ? suggestionsResult.value?.suggestions || []
            : [];

          const summaryResult = await getSummary(token)(conversationData);
          const summaryData = summaryResult.ok
            ? summaryResult.value || null
            : null;

          const diagnosisRequest = {
            conversation_input: conversationData,
            doctors_notes: state.doctorsNotes,
            physical_evaluation: state.physicalEvaluation,
            gender: state.gender,
            age: state.age,
            threshold: 0.7,
          };
          const diagnosisResult = await getDiagnosis(token)(diagnosisRequest);
          const diagnosisData = diagnosisResult.ok
            ? diagnosisResult.value || null
            : {
                diagnoses: [{ diagnosis: "Unknown", likelihood: 0 }],
                symptoms: [],
                source: "fallback",
                similarity: 0,
              };

          const keypointsRequest = {
            conversation_input: conversationData,
            doctors_notes: state.doctorsNotes,
          };
          const keypointsResult = await getKeypoints(token)(keypointsRequest);
          const keypointsData = keypointsResult.ok
            ? keypointsResult.value?.keypoints || []
            : [];

          setState((prev) => ({
            ...prev,
            labeledSegments: formattedConversation,
            suggestions: [...new Set(suggestionsData)],
            summary: summaryData || prev.summary,
            diagnosis: diagnosisData, // Replace old diagnosis with new data
            keypoints: [...new Set(keypointsData)],
            error: null,
            isSending: false,
          }));

          // Clear new chunks after successful send
          newAudioChunksRef.current = [];
        } else {
          console.warn("No segments returned from Deepgram");
          setState((prev) => ({ ...prev, isSending: false }));
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to process audio";
        console.error("sendAudio error:", error);
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isSending: false,
        }));
      } finally {
        if (isStopPendingRef.current && mediaRecorder) {
          console.log("Processing pending stop after sendAudio");
          isStopPendingRef.current = false;
          if (stopTimeoutRef.current) {
            clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
          }
          mediaRecorder.stop();
          setMediaRecorder(null);
          await saveAudioLocally();
          setState((prev) => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            isSending: false,
            isStopping: false,
          }));
        }
      }
    },
    [
      isHydrated,
      token,
      state.doctorsNotes,
      state.physicalEvaluation,
      state.gender,
      state.age,
      mediaRecorder,
    ]
  );

  const saveAudioLocally = useCallback(async () => {
    if (allAudioChunksRef.current.length === 0) {
      console.warn("No audio chunks to save locally");
      return;
    }
    try {
      const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
      const audioBlob = new Blob(allAudioChunksRef.current, { type: mimeType });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");

      console.log("Sending to /api/save-audio:", {
        sessionId: sessionIdRef.current,
        audioSize: audioBlob.size,
        mimeType: mimeType,
      });

      const response = await fetch("/api/save-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          audio: { data: base64Data, type: mimeType },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(
          `Save audio request failed: HTTP ${response.status} - ${errorData}`
        );
        throw new Error(
          errorData || `Failed to save audio: HTTP ${response.status}`
        );
      }

      const { filename } = await response.json();
      audioFilenameRef.current = filename;
      console.log(`Saved audio to ${filename}`);
    } catch (error) {
      console.error("saveAudioLocally error:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save audio locally. Please check if the /api/save-audio endpoint supports POST requests.",
      }));
    }
  }, [mediaRecorder, token]);

  const uploadAudioToS3 = useCallback(async () => {
    if (!audioFilenameRef.current) {
      setState((prev) => ({
        ...prev,
        error: "No audio file to upload",
        isSending: false,
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isSending: true }));
    try {
      // Retrieve audio from server
      const getResponse = await fetch(
        `/api/get-audio?filename=${encodeURIComponent(
          audioFilenameRef.current
        )}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!getResponse.ok) {
        const errorData = await getResponse.json();
        throw new Error(errorData.message || "Failed to retrieve audio");
      }

      const { data: base64Data, mimetype } = await getResponse.json();
      const buffer = Buffer.from(base64Data, "base64");
      const audioBlob = new Blob([buffer], { type: mimetype });

      // Upload to S3
      const formData = new FormData();
      formData.append("audio", audioBlob, audioFilenameRef.current);
      formData.append("session_id", sessionIdRef.current);

      const uploadResponse = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(result.message || "Failed to upload audio to S3");
      }

      const audioUrl = result.audio_url;
      if (!audioUrl) {
        throw new Error("No audio URL returned from S3 upload");
      }

      // Prepare combined-create-v2 payload
      const conversationText = state.labeledSegments
        .map((seg) => `${seg.speaker}: ${seg.text}`)
        .join("\n");
      const payload: CombinedCreateRequest = {
        session_id: sessionIdRef.current,
        doctor_id: doctorId!,
        patient_summary: state.summary?.patient_summary || "",
        doctor_summary: state.summary?.doctor_summary || "",
        notes_summary: state.doctorsNotes || "",
        diagnosis: state.diagnosis?.diagnoses || [],
        data_json: {
          data: state.labeledSegments.map((segment) => ({
            [segment.speaker]: segment.text,
          })),
          patient_summary: state.summary?.patient_summary || "",
          doctor_summary: state.summary?.doctor_summary || "",
          doctor_note_summary: state.doctorsNotes || "",
          diagnoses: state.diagnosis?.diagnoses || [],
          symptoms: state.diagnosis?.symptoms || [],
          physical_evaluation: state.physicalEvaluation || "",
          gender: state.gender || "",
          age: state.age || "",
        },
        audio_url: audioUrl,
        conversation: conversationText,
        physical_evaluation: state.physicalEvaluation || "",
        gender: state.gender || "",
        age: state.age || "",
      };

      // Call combined-create-v2
      const createResult = await createCombined(token)(payload);
      if (!createResult.ok) {
        throw new Error(
          createResult.error || "Failed to create combined record"
        );
      }

      console.log("Combined record created:", createResult.value);

      // Delete local file
      const deleteResponse = await fetch("/api/delete-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ filename: audioFilenameRef.current }),
      });
      if (!deleteResponse.ok) {
        console.warn(
          "Failed to delete local audio file:",
          await deleteResponse.json()
        );
      } else {
        console.log("Deleted local audio file:", audioFilenameRef.current);
      }

      setState((prev) => ({
        ...prev,
        isSending: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      console.error(
        "Error uploading audio or creating combined record:",
        error
      );
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to upload audio or save session",
        isSending: false,
      }));
      return false;
    }
  }, [token, doctorId, state]);

  const startRecording = useCallback(async () => {
    if (!isHydrated) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "MediaDevices API not supported. Please ensure you're using a secure context (https) and a compatible browser."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      console.log(`Starting recording with MIME type: ${mimeType}`);
      const newMediaRecorder = new MediaRecorder(stream, { mimeType });
      allAudioChunksRef.current = [];
      newAudioChunksRef.current = [];
      isFinalSendRef.current = false;
      sessionIdRef.current = uuidv4();
      audioFilenameRef.current = null;

      newMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          allAudioChunksRef.current.push(event.data);
          newAudioChunksRef.current.push(event.data);
          console.log(`New audio chunk added, size: ${event.data.size} bytes`);
        }
      };

      newMediaRecorder.onstart = () => {
        sendIntervalRef.current = setInterval(() => {
          if (
            newMediaRecorder.state === "recording" &&
            !state.isSending &&
            !state.isPaused &&
            !isFinalSendRef.current &&
            newAudioChunksRef.current.length > 0
          ) {
            const audioBlob = new Blob(newAudioChunksRef.current, {
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
            !isFinalSendRef.current &&
            newAudioChunksRef.current.length > 0
          ) {
            const audioBlob = new Blob(newAudioChunksRef.current, {
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
        if (stopTimeoutRef.current) {
          clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }
      };

      newMediaRecorder.start(15000); // 15s chunks
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
        isStopping: false,
      }));
    } catch (error: any) {
      console.error("startRecording error:", error);
      setState((prev) => ({
        ...prev,
        error:
          error.message ||
          "Failed to start recording. Ensure microphone access is granted and you're using https.",
      }));
    }
  }, [isHydrated, sendAudio]);

  const pauseRecording = useCallback(async () => {
    if (!isHydrated || !mediaRecorder || mediaRecorder.state !== "recording") {
      setState((prev) => ({ ...prev, error: "No active recording to pause" }));
      return;
    }
    try {
      if (newAudioChunksRef.current.length > 0 && !isFinalSendRef.current) {
        isFinalSendRef.current = true;
        const audioBlob = new Blob(newAudioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await sendAudio(audioBlob);
      }
      mediaRecorder.pause();
      setState((prev) => ({ ...prev, isPaused: true, isSending: false }));
    } catch (error: any) {
      console.error("pauseRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to pause recording",
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
    } catch (error: any) {
      console.error("resumeRecording error:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to resume recording",
      }));
    }
  }, [isHydrated, mediaRecorder]);

  const stopRecording = useCallback(async () => {
    if (!isHydrated || !mediaRecorder) {
      setState((prev) => ({ ...prev, error: "No active recorder" }));
      return;
    }
    if (state.isSending) {
      console.log("Stop requested while sending, queuing stop");
      isStopPendingRef.current = true;
      setState((prev) => ({ ...prev, isStopping: true }));
      stopTimeoutRef.current = setTimeout(() => {
        console.warn("Force stopping recording due to timeout");
        isStopPendingRef.current = false;
        mediaRecorder.stop();
        setMediaRecorder(null);
        saveAudioLocally();
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          isSending: false,
          isStopping: false,
          error: "Recording stopped due to processing timeout",
        }));
      }, 20000); // Extended to 20s
      return;
    }
    try {
      if (newAudioChunksRef.current.length > 0 && !isFinalSendRef.current) {
        isFinalSendRef.current = true;
        const audioBlob = new Blob(newAudioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await sendAudio(audioBlob);
      }
      mediaRecorder.stop();
      setMediaRecorder(null);
      await saveAudioLocally();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        isSending: false,
        isStopping: false,
      }));
    } catch (error: any) {
      console.error("stopRecording error:", error);
      await saveAudioLocally();
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to stop recording",
        isSending: false,
        isStopping: false,
      }));
    }
  }, [isHydrated, mediaRecorder, sendAudio, state.isSending, saveAudioLocally]);

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
    sessionIdRef.current = uuidv4();
    allAudioChunksRef.current = [];
    newAudioChunksRef.current = [];
    audioFilenameRef.current = null;
  }, []);

  const handleAccept = useCallback(async () => {
    console.log("Accepted");
    const success = await uploadAudioToS3();
    if (success) {
      clearResults();
    }
  }, [uploadAudioToS3, clearResults]);

  const handleReject = useCallback(async () => {
    console.log("Rejected");
    const success = await uploadAudioToS3();
    if (success) {
      clearResults();
    }
  }, [uploadAudioToS3, clearResults]);

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
    <div className="flex flex-col min-h-screen bg-gray-100 p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
        Surge AI
      </h1>
      <div className="max-w-3xl mx-auto w-full">
        {state.error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm sm:text-base">
            {state.error}
          </div>
        )}
        {(state.isSending || state.isStopping) && (
          <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-md text-sm sm:text-base">
            {state.isStopping
              ? "Processing final audio chunk..."
              : "Processing audio, please wait..."}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Textarea
            value={state.doctorsNotes}
            onChange={handleDoctorsNotesChange}
            placeholder="Enter doctor's notes..."
            rows={4}
            className="w-full p-3 border rounded-md text-sm sm:text-base"
          />
          <Textarea
            value={state.physicalEvaluation}
            onChange={handlePhysicalEvaluationChange}
            placeholder="Enter physical evaluation (e.g., blood pressure, heart rate)..."
            rows={4}
            className="w-full p-3 border rounded-md text-sm sm:text-base"
          />
          <Select onValueChange={handleGenderChange} value={state.gender}>
            <SelectTrigger className="w-full p-3 text-sm sm:text-base">
              <SelectValue placeholder="Select Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={handleAgeChange} value={state.age}>
            <SelectTrigger className="w-full p-3 text-sm sm:text-base">
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
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <Button
            onClick={handleToggleRecording}
            className={`w-full sm:w-auto px-6 py-3 text-sm sm:text-base ${
              state.isRecording
                ? state.isPaused
                  ? "bg-yellow-400 hover:bg-yellow-500"
                  : "bg-yellow-400 hover:bg-yellow-500"
                : "bg-green-500 hover:bg-green-600"
            }`}
            disabled={state.isSending || state.isStopping}
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
              className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base bg-red-500 hover:bg-red-600"
            >
              Stop Recording
            </Button>
          )}
          {!state.isRecording && (
            <Button
              onClick={clearResults}
              className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base bg-gray-500 hover:bg-gray-600"
              disabled={
                state.isSending ||
                state.isStopping ||
                state.labeledSegments.length === 0
              }
            >
              Clear Results
            </Button>
          )}
        </div>
        {state.suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-lg sm:text-xl mb-2">
              Doctor Reply Suggestions
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
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
          <div className="mb-6">
            <h3 className="font-bold mb-2 text-lg sm:text-xl">Diagnosis</h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="mb-2 text-sm sm:text-base">
                <strong>Diagnoses:</strong>
              </p>
              <ul className="list-disc pl-5 mb-2 text-sm sm:text-base">
                {state.diagnosis.diagnoses.map((diag, index) => (
                  <li key={index}>
                    {formatText(diag.diagnosis)} (Likelihood: {diag.likelihood}
                    %)
                  </li>
                ))}
              </ul>
              <div className="h-32 sm:h-40">
                <Bar data={getChartData()} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
        {/* {state.summary && (
          <div className="mb-6">
            <h3 className="font-bold mb-2 text-lg sm:text-xl">
              Conversation Summary
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="mb-2 text-sm sm:text-base">
                <strong>Patient Summary:</strong>{" "}
                {formatText(state.summary.patient_summary)}
              </p>
              <p className="mb-2 text-sm sm:text-base">
                <strong>Doctor Summary:</strong>{" "}
                {formatText(state.summary.doctor_summary)}
              </p>
            </div>
          </div>
        )} */}
        {(state.keypoints.length > 0 || state.diagnosis || state.summary) && (
          <div className="mb-6">
            <h3 className="font-bold mb-2 text-lg sm:text-xl">
              Summary and Actions
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              {state.keypoints.length > 0 && (
                <>
                  <p className="mb-2 text-sm sm:text-base">
                    <strong>Key Points:</strong>
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-sm sm:text-base">
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
                  <p className="mb-2 text-sm sm:text-base">
                    <strong>Diagnosis:</strong>
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-sm sm:text-base">
                    {state.diagnosis.diagnoses.map((diag, index) => (
                      <li key={index}>
                        {formatText(diag.diagnosis)} (Likelihood:{" "}
                        {diag.likelihood}%)
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {state.summary && (
                <p className="mb-4 text-sm sm:text-base">
                  <strong>Patient Summary:</strong>{" "}
                  {formatText(state.summary.patient_summary)}
                </p>
              )}
              <div className="flex justify-end space-x-4">
                <Button
                  onClick={handleAccept}
                  className="w-full sm:w-auto px-6 py-2 text-sm sm:text-base bg-green-500 hover:bg-green-600"
                  disabled={state.isSending || state.isStopping}
                >
                  Accept
                </Button>
                <Button
                  onClick={handleReject}
                  className="w-full sm:w-auto px-6 py-2 text-sm sm:text-base bg-red-500 hover:bg-red-600"
                  disabled={state.isSending || state.isStopping}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )}
        {state.labeledSegments.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold mb-2 text-lg sm:text-xl">
              Labeled Conversation
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              {(state.isSending || state.isStopping) && (
                <p className="text-gray-500 text-sm mb-2">
                  {state.isStopping
                    ? "Processing final audio chunk..."
                    : "Processing audio chunk..."}
                </p>
              )}
              {state.labeledSegments.map((segment, index) => (
                <p key={index} className="mb-2 text-sm sm:text-base">
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
      {/* Keypoints Mobile */}
      <div className="sm:hidden fixed bottom-4 left-4">
        <Dialog
          open={isKeypointsOpen}
          onOpenChange={(open) => setIsKeypointsOpen(open)}
        >
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 p-3 rounded-full">
              <Menu className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="fixed bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg max-h-[50vh] overflow-y-auto">
            <h3 className="font-bold mb-2 text-lg">Key Points</h3>
            {state.keypoints.length > 0 ? (
              <ul className="list-disc pl-5 text-sm">
                {state.keypoints.map((keypoint, index) => (
                  <li key={index} className="mb-2">
                    {formatText(keypoint)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No key points available.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {/* Keypoints Sidebar Desktop */}
      <div className="hidden sm:block w-64 bg-white shadow-lg fixed right-0 top-0 h-full p-4">
        <h3 className="font-bold mb-2 text-lg">Key Points</h3>
        {state.keypoints.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {state.keypoints.map((keypoint, index) => (
              <li key={index} className="mb-2">
                {formatText(keypoint)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No key points available.</p>
        )}
      </div>
    </div>
  );
}
