import { ok } from "@/lib/result";

export async function GET() {
  return ok({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
