import React from 'react';
import { EmptyState, ScreenContainer, SectionHeading } from '../../components';
import { AppTimeSection } from '../usage/AppTimeSection';

export function InsightsScreen() {
  return (
    <ScreenContainer>
      <SectionHeading
        kicker="Your progress"
        title="Progress, not perfection."
        subtitle="Only real numbers here. Nothing is made up."
      />
      <AppTimeSection />
      <EmptyState
        title="Focus time"
        body="Complete a few focus sessions to see your trend."
      />
      <EmptyState
        title="Thinking practice"
        body="Practice is tracked by skill, such as inference and evidence. RECLAIM never gives an IQ score."
      />
    </ScreenContainer>
  );
}
