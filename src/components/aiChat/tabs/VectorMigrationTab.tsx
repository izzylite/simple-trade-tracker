/**
 * Vector Migration Tab Component
 * Handles economic events vector migration functionality
 *
 * NOTE: Vector migration functionality has been removed from the codebase.
 * This component is kept for reference but is non-functional.
 */

import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert
} from '@mui/material';

// import VectorMigrationDialog from '../../VectorMigrationDialog'; // REMOVED
import { Calendar } from '../../../types/calendar';

interface VectorMigrationTabProps {
  calendar?: Calendar;
}

const VectorMigrationTab: React.FC<VectorMigrationTabProps> = () => {
  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Economic Events Vector Migration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vector migration functionality has been removed from the codebase.
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            This feature is no longer available. Vector embeddings have been removed from the application.
          </Alert>
        </CardContent>
      </Card>
    </>
  );
};

export default VectorMigrationTab;
