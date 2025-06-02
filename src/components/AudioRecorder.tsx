"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Get supported MIME type
const getSupportedMimeType = (): string => {
  if (typeof window === "undefined") return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  console.warn("No supported audio format found, defaulting to audio/webm");
  return "audio/webm;codecs=opus";
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
  diagnoses: Array<{ diagnosis: string; likelihood: number }>;
  symptoms: string[];
  source?: string;
  similarity?: number;
  doctors_notes?: string;
  gender?: string;
  age?: string;
  vitals?: {
    blood_pressure?: string;
    heart_rate_bpm?: string;
    respiratory_rate_bpm?: string;
    spo2_percent?: string;
    pain_score?: number;
    weight_kg?: number;
    height_cm?: number;
    temperature_celsius?: number;
  };
}

interface CombinedCreateRequest {
  session_id?: string;
  doctor_id?: string;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string;
  diagnosis: Array<{ diagnosis: string; likelihood: number }>;
  data_json?: {
    data?: Array<{ [speaker: string]: string }>;
    patient_summary?: string;
    doctor_summary?: string;
    doctor_note_summary?: string;
    diagnoses?: Array<{ diagnosis: string; likelihood: number }>;
    symptoms?: string[];
    gender?: string;
    age?: string;
    vitals?: {
      blood_pressure?: string;
      heart_rate_bpm?: string;
      respiratory_rate_bpm?: string;
      spo2_percent?: string;
      pain_score?: number;
      weight_kg?: number;
      height_cm?: number;
      temperature_celsius?: number;
    };
  };
  audio_url?: string;
  conversation: string;
  gender?: string;
  age?: string;
  vitals?: {
    blood_pressure?: string;
    heart_rate_bpm?: string;
    respiratory_rate_bpm?: string;
    spo2_percent?: string;
    pain_score?: number;
    weight_kg?: number;
    height_cm?: number;
    temperature_celsius?: number;
  };
}

interface CombinedCreateResponse {
  session_id: string;
  summary_id: string;
  diagnosis_validation_id: string;
  gender: string;
  age: string;
  status?: number;
  message?: string;
}

type RecorderState = {
  isRecording: boolean;
  labeledSegments: LabeledSegment[];
  suggestions: string[];
  summary: Summary | null;
  diagnosis: Diagnosis | null;
  keypoints: string[];
  error: string | null;
  isSending: boolean;
  doctorsNotes: string;
  gender: string;
  age: string;
  session?: CombinedCreateResponse;
  vitals: {
    blood_pressure?: string;
    heart_rate_bpm?: string;
    respiratory_rate_bpm?: string;
    spo2_percent?: string;
    pain_score?: number;
    weight_kg?: number;
    height_cm?: number;
    temperature_celsius?: number;
  };
};

export default function AudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    labeledSegments: [],
    suggestions: [],
    summary: null,
    diagnosis: null,
    keypoints: [],
    error: null,
    isSending: false,
    doctorsNotes: "",
    gender: "",
    age: "",
    session: undefined,
    vitals: {},
  });
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isKeypointsOpen, setIsKeypointsOpen] = useState(false);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkTimestampsRef = useRef<number[]>([]);
  const sessionIdRef = useRef<string>(uuidv4());
  const audioFilenameRef = useRef<string | null>(null);
  const isSendingLockRef = useRef<boolean>(false);
  const doctorsNotesRef = useRef(state.doctorsNotes);
  const genderRef = useRef(state.gender);
  const ageRef = useRef(state.age);
  const vitalsRef = useRef(state.vitals);

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
    async (audioBlobParam?: Blob) => {
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
        formData.append(
          "audio",
          audioBlob,
          `audio-${sessionIdRef.current}.webm`
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
      vitals: RecorderState["vitals"]
    ) => {
      if (!isHydrated || (isSendingLockRef.current && state.isRecording))
        return;
      isSendingLockRef.current = true;
      setState((prev) => ({ ...prev, isSending: true }));

      try {
        if (audioBlob.size < 512) {
          throw new Error("Audio blob too small, likely corrupted");
        }

        const formData = new FormData();
        formData.append(
          "audio",
          audioBlob,
          `chunk-${sessionIdRef.current}-${startTime}.webm`
        );

        const response = await fetch("/api/deepgram/transcribe", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Deepgram response error:", errorData);
          throw new Error(
            errorData.message || `Transcription failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();
        const segments: LabeledSegment[] = data.data || [];

        if (segments.length > 0) {
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
            doctors_notes: doctorsNotes || undefined,
            gender: gender || undefined,
            age: age || undefined,
            vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
            threshold: 0.7,
          };
          const diagnosisResult = await getDiagnosis(token)(diagnosisRequest);
          const diagnosisData: Diagnosis = diagnosisResult.ok
            ? diagnosisResult.value
            : {
                diagnoses: [{ diagnosis: "Unknown", likelihood: 0 }],
                symptoms: [],
                source: "fallback",
                similarity: 0,
                doctors_notes: doctorsNotes || undefined,
                gender: gender || undefined,
                age: age || undefined,
                vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
              };

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
            labeledSegments: formattedConversation,
            suggestions: suggestionsData,
            summary: summaryData,
            diagnosis: diagnosisData,
            keypoints: keypointsData,
            error: null,
            isSending: false,
          }));
        } else {
          console.warn("No segments returned from Deepgram");
          setState((prev) => ({ ...prev, isSending: false }));
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message.includes("corrupt or unsupported data")
              ? "Failed to transcribe audio: Invalid or corrupted audio data. Please try again."
              : error.message
            : "Failed to process audio";
        console.error("sendAudio error:", error);
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isSending: false,
        }));
      } finally {
        isSendingLockRef.current = false;
      }
    },
    [
      isHydrated,
      token,
      state.isRecording,
      state.doctorsNotes,
      state.gender,
      state.age,
      state.vitals,
    ]
  );

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

      const conversationText = state.labeledSegments
        .map((seg) => `${seg.speaker}: ${seg.text}`)
        .join("\n");
      const payload: CombinedCreateRequest = {
        session_id: sessionIdRef.current,
        doctor_id: doctorId || undefined,
        patient_summary: state.summary?.patient_summary,
        doctor_summary: state.summary?.doctor_summary,
        notes_summary: state.doctorsNotes,
        diagnosis: state.diagnosis?.diagnoses || [],
        data_json: {
          data: state.labeledSegments.map((segment) => ({
            [segment.speaker]: segment.text,
          })),
          patient_summary: state.summary?.patient_summary,
          doctor_summary: state.summary?.doctor_summary,
          doctor_note_summary: state.doctorsNotes,
          diagnoses: state.diagnosis?.diagnoses,
          symptoms: state.diagnosis?.symptoms,
          gender: state.gender,
          age: state.age,
          vitals:
            Object.keys(state.vitals).length > 0 ? state.vitals : undefined,
        },
        audio_url: audioUrl,
        conversation: conversationText,
        gender: state.gender,
        age: state.age,
        vitals: Object.keys(state.vitals).length > 0 ? state.vitals : undefined,
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
  }, [token, doctorId, state]);

  const startRecording = useCallback(async () => {
    if (!isHydrated) return;
    try {
      audioChunksRef.current = [];
      let initSegment: Blob | null = null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = async (event) => {
        if (!event.data.size) return;
        audioChunksRef.current.push(event.data);

        const doctorsNotes = doctorsNotesRef.current;
        const gender = genderRef.current;
        const age = ageRef.current;
        const vitals = vitalsRef.current;
        if (!initSegment) {
          initSegment = event.data;
          await sendAudio(
            initSegment,
            Date.now(),
            doctorsNotes,
            gender,
            age,
            vitals
          );
        } else {
          const stitched = new Blob(audioChunksRef.current, { type: mimeType });
          await sendAudio(
            stitched,
            Date.now(),
            doctorsNotes,
            gender,
            age,
            vitals
          );
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(10_000);
      setMediaRecorder(recorder);
      setState((s) => ({
        ...s,
        isRecording: true,
        suggestions: [],
        summary: null,
        diagnosis: null,
        keypoints: [],
        labeledSegments: [],
        error: null,
        isSending: false,
        session: undefined,
      }));
    } catch (err: any) {
      console.error(err);
      setState((s) => ({ ...s, error: err.message || "Recording error" }));
    }
  }, [isHydrated, sendAudio]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setState((prev) => ({ ...prev, isRecording: false }));

      // Trigger final sendAudio with accumulated chunks
      if (audioChunksRef.current.length > 0) {
        const mimeType = mediaRecorder.mimeType || getSupportedMimeType();
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const doctorsNotes = doctorsNotesRef.current;
        const gender = genderRef.current;
        const age = ageRef.current;
        const vitals = vitalsRef.current;

        await sendAudio(finalBlob, 0, doctorsNotes, gender, age, vitals);
        await saveAudioLocally(finalBlob);
      }

      setState((prev) => ({ ...prev, isSending: false }));
    }
  }, [mediaRecorder, sendAudio, saveAudioLocally]);

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
      threshold: 0.7,
    }));
    sessionIdRef.current = uuidv4();
    audioChunksRef.current = [];
    chunkTimestampsRef.current = [];
    audioFilenameRef.current = null;
    isSendingLockRef.current = false;
  }, []);

  const handleAccept = useCallback(async () => {
    const success = await uploadAudioToS3();
    if (success) {
      clearResults();
    }
  }, [uploadAudioToS3, clearResults]);

  const handleReject = useCallback(async () => {
    const success = await uploadAudioToS3();
    if (success) {
      clearResults();
    }
  }, [uploadAudioToS3, clearResults]);

  const handleToggleRecording = useCallback(async () => {
    if (!isHydrated) return;
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isHydrated, state.isRecording, startRecording, stopRecording]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
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
                Processing audio, please wait...
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
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
            </div>
            <div className="mt-4">
              <h3 className="font-semibold mb-2 text-base sm:text-lg">
                Vitals (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  type="text"
                  value={state.vitals?.blood_pressure || ""}
                  onChange={(e) => handleVitalsChange(e, "blood_pressure")}
                  placeholder="Blood Pressure (e.g., 120/80)"
                  className="w-full bg-white"
                />
                <Input
                  type="text"
                  value={state.vitals?.heart_rate_bpm || ""}
                  onChange={(e) => handleVitalsChange(e, "heart_rate_bpm")}
                  placeholder="Heart Rate (bpm, e.g., 60-100)"
                  className="w-full bg-white"
                />
                <Input
                  type="text"
                  value={state.vitals?.respiratory_rate_bpm || ""}
                  onChange={(e) =>
                    handleVitalsChange(e, "respiratory_rate_bpm")
                  }
                  placeholder="Respiratory Rate (bpm, e.g., 12-20)"
                  className="w-full bg-white"
                />
                <Input
                  type="text"
                  value={state.vitals?.spo2_percent || ""}
                  onChange={(e) => handleVitalsChange(e, "spo2_percent")}
                  placeholder="SpO2 (%)"
                  className="w-full bg-white"
                />
                <Input
                  type="number"
                  value={state.vitals?.pain_score ?? ""}
                  onChange={(e) => handleVitalsChange(e, "pain_score")}
                  placeholder="Pain Score (0-10)"
                  min={0}
                  max={10}
                  className="w-full bg-white"
                />
                <Input
                  type="number"
                  value={state.vitals?.weight_kg ?? ""}
                  onChange={(e) => handleVitalsChange(e, "weight_kg")}
                  placeholder="Weight (kg)"
                  className="w-full bg-white"
                />
                <Input
                  type="number"
                  value={state.vitals?.height_cm ?? ""}
                  onChange={(e) => handleVitalsChange(e, "height_cm")}
                  placeholder="Height (cm)"
                  className="w-full bg-white"
                />
                <Input
                  type="number"
                  value={state.vitals?.temperature_celsius ?? ""}
                  onChange={(e) => handleVitalsChange(e, "temperature_celsius")}
                  placeholder="Temperature (°C)"
                  step="0.1"
                  className="w-full bg-white"
                />
              </div>
            </div>
            <div className="flex w-full justify-center gap-4 mt-4">
              <Button
                onClick={handleToggleRecording}
                className={
                  state.isRecording
                    ? "bg-[#f27252] hover:bg-[#ea5321] w-[49%]"
                    : "bg-[#34E796] hover:bg-[#00c36b] w-[49%]"
                }
                disabled={state.isRecording && isSendingLockRef.current}
              >
                {state.isRecording ? "Stop Recording" : "Start Recording"}
              </Button>
              {!state.isRecording && (
                <Button
                  onClick={clearResults}
                  className="bg-[#f27252] hover:bg-[#ea5321] w-[49%]"
                  disabled={
                    state.isSending || state.labeledSegments.length === 0
                  }
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
                  <div className="h-32 sm:h-40">
                    <Bar data={getChartData()} options={chartOptions} />
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
                    <p className="mb-4">
                      <strong>Patient Summary:</strong>{" "}
                      {formatText(state.summary.patient_summary)}
                    </p>
                  )}
                  <div className="flex justify-end space-x-4">
                    <Button
                      onClick={handleAccept}
                      className="bg-[#34E796] hover:bg-[#00c36b]"
                      disabled={state.isSending}
                    >
                      Valid
                    </Button>
                    <Button
                      onClick={handleReject}
                      className="bg-[#f27252] hover:bg-[#ea5321]"
                      disabled={state.isSending}
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
                  {state.isSending && (
                    <p className="text-gray-500 text-sm mb-2">
                      Processing audio chunk...
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
        </Card>
        {/* Keypoints Sidebar Desktop */}
        <Card className="hidden sm:block w-4/12 bg-white overflow-y-auto pl-8 max-h-screen">
          <h3 className="font-semibold mb-4 text-lg">Key Points</h3>
          {state.keypoints.length > 0 ? (
            <ul className="list-disc pl-6">
              {state.keypoints.map((keypoint, index) => (
                <li key={index} className="mb-2">
                  {formatText(keypoint)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No key points available.</p>
          )}
        </Card>
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
                <p className="text-gray-500 text-sm">
                  No key points available.
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
