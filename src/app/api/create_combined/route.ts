import { NextResponse } from "next/server";
import axios from "axios";

interface CombinedCreateRequest {
  session_id: string;
  doctor_id: string;
  patient_summary: string;
  doctor_summary: string;
  notes_summary: string;
  diagnosis: Array<{ diagnosis: string; likelihood: number }>;
  data_json: {
    data: any[]; // Allow empty array or any data
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
  status?: number; // Optional, may appear in errors
  message?: string; // Optional, may appear in errors
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
      !body.session_id ||
      !body.doctor_id ||
      !body.patient_summary ||
      !body.doctor_summary ||
      !body.notes_summary ||
      !body.diagnosis ||
      !Array.isArray(body.diagnosis) ||
      !body.data_json ||
      !Array.isArray(body.data_json.data) ||
      !body.data_json.patient_summary ||
      !body.data_json.doctor_summary ||
      !body.data_json.doctor_note_summary ||
      !Array.isArray(body.data_json.diagnoses) ||
      !Array.isArray(body.data_json.symptoms) ||
      !body.audio_url ||
      !body.conversation ||
      body.physical_evaluation === undefined ||
      body.gender === undefined ||
      body.age === undefined ||
      body.data_json.physical_evaluation === undefined ||
      body.data_json.gender === undefined ||
      body.data_json.age === undefined
    ) {
      console.error(
        "Invalid request body: Missing or invalid required fields",
        {
          missingFields: {
            session_id: !body.session_id,
            doctor_id: !body.doctor_id,
            patient_summary: !body.patient_summary,
            doctor_summary: !body.doctor_summary,
            notes_summary: !body.notes_summary,
            diagnosis: !body.diagnosis || !Array.isArray(body.diagnosis),
            data_json: !body.data_json,
            data: !body.data_json || !Array.isArray(body.data_json?.data),
            data_json_patient_summary:
              !body.data_json || !body.data_json.patient_summary,
            data_json_doctor_summary:
              !body.data_json || !body.data_json.doctor_summary,
            data_json_doctor_note_summary:
              !body.data_json || !body.data_json.doctor_note_summary,
            data_json_diagnoses:
              !body.data_json || !Array.isArray(body.data_json.diagnoses),
            data_json_symptoms:
              !body.data_json || !Array.isArray(body.data_json.symptoms),
            audio_url: !body.audio_url,
            conversation: !body.conversation,
            physical_evaluation: body.physical_evaluation === undefined,
            gender: body.gender === undefined,
            age: body.age === undefined,
            data_json_physical_evaluation:
              !body.data_json ||
              body.data_json.physical_evaluation === undefined,
            data_json_gender:
              !body.data_json || body.data_json.gender === undefined,
            data_json_age: !body.data_json || body.data_json.age === undefined,
          },
        }
      );
      return NextResponse.json(
        {
          message: "Invalid request body: Missing or invalid required fields",
        },
        { status: 400 }
      );
    }

    const response = await axios.post<CombinedCreateResponse>(
      `${backendUrl}/combined-create-v2`,
      body,
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
