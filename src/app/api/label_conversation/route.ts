import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface Segment {
  text: string;
  speaker: string;
}

interface LabelConversationRequest {
  data: Segment[];
}

interface LabelConversationResponse {
  data: Segment[];
}

const mergeSegments = (segments: Segment[]): Segment[] => {
  if (!segments.length) return [];
  const merged: Segment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.speaker === current.speaker) {
      current.text += next.text.startsWith(",") ? next.text : ` ${next.text}`;
    } else {
      merged.push({ ...current });
      current = { ...next };
    }
  }
  merged.push({ ...current });

  return merged.map((segment) => ({
    text: segment.text.trim(),
    speaker: segment.speaker,
  }));
};

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.error(
        "Environment variable NEXT_PUBLIC_BACKEND_API_URL is not set",
        { timestamp: new Date().toISOString() }
      );
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }
    console.log("Backend URL:", backendUrl, {
      timestamp: new Date().toISOString(),
    });

    // Validate authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header", {
        authHeader: authHeader || "None",
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    console.log(
      "Authorization token extracted (first 10 chars):",
      token.slice(0, 10) + "...",
      {
        timestamp: new Date().toISOString(),
      }
    );

    // Parse and validate request body
    const body: LabelConversationRequest = await request.json();
    console.log("Request body:", JSON.stringify(body, null, 2), {
      timestamp: new Date().toISOString(),
    });
    if (!body.data || !Array.isArray(body.data)) {
      console.error("Invalid request body: data is missing or not an array", {
        body: JSON.stringify(body, null, 2),
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { message: "Invalid request body: data must be an array" },
        { status: 400 }
      );
    }

    // Validate segment structure
    const isValid = body.data.every(
      (segment) =>
        typeof segment.text === "string" &&
        typeof segment.speaker === "string" &&
        segment.text.trim().length > 0
    );
    if (!isValid) {
      console.error("Invalid segment structure in request body", {
        data: JSON.stringify(body.data, null, 2),
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        {
          message:
            "Invalid segment structure: each segment must have a non-empty text and speaker string",
        },
        { status: 400 }
      );
    }
    console.log("Request body validated successfully", {
      segmentCount: body.data.length,
      timestamp: new Date().toISOString(),
    });

    // Make backend API call
    console.log(
      "Sending request to backend:",
      `${backendUrl}/label-conversation2`,
      {
        timestamp: new Date().toISOString(),
      }
    );
    const response = await axios.post<LabelConversationResponse>(
      `${backendUrl}/label-conversation2`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 60000, // 30-second timeout
      }
    );
    console.log("Backend response received:", {
      status: response.status,
      data: JSON.stringify(response.data, null, 2),
      timestamp: new Date().toISOString(),
    });

    // Validate response data
    if (!response.data?.data || !Array.isArray(response.data.data)) {
      console.error(
        "Invalid backend response: data is missing or not an array",
        {
          responseData: JSON.stringify(response.data, null, 2),
          timestamp: new Date().toISOString(),
        }
      );
      return NextResponse.json(
        { message: "Invalid backend response: data must be an array" },
        { status: 500 }
      );
    }

    // Merge segments
    const mergedData: LabelConversationResponse = {
      data: mergeSegments(response.data.data),
    };
    console.log("Merged segments:", JSON.stringify(mergedData, null, 2), {
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(mergedData, { status: 200 });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message;
      const responseData = error.response?.data || null;
      const errorDetails = {
        status,
        message,
        responseData: JSON.stringify(responseData, null, 2),
        requestUrl: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/label-conversation`,
        requestBody: JSON.stringify(
          await request.json().catch(() => null),
          null,
          2
        ),
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      };
      console.error("Backend API error:", errorDetails);
      return NextResponse.json(
        { message: `Failed to label conversation: ${message}` },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

    console.error("Labeling API error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
