import React from 'react';
import LegalPage from './LegalPage';
import PrivacyContent from './content/PrivacyContent';

const PrivacyPage: React.FC = () => (
  <LegalPage title="Privacy Policy" lastUpdated="2026-05-26">
    <PrivacyContent />
  </LegalPage>
);

export default PrivacyPage;
