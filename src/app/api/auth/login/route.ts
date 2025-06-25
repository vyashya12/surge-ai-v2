import { NextResponse } from "next/server";
import axios from "axios";

// Hardcoded blacklisted user ID - replace with the actual bad actor's ID
const BLACKLISTED_USER_ID = "e2ba3ffb-0def-454e-9b73-1b0583ddab96";

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const response = await axios.post(`${backendUrl}/login`, body, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Block the specific bad actor
    if (response.data.status === 200 && response.data.doctor?.id === BLACKLISTED_USER_ID) {
      return NextResponse.json(
        { message: "Account access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, {
        status: error.response.status,
      });
    }
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}