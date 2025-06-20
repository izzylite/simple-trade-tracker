import { BlogCategory } from '../../types/blog';

/**
 * Clean and sanitize HTML content
 */
export const sanitizeContent = (content: string): string => {
  // Remove script tags and other potentially harmful content
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
};

/**
 * Extract plain text from HTML content
 */
export const extractTextFromHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

/**
 * Truncate text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Generate summary from content
 */
export const generateSummary = (content: string, maxLength: number = 200): string => {
  const plainText = extractTextFromHtml(content);
  return truncateText(plainText, maxLength);
};

/**
 * Extract keywords from content
 */
export const extractKeywords = (content: string): string[] => {
  const plainText = extractTextFromHtml(content).toLowerCase();
  const words = plainText.split(/\W+/);
  
  // Common trading/finance keywords
  const tradingKeywords = [
    'trading', 'forex', 'stocks', 'crypto', 'bitcoin', 'ethereum',
    'market', 'analysis', 'bullish', 'bearish', 'support', 'resistance',
    'breakout', 'trend', 'volatility', 'volume', 'price', 'chart',
    'technical', 'fundamental', 'strategy', 'risk', 'profit', 'loss'
  ];
  
  return words.filter(word => 
    word.length > 3 && 
    tradingKeywords.includes(word)
  ).slice(0, 10);
};

/**
 * Categorize content based on keywords with improved logic
 */
export const categorizeContent = (title: string, content: string): BlogCategory => {
  const text = (title + ' ' + extractTextFromHtml(content)).toLowerCase();

  const categoryKeywords = {
    [BlogCategory.TRADING_STRATEGIES]: ['strategy', 'scalping', 'swing', 'day trading', 'position', 'trading plan', 'entry', 'exit'],
    [BlogCategory.ANALYSIS]: ['analysis', 'technical', 'fundamental', 'chart', 'pattern', 'support', 'resistance', 'trend'],
    [BlogCategory.EDUCATION]: ['learn', 'tutorial', 'guide', 'beginner', 'education', 'how to', 'basics', 'introduction'],
    [BlogCategory.CRYPTOCURRENCY]: ['cryptocurrency', 'crypto coin', 'blockchain technology', 'defi protocol', 'nft marketplace', 'altcoin'],
    [BlogCategory.FOREX]: ['forex trading', 'currency pair', 'exchange rate', 'pip', 'spread', 'major pairs'],
    [BlogCategory.STOCKS]: ['stock market', 'equity trading', 'share price', 'nasdaq index', 'dow jones', 's&p 500', 'earnings report'],
    [BlogCategory.COMMODITIES]: ['gold price', 'silver trading', 'oil futures', 'commodity market', 'crude oil', 'precious metals'],
    [BlogCategory.ECONOMIC_INDICATORS]: ['gdp growth', 'inflation rate', 'unemployment data', 'fed meeting', 'interest rate decision', 'cpi report'],
    [BlogCategory.REGULATION]: ['regulation update', 'sec ruling', 'cftc announcement', 'compliance requirement', 'legal framework', 'regulatory change']
  };

  let maxScore = 0;
  let bestCategory = BlogCategory.MARKET_NEWS;

  // First, check for exact phrase matches (higher weight)
  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    const phraseScore = keywords.reduce((acc, keyword) => {
      return acc + (text.includes(keyword) ? 2 : 0); // Higher weight for phrase matches
    }, 0);

    if (phraseScore > maxScore) {
      maxScore = phraseScore;
      bestCategory = category as BlogCategory;
    }
  });

  // If no strong phrase matches, check for individual keywords (lower weight)
  if (maxScore === 0) {
    const individualKeywords = {
      [BlogCategory.CRYPTOCURRENCY]: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft'],
      [BlogCategory.FOREX]: ['forex', 'currency', 'usd', 'eur', 'gbp', 'jpy'],
      [BlogCategory.STOCKS]: ['stock', 'equity', 'share', 'nasdaq', 'dow', 'earnings'],
      [BlogCategory.COMMODITIES]: ['gold', 'silver', 'oil', 'commodity', 'futures', 'crude'],
      [BlogCategory.ECONOMIC_INDICATORS]: ['gdp', 'inflation', 'unemployment', 'fed', 'cpi'],
      [BlogCategory.TRADING_STRATEGIES]: ['strategy', 'scalping', 'swing', 'position'],
      [BlogCategory.ANALYSIS]: ['analysis', 'technical', 'fundamental', 'chart', 'pattern'],
      [BlogCategory.EDUCATION]: ['learn', 'tutorial', 'guide', 'beginner', 'education'],
      [BlogCategory.REGULATION]: ['regulation', 'sec', 'cftc', 'compliance', 'legal', 'law']
    };

    Object.entries(individualKeywords).forEach(([category, keywords]) => {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (text.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as BlogCategory;
      }
    });
  }

  return bestCategory;
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};

/**
 * Generate slug from title
 */
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Highlight search terms in text
 */
export const highlightSearchTerms = (text: string, searchTerm: string): string => {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

/**
 * Parse RSS feed content
 */
export const parseRssContent = (rssText: string): any => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rssText, 'text/xml');
  
  const items = Array.from(xmlDoc.querySelectorAll('item')).map(item => ({
    title: item.querySelector('title')?.textContent || '',
    description: item.querySelector('description')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    pubDate: item.querySelector('pubDate')?.textContent || '',
    author: item.querySelector('author')?.textContent || '',
    category: item.querySelector('category')?.textContent || ''
  }));
  
  return {
    title: xmlDoc.querySelector('channel > title')?.textContent || '',
    description: xmlDoc.querySelector('channel > description')?.textContent || '',
    link: xmlDoc.querySelector('channel > link')?.textContent || '',
    items
  };
};

/**
 * Format content for display
 */
export const formatContentForDisplay = (content: string, maxLength?: number): string => {
  let formatted = sanitizeContent(content);
  
  if (maxLength) {
    formatted = truncateText(formatted, maxLength);
  }
  
  return formatted;
};
