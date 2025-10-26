/**
 * Vector Migration Tab Component
 * Handles economic events vector migration functionality
 */

import React, { useState } from 'react';
import {
  Button,
  Typography,
  Card,
  CardContent,
  Alert
} from '@mui/material';

import VectorMigrationDialog from '../../VectorMigrationDialog';
import { Calendar } from '../../../types/calendar';

interface VectorMigrationTabProps {
  calendar?: Calendar;
}

const VectorMigrationTab: React.FC<VectorMigrationTabProps> = ({
  calendar
}) => {
  const [showVectorMigration, setShowVectorMigration] = useState(false);

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Economic Events Vector Migration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Regenerate vector embeddings to include economic events data in both embedded content and structured database fields.
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            This migration adds economic events to the Supabase database and regenerates all embeddings.
            Economic events will be stored as structured JSONB data and included in searchable content,
            enabling better AI analysis of trades correlated with economic news.
          </Alert>

          <Button
            variant="contained"
            onClick={() => setShowVectorMigration(true)}
            disabled={!calendar}
            fullWidth
          >
            Run Vector Migration
          </Button>

          {!calendar && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Calendar is required to run migration
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Vector Migration Dialog */}
      <VectorMigrationDialog
        open={showVectorMigration}
        onClose={() => setShowVectorMigration(false)}
        calendar={calendar}
      />
    </>
  );
};

export default VectorMigrationTab;
