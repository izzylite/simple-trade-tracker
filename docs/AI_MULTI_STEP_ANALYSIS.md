# Compositional Function Calling Feature

## Overview

The AI chat service now uses **official compositional function calling**, leveraging Google Gemini's native ability to chain multiple function calls together naturally to answer complex trading questions.

## How It Works

### Official Compositional Pattern
```
User: "How many unemployment rate trades do we have on Tuesdays?"
AI:
  Step 1: searchTrades({dayOfWeek: "tuesday"}) → Get all Tuesday trades
  Step 2: findSimilarTrades({query: "unemployment rate economic events"}) → Get unemployment-related trades
  Step 3: Naturally analyzes overlap → Provides precise count and insights
```

This uses Google's official compositional function calling capability where the model naturally determines when multiple function calls are needed.

## Key Features

### 1. Natural Function Chaining
The AI naturally determines when multiple function calls are needed without complex prompting or forced behavior.

### 2. Official Gemini API Support
- Uses Google's official compositional function calling capability
- Supports up to 10 rounds of function calling for complex analysis
- Natural conversation flow handles the sequencing automatically

### 3. Simplified Implementation
Clean, reliable implementation that follows Google's intended design patterns rather than over-engineering the solution.

## Example Use Cases

### Complex Filtering
**Question:** "Show me my best EUR/USD trades during high-impact news events"

**Multi-Step Process:**
1. `findSimilarTrades({query: "EUR/USD currency pair"})` → Get EUR/USD trades
2. `findSimilarTrades({query: "high impact economic news events"})` → Get news-related trades
3. Find intersection and rank by profitability

### Comparative Analysis
**Question:** "What's my win rate during London session vs NY session for scalping trades?"

**Multi-Step Process:**
1. `findSimilarTrades({query: "scalping strategy trades"})` → Get scalping trades
2. `searchTrades({session: "london"})` → Get London session trades
3. `searchTrades({session: "new-york"})` → Get NY session trades
4. Calculate win rates for scalping trades in each session

### Time-Based + Event Analysis
**Question:** "How many unemployment rate trades do we have on Tuesdays?"

**Multi-Step Process:**
1. `searchTrades({dayOfWeek: "tuesday"})` → Get all Tuesday trades
2. `findSimilarTrades({query: "unemployment rate economic events"})` → Get unemployment-related trades
3. Analyze overlap and count matches

## Technical Implementation

### Simplified System Prompt
The AI system prompt now includes:
- Brief explanation of compositional function calling capability
- Natural examples without forced prompting
- Relies on Gemini's native intelligence

### Official Compositional Pattern
```typescript
// Create chat session for natural function calling
const chat = model.startChat();
let currentResponse = await chat.sendMessage(prompt);

// Natural compositional function calling loop
while (currentRound < maxRounds) {
  const functionCalls = currentResponse.response.functionCalls();

  if (!functionCalls || functionCalls.length === 0) {
    // Model has final answer
    break;
  }

  // Execute functions and send results back
  const functionResponseParts = await executeFunctions(functionCalls);
  currentResponse = await chat.sendMessage(functionResponseParts);
}
```

### Natural Conversation Flow
- Uses standard Firebase AI chat sessions
- No complex history management needed
- Model naturally decides when to chain functions

## Benefits

### 1. More Accurate Results
By combining multiple data sources, the AI provides more precise and comprehensive answers.

### 2. Better Context Understanding
The AI can now handle complex questions that require understanding relationships between different data dimensions.

### 3. Comprehensive Analysis
Instead of providing partial answers, the AI builds complete insights by analyzing all relevant data.

### 4. Flexible Query Handling
Supports natural language questions that would previously require multiple separate queries.

### 5. Simplified Function Logic
Removed automatic fallback mechanisms in favor of intelligent multi-step analysis - the AI now decides when and how to combine different functions.

## Usage Examples

### In AI Chat Interface
Simply ask complex questions naturally:

```
"How many unemployment rate trades do we have on Tuesdays?"
"What's my best performing strategy during high-impact news events?"
"Show me EUR/USD trades that happened during London session with risk-reward above 2:1"
"Compare my win rate on Mondays vs Fridays for scalping trades"
```

### Expected AI Response Pattern
1. **Function Execution Summary**: Shows which functions were called and why
2. **Data Analysis**: Combines results from all function calls
3. **Insights & Patterns**: Identifies trends across the combined dataset
4. **Actionable Recommendations**: Provides specific advice based on comprehensive analysis
5. **Trade Cards**: Displays relevant trades when applicable

## Configuration

### Max Rounds Limit
- Default: 5 rounds maximum
- Prevents infinite loops while allowing complex analysis
- Can be adjusted in `firebaseAIChatService.ts`

### Function Call Timeout
- Each function call respects existing timeout settings
- Total analysis time may be longer due to multiple rounds
- Progress indicators show ongoing analysis

## Demo Component

A demo component (`MultiStepAnalysisDemo.tsx`) is available to showcase the feature with predefined complex questions and step-by-step visualization.

## Future Enhancements

1. **Dynamic Step Visualization**: Real-time display of analysis steps in the chat interface
2. **User-Guided Analysis**: Allow users to approve each step before proceeding
3. **Analysis Caching**: Cache intermediate results for faster subsequent queries
4. **Custom Analysis Workflows**: Allow users to define their own multi-step analysis patterns
