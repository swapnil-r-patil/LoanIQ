import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ProcessDataResponse } from '../services/loanApi';

export interface LoanApplicationState {
  // Pre-check
  cameraReady: boolean;
  micReady: boolean;
  networkQuality: 'Good' | 'Medium' | 'Poor' | 'Unknown';
  locationEnabled: boolean;

  // KYC Data
  transcript: string;
  panImage: string | null;
  livenessPass: boolean;
  location: string | null;

  // Processing result
  result: ProcessDataResponse | null;

  // Disbursement
  accountNumber: string;
  ifscCode: string;
  disbursed: boolean;
}

interface LoanContextType {
  state: LoanApplicationState;
  setState: React.Dispatch<React.SetStateAction<LoanApplicationState>>;
  resetApplication: () => void;
}

const defaultState: LoanApplicationState = {
  cameraReady: false,
  micReady: false,
  networkQuality: 'Unknown',
  locationEnabled: false,
  transcript: '',
  panImage: null,
  livenessPass: false,
  location: null,
  result: null,
  accountNumber: '',
  ifscCode: '',
  disbursed: false,
};

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function LoanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoanApplicationState>(defaultState);

  const resetApplication = () => setState(defaultState);

  return (
    <LoanContext.Provider value={{ state, setState, resetApplication }}>
      {children}
    </LoanContext.Provider>
  );
}

export function useLoan() {
  const ctx = useContext(LoanContext);
  if (!ctx) throw new Error('useLoan must be used inside LoanProvider');
  return ctx;
}
