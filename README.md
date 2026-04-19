# 🚀 LoanIQ – Intelligent AI Loan Origination System

> **Built by Team CodeStorm for the Hackathon** ⚡

**LoanIQ** is a fully autonomous, highly secure loan application and processing platform. It eliminates the need for manual paperwork and branch visits by combining **3D Biometric Verification**, **Speech-to-Text NLP**, and **Intelligent OCR** to securely verify users and dynamically generate credit decisions in under 2 minutes.

---

## 🌟 Key Features

### 🛡️ Unbeatable Security & Fraud Prevention
*   **3D Biometric Liveness Detection**: Uses advanced MediaPipe FaceMesh to track micro-movements (blinks, head turns, smiles), completely neutralizing static photo or video spoofing attempts.
*   **Identity Cross-Verification**: The system uses **Intelligent OCR** to extract the legal name from a PAN card upload, and then uses **Fuzzy String Matching** to compare it against the name spoken during the video interview. Any mismatch automatically flags the application.

### 🧠 Autonomous AI Processing
*   **Multilingual Speech Parsing (NLP)**: The applicant conducts a short video interview. Our custom NLP engine parses the transcript (supporting English, Hindi, and Marathi) to accurately extract the user's *Income*, *Employment Type*, and *Loan Purpose*.
*   **Algorithmic Credit Engine**: A proprietary, mathematically weighted scoring model calculates a `0-900` credit score instantly. It evaluates factors like Loan-to-Income ratio, Job Stability, Liveness, and Identity Match to generate a highly accurate risk profile.

### 📊 Real-Time Operations & Transparency
*   **Automated PDF Sanction Letters**: Approved applicants instantly receive a professionally generated PDF report detailing their EMI, Interest Rate, and terms.
*   **Public QR Tracking**: Every generated PDF contains a unique QR code. Scanning this takes the user (or an auditor) to a secure public tracking page showing live **Money Given vs. Money Paid** and overall repayment progress.
*   **Live Admin Dashboard**: A beautifully designed, dark-glassmorphism dashboard allowing admins to view applications streaming in real-time via Firebase, override AI decisions, and manage an "Expiry Section" (Recycle Bin) for soft/hard-deleted applications.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript, Tailwind CSS, MediaPipe (FaceMesh), Lucide React
*   **Backend**: Node.js, Express.js
*   **AI/ML**: Tesseract.js (OCR), Custom NLP Regex Engine
*   **Database**: Firebase Firestore (Real-time DB via Server-Sent Events)
*   **File Management**: jsPDF, qrcode (Dynamic Sanction Letter generation)

---

## 🚀 How It Works (The User Journey)

1.  **Pre-Check**: System checks camera, microphone, and network bandwidth.
2.  **Biometric KYC**: User completes the active liveness check (look left, look right, smile, blink).
3.  **Document Upload**: User uploads a PAN card image for OCR processing.
4.  **Video Interview**: User verbally answers 5 basic questions about their financial needs.
5.  **AI Analysis**: The engine processes the transcript, cross-verifies the ID, and calculates the risk score.
6.  **Instant Decision**: User sees their score, decision, and downloads their official PDF Sanction Letter.

---

## 💻 Local Development Setup

### 1. Clone the repository
```bash
git clone <repository_url>
cd LoanIQ
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Environment Variables
Create a `.env` file in the `backend` directory and add your Firebase credentials:
```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
```

### 4. Run the Application
You will need two terminals to run the frontend and backend simultaneously.

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

---
*Developed with ❤️ by Team CodeStorm*
