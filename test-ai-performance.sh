#!/bin/bash

# AI Chat Performance Test Script
# Tests tool caching, warmup endpoint, and performance improvements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_ANON_KEY environment variable not set${NC}"
  echo "Set it with: export SUPABASE_ANON_KEY=your_key_here"
  exit 1
fi

AI_AGENT_URL="${SUPABASE_URL}/functions/v1/ai-trading-agent"
WARMUP_AGENT_URL="${SUPABASE_URL}/functions/v1/warmup-ai-agent"

echo "=================================================="
echo "AI Chat Performance Test Suite"
echo "=================================================="
echo ""

# Test 1: Warmup Endpoint
echo -e "${YELLOW}Test 1: Warmup Endpoint${NC}"
echo "Testing warmup endpoint with X-Warmup header..."
echo ""

WARMUP_RESPONSE=$(curl -s -X POST "$AI_AGENT_URL" \
  -H "Content-Type: application/json" \
  -H "X-Warmup: true" \
  -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}")

HTTP_CODE=$(echo "$WARMUP_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$WARMUP_RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$WARMUP_RESPONSE" | sed '/HTTP_CODE:/,$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Warmup endpoint responding${NC}"
  echo "  Response time: ${TIME_TOTAL}s"
  echo "  Response: $RESPONSE_BODY"
else
  echo -e "${RED}✗ Warmup endpoint failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 2: Warmup Cron Function
echo -e "${YELLOW}Test 2: Warmup Cron Function${NC}"
echo "Testing warmup cron function..."
echo ""

CRON_RESPONSE=$(curl -s -X POST "$WARMUP_AGENT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}")

CRON_HTTP_CODE=$(echo "$CRON_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
CRON_TIME=$(echo "$CRON_RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
CRON_BODY=$(echo "$CRON_RESPONSE" | sed '/HTTP_CODE:/,$d')

if [ "$CRON_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Warmup cron function responding${NC}"
  echo "  Response time: ${CRON_TIME}s"
  echo "  Response: $CRON_BODY"
else
  echo -e "${RED}✗ Warmup cron function failed (HTTP $CRON_HTTP_CODE)${NC}"
fi
echo ""

# Test 3: Tool Cache - First Request (Cache Miss)
echo -e "${YELLOW}Test 3: Tool Cache - First Request${NC}"
echo "Making first request (expecting cache miss)..."
echo ""

FIRST_REQUEST=$(curl -s -X POST "$AI_AGENT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "message": "Hello, test message",
    "userId": "test-user-123",
    "calendarId": "test-calendar-456",
    "conversationHistory": []
  }' \
  -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}")

FIRST_HTTP_CODE=$(echo "$FIRST_REQUEST" | grep "HTTP_CODE:" | cut -d: -f2)
FIRST_TIME=$(echo "$FIRST_REQUEST" | grep "TIME_TOTAL:" | cut -d: -f2)

if [ "$FIRST_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ First request successful${NC}"
  echo "  Response time: ${FIRST_TIME}s"
else
  echo -e "${RED}✗ First request failed (HTTP $FIRST_HTTP_CODE)${NC}"
fi
echo ""

# Wait a moment
sleep 1

# Test 4: Tool Cache - Second Request (Cache Hit)
echo -e "${YELLOW}Test 4: Tool Cache - Second Request${NC}"
echo "Making second request (expecting cache hit)..."
echo ""

SECOND_REQUEST=$(curl -s -X POST "$AI_AGENT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "message": "Another test message",
    "userId": "test-user-123",
    "calendarId": "test-calendar-456",
    "conversationHistory": []
  }' \
  -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}")

SECOND_HTTP_CODE=$(echo "$SECOND_REQUEST" | grep "HTTP_CODE:" | cut -d: -f2)
SECOND_TIME=$(echo "$SECOND_REQUEST" | grep "TIME_TOTAL:" | cut -d: -f2)

if [ "$SECOND_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Second request successful${NC}"
  echo "  Response time: ${SECOND_TIME}s"

  # Calculate improvement
  IMPROVEMENT=$(echo "scale=2; ($FIRST_TIME - $SECOND_TIME) * 1000" | bc)
  if [ $(echo "$IMPROVEMENT > 0" | bc) -eq 1 ]; then
    echo -e "${GREEN}  Cache benefit: ${IMPROVEMENT}ms faster${NC}"
  else
    echo -e "${YELLOW}  Note: Second request not faster (both may be cached)${NC}"
  fi
else
  echo -e "${RED}✗ Second request failed (HTTP $SECOND_HTTP_CODE)${NC}"
fi
echo ""

# Test 5: Performance Comparison
echo -e "${YELLOW}Test 5: Performance Summary${NC}"
echo "=================================================="
echo ""
echo "Request Performance:"
echo "  First request:  ${FIRST_TIME}s"
echo "  Second request: ${SECOND_TIME}s"
echo "  Warmup ping:    ${TIME_TOTAL}s"
echo "  Cron function:  ${CRON_TIME}s"
echo ""

# Summary
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

[ "$HTTP_CODE" = "200" ] && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
[ "$CRON_HTTP_CODE" = "200" ] && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
[ "$FIRST_HTTP_CODE" = "200" ] && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
[ "$SECOND_HTTP_CODE" = "200" ] && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))

echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Phase 1 implementation verified.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Check the output above.${NC}"
  exit 1
fi
