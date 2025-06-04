import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

interface SuggestionsRequest {
  data: Array<{ doctor?: string; patient?: string }>;
}

interface SuggestionsResponse {
  suggestions: string[];
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
  };

  try {
    logger.info("Processing suggestions request", { url: request.url });

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

    const body: SuggestionsRequest = await request.json();
    logger.info("Received request body", {
      body: JSON.stringify(body, null, 2),
    });

    if (!body.data || !Array.isArray(body.data)) {
      logger.error("Invalid request body", {
        error: "data is missing or not an array",
        body: JSON.stringify(body, null, 2),
      });
      return NextResponse.json(
        {
          message: "Invalid request body: data is missing or not an array",
          requestId,
        },
        { status: 400 }
      );
    }

    const isValid = body.data.every(
      (segment) => "doctor" in segment || "patient" in segment
    );
    if (!isValid) {
      logger.error("Invalid segment structure in request body", {
        data: JSON.stringify(body.data, null, 2),
      });
      return NextResponse.json(
        {
          message:
            "Invalid segment structure: each segment must have a doctor or patient string",
          requestId,
        },
        { status: 400 }
      );
    }
    logger.info("Request body validated successfully", {
      segmentCount: body.data.length,
    });

    logger.info("Sending request to backend", {
      backendUrl: `${backendUrl}/doctor-reply-suggestions`,
    });
    const response = await axios.post<SuggestionsResponse>(
      `${backendUrl}/doctor-reply-suggestions`,
      body,
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
        requestUrl: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/doctor-reply-suggestions`,
        requestBody: JSON.stringify(
          await request.json().catch(() => null),
          null,
          2
        ),
        errorCode: error.code,
      };
      logger.error("Backend API error", errorDetails);
      return NextResponse.json(
        { message: `Failed to fetch suggestions: ${message}`, requestId },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

    logger.error("Unexpected error in suggestions API", {
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
