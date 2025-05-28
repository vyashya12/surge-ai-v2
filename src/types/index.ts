export interface User {
  id: string;
  username: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  status: number;
  message: string;
  user: User;
  token: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface RegisterResponse {
  status: number;
  message: string;
}

export interface Diagnosis {
  diagnoses: { diagnosis: string; likelihood: number }[];
  symptoms: string[];
  source: string;
  similarity: number;
}

export interface DiagnosisValidation {
  id: string;
  doctor_id: string;
  session_id: string;
  summary_id: string;
  validation: boolean;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string | null;
  diagnosis: Array<{ diagnosis?: string; likelihood?: number }>;
  data_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Define request and response types for getAllDiagnosisValidations
export interface DiagnosisValidationRequest {
  // Add fields if the API requires specific data in the POST request
  // Example: { filter: string } or leave as empty object {}
}

export interface DiagnosisValidationResponse {
  diagnoses: DiagnosisValidation[];
  status?: string | number;
  message?: string;
}

export interface Summary {
  id: string;
  session_id: string;
  doctorsid: string;
  patient: string;
  doctor: string;
  notes_summary: string;
  diagnosis: string;
  diagnosis_probability: number;
  physical_evaluation: string;
  gender: string;
  age: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  doctorsid: string;
  audio_url: string;
  conversation: string;
  summaryid: string;
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  text: string;
}

export interface Keypoint {
  text: string;
}

export interface Label {
  label: string;
}

export interface DiagnosisSuggestion {
  id: string;
  name: string;
  probability: number;
}

export interface Conversation {
  text: string;
  speaker: string;
}

export interface LabelConversation {
  data: Conversation[];
}

export interface LabeledConversationSegment {
  doctor: string;
  patient: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
