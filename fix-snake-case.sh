#!/bin/bash

# Script to convert camelCase property names to snake_case
# This script will update all TypeScript/TSX files in src/

# Trade properties
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.date\b/.trade_date/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.type\b/.trade_type/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.entryPrice\b/.entry_price/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.exitPrice\b/.exit_price/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.stopLoss\b/.stop_loss/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.takeProfit\b/.take_profit/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.riskToReward\b/.risk_to_reward/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.partialsTaken\b/.partials_taken/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.isTemporary\b/.is_temporary/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.isPinned\b/.is_pinned/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.shareLink\b/.share_link/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.isShared\b/.is_shared/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.sharedAt\b/.shared_at/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.shareId\b/.share_id/g' {} +

# Calendar properties
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.userId\b/.user_id/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.calendarId\b/.calendar_id/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.accountBalance\b/.account_balance/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.maxDailyDrawdown\b/.max_daily_drawdown/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.weeklyTarget\b/.weekly_target/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.monthlyTarget\b/.monthly_target/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.yearlyTarget\b/.yearly_target/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.riskPerTrade\b/.risk_per_trade/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.dynamicRiskEnabled\b/.dynamic_risk_enabled/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.increasedRiskPercentage\b/.increased_risk_percentage/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.profitThresholdPercentage\b/.profit_threshold_percentage/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.requiredTagGroups\b/.required_tag_groups/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.scoreSettings\b/.score_settings/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.economicCalendarFilters\b/.economic_calendar_filters/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.duplicatedCalendar\b/.duplicated_calendar/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.sourceCalendarId\b/.source_calendar_id/g' {} +

# Timestamp properties
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.createdAt\b/.created_at/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.updatedAt\b/.updated_at/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.deletedAt\b/.deleted_at/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.deletedBy\b/.deleted_by/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.autoDeleteAt\b/.auto_delete_at/g' {} +

# Statistics properties
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.totalPnl\b/.total_pnl/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.winRate\b/.win_rate/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.totalTrades\b/.total_trades/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.winCount\b/.win_count/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.lossCount\b/.loss_count/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.profitFactor\b/.profit_factor/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.maxDrawdown\b/.max_drawdown/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.avgWin\b/.avg_win/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.avgLoss\b/.avg_loss/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.currentBalance\b/.current_balance/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.pnlPerformance\b/.pnl_performance/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.targetProgress\b/.target_progress/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.weeklyProgress\b/.weekly_progress/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.monthlyProgress\b/.monthly_progress/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.drawdownStartDate\b/.drawdown_start_date/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.drawdownEndDate\b/.drawdown_end_date/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.drawdownRecoveryNeeded\b/.drawdown_recovery_needed/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.drawdownDuration\b/.drawdown_duration/g' {} +

# Economic event properties
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.eventId\b/.event_id/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.eventDate\b/.event_date/g' {} +
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.eventTime\b/.event_time/g' {} +

echo "Snake case conversion complete!"

