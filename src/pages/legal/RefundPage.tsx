import React from 'react';
import LegalPage from './LegalPage';
import RefundContent from './content/RefundContent';

const RefundPage: React.FC = () => (
  <LegalPage title="Refund Policy" lastUpdated="2026-05-26">
    <RefundContent />
  </LegalPage>
);

export default RefundPage;
