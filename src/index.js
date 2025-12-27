export default {
  async fetch(req, env) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), req);
    }
    if (req.method !== "POST") {
      return withCors(
        new Response(JSON.stringify({ error: "POST only" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    // 1) 프론트에서 보낸 상태 요약 받기
    const input = await req.json();

    // 2) Gemini에 보낼 프롬프트 만들기(짧게)
    const prompt = buildPrompt(input);

    // 3) Structured Output 스키마(원하는 카드 JSON 형태로 제한)
    const responseSchema = {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string" }, // "HIGHLIGHT"로 고정시킬 예정
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
              tag: { type: "string" },   // A/B/C 권장(모델/스키마 제약 이슈가 있으면 enum 제거)
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

    // 4) Gemini generateContent 요청 바디
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.9,
        maxOutputTokens: 450,
      },
    };

    // 5) 호출 (API key는 Secret에서 읽음)
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
      env.GEMINI_KEY;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const detail = await r.text();
      return withCors(
        new Response(JSON.stringify({ error: "Gemini error", detail }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    // 6) Gemini 응답에서 JSON 텍스트 추출 → 파싱
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return withCors(
        new Response(JSON.stringify({ error: "No candidate text", data }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    let card;
    try {
      card = JSON.parse(text);
    } catch {
      return withCors(
        new Response(JSON.stringify({ error: "Non-JSON response", raw: text }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
        req
      );
    }

    // 7) type/meta 보정
    card.type = "HIGHLIGHT";
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

function buildPrompt(input) {
  const monthIndex = input.monthIndex ?? 0;
  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;

  const chars = (input.characters ?? [])
    .map(
      (c) =>
        `- ${c.name} (${c.mbti}, ${c.zodiac}), schedule: ${c.schedule}, stats: intellect ${c.stats?.intellect}, charm ${c.stats?.charm}, strength ${c.stats?.strength}, art ${c.stats?.art}, morality ${c.stats?.morality}, stress ${c.stats?.stress}`
    )
    .join("\n");

  const rels = (input.relations ?? [])
    .slice(0, 8)
    .map(
      (r) =>
        `- ${r.key}: stage ${r.stage}, affinity ${r.affinity}, trust ${r.trust}, tension ${r.tension}, romance ${r.romance}`
    )
    .join("\n");

  return `
Write ONE monthly highlight scene for a Princess-Maker-style raising simulation.
Style: narration + dialogues (B style). English only. Keep it short and game-like.

Timeline: Year ${year}, Month ${month}

Cast:
${chars || "- (none)"}

Relationships:
${rels || "- (none)"}

Rules:
- Output MUST be valid JSON matching the provided schema.
- dialogues: 2 to 5 lines is ideal.
- choices: either [] or exactly 3 choices with tags A/B/C.
- Do not invent numeric effects. This is text only.
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
