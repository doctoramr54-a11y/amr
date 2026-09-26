export default {
  async fetch(request, env, ctx) {
    // التعامل مع CORS للسماح للموقع بالاتصال بالـ API
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST allowed" }), { status: 405 });
    }

    try {
      const body = await request.json();
      const prompt = body.prompt;
      const model = body.model || "gpt-4o-mini";

      if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
      }

      // 1. جلب Token الجلسة تلقائياً من DuckDuckGo
      const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "x-vnc-req": "1",
          "Accept": "*/*"
        }
      });

      const token = statusRes.headers.get("x-vnc-etag");

      // 2. إرسال السؤال والتواصل مع نموذج الذكاء الاصطناعي
      const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "x-vnc-etag": token
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }]
        })
      });

      // 3. معالجة وتجميع النص
      const rawText = await chatRes.text();
      const lines = rawText.split("\n");
      let fullResponse = "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.message) fullResponse += parsed.message;
          } catch (e) {}
        }
      }

      return new Response(JSON.stringify({ response: fullResponse }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
