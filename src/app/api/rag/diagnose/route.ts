import { NextResponse } from "next/server";
import axios from "axios";

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

    const body = await request.json();

    // Validate conversation_input
    if (
      !body.conversation_input?.data ||
      !Array.isArray(body.conversation_input.data)
    ) {
      console.error(
        "Invalid request body: conversation_input.data is missing or not an array",
        { body }
      );
      return NextResponse.json(
        {
          message:
            "Invalid request body: conversation_input.data is missing or not an array",
        },
        { status: 400 }
      );
    }

    // Validate threshold if provided
    if (
      body.threshold !== undefined &&
      (typeof body.threshold !== "number" ||
        body.threshold < 0 ||
        body.threshold > 1)
    ) {
      console.warn("Invalid threshold value", { threshold: body.threshold });
      return NextResponse.json(
        { message: "Threshold must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    // Ensure vitals is an object or undefined
    const validatedBody = {
      ...body,
      vitals: body.vitals ?? undefined,
    };

    const response = await axios.post(
      `${backendUrl}/rag/diagnose`,
      validatedBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`Diagnosis API error: HTTP ${error.response.status}`, {
        message: error.response.data?.message || error.message,
        responseData: error.response.data,
      });
      return NextResponse.json(
        {
          message: error.response.data?.message || "Failed to fetch diagnosis",
          status: error.response.status,
        },
        { status: error.response.status }
      );
    }
    console.error("Diagnosis API error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
