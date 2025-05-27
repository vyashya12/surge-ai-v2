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
  source: string;
  similarity: number;
}

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

interface CombinedCreateResponse {
  session_id: string;
  summary_id: string;
  diagnosis_validation_id: string;
  physical_evaluation: string;
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
  physicalEvaluation: string;
  gender: string;
  age: string;
  session?: CombinedCreateResponse;
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
    physicalEvaluation: "",
    gender: "",
    age: "",
    session: undefined,
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
  const physicalEvaluationRef = useRef(state.physicalEvaluation);
  const genderRef = useRef(state.gender);
  const ageRef = useRef(state.age);

  useEffect(() => {
    doctorsNotesRef.current = state.doctorsNotes;
  }, [state.doctorsNotes]);
  useEffect(() => {
    physicalEvaluationRef.current = state.physicalEvaluation;
  }, [state.physicalEvaluation]);
  useEffect(() => {
    genderRef.current = state.gender;
  }, [state.gender]);
  useEffect(() => {
    ageRef.current = state.age;
  }, [state.age]);

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

        console.log("Saving audio locally:", {
          sessionId: sessionIdRef.current,
          audioSize: audioBlob.size,
          mimeType: mimeType,
        });

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
        console.log(`Saved audio to ${filename}`);
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
      physicalEvaluation: string,
      gender: string,
      age: string
    ) => {
      if (!isHydrated || isSendingLockRef.current) return;
      isSendingLockRef.current = true;
      setState((prev) => ({ ...prev, isSending: true }));

      try {
        console.log(
          `Sending audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}, startTime: ${startTime}`
        );
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
            doctors_notes: doctorsNotes,
            physical_evaluation: physicalEvaluation,
            gender: gender,
            age: age,
            threshold: 0.7,
          };
          const diagnosisResult = await getDiagnosis(token)(diagnosisRequest);
          const diagnosisData = diagnosisResult.ok
            ? diagnosisResult.value
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

          console.log(
            "New diagnosis data:",
            JSON.stringify(diagnosisData, null, 2)
          );

          setState((prev) => ({
            ...prev,
            labeledSegments: formattedConversation, // replace entire transcript
            suggestions: suggestionsData, // replace with latest
            summary: summaryData, // replace with latest
            diagnosis: diagnosisData, // replace with latest
            keypoints: keypointsData, // replace with latest
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
      state.doctorsNotes,
      state.physicalEvaluation,
      state.gender,
      state.age,
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
        age: "",
      };

      console.log("Combined Create Payload:", JSON.stringify(payload, null, 2));

      if (
        !payload.patient_summary ||
        !payload.doctor_summary ||
        !payload.conversation
      ) {
        throw new Error("Missing required summary or conversation data");
      }

      const createResult = await createCombined(token)(payload);
      if (!createResult.ok) {
        throw new Error(
          createResult.error || "Failed to create combined record"
        );
      }

      const sessionResponse = createResult.value;
      console.log(
        "Combined record created:",
        JSON.stringify(sessionResponse, null, 2)
      );

      setState((prev) => ({ ...prev, session: sessionResponse }));

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

      const saveChunks: Blob[] = [];

      recorder.ondataavailable = async (event) => {
        if (!event.data.size) return;
        audioChunksRef.current.push(event.data);

        // grab the *current* UI inputs
        const doctorsNotes = doctorsNotesRef.current;
        const physicalEvaluation = physicalEvaluationRef.current;
        const gender = genderRef.current;
        const age = ageRef.current;
        if (!initSegment) {
          initSegment = event.data;
          await sendAudio(
            initSegment,
            Date.now(),
            doctorsNotes,
            physicalEvaluation,
            gender,
            age
          );
        } else {
          const stitched = new Blob(audioChunksRef.current, { type: mimeType });
          await sendAudio(
            stitched,
            Date.now(),
            doctorsNotes,
            physicalEvaluation,
            gender,
            age
          );
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // again, pull the very latest inputs
        const doctorsNotes = doctorsNotesRef.current;
        const physicalEvaluation = physicalEvaluationRef.current;
        const gender = genderRef.current;
        const age = ageRef.current;
        await sendAudio(
          fullBlob,
          0,
          doctorsNotes,
          physicalEvaluation,
          gender,
          age
        );

        await saveAudioLocally(fullBlob);
      };

      recorder.start(10_000); // slice into 10s chunks
      setMediaRecorder(recorder);
      setState((s) => ({
        ...s,
        isRecording: true,
        // clear out old results so UI always shows the fresh ones
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

  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setState((s) => ({ ...s, isRecording: false, isSending: false }));
    }
  }, [mediaRecorder]);

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
      session: undefined,
    }));
    sessionIdRef.current = uuidv4();
    audioChunksRef.current = [];
    chunkTimestampsRef.current = [];
    audioFilenameRef.current = null;
    isSendingLockRef.current = false;
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
        {state.isSending && (
          <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-md text-sm sm:text-base">
            Processing audio, please wait...
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
            <SelectTrigger className="w-full p-2 text-sm sm:text-base">
              <SelectValue placeholder="Select Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="undisclosed">Undisclosed</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={handleAgeChange} value={state.age}>
            <SelectTrigger className="w-full p-2 text-sm sm:text-base">
              <SelectValue placeholder="Select Age Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0-18">0-18</SelectItem>
              <SelectItem value="19-30">19-30</SelectItem>
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
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
            disabled={state.isSending}
          >
            {state.isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
          {!state.isRecording && (
            <Button
              onClick={clearResults}
              className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base bg-gray-500 hover:bg-gray-600"
              disabled={state.isSending || state.labeledSegments.length === 0}
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
                  <li key={index} className="mb-2 text-sm sm:text-base">
                    {formatText(suggestion)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {state.diagnosis && (
          <div className="mb-6">
            <h3 className="font-bold text-lg sm:text-xl mb-2">Diagnosis</h3>
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
        {(state.keypoints.length > 0 || state.diagnosis || state.summary) && (
          <div className="mb-6">
            <h3 className="font-bold text-lg sm:text-xl mb-2">
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
                  disabled={state.isSending}
                >
                  Accept
                </Button>
                <Button
                  onClick={handleReject}
                  className="w-full sm:w-auto px-6 py-2 text-sm sm:text-base bg-red-500 hover:bg-red-600"
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
            <h3 className="font-bold text-lg sm:text-xl mb-2">
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
            <h3 className="font-bold text-lg mb-2">Key Points</h3>
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
      <div className="hidden sm:block w-64 bg-white shadow-lg fixed right-0 top-0 h-full p-4">
        <h3 className="font-bold text-lg mb-2">Key Points</h3>
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
