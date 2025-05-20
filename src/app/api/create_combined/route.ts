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
    data: Array<unknown>;
    patient_summary: string;
    doctor_summary: string;
    doctor_note_summary: string;
    diagnoses: Array<{ diagnosis: string; likelihood: number }>;
    symptoms: string[];
  };
  audio_url: string;
  conversation: string;
}

interface CombinedCreateResponse {
  status: number;
  message: string;
  [key: string]: any; // Allow additional fields from backend
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
      !body.conversation
    ) {
      console.error("Invalid request body: Missing or invalid required fields");
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
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `Combined Create API error: HTTP ${error.response.status} - ${
          error.response.data?.message || error.message
        }`
      );
      return NextResponse.json(
        {
          message: error.response.data?.message || "Failed to create record",
          status: error.response.status,
        },
        { status: error.response.status }
      );
    }
    console.error("Combined Create API error:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
