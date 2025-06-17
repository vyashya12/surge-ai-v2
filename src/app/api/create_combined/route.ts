import { NextResponse } from "next/server";
import axios from "axios";

interface CombinedCreateRequest {
  session_id?: string;
  doctor_id?: string;
  patient_summary?: string;
  doctor_summary?: string;
  notes_summary?: string;
  diagnosis?: Array<{ diagnosis: string; likelihood: number }>;
  data_json?: {
    data?: any[];
    patient_summary?: string;
    doctor_summary?: string;
    doctor_note_summary?: string;
    diagnoses?: Array<{ diagnosis: string; likelihood: number }>;
    symptoms?: string[];
    physical_evaluation?: string;
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
  conversation?: string;
  physical_evaluation?: string;
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

    // Ensure all fields have default values if they're empty
    const validatedBody: CombinedCreateRequest = {
      ...body,
      session_id: body.session_id || "",
      doctor_id: body.doctor_id || "",
      diagnosis: Array.isArray(body.diagnosis) ? body.diagnosis : [],
      conversation: body.conversation || "",
      data_json: {
        data: body.data_json?.data || [],
        patient_summary: body.data_json?.patient_summary || "",
        doctor_summary: body.data_json?.doctor_summary || "",
        doctor_note_summary: body.data_json?.doctor_note_summary || "",
        diagnoses: body.data_json?.diagnoses || [],
        symptoms: body.data_json?.symptoms || [],
        gender: body.data_json?.gender || "",
        age: body.data_json?.age
          ? parseInt(body.data_json?.age?.toString())
          : null,
        vitals: {
          blood_pressure: body.data_json?.vitals?.blood_pressure || "",
          heart_rate_bpm: body.data_json?.vitals?.heart_rate_bpm || "",
          respiratory_rate_bpm:
            body.data_json?.vitals?.respiratory_rate_bpm || "",
          spo2_percent: body.data_json?.vitals?.spo2_percent || "",
          pain_score: body.data_json?.vitals?.pain_score || 0,
          weight_kg: body.data_json?.vitals?.weight_kg || 0,
          height_cm: body.data_json?.vitals?.height_cm || 0,
          temperature_celsius: body.data_json?.vitals?.temperature_celsius || 0,
        },
      },
      patient_summary: body.patient_summary || "",
      doctor_summary: body.doctor_summary || "",
      notes_summary: body.notes_summary || "",
      audio_url: body.audio_url || "",
      gender: body.gender || "",
      age: body.age ? parseInt(body.age.toString()) : null,
      vitals: {
        blood_pressure: body.vitals?.blood_pressure || "",
        heart_rate_bpm: body.vitals?.heart_rate_bpm || "",
        respiratory_rate_bpm: body.vitals?.respiratory_rate_bpm || "",
        spo2_percent: body.vitals?.spo2_percent || "",
        pain_score: body.vitals?.pain_score || 0,
        weight_kg: body.vitals?.weight_kg || 0,
        height_cm: body.vitals?.height_cm || 0,
        temperature_celsius: body.vitals?.temperature_celsius || 0,
      },
    };

    // Log the request payload for debugging
    console.log(
      "Combined Create Request Payload:",
      JSON.stringify({
        session_id: validatedBody.session_id,
        doctor_id: validatedBody.doctor_id,
        has_audio: !!validatedBody.audio_url,
        has_conversation:
          !!validatedBody.conversation && validatedBody.conversation.length > 0,
        has_diagnosis:
          validatedBody.diagnosis && validatedBody.diagnosis.length > 0,
        vitals_keys: validatedBody.vitals
          ? Object.keys(validatedBody.vitals)
          : [],
      })
    );

    // Fix for null values in vitals - ensure they are 0 or empty string
    if (validatedBody.vitals) {
      validatedBody.vitals.pain_score = validatedBody.vitals.pain_score ?? 0;
      validatedBody.vitals.weight_kg = validatedBody.vitals.weight_kg ?? 0;
      validatedBody.vitals.height_cm = validatedBody.vitals.height_cm ?? 0;
      validatedBody.vitals.temperature_celsius =
        validatedBody.vitals.temperature_celsius ?? 0;
    }

    if (validatedBody.data_json?.vitals) {
      validatedBody.data_json.vitals.pain_score =
        validatedBody.data_json.vitals.pain_score ?? 0;
      validatedBody.data_json.vitals.weight_kg =
        validatedBody.data_json.vitals.weight_kg ?? 0;
      validatedBody.data_json.vitals.height_cm =
        validatedBody.data_json.vitals.height_cm ?? 0;
      validatedBody.data_json.vitals.temperature_celsius =
        validatedBody.data_json.vitals.temperature_celsius ?? 0;
    }

    const response = await axios.post<CombinedCreateResponse>(
      `${backendUrl}/combined-create-v2`,
      validatedBody,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 20000,
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // Log detailed error information
      console.error(
        `Combined Create API error: HTTP ${error.response.status}`,
        {
          message: error.response.data?.message || error.message,
          responseData: error.response.data,
          detail: error.response.data?.detail
            ? JSON.stringify(error.response.data.detail, null, 2)
            : "No details",
        }
      );

      // If it's a validation error (422), log more details
      if (error.response.status === 422) {
        console.error(
          "Validation errors:",
          error.response.data?.detail
            ?.map(
              (err: any) => `${err.loc?.join(".")} - ${err.msg} (${err.type})`
            )
            .join(", ")
        );
      }

      return NextResponse.json(
        {
          message: error.response.data?.message || "Failed to create record",
          status: error.response.status,
          detail: error.response.data?.detail || [],
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
