import { NextRequest } from "next/server";
import { ImageInput, runAgent, StepEvent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Outgoing = StepEvent | { step: "final"; status: "done"; data: unknown } | { step: "fatal"; status: "error"; note: string };

const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64 = 2_800_000; // 약 2MB 원본. 클라이언트에서 축소해 보냄
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function readImages(raw: unknown): ImageInput[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return "사진 형식이 올바르지 않습니다.";
  if (raw.length > MAX_IMAGES) return `사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`;
  const out: ImageInput[] = [];
  for (const item of raw) {
    const mime = typeof item?.mime === "string" ? item.mime : "";
    const data = typeof item?.data === "string" ? item.data : "";
    if (!ALLOWED_MIME.has(mime)) return "사진은 JPEG, PNG, WEBP, GIF만 첨부할 수 있습니다.";
    if (!data || data.length > MAX_IMAGE_BASE64) return "사진 한 장의 크기가 너무 큽니다.";
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) return "사진 데이터가 손상되었습니다.";
    out.push({ mime, data });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: { input?: unknown; images?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 });
  }

  const input = typeof body?.input === "string" ? body.input : "";
  const images = readImages(body?.images);
  if (typeof images === "string") {
    return Response.json({ error: images }, { status: 400 });
  }

  if (input.trim().length < 20 && images.length === 0) {
    return Response.json(
      { error: "청구 메일이나 카드 문자 내용을 20자 이상 붙여넣거나 사진을 첨부해 주세요." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "서버에 API 키가 설정되어 있지 않습니다." }, { status: 500 });
  }

  const text = input;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Outgoing) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        const result = await runAgent(text, send, new Date(), images);
        send({ step: "final", status: "done", data: result });
      } catch (err) {
        send({
          step: "fatal",
          status: "error",
          note: err instanceof Error ? err.message : "판정 중 알 수 없는 오류가 발생했습니다.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
