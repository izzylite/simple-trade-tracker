const cheerio = require('cheerio');
const fs = require('fs');

/**
 * Test HTML parsing without database operations
 */
function testHTMLParsing(htmlFilePath) {
  console.log('🧪 TESTING HTML PARSING\n');
  
  try {
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    console.log(`📄 HTML file size: ${html.length} characters`);
    
    const $ = cheerio.load(html);
    const rows = $('tr');
    console.log(`📊 Found ${rows.length} table rows`);
    
    console.log('\n🔍 ANALYZING EACH ROW:\n');
    
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length > 0) {
        console.log(`Row ${index}:`);
        console.log(`  Cells: ${cells.length}`);
        
        cells.each((cellIndex, cell) => {
          const cellText = $(cell).text().trim();
          console.log(`    Cell ${cellIndex}: "${cellText}"`);
        });
        
        // Test our parsing logic
        if (cells.length >= 4) {
          const rowText = $row.text();
          
          // Look for date patterns
          const datePatterns = [
            /Apr\s+\d{1,2}/i, /\d{1,2}\s+Apr/i,
            /May\s+\d{1,2}/i, /\d{1,2}\s+May/i,
            /Jun\s+\d{1,2}/i, /\d{1,2}\s+Jun/i,
          ];
          
          const hasDateMatch = datePatterns.some(pattern => pattern.test(rowText));
          
          if (hasDateMatch) {
            console.log(`  ✅ HAS DATE MATCH: "${rowText}"`);
            
            let time = '';
            let currency = '';
            let eventName = '';
            let impact = '';
            
            cells.each((cellIndex, cell) => {
              const cellText = $(cell).text().trim();
              
              // Cell 0: Date and time
              if (cellIndex === 0) {
                const timeMatch = cellText.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                  time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
                }
              }
              
              // Currency
              if (/^(USD|EUR|GBP|JPY|AUD|CAD|CHF)$/.test(cellText)) {
                currency = cellText;
              }
              
              // Impact
              if (/^(High|Medium|Low)$/i.test(cellText)) {
                impact = cellText;
              }
              
              // Event name - try different cells
              if (cellText.length > 3 && 
                  !/^(USD|EUR|GBP|JPY|AUD|CAD|CHF)$/i.test(cellText) &&
                  !/^(High|Medium|Low)$/i.test(cellText) &&
                  !/^\d{1,2}:\d{2}$/.test(cellText) &&
                  !/^[\d.,%-]+$/.test(cellText) &&
                  !eventName) { // Take the first valid event name
                eventName = cellText;
              }
            });
            
            console.log(`    EXTRACTED:`);
            console.log(`      Time: "${time}"`);
            console.log(`      Currency: "${currency}"`);
            console.log(`      Impact: "${impact}"`);
            console.log(`      Event: "${eventName}"`);
            
            if (time && currency && eventName) {
              console.log(`    ✅ VALID EVENT`);
            } else {
              console.log(`    ❌ INVALID EVENT (missing required fields)`);
            }
          } else {
            console.log(`  ❌ NO DATE MATCH`);
          }
        }
        
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run test
if (require.main === module) {
  const htmlFilePath = process.argv[2] || 'sample-economic-calendar.html';
  testHTMLParsing(htmlFilePath);
}

module.exports = { testHTMLParsing };
