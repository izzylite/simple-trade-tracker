import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildThinResultRow } from '../storeTaskResult.ts';

Deno.test('buildThinResultRow carries envelope + briefing_id, no content', () => {
  const row = buildThinResultRow(
    { id: 't1', user_id: 'u1', task_type: 'market_research' },
    { briefingId: 'b1', title: 'EURUSD Market Research', significance: 'high', preview: 'x' },
  );
  assertEquals(row.task_id, 't1');
  assertEquals(row.user_id, 'u1');
  assertEquals(row.briefing_id, 'b1');
  assertEquals(row.title, 'EURUSD Market Research');
  assertEquals(row.significance, 'high');
  assertEquals('content_html' in row, false);
});
