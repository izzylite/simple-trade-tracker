import React from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';

interface Row {
  label: string;
  free: React.ReactNode;
  lite: React.ReactNode;
  pro: React.ReactNode;
  elite: React.ReactNode;
}

interface Group {
  heading: string;
  rows: Row[];
}

const yes = <CheckIcon fontSize="small" />;
const no = <RemoveIcon fontSize="small" sx={{ opacity: 0.4 }} />;

const GROUPS: Group[] = [
  {
    heading: 'Calendar',
    rows: [
      { label: 'Calendars', free: '1', lite: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
      { label: 'Trade history', free: 'Unlimited', lite: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
      { label: 'Image uploads on trades', free: no, lite: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
    ],
  },
  {
    heading: 'Performance',
    rows: [
      { label: 'Basic stats', free: yes, lite: yes, pro: yes, elite: yes },
      { label: 'Tag-pattern analysis', free: yes, lite: yes, pro: yes, elite: yes },
      { label: 'Scoring', free: yes, lite: yes, pro: yes, elite: yes },
    ],
  },
  {
    heading: 'Notes',
    rows: [
      { label: 'Notes', free: 'Unlimited', lite: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
    ],
  },
  {
    heading: 'Economic Events',
    rows: [
      { label: 'Pin events', free: yes, lite: yes, pro: yes, elite: yes },
      { label: 'Event notifications', free: yes, lite: yes, pro: yes, elite: yes },
    ],
  },
  {
    heading: 'Orion AI',
    rows: [
      { label: 'Orion access', free: no, lite: 'Daily', pro: '5× Lite', elite: '5× Pro' },
    ],
  },
  {
    heading: 'Sharing & I/O',
    rows: [
      { label: 'Share links (calendars, notes, trades)', free: yes, lite: yes, pro: yes, elite: yes },
      { label: 'Import / Export', free: yes, lite: yes, pro: yes, elite: yes },
    ],
  },
  {
    heading: 'Support',
    rows: [
      { label: 'Community support', free: yes, lite: yes, pro: yes, elite: yes },
      { label: 'Priority support', free: no, lite: no, pro: yes, elite: yes },
    ],
  },
];

export const ComparisonTable: React.FC = () => {
  return (
    <Box sx={{ mt: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Compare features</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Feature</TableCell>
              <TableCell align="center">Free</TableCell>
              <TableCell align="center">Lite</TableCell>
              <TableCell align="center">Pro</TableCell>
              <TableCell align="center">Elite</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {GROUPS.map((group) => (
              <React.Fragment key={group.heading}>
                <TableRow>
                  <TableCell colSpan={5} sx={{ bgcolor: 'action.hover', fontWeight: 600 }}>
                    {group.heading}
                  </TableCell>
                </TableRow>
                {group.rows.map((row) => (
                  <TableRow key={row.label} hover>
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="center">{row.free}</TableCell>
                    <TableCell align="center">{row.lite}</TableCell>
                    <TableCell align="center">{row.pro}</TableCell>
                    <TableCell align="center">{row.elite}</TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};
