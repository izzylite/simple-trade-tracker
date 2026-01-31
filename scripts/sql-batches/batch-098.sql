INSERT INTO economic_events (
  external_id, currency, event_name, impact, event_date, event_time, time_utc,
  unix_timestamp, actual_value, forecast_value, previous_value, actual_result_type,
  country, flag_code, flag_url, data_source
) VALUES
('fff1242c8a65b500bf3e', 'CHF', 'Retail Sales MoM (Jun)', 'High', '2025-07-31', '2025-07-31T06:30:00.000Z', '2025-07-31T06:30:00.000Z', 1753943400000, '1.5%', '0.4', '-0.4', 'good', 'Switzerland', 'ch', 'https://flagcdn.com/w160/ch.png', 'myfxbook'),
('fff1e0dbad81d42673bf', 'AUD', 'CoreLogic Dwelling Prices MoM (Mar)', 'Low', '2025-04-01', '2025-04-01T00:01:00.000Z', '2025-04-01T00:01:00.000Z', 1743465660000, '0.4%', '0.3', '0.3', 'good', 'Australia', 'au', 'https://flagcdn.com/w160/au.png', 'myfxbook'),
('fff40a256d196ea9db22', 'JPY', 'Stock Investment by Foreigners (Aug/16)', 'Low', '2025-08-20', '2025-08-20T23:50:00.000Z', '2025-08-20T23:50:00.000Z', 1755733800000, NULL, NULL, '489.3', NULL, 'Japan', 'jp', 'https://flagcdn.com/w160/jp.png', 'myfxbook'),
('fffbf7ac96636433814b', 'USD', 'EIA Crude Oil Stocks Change (Oct/24)', 'Medium', '2025-10-29', '2025-10-29T14:30:00.000Z', '2025-10-29T14:30:00.000Z', 1761748200000, '-6.858M', '-0.2', '-0.961', 'good', 'United States', 'us', 'https://flagcdn.com/w160/us.png', 'myfxbook')
ON CONFLICT (external_id) DO UPDATE SET
  actual_value = EXCLUDED.actual_value,
  forecast_value = EXCLUDED.forecast_value,
  previous_value = EXCLUDED.previous_value,
  actual_result_type = EXCLUDED.actual_result_type,
  last_updated = NOW();