// Batch tester: posts an HTML file to the deployed process-economic-events function in smaller chunks
// Usage: node scripts/test-process-economic-events-batch.js sample-economic-calendar-apr.html

const fs = require('fs');
const path = require('path');

function extractRows(html) {
  const re = /<tr[^>]*class="[^"]*economicCalendarRow[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
  const m = html.match(re);
  return m || [];
}

function wrap(rows) {
  return `<!doctype html><html><body><table><tbody>\n${rows.join('\n')}\n</tbody></table></body></html>`;
}

async function postBatch(rows) {
  const url = 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/process-economic-events';
  const html = wrap(rows);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ htmlContent: html })
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
  return { status: res.status, ok: res.ok, data: json };
}

async function main() {
  const fileArg = process.argv[2] || 'sample-economic-calendar-apr.html';
  const filePath = path.resolve(process.cwd(), fileArg);
  const html = fs.readFileSync(filePath, 'utf8');
  const rows = extractRows(html);
  console.log(`Found ${rows.length} economicCalendarRow rows`);

  const batchSize = 40;
  let totalProcessed = 0;
  let totalStored = 0;
  let batches = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    batches++;
    const res = await postBatch(chunk);
    console.log(`Batch ${batches} -> status=${res.status} ok=${res.ok}`);
    if (res.ok && res.data && res.data.success) {
      const d = res.data;
      totalProcessed += d.data?.events_processed ?? d.events_processed ?? 0;
      totalStored += d.data?.events_stored ?? d.events_stored ?? 0;
    } else {
      console.log('Response:', JSON.stringify(res.data).slice(0, 400));
      // If we see worker limit, slow down a bit
      await new Promise(r => setTimeout(r, 800));
    }
    // brief delay between batches
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(JSON.stringify({ batches, totalProcessed, totalStored }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });

