// worker.js (Cloudflare Worker)
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), req);
    }
    if (req.method !== "POST") {
      return withCors(
        new Response(JSON.stringify({ error: "POST만 허용" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    const input = await req.json();
    const prompt = buildPromptKR(input);

    const responseSchema = {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string" }, // "하이라이트"
        title: { type: "string" },
        narration: { type: "string" },
        dialogues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              speaker: { type: "string" },
              line: { type: "string" },
            },
            required: ["speaker", "line"],
          },
          minItems: 1,
          maxItems: 6,
        },
        choices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tag: { type: "string" },
              label: { type: "string" },
            },
            required: ["tag", "label"],
          },
          minItems: 0,
          maxItems: 3,
        },
        meta: { type: "object" },
      },
      required: ["id", "title", "narration", "dialogues", "choices", "meta"],
    };

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.9,
        maxOutputTokens: 500,
      },
    };

    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const detail = await r.text();
      return withCors(
        new Response(JSON.stringify({ error: "Gemini 오류", detail }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return withCors(
        new Response(JSON.stringify({ error: "응답 텍스트 없음", data }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    let card;
    try { card = JSON.parse(text); }
    catch {
      return withCors(
        new Response(JSON.stringify({ error: "JSON 파싱 실패", raw: text }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    card.type = "하이라이트";
    card.id = card.id || `highlight_${Date.now()}`;
    card.meta = card.meta || {};
    card.meta.source = "gemini";

    return withCors(
      new Response(JSON.stringify(card), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      req
    );
  },
};

function buildPromptKR(input) {
  const monthIndex = input.monthIndex ?? 0;
  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;

  const chars = (input.characters ?? [])
    .map(
      (c) =>
        `- ${c.name} (${c.mbti}, ${c.zodiac}), 이번달: ${c.schedule}, 능력치: 지능 ${c.stats?.intellect}, 매력 ${c.stats?.charm}, 체력 ${c.stats?.strength}, 예술 ${c.stats?.art}, 도덕 ${c.stats?.morality}, 스트레스 ${c.stats?.stress}`
    )
    .join("\n");

  const rels = (input.relations ?? [])
    .slice(0, 8)
    .map(
      (r) =>
        `- ${r.key}: 단계 ${r.stage}, 호감 ${r.affinity}, 신뢰 ${r.trust}, 긴장 ${r.tension}, 연정 ${r.romance}`
    )
    .join("\n");

  return `
당신은 프린세스 메이커 느낌의 '키우기 시뮬레이션'에서, 이번 달의 하이라이트 장면 1개를 작성합니다.
스타일: 내레이션 + 대사(B 스타일). 한국어로만. 짧고 게임 로그처럼.

시간: 제 ${year}년 ${month}월 (10년 게임, 월 단위 진행)

등장인물:
${chars || "- (없음)"}

관계 요약:
${rels || "- (없음)"}

규칙:
- 숫자/효과(능력치 변화)는 절대 만들지 말 것(텍스트만).
- 출력은 반드시 JSON이며, 제공된 스키마를 지켜야 함.
- dialogues는 2~5줄이 이상적.
- choices는 [] 또는 3개(A/B/C 태그) 중 하나.
  `.trim();
}

function withCors(res, req) {
  const origin = req.headers.get("Origin") || "*";
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}
