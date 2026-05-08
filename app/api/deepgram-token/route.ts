import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "Deepgram not configured" }, { status: 500 });
  }

  if (!projectId) {
    console.warn("DEEPGRAM_PROJECT_ID not set — returning raw API key for local dev");
    return NextResponse.json({ token: apiKey });
  }

  const res = await fetch(
    `https://api.deepgram.com/v1/projects/${projectId}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "nexis-session",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 300,
      }),
    }
  );

  if (!res.ok) {
    console.error("Deepgram key creation failed:", res.status);
    return NextResponse.json({ token: apiKey });
  }

  const data = await res.json();
  return NextResponse.json({ token: data.key });
}
