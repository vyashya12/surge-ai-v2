import axios from "axios";
import {
  Session,
  Diagnosis,
  Summary,
  DiagnosisSuggestion,
  Result,
  DiagnosisValidation,
  DiagnosisValidationResponse,
} from "@/types";

// Custom error interface for safe error handling
interface AppError {
  message: string;
  stack?: string;
}

// Create a reusable Axios client with token support
const createApiClient = (token: string | null) => ({
  post: async <T>(url: string, data: unknown): Promise<Result<T, string>> => {
    try {
      const response = await axios.post<T>(`/api${url}`, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { ok: true, value: response.data };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        const status = error.response?.status;
        return {
          ok: false,
          error: status
            ? `HTTP ${status}: ${message}`
            : `Request failed: ${message}`,
        };
      }
      const appError = error as AppError;
      return {
        ok: false,
        error: appError.message || "Request failed: Unknown error",
      };
    }
  },
  get: async <T>(url: string): Promise<Result<T, string>> => {
    try {
      const response = await axios.get<T>(`/api${url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { ok: true, value: response.data };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        const status = error.response?.status;
        return {
          ok: false,
          error: status
            ? `HTTP ${status}: ${message}`
            : `Request failed: ${message}`,
        };
      }
      const appError = error as AppError;
      return {
        ok: false,
        error: appError.message || "Request failed: Unknown error",
      };
    }
  },
});

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
}

interface RegisterResponse {
  status: number;
  message: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
  status: number;
  message: string;
}

// Register a doctor
export const register =
  () =>
  async (
    credentials: RegisterCredentials
  ): Promise<Result<RegisterResponse, string>> => {
    const client = createApiClient(null);
    const response = await client.post<RegisterResponse>(
      "/auth/register",
      credentials
    );
    return response.ok && response.value.status !== 200
      ? { ok: false, error: response.value.message }
      : response;
  };

// Login a doctor
export const login =
  () =>
  async (
    credentials: LoginCredentials
  ): Promise<Result<LoginResponse, string>> => {
    const client = createApiClient(null);
    const response = await client.post<{
      status: number;
      message: string;
      token: string;
      doctor: { id: string; username: string; email: string };
    }>("/auth/login", credentials);
    if (response.ok && response.value.status === 200) {
      return {
        ok: true,
        value: {
          token: response.value.token,
          user: {
            id: response.value.doctor.id,
            email: response.value.doctor.email,
            username: response.value.doctor.username,
          },
          status: response.value.status,
          message: response.value.message,
        },
      };
    }
    return {
      ok: false,
      error: response.toString() || "Login failed",
    };
  };

// Get session history for a doctor
export const getSessionHistory =
  (token: string | null) =>
  async (doctorId: string): Promise<Result<Session[], string>> => {
    const client = createApiClient(token);
    const response = await client.get<{
      sessions: Session[];
      status?: number;
      message?: string;
    }>(`/session-history/${doctorId}`);
    return response.ok
      ? { ok: true, value: response.value.sessions }
      : {
          ok: false,
          error: response.error || "Failed to retrieve session history",
        };
  };

// Get all diagnosis validations
export const getAllDiagnosisValidations =
  (token?: string | null) =>
  async (): Promise<Result<DiagnosisValidation[], string>> => {
    try {
      const client = createApiClient(token!);
      const response = await client.get<DiagnosisValidationResponse>(
        "/validation/unvalidated"
      );
      if (response.ok) {
        return { ok: true, value: response.value.diagnoses };
      }
      return {
        ok: false,
        error: response.error || "Failed to fetch diagnoses",
      };
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getAllDiagnosisValidations fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch diagnoses",
      };
    }
  };

// Get validation data by session ID
export const getValidationBySessionId =
  (token: string | null) =>
  async (sessionId: string): Promise<Result<DiagnosisValidation | null, string>> => {
    try {
      const allValidationsResult = await getAllDiagnosisValidations(token)();
      if (!allValidationsResult.ok) {
        return allValidationsResult;
      }
      
      const validation = allValidationsResult.value.find(
        (v) => v.session_id === sessionId
      );
      
      return { ok: true, value: validation || null };
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getValidationBySessionId fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch validation data",
      };
    }
  };

// Get summary by ID
// export const getSummaryById =
//   (token: string | null) =>
//   async (summaryId: string): Promise<Result<Summary, string>> => {
//     const client = createApiClient(token);
//     const response = await client.get<
//       Summary & { status: number; message?: string }
//     >(`/summary/${summaryId}`);
//     return response.ok && response.value.status === 200
//       ? { ok: true, value: response.value }
//       : {
//           ok: false,
//           error: response.toString() || "Failed to fetch summary",
//         };
//   };

// Get summary from conversation
export const getSummaryFromConversation =
  (token: string | null) =>
  async (data: SummaryRequest): Promise<Result<Summary, string>> => {
    const client = createApiClient(token);
    const response = await client.post<
      Summary & { status: number; message?: string }
    >("/separate-conversation-summary", data);
    return response.ok && response.value.status === 200
      ? { ok: true, value: response.value }
      : {
          ok: false,
          error: response.toString() || "Failed to fetch summary",
        };
  };

// Request and response types for specific APIs
interface ConversationSegment {
  [speaker: string]: string;
}

interface SuggestionsRequest {
  data: ConversationSegment[];
}

interface SuggestionsResponse {
  suggestions: string[];
}

// Get doctor reply suggestions
export const getSuggestions =
  (token: string | null) =>
  async (
    data: SuggestionsRequest
  ): Promise<Result<SuggestionsResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<SuggestionsResponse>(
        "/doctor_reply_suggestions",
        data
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getSuggestions fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch suggestions",
      };
    }
  };

// Suggest diagnoses
interface DiagnosesRequest {
  conversation_input: {
    data: Array<{ [speaker: string]: string }>;
  };
  doctors_notes: string | undefined;
  gender: string | undefined;
  age: number | null | undefined;
  vitals: {
    blood_pressure: string | undefined;
    heart_rate_bpm: string | undefined;
    respiratory_rate_bpm: string | undefined;
    spo2_percent: string | undefined;
    pain_score: number | undefined;
    weight_kg: number | undefined;
    height_cm: number | undefined;
    temperature_celsius: number | undefined;
  };
}

export const suggestDiagnoses =
  (token: string | null) =>
  async (
    data: DiagnosesRequest
  ): Promise<Result<DiagnosisSuggestion[], string>> => {
    const client = createApiClient(token);
    const response = await client.post<{
      diagnoses: DiagnosisSuggestion[];
      status: number;
      message?: string;
    }>("/suggest_diagnoses", data);
    return response.ok && response.value.status === 200
      ? { ok: true, value: response.value.diagnoses }
      : {
          ok: false,
          error: response.toString() || "Failed to fetch suggested diagnoses",
        };
  };

// Label conversation
export const labelConversation =
  (token: string) =>
  async (input: {
    data: { text: string; speaker: string }[];
  }): Promise<
    Result<{ data: { text: string; speaker: string }[] }, string>
  > => {
    try {
      // **3) send the same shape the route now expects**
      const response = await fetch("/api/label_conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: input.data }),
      });

      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.message || `HTTP ${response.status}` };
      }

      const payload: { data: { text: string; speaker: string }[] } =
        await response.json();
      return { ok: true, value: payload };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  };

// Get summary
interface SummaryRequest {
  data: ConversationSegment[];
}

interface SummaryResponse {
  patient_summary: string;
  doctor_summary: string;
}

export const getSummary =
  (token: string | null) =>
  async (data: SummaryRequest): Promise<Result<SummaryResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<SummaryResponse>(
        "/separate_conversation_summary",
        data
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getSummary fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch summary",
      };
    }
  };

// Get diagnosis
interface DiagnosisRequest {
  conversation_input: {
    data: Array<{ [speaker: string]: string }>;
  };
  doctors_notes?: string;
  threshold?: number;
  gender?: string;
  age?: number | null;
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

interface DiagnosisResponse {
  diagnoses: Array<{ diagnosis: string; likelihood: number }>;
  symptoms: string[];
  source: string;
  similarity: number;
  doctors_notes: string;
  gender: string;
  age: number;
  vitals: {
    blood_pressure: string;
    heart_rate_bpm: string;
    respiratory_rate_bpm: string;
    spo2_percent: string;
    pain_score: number;
    weight_kg: number;
    height_cm: number;
    temperature_celsius: number;
  };
  presenting_complaint: string;
  past_medical_history: string;
  drug_history: string;
  allergies: string;
  smoking_history: string;
  alcohol_history: string;
  social_history: string;
}

export const getDiagnosis =
  (token: string | null) =>
  async (
    data: DiagnosisRequest
  ): Promise<Result<DiagnosisResponse, string>> => {
    try {
      // Ensure age is properly formatted for the API
      const requestData = {
        ...data,
        // Send age as is if it's a number, or undefined if null/undefined
        age: data.age !== null && data.age !== undefined ? data.age : undefined,
      };

      const client = createApiClient(token);
      const response = await client.post<DiagnosisResponse>(
        "/rag/diagnose",
        requestData
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getDiagnosis fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch diagnosis",
      };
    }
  };

// Get keypoints
interface KeypointsRequest {
  conversation_input: { data: ConversationSegment[] };
  doctors_notes: string;
}

interface KeypointsResponse {
  keypoints: string[];
}

export const getKeypoints =
  (token: string | null) =>
  async (
    data: KeypointsRequest
  ): Promise<Result<KeypointsResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<KeypointsResponse>(
        "/keypoint_summary",
        data
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getKeypoints fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch keypoints",
      };
    }
  };

// Create combined record
interface CombinedCreateRequest {
  session_id?: string;
  doctor_id?: string;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string;
  diagnosis?: Array<{ diagnosis: string; likelihood: number }>; // Made optional
  data_json?: {
    data?: any[];
    patient_summary?: string;
    doctor_summary?: string;
    doctor_note_summary?: string;
    diagnoses?: Array<{ diagnosis: string; likelihood: number }>;
    symptoms?: string[];
    gender?: string;
    age?: number | null;
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
  conversation?: string; // Made optional
  gender?: string;
  age?: number | null;
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
  session_id?: string;
  summary_id?: string;
  diagnosis_validation_id?: string;
  gender?: string;
  age?: number | null;
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
  status?: number;
  message?: string;
  [key: string]: unknown;
}

export const createCombined =
  (token: string | null) =>
  async (
    data: CombinedCreateRequest
  ): Promise<Result<CombinedCreateResponse, string>> => {
    try {
      // Ensure all fields have default values if they're empty
      const sanitizedData: CombinedCreateRequest = {
        ...data,
        // Ensure required fields have default values
        session_id: data.session_id || "",
        doctor_id: data.doctor_id || "",
        // Ensure diagnosis is always an array
        diagnosis: Array.isArray(data.diagnosis) ? data.diagnosis : [],
        // Ensure conversation is always a string
        conversation: data.conversation || "",
        // Ensure data_json is always an object with default values for all nested fields
        data_json: {
          data: data.data_json?.data || [],
          patient_summary: data.data_json?.patient_summary || "",
          doctor_summary: data.data_json?.doctor_summary || "",
          doctor_note_summary: data.data_json?.doctor_note_summary || "",
          diagnoses: data.data_json?.diagnoses || [],
          symptoms: data.data_json?.symptoms || [],
          gender: data.data_json?.gender || "",
          age: data.data_json?.age || null,
          vitals: {
            blood_pressure: data.data_json?.vitals?.blood_pressure || "",
            heart_rate_bpm: data.data_json?.vitals?.heart_rate_bpm || "",
            respiratory_rate_bpm:
              data.data_json?.vitals?.respiratory_rate_bpm || "",
            spo2_percent: data.data_json?.vitals?.spo2_percent || "",
            pain_score: data.data_json?.vitals?.pain_score || 0,
            weight_kg: data.data_json?.vitals?.weight_kg || 0,
            height_cm: data.data_json?.vitals?.height_cm || 0,
            temperature_celsius:
              data.data_json?.vitals?.temperature_celsius || 0,
          },
        },
        // Ensure other fields have default values
        patient_summary: data.patient_summary || "",
        doctor_summary: data.doctor_summary || "",
        notes_summary: data.notes_summary || "",
        audio_url: data.audio_url || "",
        gender: data.gender || "",
        age: data.age || null,
        vitals: {
          blood_pressure: data.vitals?.blood_pressure || "",
          heart_rate_bpm: data.vitals?.heart_rate_bpm || "",
          respiratory_rate_bpm: data.vitals?.respiratory_rate_bpm || "",
          spo2_percent: data.vitals?.spo2_percent || "",
          pain_score: data.vitals?.pain_score || 0,
          weight_kg: data.vitals?.weight_kg || 0,
          height_cm: data.vitals?.height_cm || 0,
          temperature_celsius: data.vitals?.temperature_celsius || 0,
        },
      };

      const client = createApiClient(token);
      const response = await client.post<CombinedCreateResponse>(
        "/create_combined",
        sanitizedData
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("createCombined fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to create combined record",
      };
    }
  };

// Get summary by ID
export const getSummaryById =
  (token: string | null) =>
  async (summaryId: string): Promise<Result<Summary, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.get<Summary>(`/summary/${summaryId}`);
      return response.ok
        ? { ok: true, value: response.value }
        : {
            ok: false,
            error: response.error || "Failed to fetch summary",
          };
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getSummaryById fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch summary",
      };
    }
  };

interface DiagnoseDnRequest {
  doctors_notes: string;
  threshold?: number;
  gender?: string;
  age?: number;
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

interface DiagnoseDnResponse {
  diagnoses: Array<{ diagnosis: string; likelihood: number }>;
  symptoms: string[];
  keypoints: string[];
  source?: string;
  similarity?: number;
  doctors_notes?: string;
  gender?: string;
  age?: number;
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

export const getDiagnosisFromNotes =
  (token: string | null) =>
  async (
    data: DiagnoseDnRequest
  ): Promise<Result<DiagnoseDnResponse, string>> => {
    try {
      // Ensure threshold is always provided
      const requestData = {
        ...data,
        threshold: data.threshold ?? 0.5,
      };

      const client = createApiClient(token);
      const response = await client.post<DiagnoseDnResponse>(
        "/rag/diagnose_dn",
        requestData
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("getDiagnosisFromNotes fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch diagnosis from notes",
      };
    }
  };

interface LabelConversationRequest {
  data: Array<{
    text: string;
    speaker: string;
  }>;
}

interface LabelConversationResponse {
  data: Array<{
    text: string;
    speaker: string;
  }>;
}

export const finalLabelConversation =
  (token: string | null) =>
  async (
    data: LabelConversationRequest
  ): Promise<Result<LabelConversationResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<LabelConversationResponse>(
        "/final_label",
        data
      );
      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("finalLabelConversation fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to label conversation",
      };
    }
  };
