import { NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent';
import { maskText } from '@/lib/case';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function POST(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) return Response.json({ error: '입력 내용이 없습니다.' }, { status: 400 });
  let bytes = 0, raw = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 80_000) { await reader.cancel(); return Response.json({ error: '입력은 20,000자 이내로 나누어 주세요.' }, { status: 413 }); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch { return Response.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 }); }
  let input: string;
  try { const body = JSON.parse(raw); if (typeof body.input !== 'string') throw new Error(); input = maskText(body.input.trim()); }
  catch { return Response.json({ error: '텍스트 형식으로 입력해 주세요.' }, { status: 400 }); }
  if (input.length < 20 || input.length > 20_000) return Response.json({ error: '내용을 20~20,000자로 입력해 주세요.' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-...') return Response.json({ error: 'OpenAI API 키 연결이 필요합니다. 서버의 .env.local에 OPENAI_API_KEY를 설정해 주세요. 예시 사건은 키 없이 살펴볼 수 있습니다.' }, { status: 503 });
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort(), { once: true });
  const encoder = new TextEncoder(); let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => { if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      try { const result = await runAgent(input, send, abort.signal); send({ step: 'final', data: result }); }
      catch { if (!abort.signal.aborted) send({ step: 'error', note: '분석 연결에 문제가 생겼습니다. 입력은 유지됩니다. API 키·모델 접근 권한을 확인한 뒤 다시 시도해 주세요.' }); }
      finally { if (!closed) { closed = true; controller.close(); } }
    }, cancel() { closed = true; abort.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
}
