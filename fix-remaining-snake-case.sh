#!/bin/bash

# Script to convert remaining camelCase property names to snake_case
# This handles properties that were missed in the first pass

echo "Converting remaining camelCase to snake_case..."

# Find all TypeScript/TSX files in src/ directory
find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" | while read file; do
  # Calendar properties
  sed -i 's/\.lastModified/\.updated_at/g' "$file"
  sed -i 's/\.heroImageUrl/\.hero_image_url/g' "$file"
  sed -i 's/\.heroImageAttribution/\.hero_image_attribution/g' "$file"
  sed -i 's/\.daysNotes/\.days_notes/g' "$file"
  sed -i 's/\.pinnedEvents/\.pinned_events/g' "$file"
  sed -i 's/\.totalPnL/\.total_pnl/g' "$file"
  
  # Trade properties
  sed -i 's/\.entry\b/\.entry_price/g' "$file"
  sed -i 's/\.exit\b/\.exit_price/g' "$file"
  
  # CalendarStats properties (convert from snake_case to camelCase for UI)
  sed -i 's/stats\.win_rate/stats.winRate/g' "$file"
  sed -i 's/stats\.win_count/stats.winCount/g' "$file"
  sed -i 's/stats\.loss_count/stats.lossCount/g' "$file"
  sed -i 's/stats\.profit_factor/stats.profitFactor/g' "$file"
  sed -i 's/stats\.avg_win/stats.avgWin/g' "$file"
  sed -i 's/stats\.avg_loss/stats.avgLoss/g' "$file"
  sed -i 's/stats\.max_drawdown/stats.maxDrawdown/g' "$file"
  sed -i 's/stats\.drawdown_recovery_needed/stats.drawdownRecoveryNeeded/g' "$file"
  sed -i 's/stats\.drawdown_duration/stats.drawdownDuration/g' "$file"
  sed -i 's/stats\.drawdown_start_date/stats.drawdownStartDate/g' "$file"
  sed -i 's/stats\.drawdown_end_date/stats.drawdownEndDate/g' "$file"
  sed -i 's/stats\.weekly_progress/stats.weeklyProgress/g' "$file"
  sed -i 's/stats\.monthly_progress/stats.monthlyProgress/g' "$file"
  sed -i 's/stats\.total_trades/stats.totalTrades/g' "$file"
  
  # DynamicRiskSettings properties (convert to snake_case)
  sed -i 's/dynamicRiskEnabled/dynamic_risk_enabled/g' "$file"
  sed -i 's/increasedRiskPercentage/increased_risk_percentage/g' "$file"
  sed -i 's/profitThresholdPercentage/profit_threshold_percentage/g' "$file"
  
  # Object literal properties in interfaces/types
  sed -i 's/accountBalance:/account_balance:/g' "$file"
  sed -i 's/maxDailyDrawdown:/max_daily_drawdown:/g' "$file"
  sed -i 's/weeklyTarget:/weekly_target:/g' "$file"
  sed -i 's/monthlyTarget:/monthly_target:/g' "$file"
  sed -i 's/yearlyTarget:/yearly_target:/g' "$file"
  sed -i 's/riskPerTrade:/risk_per_trade:/g' "$file"
  sed -i 's/heroImageUrl:/hero_image_url:/g' "$file"
  sed -i 's/heroImageAttribution:/hero_image_attribution:/g' "$file"
  sed -i 's/scoreSettings:/score_settings:/g' "$file"
  sed -i 's/requiredTagGroups:/required_tag_groups:/g' "$file"
  sed -i 's/shareLink:/share_link:/g' "$file"
  sed -i 's/shareId:/share_id:/g' "$file"
  sed -i 's/isShared:/is_shared:/g' "$file"
  sed -i 's/sharedAt:/shared_at:/g' "$file"
  
  # Function parameter names (only in specific contexts)
  sed -i 's/accountBalance,/account_balance,/g' "$file"
  sed -i 's/maxDailyDrawdown,/max_daily_drawdown,/g' "$file"
  sed -i 's/weeklyTarget,/weekly_target,/g' "$file"
  sed -i 's/monthlyTarget,/monthly_target,/g' "$file"
  sed -i 's/yearlyTarget,/yearly_target,/g' "$file"
  sed -i 's/riskPerTrade,/risk_per_trade,/g' "$file"
done

echo "Conversion complete!"

