import axios from "axios";
import {
  Session,
  Diagnosis,
  Summary,
  // Suggestion,
  // Keypoint,
  DiagnosisSuggestion,
  // LabelConversation,
  Result,
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
      status: number;
      message?: string;
    }>(`/session-history/${doctorId}`);
    return response.ok && response.value.status === 200
      ? { ok: true, value: response.value.sessions }
      : {
          ok: false,
          error: response.toString() || "Failed to retrieve session history",
        };
  };

// Get all diagnosis validations
export const getAllDiagnosisValidations =
  (baseUrl: string, token?: string | null) =>
  async (): Promise<Result<Diagnosis[], string>> => {
    const client = createApiClient(token!);
    console.log(baseUrl);
    const response = await client.get<{
      diagnoses: Diagnosis[];
      status: number;
      message?: string;
    }>("/diagnosis-validation/all");
    return response.ok && response.value.status === 200
      ? { ok: true, value: response.value.diagnoses }
      : {
          ok: false,
          error: response.toString() || "Failed to fetch diagnoses",
        };
  };

// Get summary by ID
export const getSummaryById =
  (token: string | null) =>
  async (summaryId: string): Promise<Result<Summary, string>> => {
    const client = createApiClient(token);
    const response = await client.get<
      Summary & { status: number; message?: string }
    >(`/summary/${summaryId}`);
    return response.ok && response.value.status === 200
      ? { ok: true, value: response.value }
      : {
          ok: false,
          error: response.toString() || "Failed to fetch summary",
        };
  };

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
interface SuggestionsRequest {
  data: { doctor: string; patient: string }[];
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

      console.log(
        "getSuggestions fetch response:",
        JSON.stringify(response, null, 2)
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
  conversation_input: { data: { doctor: string; patient: string }[] };
  doctors_notes: string;
  threshold: number;
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
interface LabelConversationRequest {
  data: { text: string; speaker: string }[];
}

interface LabelConversationResponse {
  data: { text: string; speaker: string }[];
}

export const labelConversation =
  (token: string | null) =>
  async (
    data: LabelConversationRequest
  ): Promise<Result<LabelConversationResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<LabelConversationResponse>(
        "/label_conversation",
        data
      );

      console.log(
        "labelConversation fetch response:",
        JSON.stringify(response, null, 2)
      );

      return response;
    } catch (error: unknown) {
      const appError = error as AppError;
      console.error("labelConversation fetch error:", appError);
      return {
        ok: false,
        error: appError.message || "Failed to fetch labelConversation",
      };
    }
  };

// Get summary
interface SummaryRequest {
  data: { doctor: string; patient: string }[];
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

      console.log(
        "getSummary fetch response:",
        JSON.stringify(response, null, 2)
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
  conversation_input: { data: { doctor: string; patient: string }[] };
  doctors_notes: string;
  threshold: number;
}

interface DiagnosisResponse {
  diagnoses: { diagnosis: string; likelihood: number }[];
  symptoms: string[];
  source: string;
  similarity: number;
}

export const getDiagnosis =
  (token: string | null) =>
  async (
    data: DiagnosisRequest
  ): Promise<Result<DiagnosisResponse, string>> => {
    try {
      const client = createApiClient(token);
      const response = await client.post<DiagnosisResponse>(
        "/rag/diagnose",
        data
      );

      console.log(
        "getDiagnosis fetch response:",
        JSON.stringify(response, null, 2)
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
  conversation_input: { data: { doctor: string; patient: string }[] };
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

      console.log(
        "getKeypoints fetch response:",
        JSON.stringify(response, null, 2)
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
