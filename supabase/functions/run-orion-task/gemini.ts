import { log } from '../_shared/supabase.ts';

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const BRIEFING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    significance: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    title: { type: 'string' },
    briefing_html: { type: 'string' },
    briefing_plain: { type: 'string' },
  },
  required: ['significance', 'title', 'briefing_html', 'briefing_plain'],
};

export async function generateContent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: BRIEFING_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log('Gemini API error', 'error', {
      status: response.status,
      body: errorText.substring(0, 500),
    });
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p: { text?: string }) => p.text || '').join('');
}
