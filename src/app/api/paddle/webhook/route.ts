import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature") ?? request.headers.get("x-paddle-signature");
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "PADDLE_WEBHOOK_SECRET is not configured" }, { status: 400 });
  }

  if (!process.env.PADDLE_API_KEY) {
    return NextResponse.json({ error: "PADDLE_API_KEY is not configured" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing Paddle signature" }, { status: 401 });
  }

  const paddle = new Paddle(process.env.PADDLE_API_KEY, {
    environment: process.env.PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox
  });

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch {
    return NextResponse.json({ error: "Invalid Paddle signature" }, { status: 401 });
  }

  return NextResponse.json({
    received: true,
    eventType: event.eventType
  });
}
