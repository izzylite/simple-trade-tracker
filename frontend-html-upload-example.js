/**
 * Frontend example for uploading HTML files to the cloud function
 * This shows how to integrate the processHtmlEconomicEvents function in your React app
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Upload HTML content to cloud function for processing
 * @param {string} htmlContent - The HTML content to process
 * @returns {Promise<Object>} - Processing result
 */
export async function uploadHtmlToCloud(htmlContent) {
  try {
    console.log('🚀 Uploading HTML to cloud function...');
    
    // Get Firebase Functions instance
    const functions = getFunctions();
    
    // Get the callable function
    const processHtmlEconomicEvents = httpsCallable(functions, 'processHtmlEconomicEvents');
    
    // Call the function with HTML content
    const result = await processHtmlEconomicEvents({
      htmlContent: htmlContent
    });
    
    console.log('✅ Cloud function completed:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('❌ Error calling cloud function:', error);
    throw error;
  }
}

/**
 * React component example for HTML file upload
 */
export function HtmlUploadComponent() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.html')) {
      setError('Please select an HTML file');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      // Read file content
      const htmlContent = await readFileAsText(file);
      
      // Upload to cloud function
      const processingResult = await uploadHtmlToCloud(htmlContent);
      
      setResult(processingResult);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  return (
    <div className="html-upload-component">
      <h3>Upload Economic Calendar HTML</h3>
      
      <div className="upload-section">
        <input
          type="file"
          accept=".html"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        
        {uploading && (
          <div className="uploading">
            <span>Processing HTML file...</span>
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="error">
          <h4>❌ Error</h4>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="result">
          <h4>✅ Processing Complete</h4>
          
          {result.success ? (
            <div className="success-details">
              <p><strong>Total Events:</strong> {result.totalEvents}</p>
              <p><strong>Major Currency Events:</strong> {result.majorCurrencyEvents}</p>
              <p><strong>Currencies:</strong> {result.currencies.join(', ')}</p>
              
              {result.dateRange.start && (
                <p><strong>Date Range:</strong> {result.dateRange.start} to {result.dateRange.end}</p>
              )}
              
              <h5>Sample Events:</h5>
              <ul>
                {result.sampleEvents.map((event, i) => (
                  <li key={i}>
                    <strong>{event.currency}</strong> - {event.event} ({event.impact})
                    <br />
                    <small>📅 {event.time_utc}</small>
                    {event.country && <small> | 🌍 {event.country}</small>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="error-details">
              <p>Processing failed: {result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Usage example in your main app
 */
export function ExampleUsage() {
  const handleManualUpload = async () => {
    try {
      // Example: Upload HTML content directly
      const htmlContent = `
        <!-- Your MyFXBook HTML content here -->
        <html>...</html>
      `;
      
      const result = await uploadHtmlToCloud(htmlContent);
      console.log('Upload result:', result);
      
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <h2>Economic Calendar HTML Upload</h2>
      
      {/* File upload component */}
      <HtmlUploadComponent />
      
      {/* Manual upload button */}
      <button onClick={handleManualUpload}>
        Test Manual Upload
      </button>
    </div>
  );
}
