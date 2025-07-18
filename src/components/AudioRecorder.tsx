"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import VitalsForm from "@/components/VitalsForm";
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
import { Card, CardTitle } from "./ui/card";
import { Menu } from "lucide-react";
import { Loader } from "./ui/loader";
import MaintenanceBanner from "./MaintenanceBanner";

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Get supported MIME type
const getSupportedMimeType = (): string => {
  if (typeof window === "undefined") return "audio/webm;codecs=opus";
  const types = ["audio/webm;codecs=opus", "audio/webm"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      console.log("Selected MIME type:", t);
      return t;
    }
  }
  console.warn("No supported audio format, defaulting to audio/webm");
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

// Centralized Vitals interface
export interface Vitals {
  blood_pressure?: string;
  heart_rate_bpm?: string;
  respiratory_rate_bpm?: string;
  spo2_percent?: string;
  pain_score?: number;
  weight_kg?: number;
  height_cm?: number;
  temperature_celsius?: number;
}

interface Diagnosis {
  diagnoses: Array<{ diagnosis: string; likelihood: number }>;
  symptoms: string[];
  source: string;
  similarity: number;
  doctors_notes: string;
  gender: string;
  age: number;
  vitals: Vitals;
  presenting_complaint: string;
  past_medical_history: string;
  drug_history: string;
  allergies: string;
  smoking_history: string;
  alcohol_history: string;
  social_history: string;
}

interface CombinedCreateRequest {
  session_id?: string;
  doctor_id?: string;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string;
  diagnosis?: Array<{ diagnosis: string; likelihood: number }>;
  data_json?: {
    data?: Array<{ [speaker: string]: string }>;
    patient_summary?: string;
    doctor_summary?: string;
    doctor_note_summary?: string;
    diagnoses?: Array<{ diagnosis: string; likelihood: number }>;
    symptoms?: string[];
    gender?: string;
    age?: number | null;
    vitals?: Vitals;
  };
  audio_url?: string;
  conversation?: string;
  gender?: string;
  age?: number | null;
  vitals?: Vitals;
}

interface CombinedCreateResponse {
  session_id?: string;
  summary_id?: string;
  diagnosis_validation_id?: string;
  gender?: string;
  age?: number | null;
  status?: number;
  message?: string;
  vitals?: Vitals;
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
  gender: string;
  age: string;
  language: string;
  session?: CombinedCreateResponse;
  vitals: Vitals;
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
    isStopping: false,
    doctorsNotes: "",
    gender: "",
    age: "",
    language: "en",
    session: undefined,
    vitals: {},
  });
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isKeypointsOpen, setIsKeypointsOpen] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef(uuidv4());
  const audioFilenameRef = useRef<string | null>(null);
  const isSendingLockRef = useRef(false);
  const doctorsNotesRef = useRef(state.doctorsNotes);
  const genderRef = useRef(state.gender);
  const ageRef = useRef(state.age);
  const vitalsRef = useRef(state.vitals);
  const [processingState, setProcessingState] = useState({
    lastProcessedTime: 0,
    isProcessing: false,
  });

  const audioQueueRef = useRef<Blob[]>([]);
  const sendIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    doctorsNotesRef.current = state.doctorsNotes;
  }, [state.doctorsNotes]);
  useEffect(() => {
    genderRef.current = state.gender;
  }, [state.gender]);
  useEffect(() => {
    ageRef.current = state.age;
  }, [state.age]);
  useEffect(() => {
    vitalsRef.current = state.vitals;
  }, [state.vitals]);

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

  const searchParams = useSearchParams();

  // Load session data from URL parameters
  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionParam));

        // Parse conversation into labeled segments
        if (sessionData.conversation) {
          const segments = sessionData.conversation
            .split(/(?:^|\n)(doctor:|patient:)/gi)
            .map((line: string) => line.trim())
            .filter(Boolean);

          const labeledSegments: { text: any; speaker: any }[] = [];
          for (let i = 0; i < segments.length; i += 2) {
            const speakerRaw = segments[i];
            const messageRaw = segments[i + 1] || "";
            const speaker = speakerRaw.toLowerCase().replace(":", "");
            const text = messageRaw.trim();

            if (["doctor", "patient"].includes(speaker) && text) {
              labeledSegments.push({ text, speaker });
            }
          }

          // Load diagnosis data from validation
          let diagnosis = null;
          if (sessionData.validation?.data_json) {
            const dataJson = sessionData.validation.data_json;
            diagnosis = {
              diagnoses: dataJson.diagnoses || [],
              symptoms: dataJson.symptoms || [],
              source: "",
              similarity: 0,
              doctors_notes: sessionData.validation.notes_summary || "",
              gender: dataJson.gender || "",
              age: dataJson.age || 0,
              vitals: {
                blood_pressure: dataJson.vitals?.blood_pressure || "",
                heart_rate_bpm: dataJson.vitals?.heart_rate_bpm || "",
                respiratory_rate_bpm:
                  dataJson.vitals?.respiratory_rate_bpm || "",
                spo2_percent: dataJson.vitals?.spo2_percent || "",
                pain_score: dataJson.vitals?.pain_score || 0,
                weight_kg: dataJson.vitals?.weight_kg || 0,
                height_cm: dataJson.vitals?.height_cm || 0,
                temperature_celsius: dataJson.vitals?.temperature_celsius || 0,
              },
              presenting_complaint: dataJson.presenting_complaint || "",
              past_medical_history: dataJson.past_medical_history || "",
              drug_history: dataJson.drug_history || "",
              allergies: dataJson.allergies || "",
              smoking_history: dataJson.smoking_history || "",
              alcohol_history: dataJson.alcohol_history || "",
              social_history: dataJson.social_history || "",
            };
          }

          setState((prev) => ({
            ...prev,
            labeledSegments,
            summary: sessionData.summary
              ? {
                  patient_summary: sessionData.summary.patient || "",
                  doctor_summary: sessionData.summary.doctor || "",
                }
              : null,
            diagnosis,
            keypoints: sessionData.validation?.data_json?.keypoints || [],
            doctorsNotes: sessionData.validation?.notes_summary || "",
            gender: sessionData.validation?.data_json?.gender || "",
            age: sessionData.validation?.data_json?.age?.toString() || "",
            vitals: sessionData.validation?.data_json?.vitals || {},
          }));
        }
      } catch (error) {
        console.error("Error parsing session data:", error);
      }
    }
  }, [searchParams]);

  // Set hydrated state and cleanup
  useEffect(() => {
    setIsHydrated(true);

    // Set up a global timer for debugging
    const debugInterval = window.setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log(`Audio queue size: ${audioQueueRef.current.length} chunks`);
      }
    }, 5000);

    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      if (sendIntervalRef.current !== null) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
      clearInterval(debugInterval);
      isSendingLockRef.current = false;
    };
  }, [mediaRecorder]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, error: null }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  // Handle inputs
  const handleDoctorsNotesChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setState((prev) => ({ ...prev, doctorsNotes: e.target.value }));
  };

  const handleGenderChange = (value: string) => {
    setState((prev) => ({ ...prev, gender: value }));
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, age: e.target.value }));
  };

  const handleLanguageChange = (value: string) => {
    setState((prev) => ({ ...prev, language: value }));
  };

  const handleVitalsChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof NonNullable<RecorderState["vitals"]>
  ) => {
    const value = e.target.value;
    setState((prev) => ({
      ...prev,
      vitals: {
        ...prev.vitals,
        [field]:
          field === "pain_score" ||
          field === "weight_kg" ||
          field === "height_cm" ||
          field === "temperature_celsius"
            ? value
              ? parseFloat(value)
              : undefined
            : value || undefined,
      },
    }));
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

    return { labels, datasets };
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
      y: { stacked: true, display: false },
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

  const saveAudioLocally = useCallback(
    async (audioBlobParam?: Blob, startTime: number = Date.now()) => {
      if (audioChunksRef.current.length === 0) {
        console.warn("No audio chunks to save locally");
        return;
      }
      try {
        const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
        const audioBlob =
          audioBlobParam ??
          new Blob(audioChunksRef.current, { type: mimeType });

        const formData = new FormData();
        formData.append("sessionId", sessionIdRef.current);
        const ext = mediaRecorder?.mimeType?.includes("webm") ? "webm" : "wav";
        formData.append(
          "audio",
          audioBlob,
          `chunk-${sessionIdRef.current}-${startTime}.${ext}`
        );

        const response = await fetch("/api/save-audio", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Save audio failed:", errorText);
          throw new Error(
            errorText || `Failed to save audio: HTTP ${response.status}`
          );
        }

        const { filename } = await response.json();
        audioFilenameRef.current = filename;
      } catch (error) {
        console.error("saveAudioLocally error:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to save audio locally.",
        }));
      }
    },
    [mediaRecorder, token]
  );

  const sendAudio = useCallback(
    async (
      audioBlob: Blob,
      startTime: number,
      doctorsNotes: string,
      gender: string,
      age: string,
      vitals: RecorderState["vitals"],
      isFinalSend: boolean = false
    ) => {
      if (!isHydrated) {
        console.warn("Skipping send - not hydrated");
        return;
      }

      // Skip if we're already sending and this isn't the final send
      if (!isFinalSend && isSendingLockRef.current) {
        console.log("Skipping concurrent send");
        return;
      }

      isSendingLockRef.current = true;
      setState((prev) => ({ ...prev, isSending: true }));

      try {
        // Enhanced validation
        if (audioBlob.size < 10_000) {
          throw new Error("Audio too small for processing");
        }

        const formData = new FormData();
        const mime = mediaRecorder?.mimeType || getSupportedMimeType();
        const ext = mime.includes("webm") ? "webm" : "wav";
        formData.append(
          "audio",
          audioBlob,
          `chunk-${sessionIdRef.current}-${startTime}.${ext}`
        );
        formData.append("language", state.language);

        // Add metadata to help with debugging
        formData.append(
          "metadata",
          JSON.stringify({
            size: audioBlob.size,
            type: mime,
            timestamp: new Date().toISOString(),
            isFinal: isFinalSend,
          })
        );

        // Timeout after 15 seconds
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            errorText || `Transcription failed: ${response.status}`
          );
        }

        // Rest of your existing processing logic...
        // [Keep all your existing transcription processing code]
      } catch (error) {
        console.error("Audio processing error:", error);

        setState((prev) => ({
          ...prev,
          isSending: false,
          isStopping: isFinalSend ? false : prev.isStopping,
        }));
      } finally {
        isSendingLockRef.current = false;
        console.log("Audio processing completed");
      }
    },
    [token, isHydrated, mediaRecorder]
  );

  // Function to create a combined record with empty/default values when there's no audio
  const createEmptyCombinedRecord = useCallback(async () => {
    setState((prev) => ({ ...prev, isSending: true }));
    try {
      // Create a minimal valid payload - only include required fields
      const payload: CombinedCreateRequest = {
        session_id: sessionIdRef.current,
        doctor_id: doctorId || "",
        age: null,
        data_json: {
          data: [],
          diagnoses: [],
          symptoms: [],
          age: null,
        },
        diagnosis: [],
        audio_url: "",
        conversation: "",
      };

      const createResult = await createCombined(token)(payload);
      if (!createResult.ok) {
        throw new Error(
          createResult.error || "Failed to create combined record"
        );
      }

      setState((prev) => ({
        ...prev,
        isSending: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      console.error("Error creating empty combined record:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to create record. Please try again.",
        isSending: false,
      }));
      return false;
    }
  }, [token, doctorId, state, createCombined]);

  const uploadAudioToS3 = useCallback(async () => {
    if (!audioFilenameRef.current) {
      // Just return success if there's no audio file
      return true;
    }

    setState((prev) => ({ ...prev, isSending: true }));
    try {
      const getResponse = await fetch(
        `/api/get-audio?filename=${encodeURIComponent(
          audioFilenameRef.current
        )}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!getResponse.ok) {
        const errorData = await getResponse.json();
        throw new Error(errorData.message || "Failed to retrieve audio");
      }

      const { data: base64Data, mimetype } = await getResponse.json();
      const buffer = Buffer.from(base64Data, "base64");
      const audioBlob = new Blob([buffer], { type: mimetype });

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
        if (
          result.message.includes("not authorized") ||
          result.message.includes("s3:PutObject")
        ) {
          throw new Error(
            "AWS permissions error: Unable to upload to S3. Contact your administrator."
          );
        }
        throw new Error(result.message || "Failed to upload audio to S3");
      }

      const audioUrl = result.audio_url;
      if (!audioUrl) {
        throw new Error("No audio URL returned from S3 upload");
      }

      // Ensure we have a valid conversation text even if segments are empty
      const conversationText =
        state.labeledSegments.length > 0
          ? state.labeledSegments
              .map((seg) => `${seg.speaker}: ${seg.text}`)
              .join("\n")
          : ""; // Empty string if no segments

      // Create a payload with all fields explicitly set to empty values if they don't exist
      const payload: CombinedCreateRequest = {
        session_id: sessionIdRef.current,
        doctor_id: doctorId || "",
        patient_summary: state.summary?.patient_summary || "",
        doctor_summary: state.summary?.doctor_summary || "",
        notes_summary: state.doctorsNotes || "",
        // Always provide an array for diagnosis, even if empty
        diagnosis: state.diagnosis?.diagnoses || [],
        data_json: {
          // Handle empty segments case
          data:
            state.labeledSegments.length > 0
              ? state.labeledSegments.map((segment) => ({
                  [segment.speaker]: segment.text,
                }))
              : [],
          patient_summary: state.summary?.patient_summary || "",
          doctor_summary: state.summary?.doctor_summary || "",
          doctor_note_summary: state.doctorsNotes || "",
          diagnoses: state.diagnosis?.diagnoses || [],
          symptoms: state.diagnosis?.symptoms || [],
          gender: state.gender || "",
          // Fix: Ensure age is an integer (0 if empty)
          age: state.age ? parseInt(state.age) : null,
          vitals: {
            blood_pressure: state.vitals?.blood_pressure || "",
            heart_rate_bpm: state.vitals?.heart_rate_bpm || "",
            respiratory_rate_bpm: state.vitals?.respiratory_rate_bpm || "",
            spo2_percent: state.vitals?.spo2_percent || "",
            pain_score: state.vitals?.pain_score || 0,
            weight_kg: state.vitals?.weight_kg || 0,
            height_cm: state.vitals?.height_cm || 0,
            temperature_celsius: state.vitals?.temperature_celsius || 0,
          },
        },
        audio_url: audioUrl || "",
        conversation: conversationText,
        gender: state.gender || "",
        // Fix: Ensure age is an integer (0 if empty)
        age: state.age ? parseInt(state.age) : null,
        vitals: {
          blood_pressure: state.vitals?.blood_pressure || "",
          heart_rate_bpm: state.vitals?.heart_rate_bpm || "",
          respiratory_rate_bpm: state.vitals?.respiratory_rate_bpm || "",
          spo2_percent: state.vitals?.spo2_percent || "",
          pain_score: state.vitals?.pain_score || 0,
          weight_kg: state.vitals?.weight_kg || 0,
          height_cm: state.vitals?.height_cm || 0,
          temperature_celsius: state.vitals?.temperature_celsius || 0,
        },
      };

      const createResult = await createCombined(token)(payload);
      if (!createResult.ok) {
        throw new Error(
          createResult.error || "Failed to create combined record"
        );
      }

      const sessionResponse = createResult.value;
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
      const errorMessage = error.message.includes("AWS permissions error")
        ? error.message
        : error.message ||
          "Failed to upload audio or save session. Please try again.";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isSending: false,
      }));
      return false;
    }
  }, [token, doctorId, state, createCombined]);

  const createInitialSegments = (transcript: string) => {
    return transcript
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 5)
      .map((text, index) => {
        const lowerText = text.toLowerCase();
        let speaker: string;

        // Patient indicators
        const patientKeywords = [
          "i have",
          "i feel",
          "i went",
          "i had",
          "i woke",
          "i vomited",
          "i didn't",
          "i do",
          "i've never",
          "my stomach",
          "last night",
          "when i",
          "i don't have",
          "hi doctor",
          "doctor i",
          "help me",
          "i'm feeling",
          "i experience",
        ];

        // Doctor indicators
        const doctorKeywords = [
          "what",
          "how",
          "when",
          "where",
          "can you",
          "tell me",
          "describe",
          "any",
          "do you",
          "have you",
          "let me",
          "i recommend",
          "take this",
          "you should",
          "i suggest",
          "based on",
        ];

        const hasPatientKeywords = patientKeywords.some((keyword) =>
          lowerText.includes(keyword)
        );

        const hasDoctorKeywords = doctorKeywords.some((keyword) =>
          lowerText.includes(keyword)
        );

        if (hasPatientKeywords && !hasDoctorKeywords) {
          speaker = "patient";
        } else if (hasDoctorKeywords && !hasPatientKeywords) {
          speaker = "doctor";
        } else if (
          lowerText.includes("doctor") &&
          !lowerText.startsWith("doctor")
        ) {
          // If "doctor" is mentioned but not at start, likely patient speaking
          speaker = "patient";
        } else {
          // Default alternating pattern starting with patient
          speaker = index % 2 === 0 ? "patient" : "doctor";
        }

        return { text, speaker };
      });
  };

  const sendToDeepgram = async (blob: Blob, ts: number) => {
    const formData = new FormData();
    const mime = mediaRecorder?.mimeType || getSupportedMimeType();
    const ext = mime.includes("webm") ? "webm" : "wav";

    formData.append(
      "audio",
      blob,
      `chunk-${sessionIdRef.current}-${ts}.${ext}`
    );
    formData.append("language", state.language);

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("/api/deepgram/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error("Transcription request timed out after 15 seconds");
      }
      throw error;
    }
  };

  const processThroughPipeline = async (
    transcript: string,
    timestamp: number
  ) => {
    try {
      console.log(
        "Starting pipeline processing with transcript:",
        transcript.substring(0, 100)
      );

      // Initial segmentation
      const segments = createInitialSegments(transcript);
      console.log("Created segments:", segments.length);

      // Label conversation
      console.log("Calling labelConversation API...");
      const labeledResult = await labelConversation(token)({ data: segments });
      const labeledData = labeledResult.ok
        ? labeledResult.value?.data
        : segments;
      console.log(
        "Label conversation result:",
        labeledResult.ok ? "success" : "failed"
      );

      const formattedConversation = labeledData
        .filter((s) => s.text.trim().length >= 5)
        .map((s) => ({
          text: s.text.trim(),
          speaker: s.speaker,
        }));

      console.log(
        "Formatted conversation segments:",
        formattedConversation.length
      );
      if (formattedConversation.length === 0) {
        console.log("No valid conversation segments, skipping pipeline");
        return;
      }

      // Prepare conversation data
      const conversationData = {
        data: formattedConversation.map((s) => ({ [s.speaker]: s.text })),
      };
      console.log("Prepared conversation data for APIs");

      // Execute all API calls in parallel with individual error handling
      console.log("Starting parallel API calls...");
      const [suggestions, summary, diagnosis, keypoints] =
        await Promise.allSettled([
          getSuggestions(token)(conversationData)
            .then((res) => {
              console.log(
                "Suggestions API result:",
                res.ok ? "success" : "failed"
              );
              return res.ok ? res.value?.suggestions : [];
            })
            .catch((err) => {
              console.error("Suggestions API error:", err);
              return [];
            }),

          getSummary(token)(conversationData)
            .then((res) => {
              console.log("Summary API result:", res.ok ? "success" : "failed");
              return res.ok ? res.value : null;
            })
            .catch((err) => {
              console.error("Summary API error:", err);
              return null;
            }),

          getDiagnosis(token)({
            conversation_input: conversationData,
            doctors_notes: doctorsNotesRef.current,
            gender: genderRef.current,
            age: ageRef.current ? parseInt(ageRef.current) : null,
            vitals: vitalsRef.current,
            threshold: 0.7,
          })
            .then((res) => {
              console.log(
                "Diagnosis API result:",
                res.ok ? "success" : "failed"
              );
              return res.ok
                ? res.value
                : {
                    diagnoses: [
                      { diagnosis: "Diagnosis pending", likelihood: 0 },
                    ],
                    symptoms: [],
                    source: "",
                    similarity: 0,
                    doctors_notes: "",
                    gender: "",
                    age: 0,
                    vitals: {
                      blood_pressure: "",
                      heart_rate_bpm: "",
                      respiratory_rate_bpm: "",
                      spo2_percent: "",
                      pain_score: 0,
                      weight_kg: 0,
                      height_cm: 0,
                      temperature_celsius: 0,
                    },
                    presenting_complaint: "",
                    past_medical_history: "",
                    drug_history: "",
                    allergies: "",
                    smoking_history: "",
                    alcohol_history: "",
                    social_history: "",
                  };
            })
            .catch((err) => {
              console.error("Diagnosis API error:", err);
              return {
                diagnoses: [{ diagnosis: "Diagnosis failed", likelihood: 0 }],
                symptoms: [],
                source: "",
                similarity: 0,
                doctors_notes: "",
                gender: "",
                age: 0,
                vitals: {
                  blood_pressure: "",
                  heart_rate_bpm: "",
                  respiratory_rate_bpm: "",
                  spo2_percent: "",
                  pain_score: 0,
                  weight_kg: 0,
                  height_cm: 0,
                  temperature_celsius: 0,
                },
                presenting_complaint: "",
                past_medical_history: "",
                drug_history: "",
                allergies: "",
                smoking_history: "",
                alcohol_history: "",
                social_history: "",
              };
            }),

          getKeypoints(token)({
            conversation_input: conversationData,
            doctors_notes: doctorsNotesRef.current,
          })
            .then((res) => {
              console.log(
                "Keypoints API result:",
                res.ok ? "success" : "failed"
              );
              return res.ok ? res.value?.keypoints : [];
            })
            .catch((err) => {
              console.error("Keypoints API error:", err);
              return [];
            }),
        ]);

      // Extract results from Promise.allSettled
      const suggestionsResult =
        suggestions.status === "fulfilled" ? suggestions.value : [];
      const summaryResult =
        summary.status === "fulfilled" ? summary.value : null;
      const diagnosisResult =
        diagnosis.status === "fulfilled" ? diagnosis.value : null;
      const keypointsResult =
        keypoints.status === "fulfilled" ? keypoints.value : [];

      console.log("All API calls completed. Results:", {
        suggestions: suggestionsResult?.length || 0,
        summary: summaryResult ? "present" : "null",
        diagnosis: diagnosisResult?.diagnoses?.length || 0,
        keypoints: keypointsResult?.length || 0,
      });

      // Update state with all results - replace conversation instead of appending
      setState((prev) => ({
        ...prev,
        labeledSegments: formattedConversation, // Replace instead of append
        suggestions: suggestionsResult || prev.suggestions,
        summary: summaryResult || prev.summary,
        diagnosis: diagnosisResult || prev.diagnosis,
        keypoints: keypointsResult || prev.keypoints,
        isSending: false,
      }));

      console.log("Pipeline processing completed successfully");
    } catch (error) {
      console.error("Pipeline error:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Pipeline processing failed",
        isSending: false,
      }));
      throw error;
    }
  };

  const processAudioQueue = useCallback(
    async (forceProcess = false) => {
      // Skip if already processing
      if (isSendingLockRef.current) {
        console.log("Already processing audio, skipping this batch");
        return;
      }

      // Skip if no audio unless we're forcing processing
      if (audioQueueRef.current.length === 0) {
        console.log("No audio to process");
        return;
      }

      console.log(`Processing ${audioQueueRef.current.length} audio chunks`);
      isSendingLockRef.current = true;
      setState((s) => ({ ...s, isSending: true }));

      // Take current batch and reset queue
      const batch = audioQueueRef.current.slice();
      const ts = Date.now();
      audioQueueRef.current = [];

      try {
        const blob = new Blob(batch, {
          type: mediaRecorder?.mimeType || getSupportedMimeType(),
        });

        const blobSize = blob.size;
        console.log(`Audio blob size: ${blobSize} bytes`);

        // Process even small batches if forced
        if (blobSize < 10000 && !forceProcess) {
          console.warn("Audio batch too small:", blobSize);
          isSendingLockRef.current = false;
          setState((s) => ({ ...s, isSending: false }));
          return;
        }

        // 1) send to Deepgram with clear logging
        console.log("Sending audio to Deepgram for transcription");
        const form = new FormData();
        const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
        const ext = mimeType.includes("webm") ? "webm" : "wav";
        const filename = `chunk-${sessionIdRef.current}-${ts}.${ext}`;
        form.append("audio", blob, filename);
        form.append("language", state.language);
        console.log(`Sending file: ${filename} (${blobSize} bytes)`);

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          console.log("Transcription request timed out, aborting");
          controller.abort();
        }, 15000);

        console.log("Sending transcription request...");
        const dgRes = await fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        clearTimeout(timeout);
        console.log(`Transcription response status: ${dgRes.status}`);

        if (!dgRes.ok) throw new Error(`Deepgram error: ${dgRes.status}`);
        const data = await dgRes.json();
        const text = data.text || "";

        if (!text.trim()) {
          console.log("Empty transcription received, skipping pipeline");
          isSendingLockRef.current = false;
          setState((s) => ({ ...s, isSending: false }));
          return;
        }

        console.log("Transcription received:", text.substring(0, 50) + "...");

        // 2) run your pipeline
        await processThroughPipeline(text, ts);
      } catch (err: any) {
        console.error("processAudioQueue error:", err);
        setState((s) => ({ ...s, error: err.message }));
      } finally {
        console.log("Audio processing completed, releasing lock");
        isSendingLockRef.current = false;
        setState((s) => ({ ...s, isSending: false }));
      }
    },
    [mediaRecorder, token, processThroughPipeline]
  );

  // We don't need this function anymore as we're using timeslice directly

  const startRecording = useCallback(async () => {
    if (!isHydrated) return;

    // reset everything
    audioChunksRef.current = [];
    sessionIdRef.current = uuidv4();
    isSendingLockRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      // Create a new recorder that collects data every 10 seconds exactly
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        console.log(`Audio chunk received: ${e.data.size} bytes`);
        if (e.data.size < 1024) return; // drop tiny chunks

        // Add to accumulated audio chunks
        audioChunksRef.current.push(e.data);

        // Skip if we're already processing
        if (isSendingLockRef.current) {
          console.log("Already processing audio, will process on next chunk");
          return;
        }

        // Create a blob with ALL accumulated audio so far
        const completeAudio = new Blob(audioChunksRef.current, {
          type: mimeType,
        });
        const ts = Date.now();

        console.log(
          `Sending complete audio (${completeAudio.size} bytes) to transcription`
        );

        // Set lock to prevent concurrent processing
        isSendingLockRef.current = true;
        setState((s) => ({ ...s, isSending: true }));

        // Create a form and send the complete audio
        const form = new FormData();
        const ext = mimeType.includes("webm") ? "webm" : "wav";
        form.append(
          "audio",
          completeAudio,
          `complete-${sessionIdRef.current}-${ts}.${ext}`
        );
        form.append("language", state.language);

        fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: form,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((response) => {
            if (!response.ok)
              throw new Error(`Transcription failed: ${response.status}`);
            return response.json();
          })
          .then((data) => {
            const text = data.text || "";
            if (text.trim()) {
              return processThroughPipeline(text, ts);
            }
          })
          .catch((err) => {
            console.error("Transcription error:", err);
            setState((s) => ({
              ...s,
              error: err instanceof Error ? err.message : "Transcription error",
            }));
          })
          .finally(() => {
            // Release lock when done
            isSendingLockRef.current = false;
            setState((s) => ({ ...s, isSending: false }));
          });
      };

      recorder.onstop = () => {
        console.log("MediaRecorder stopped, releasing tracks");
        stream.getTracks().forEach((t) => t.stop());
      };

      // Start recording with exactly 10 second timeslice
      recorder.start(10000); // Get data every 10 seconds exactly

      setMediaRecorder(recorder);
      setState((s) => ({
        ...s,
        isRecording: true,
        isPaused: false,
        error: null,
      }));

      console.log("Recording started with 10-second timeslice");
    } catch (err: any) {
      console.error("startRecording failed:", err);
      setState((s) => ({ ...s, error: err.message || "Cannot access mic." }));
    }
  }, [isHydrated, token, processThroughPipeline]);

  const pauseRecording = useCallback(async () => {
    if (!mediaRecorder) return;

    if (mediaRecorder.state === "recording") {
      console.log("Pausing recording");

      // First pause the recorder
      mediaRecorder.pause();
      setState((s) => ({ ...s, isPaused: true }));

      // Wait for current processing to finish, then send final audio
      setTimeout(async () => {
        // Wait for current transcription to finish
        while (isSendingLockRef.current) {
          await new Promise((r) => setTimeout(r, 100));
        }

        // Process accumulated audio
        if (audioChunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType || getSupportedMimeType();
          const completeAudio = new Blob(audioChunksRef.current, {
            type: mimeType,
          });
          const ts = Date.now();

          console.log(`Sending paused audio (${completeAudio.size} bytes)`);

          isSendingLockRef.current = true;
          setState((s) => ({ ...s, isSending: true }));

          try {
            const form = new FormData();
            const ext = mimeType.includes("webm") ? "webm" : "wav";
            form.append(
              "audio",
              completeAudio,
              `pause-${sessionIdRef.current}-${ts}.${ext}`
            );
            form.append("language", state.language);

            const response = await fetch("/api/deepgram/transcribe", {
              method: "POST",
              body: form,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.text || "";
              if (text.trim()) {
                await processThroughPipeline(text, ts);
              }
            }
          } catch (err) {
            console.error("Pause transcription error:", err);
          } finally {
            isSendingLockRef.current = false;
            setState((s) => ({ ...s, isSending: false }));
          }
        }
      }, 100);
    } else {
      console.log("Resuming recording");
      try {
        mediaRecorder.resume();
        setState((s) => ({ ...s, isPaused: false }));
      } catch (err) {
        console.error("Error resuming recording:", err);
        if (mediaRecorder.state !== "inactive") {
          try {
            mediaRecorder.stop();
          } catch (stopErr) {
            console.error(
              "Error stopping recorder after resume failure:",
              stopErr
            );
          }
        }
        startRecording();
      }
    }
  }, [mediaRecorder, token, processThroughPipeline, startRecording]);

  const stopRecording = useCallback(async () => {
    console.log("Stopping recording");

    setState((s) => ({ ...s, isStopping: true }));

    try {
      // If we're currently sending audio, just wait for it to complete
      if (isSendingLockRef.current) {
        console.log("Transcription in progress, waiting for it to complete");
        // Wait for current transcription to finish (up to 5 seconds)
        for (let i = 0; i < 50; i++) {
          if (!isSendingLockRef.current) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        console.log("Finished waiting for transcription");
      }

      // Process final audio before stopping
      if (audioChunksRef.current.length > 0 && !isSendingLockRef.current) {
        console.log("Processing final audio before stopping");
        const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
        const completeAudio = new Blob(audioChunksRef.current, {
          type: mimeType,
        });
        const ts = Date.now();

        isSendingLockRef.current = true;
        setState((s) => ({ ...s, isSending: true }));

        try {
          const form = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : "wav";
          form.append(
            "audio",
            completeAudio,
            `final-${sessionIdRef.current}-${ts}.${ext}`
          );
          form.append("language", state.language);

          const response = await fetch("/api/deepgram/transcribe", {
            method: "POST",
            body: form,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.text || "";
            if (text.trim()) {
              await processThroughPipeline(text, ts);
            }
          }
        } catch (err) {
          console.error("Final transcription error:", err);
        } finally {
          isSendingLockRef.current = false;
          setState((s) => ({ ...s, isSending: false }));
        }
      }

      // Stop the recorder
      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("Stopping MediaRecorder");
        mediaRecorder.stop();
      }

      setMediaRecorder(null);
      setState((s) => ({ ...s, isRecording: false }));

      // Send to final label API after all processing is complete
      // This ensures we have the most up-to-date labeled segments
      setTimeout(async () => {
        if (state.labeledSegments.length > 0) {
          console.log("Sending to final label API");
          setState((s) => ({ ...s, isSending: true }));

          try {
            // const result = await finalLabelConversation(token)({
            //   data: state.labeledSegments,
            // });
            // if (!result.ok) {
            //   throw new Error(result.error || "Final label failed");
            // }
            // console.log("Final label result received:", result.value);
            // setState((s) => ({
            //   ...s,
            //   labeledSegments: result.value?.data || s.labeledSegments,
            //   isSending: false,
            // }));
          } catch (err) {
            // console.error("Final label error:", err);
            // setState((s) => ({
            //   ...s,
            //   isSending: false,
            //   error:
            //     err instanceof Error
            //       ? err.message
            //       : "Failed to process final labeling",
            // }));
          }
        }
      }, 1000); // Longer delay to ensure all processing is complete
    } catch (err: any) {
      console.error("Error stopping recording:", err);
      setState((s) => ({
        ...s,
        error: err.message || "Error stopping recording",
      }));
    } finally {
      setState((s) => ({ ...s, isStopping: false }));
    }
  }, [mediaRecorder, token, processThroughPipeline, state.labeledSegments]);

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
      gender: "",
      age: "",
      session: undefined,
      vitals: {},
      isRecording: false,
      isPaused: false,
      isStopping: false,
    }));

    // reset everything
    sessionIdRef.current = uuidv4();
    audioChunksRef.current = [];
    audioQueueRef.current = [];
    startTimeRef.current = 0;

    if (sendIntervalRef.current !== null) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    isSendingLockRef.current = false;
    console.log("Results cleared:", new Date().toISOString());
  }, []);

  const handleAccept = useCallback(async () => {
    try {
      // If there's no audio at all, just create a minimal record
      if (audioChunksRef.current.length === 0 && !audioFilenameRef.current) {
        // Create a minimal valid payload directly
        setState((prev) => ({ ...prev, isSending: true }));

        try {
          // Create a minimal valid payload with only required fields
          const payload = {
            session_id: sessionIdRef.current,
            doctor_id: doctorId || "",
            // Include minimal data to avoid validation errors
            diagnosis: [],
            // Fix: Use null for age instead of 0
            age: null,
            data_json: {
              data: [],
              diagnoses: [],
              symptoms: [],
              // Fix: Use null for age instead of 0
              age: null,
            },
            vitals: {
              pain_score: 0,
              weight_kg: 0,
              height_cm: 0,
              temperature_celsius: 0,
            },
          };

          console.log("Creating minimal record:", JSON.stringify(payload));

          const createResult = await createCombined(token)(payload);
          if (!createResult.ok) {
            console.error(
              "Failed to create minimal record:",
              createResult.error
            );
            throw new Error(createResult.error || "Failed to create record");
          }

          return;
        } catch (err) {
          console.error("Error creating minimal record:", err);
          throw err;
        } finally {
          setState((prev) => ({ ...prev, isSending: false }));
        }
      }

      // First save audio locally if not already saved
      if (!audioFilenameRef.current && audioChunksRef.current.length > 0) {
        const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await saveAudioLocally(audioBlob);
      }

      // Then upload to S3 and create combined record
      const success = await uploadAudioToS3();
      if (success) {
        clearResults();
      }
    } catch (error) {
      console.error("Error in handleAccept:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process acceptance",
        isSending: false,
      }));
    }
  }, [
    uploadAudioToS3,
    clearResults,
    saveAudioLocally,
    mediaRecorder,
    createCombined,
    token,
    doctorId,
  ]);

  const handleReject = useCallback(async () => {
    try {
      // If there's no audio at all, just create a minimal record
      if (audioChunksRef.current.length === 0 && !audioFilenameRef.current) {
        // Create a minimal valid payload directly
        setState((prev) => ({ ...prev, isSending: true }));

        try {
          // Create a minimal valid payload with only required fields
          const payload = {
            session_id: sessionIdRef.current,
            doctor_id: doctorId || "",
            // Include minimal data to avoid validation errors
            diagnosis: [],
            // Fix: Use null for age instead of 0
            age: null,
            data_json: {
              data: [],
              diagnoses: [],
              symptoms: [],
              // Fix: Use null for age instead of 0
              age: null,
            },
            vitals: {
              pain_score: 0,
              weight_kg: 0,
              height_cm: 0,
              temperature_celsius: 0,
            },
          };

          console.log(
            "Creating minimal record (reject):",
            JSON.stringify(payload)
          );

          const createResult = await createCombined(token)(payload);
          if (!createResult.ok) {
            console.error(
              "Failed to create minimal record:",
              createResult.error
            );
            throw new Error(createResult.error || "Failed to create record");
          }

          clearResults();
          return;
        } catch (err) {
          console.error("Error creating minimal record:", err);
          throw err;
        } finally {
          setState((prev) => ({ ...prev, isSending: false }));
        }
      }

      // First save audio locally if not already saved
      if (!audioFilenameRef.current && audioChunksRef.current.length > 0) {
        const mimeType = mediaRecorder?.mimeType || getSupportedMimeType();
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await saveAudioLocally(audioBlob);
      }

      // Then upload to S3 and create combined record
      const success = await uploadAudioToS3();
      if (success) {
        clearResults();
      }
    } catch (error) {
      console.error("Error in handleReject:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process rejection",
        isSending: false,
      }));
    }
  }, [
    uploadAudioToS3,
    clearResults,
    saveAudioLocally,
    mediaRecorder,
    createCombined,
    token,
    doctorId,
  ]);

  const handleSendForDiagnosis = useCallback(async () => {
    setState((s) => ({ ...s, isSending: true }));

    try {
      // Prepare the payload for diagnosis with proper types
      const payload = {
        doctors_notes: doctorsNotesRef.current || "",
        gender: genderRef.current || "",
        age: ageRef.current ? parseInt(ageRef.current) : null,
        threshold: 0.5,
        vitals: {
          blood_pressure: vitalsRef.current?.blood_pressure || "",
          heart_rate_bpm: vitalsRef.current?.heart_rate_bpm || "",
          respiratory_rate_bpm: vitalsRef.current?.respiratory_rate_bpm || "",
          spo2_percent: vitalsRef.current?.spo2_percent || "",
          pain_score: vitalsRef.current?.pain_score || 0,
          weight_kg: vitalsRef.current?.weight_kg || 0,
          height_cm: vitalsRef.current?.height_cm || 0,
          temperature_celsius: vitalsRef.current?.temperature_celsius || 0,
        },
      };

      // Send request to the diagnosis endpoint
      const response = await fetch("/api/rag/diagnose_dn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Diagnosis failed: ${response.status}`);
      }

      const result = await response.json();

      // Update state with diagnosis and keypoints results
      setState((s) => ({
        ...s,
        diagnosis: {
          diagnoses: result.diagnoses || [],
          symptoms: result.symptoms || [],
          source: result.source || "",
          similarity: result.similarity || 0,
          doctors_notes: result.doctors_notes || "",
          gender: result.gender || "",
          age: result.age || 0,
          vitals: result.vitals || {},
          presenting_complaint: result.presenting_complaint || "",
          past_medical_history: result.past_medical_history || "",
          drug_history: result.drug_history || "",
          allergies: result.allergies || "",
          smoking_history: result.smoking_history || "",
          alcohol_history: result.alcohol_history || "",
          social_history: result.social_history || "",
        },
        keypoints: result.keypoints || [],
        error: null,
      }));

      console.log("Diagnosis received:", result);
    } catch (err) {
      console.error("Diagnosis error:", err);
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to get diagnosis",
      }));
    } finally {
      setState((s) => ({ ...s, isSending: false }));
    }
  }, [token]);

  const handleToggleRecording = useCallback(async () => {
    if (!isHydrated) {
      console.warn("Toggle recording skipped: not hydrated");
      return;
    }
    if (state.isRecording) {
      // Immediately update UI to show recording has stopped
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
      setMediaRecorder(null);
      setState((s) => ({ ...s, isRecording: false }));

      // Process final audio after current processing finishes
      setTimeout(async () => {
        // Wait for current processing to finish
        while (isSendingLockRef.current) {
          await new Promise((r) => setTimeout(r, 100));
        }

        // Process final accumulated audio
        if (audioChunksRef.current.length > 0) {
          const mimeType = getSupportedMimeType();
          const completeAudio = new Blob(audioChunksRef.current, {
            type: mimeType,
          });
          const ts = Date.now();

          console.log(`Sending final audio (${completeAudio.size} bytes)`);

          isSendingLockRef.current = true;
          setState((s) => ({ ...s, isSending: true }));

          try {
            const form = new FormData();
            const ext = mimeType.includes("webm") ? "webm" : "wav";
            form.append(
              "audio",
              completeAudio,
              `final-${sessionIdRef.current}-${ts}.${ext}`
            );
            form.append("language", state.language);

            const response = await fetch("/api/deepgram/transcribe", {
              method: "POST",
              body: form,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.text || "";
              if (text.trim()) {
                await processThroughPipeline(text, ts);
              }
            }
          } catch (err) {
            console.error("Final transcription error:", err);
          } finally {
            isSendingLockRef.current = false;
            setState((s) => ({ ...s, isSending: false, isStopping: false }));
          }
        } else {
          setState((s) => ({ ...s, isStopping: false }));
        }
      }, 100);
    } else {
      await startRecording();
    }
  }, [
    isHydrated,
    state.isRecording,
    startRecording,
    mediaRecorder,
    token,
    processThroughPipeline,
  ]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      <MaintenanceBanner />
      <p className="font-bold text-xl">Home</p>
      <div className="mt-8 flex gap-4">
        <Card className="w-full sm:w-8/12 p-8 ">
          <CardTitle>Start a New Consultation</CardTitle>
          <div>
            {state.error && (
              <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
                {state.error}
              </div>
            )}
            {state.isSending && (
              <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-md text-sm sm:text-base">
                Processing, please wait...
              </div>
            )}
            <div className="grid grid-cols-1 gap-4">
              <Textarea
                rows={6}
                value={state.doctorsNotes}
                onChange={handleDoctorsNotesChange}
                placeholder="Enter doctor's notes here (optional)..."
                className="w-full p-4 border rounded-md bg-white"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
              <Select onValueChange={handleGenderChange} value={state.gender}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="undisclosed">Undisclosed</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={state.age ?? ""}
                onChange={handleAgeChange}
                placeholder="Age"
                className="w-full bg-white"
              />
              <Select onValueChange={handleLanguageChange} value={state.language}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh-CN">Mandarin (Simplified)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <VitalsForm vitals={state.vitals} onChange={handleVitalsChange} />
            {/* Recording Consent */}
            {!state.isRecording && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="recordingConsent"
                    checked={recordingConsent}
                    onChange={(e) => setRecordingConsent(e.target.checked)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="recordingConsent"
                    className="text-sm text-gray-700"
                  >
                    <strong>Recording Consent:</strong> I confirm that I have
                    obtained informed consent from the patient for recording
                    this consultation. The patient has been informed that the
                    conversation will be recorded and transcribed for medical
                    documentation and diagnostic support purposes.
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col w-full items-center gap-3 mt-4">
              {/* Start Button - Show when not recording */}
              {!state.isRecording && (
                <Button
                  onClick={handleToggleRecording}
                  className="bg-[#34E796] hover:bg-[#00c36b] w-[60%]"
                  disabled={state.isSending || !recordingConsent}
                >
                  Start
                </Button>
              )}

              {/* Pause/Resume Button - Show when recording */}
              {state.isRecording && (
                <Button
                  onClick={pauseRecording}
                  className="bg-[#facc15] hover:bg-[#eab308] w-[60%]"
                  disabled={false}
                >
                  {state.isPaused ? "Resume" : "Pause"}
                </Button>
              )}

              {/* End Consultation Button - Show when recording or paused */}
              {state.isRecording && (
                <Button
                  onClick={handleToggleRecording}
                  className="bg-[#f27252] hover:bg-[#ea5321] w-[60%]"
                  disabled={false}
                >
                  End Consultation
                </Button>
              )}

              {/* Clear Results Button - Show when not recording and has results */}
              {!state.isRecording &&
                (state.labeledSegments.length > 0 ||
                  state.diagnosis !== null ||
                  state.keypoints.length > 0) && (
                  <Button
                    onClick={() => {
                      clearResults();
                      setRecordingConsent(false);
                    }}
                    className="bg-[#f27252] hover:bg-[#ea5321] w-[60%]"
                    disabled={state.isSending}
                  >
                    Clear Results
                  </Button>
                )}
            </div>

            {/* Send for Diagnosis Button */}
            <div className="flex w-full justify-center mt-4">
              <Button
                onClick={handleSendForDiagnosis}
                className="bg-[#60a5fa] hover:bg-[#3b82f6] w-[60%]"
                disabled={state.isSending}
              >
                Send for Diagnosis
              </Button>
            </div>

            {/* Diagnosis Chart - Right after buttons */}
            {state.diagnosis && (
              <div className="mt-6">
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <div className="h-32 sm:h-40">
                    <Bar data={getChartData()} options={chartOptions} />
                  </div>

                  {/* Diagnoses and Symptoms right below chart */}
                  <div className="mt-4 pt-4 border-t">
                    <p className="mb-2">
                      <strong>Diagnoses:</strong>
                    </p>
                    <ul className="list-disc pl-5 mb-4">
                      {state.diagnosis.diagnoses.map((diag, index) => (
                        <li key={index}>
                          {formatText(diag.diagnosis)} (Likelihood:{" "}
                          {diag.likelihood}%)
                        </li>
                      ))}
                    </ul>

                    {state.diagnosis.symptoms &&
                      state.diagnosis.symptoms.length > 0 && (
                        <>
                          <p className="mb-2">
                            <strong>Symptoms:</strong>
                          </p>
                          <ul className="list-disc pl-5">
                            {state.diagnosis.symptoms.map((symptom, index) => (
                              <li key={`symptom-${index}`}>
                                {formatText(symptom)}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                  </div>
                </div>
              </div>
            )}

            {state.keypoints.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-base sm:text-lg">
                  Key Points
                </h3>
                <div className="bg-white p-3 rounded-md shadow-sm">
                  <ul className="list-disc pl-5 text-sm sm:text-base">
                    {state.keypoints.map((keypoint, index) => (
                      <li key={`keypoint-${index}`} className="mb-2">
                        {formatText(keypoint)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {state.diagnosis && (
              <div className="mt-8">
                {/* Medical History Section */}
                <div className="mt-6 bg-white p-4 rounded-md shadow-sm">
                  <h4 className="font-semibold mb-3 text-lg">
                    Medical History
                  </h4>
                  <div className="space-y-3">
                    {state.diagnosis.presenting_complaint && (
                      <div>
                        <p className="font-medium text-sm">
                          1. Presenting Complaint:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.presenting_complaint}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.past_medical_history && (
                      <div>
                        <p className="font-medium text-sm">
                          2. Past Medical History:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.past_medical_history}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.drug_history && (
                      <div>
                        <p className="font-medium text-sm">
                          3. Drug/Medication History:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.drug_history}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.allergies && (
                      <div>
                        <p className="font-medium text-sm">4. Allergies:</p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.allergies}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.smoking_history && (
                      <div>
                        <p className="font-medium text-sm">
                          5. Smoking History:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.smoking_history}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.alcohol_history && (
                      <div>
                        <p className="font-medium text-sm">
                          6. Alcohol History:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.alcohol_history}
                        </p>
                      </div>
                    )}
                    {state.diagnosis.social_history && (
                      <div>
                        <p className="font-medium text-sm">
                          7. Social History:
                        </p>
                        <p className="text-sm text-gray-700 ml-4">
                          {state.diagnosis.social_history}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {state.summary && (
              <div className="mb-6">
                <h3 className="font-bold text-lg sm:text-xl mb-2">
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
            )}

            {(state.keypoints.length > 0 ||
              state.diagnosis ||
              state.summary) && (
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
                      <Textarea
                        className="w-full mb-4 p-2 border rounded"
                        value={state.keypoints
                          .map((keypoint) => formatText(keypoint))
                          .join("\n")}
                        onChange={(e) => {
                          const newKeypoints = e.target.value
                            .split("\n")
                            .filter((k) => k.trim());
                          setState((s) => ({ ...s, keypoints: newKeypoints }));
                        }}
                        rows={Math.min(6, state.keypoints.length + 1)}
                      />
                    </>
                  )}
                  {state.diagnosis && (
                    <>
                      <p className="mb-2 text-sm sm:text-base">
                        <strong>Diagnosis:</strong>
                      </p>
                      <div className="mb-4">
                        {state.diagnosis.diagnoses.map((diag, index) => (
                          <div key={index} className="flex items-center mb-2">
                            <Input
                              className="flex-grow mr-2"
                              value={diag.diagnosis}
                              onChange={(e) => {
                                const newDiagnoses = [
                                  ...state.diagnosis!.diagnoses,
                                ];
                                newDiagnoses[index] = {
                                  ...newDiagnoses[index],
                                  diagnosis: e.target.value,
                                };
                                setState((s) => ({
                                  ...s,
                                  diagnosis: {
                                    ...s.diagnosis!,
                                    diagnoses: newDiagnoses,
                                  },
                                }));
                              }}
                            />
                            <Input
                              className="w-20"
                              type="number"
                              min="0"
                              max="100"
                              value={diag.likelihood}
                              onChange={(e) => {
                                const newDiagnoses = [
                                  ...state.diagnosis!.diagnoses,
                                ];
                                newDiagnoses[index] = {
                                  ...newDiagnoses[index],
                                  likelihood: parseInt(e.target.value) || 0,
                                };
                                setState((s) => ({
                                  ...s,
                                  diagnosis: {
                                    ...s.diagnosis!,
                                    diagnoses: newDiagnoses,
                                  },
                                }));
                              }}
                            />
                            <span className="ml-1">%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {state.summary && (
                    <div className="mb-4">
                      <p className="mb-2">
                        <strong>Patient Summary:</strong>
                      </p>
                      <Textarea
                        className="w-full p-2 border rounded"
                        value={state.summary.patient_summary}
                        onChange={(e) => {
                          setState((s) => ({
                            ...s,
                            summary: {
                              ...s.summary!,
                              patient_summary: e.target.value,
                            },
                          }));
                        }}
                        rows={3}
                      />
                    </div>
                  )}
                  <div className="mb-4">
                    <p className="mb-2">
                      <strong>Other Diagnoses:</strong>
                    </p>
                    <Textarea
                      className="w-full p-2 border rounded"
                      placeholder="Add your diagnosis here..."
                      value={state.doctorsNotes}
                      onChange={handleDoctorsNotesChange}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-4">
                    <Button
                      onClick={handleAccept}
                      className="bg-[#34E796] hover:bg-[#00c36b]"
                      disabled={state.isSending}
                    >
                      {state.isSending ? (
                        <div className="flex items-center gap-2">
                          <Loader size={16} className="text-white" />
                          Processing...
                        </div>
                      ) : (
                        "Valid"
                      )}
                    </Button>
                    <Button
                      onClick={handleReject}
                      className="bg-[#f27252] hover:bg-[#ea5321]"
                      disabled={state.isSending}
                    >
                      {state.isSending ? (
                        <div className="flex items-center gap-2">
                          <Loader size={16} className="text-white" />
                          Processing...
                        </div>
                      ) : (
                        "Reject"
                      )}
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
                  {state.isSending && (
                    <p className="text-gray-500 text-sm mb-2">Processing...</p>
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
        </Card>
        {/* Suggestions Sidebar Desktop */}
        <Card className="hidden sm:block w-4/12 bg-white overflow-y-auto pl-6 max-h-screen">
          <h3 className="font-semibold mb-4 text-lg">Doctor Suggestions</h3>
          {state.suggestions.length > 0 ? (
            <ul className="list-disc pl-6 mb-6">
              {state.suggestions.map((suggestion, index) => (
                <li key={`suggestion-${index}`} className="mb-2">
                  {formatText(suggestion)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No suggestions available.</p>
          )}
        </Card>
        {/* Suggestions Mobile */}
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
              <h3 className="font-bold mb-4 text-lg">Doctor Suggestions</h3>
              {state.suggestions.length > 0 ? (
                <ul className="list-disc pl-5 text-sm">
                  {state.suggestions.map((suggestion, index) => (
                    <li key={`suggestion-${index}`} className="mb-2">
                      {formatText(suggestion)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-700 text-sm">
                  No suggestions available.
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
