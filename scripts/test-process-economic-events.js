// Simple tester: posts an HTML file to the deployed process-economic-events function
// Usage: node scripts/test-process-economic-events.js sample-economic-calendar-apr.html

const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const fileArg = process.argv[2] || 'sample-economic-calendar-apr.html';
    const filePath = path.resolve(process.cwd(), fileArg);
    const html = fs.readFileSync(filePath, 'utf8');

    // Pre-trim HTML to only relevant rows to reduce payload/compute
    const matches = html.match(/<tr[^>]*economicCalendarRow[^>]*>[\s\S]*?<\/tr>/gi);
    const trimmed = matches && matches.length
      ? `<!doctype html><html><body><table><tbody>${matches.join('\n')}</tbody></table></body></html>`
      : html;

    const url = 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/process-economic-events';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ htmlContent: trimmed })
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }

    console.log(JSON.stringify({
      status: res.status,
      ok: res.ok,
      response: json
    }, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();

