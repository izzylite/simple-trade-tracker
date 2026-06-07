/**
 * Single source of truth for the currencies the economic calendar covers.
 *
 * The MyFXBook parser gates on this in three places (precheck regex, extraction
 * regex, validity list) plus the storage filter — all derived from here so they
 * can never drift (NZD/CNY were once missing from the regexes, silently dropping
 * those rows). NZD completes the AUD/CAD/NZD comm-dollar trio; CNY drives global
 * risk sentiment. The UI already offers all of these as filter chips.
 */
export const CALENDAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY',
];

export const CURRENCY_REGEX = new RegExp(`\\b(${CALENDAR_CURRENCIES.join('|')})\\b`);
