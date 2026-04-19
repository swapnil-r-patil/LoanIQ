// API service for communicating with the backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface ProcessDataPayload {
  transcript: string;
  panImage: string | null;
  liveness: boolean;
  location: string | null;
  userId?: string | null;
}

export interface LoanOffer {
  offeredAmount: number;
  maxAmount: number;
  interestRate: number;
  tenure: number;
  emi: number;
  processingFee: number;
}

export interface LoanReport {
  customerDetails: {
    name: string;
    transcriptName: string;
    location: any;
  };
  financialDetails: {
    income: number;
    incomeTier: string;
    jobType: string;
    loanPurpose: string;
    requestedAmount: number;
  };
  panDetails: {
    panNumber: string | null;
    dob: string | null;
  };
  creditScore: number;
  adjustments: Array<{ factor: string; delta: number }>;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  verification: {
    liveness: boolean;
    panVerified: boolean;
  };
  decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  offer: LoanOffer | null;
  explanation: string;
}

export interface ProcessDataResponse {
  success: boolean;
  creditScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  offer: LoanOffer | null;
  report: LoanReport;
  docId: string | null;
}

export async function processLoanData(payload: ProcessDataPayload): Promise<ProcessDataResponse> {
  const formData = new URLSearchParams();
  formData.append('transcript', payload.transcript);
  formData.append('liveness', String(payload.liveness));
  if (payload.panImage) formData.append('panImage', payload.panImage);
  if (payload.location) formData.append('location', payload.location);
  if (payload.userId) formData.append('userId', payload.userId);

  const response = await fetch(`${API_BASE}/process-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
