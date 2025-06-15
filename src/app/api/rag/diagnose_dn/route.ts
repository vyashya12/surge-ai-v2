import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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

export async function POST(request: NextRequest) {
  const requestId = uuidv4();
  const logger = {
    info: (message: string, meta?: any) =>
      console.log(
        JSON.stringify({
          level: "info",
          requestId,
          message,
          timestamp: new Date().toISOString(),
          ...meta,
        })
      ),
    error: (message: string, meta?: any) =>
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          message,
          timestamp: new Date().toISOString(),
          ...meta,
        })
      ),
    warn: (message: string, meta?: any) =>
      console.warn(
        JSON.stringify({
          level: "warn",
          requestId,
          message,
          timestamp: new Date().toISOString(),
          ...meta,
        })
      ),
  };

  try {
    logger.info("Processing doctor's notes diagnosis request", {
      url: request.url,
    });

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      logger.error(
        "Environment variable NEXT_PUBLIC_BACKEND_API_URL is not set"
      );
      return NextResponse.json(
        { message: "Backend URL not configured", requestId },
        { status: 500 }
      );
    }
    logger.info("Backend URL", { backendUrl });

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.error("Missing or invalid Authorization header", {
        authHeader: authHeader || "None",
      });
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid token", requestId },
        { status: 401 }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    logger.info("Authorization token extracted (first 10 chars)", {
      token: token.slice(0, 10) + "...",
    });

    const body: DiagnoseDnRequest = await request.json();
    logger.info("Received request body", {
      body: JSON.stringify(body, null, 2),
    });

    if (!body.doctors_notes || typeof body.doctors_notes !== "string") {
      logger.error("Invalid request body", {
        error: "doctors_notes is missing or not a string",
        body: JSON.stringify(body, null, 2),
      });
      return NextResponse.json(
        {
          message:
            "Invalid request body: doctors_notes is required and must be a string",
          requestId,
        },
        { status: 400 }
      );
    }

    if (
      body.threshold !== undefined &&
      (typeof body.threshold !== "number" ||
        body.threshold < 0 ||
        body.threshold > 1)
    ) {
      logger.warn("Invalid threshold value", { threshold: body.threshold });
      return NextResponse.json(
        { message: "Threshold must be a number between 0 and 1", requestId },
        { status: 400 }
      );
    }

    const validatedBody: DiagnoseDnRequest = {
      doctors_notes: body.doctors_notes,
      threshold: body.threshold,
      gender: body.gender,
      age: body.age,
      vitals: body.vitals ?? undefined,
    };
    logger.info("Request body validated successfully");

    logger.info("Sending request to backend", {
      backendUrl: `${backendUrl}/rag/diagnose_dn`,
    });
    const response = await axios.post<DiagnoseDnResponse>(
      `${backendUrl}/rag/diagnose_dn`,
      validatedBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Request-ID": requestId,
        },
        timeout: 60000,
      }
    );
    logger.info("Backend response received", {
      status: response.status,
      data: JSON.stringify(response.data, null, 2),
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message;
      const responseData = error.response?.data || null;
      const errorDetails = {
        status,
        message,
        responseData: JSON.stringify(responseData, null, 2),
        requestUrl: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/rag_diagnose_dn`,
        requestBody: JSON.stringify(
          await request.json().catch(() => null),
          null,
          2
        ),
        errorCode: error.code,
      };
      logger.error("Backend API error", errorDetails);
      return NextResponse.json(
        { message: `Failed to fetch diagnosis: ${message}`, requestId },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

    logger.error("Unexpected error in diagnosis API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: JSON.stringify(
        await request.json().catch(() => null),
        null,
        2
      ),
    });
    return NextResponse.json(
      { message: "Internal Server Error", requestId },
      { status: 500 }
    );
  }
}
