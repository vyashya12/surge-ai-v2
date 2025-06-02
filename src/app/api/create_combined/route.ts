import { NextResponse } from "next/server";
import axios from "axios";

interface CombinedCreateRequest {
  session_id?: string;
  doctor_id?: string;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string;
  diagnosis: Array<{ diagnosis: string; likelihood: number }>;
  data_json?: {
    data?: any[];
    patient_summary?: string;
    doctor_summary?: string;
    doctor_note_summary?: string;
    diagnoses?: Array<{ diagnosis: string; likelihood: number }>;
    symptoms?: string[];
    physical_evaluation?: string;
    gender?: string;
    age?: string;
    vitals?: {
      blood_pressure?: string | undefined;
      heart_rate_bpm?: string | undefined;
      respiratory_rate_bpm?: string | undefined;
      spo2_percent?: string | undefined;
      pain_score?: number | undefined;
      weight_kg?: number | undefined;
      height_cm?: number | undefined;
      temperature_celsius?: number | undefined;
    };
  };
  audio_url?: string;
  conversation: string;
  physical_evaluation?: string;
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
  session_id?: string;
  summary_id?: string;
  diagnosis_validation_id?: string;
  physical_evaluation?: string;
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
  status?: number;
  message?: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.error("Backend URL not configured");
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }

    const body: CombinedCreateRequest = await request.json();

    // Validate required fields
    if (
      !body.diagnosis ||
      !Array.isArray(body.diagnosis) ||
      body.diagnosis.some(
        (diag) =>
          typeof diag.diagnosis !== "string" ||
          typeof diag.likelihood !== "number"
      )
    ) {
      console.error("Invalid request body: Missing or invalid diagnosis", {
        diagnosis: body.diagnosis,
      });
      return NextResponse.json(
        {
          message:
            "Invalid request body: Diagnosis must be a valid array of objects with diagnosis and likelihood",
        },
        { status: 400 }
      );
    }

    if (!body.conversation || typeof body.conversation !== "string") {
      console.error("Invalid request body: Missing or invalid conversation", {
        conversation: body.conversation,
      });
      return NextResponse.json(
        {
          message:
            "Invalid request body: Conversation is required and must be a string",
        },
        { status: 400 }
      );
    }

    // Ensure data_json has default values if undefined
    const validatedBody: CombinedCreateRequest = {
      ...body,
      data_json: body.data_json || {},
    };

    const response = await axios.post<CombinedCreateResponse>(
      `${backendUrl}/combined-create-v2`,
      validatedBody,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 20000, // 20s timeout
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `Combined Create API error: HTTP ${error.response.status}`,
        {
          message: error.response.data?.message || error.message,
          responseData: error.response.data,
        }
      );
      return NextResponse.json(
        {
          message: error.response.data?.message || "Failed to create record",
          status: error.response.status,
        },
        { status: error.response.status }
      );
    }
    console.error("Combined Create API error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
