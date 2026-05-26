import React from 'react';
import LegalPage from './LegalPage';
import TermsContent from './content/TermsContent';

const TermsPage: React.FC = () => (
  <LegalPage title="Terms of Service" lastUpdated="2026-05-26">
    <TermsContent />
  </LegalPage>
);

export default TermsPage;
