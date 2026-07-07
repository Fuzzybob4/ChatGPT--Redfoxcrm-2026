'use client';

import React, { createContext, useContext } from 'react';

export interface OrgContextType {
  orgId: string;
  businessName: string;
  isEnterprise: boolean;
  locationCount: number;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children, org }: { children: React.ReactNode; org: OrgContextType }) {
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
}

export function useOrgContext() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrgContext must be used within OrgProvider');
  }
  return context;
}
