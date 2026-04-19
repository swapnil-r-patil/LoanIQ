import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoanProvider } from "./context/LoanContext";
import { UserAuthProvider, useUserAuth } from "./context/UserAuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";

// Loan Flow Pages
import PreCheckScreen from "./pages/PreCheckScreen";
import VideoKYC from "./pages/VideoKYC";
import Processing from "./pages/Processing";
import Result from "./pages/Result";
import Report from "./pages/Report";
import Disbursement from "./pages/Disbursement";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAuth from "./pages/AdminAuth";
import UserAuth from "./pages/UserAuth";
import UserDashboard from "./pages/UserDashboard";
import PublicProfile from "./pages/PublicProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Admin route guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/auth" replace />;
  return children;
}

// User route guard
function UserProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUserAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/user/auth" replace />;
  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <ThemeProvider>
            <LoanProvider>
              <UserAuthProvider>
                <Routes>
                  <Route path="/" element={<PreCheckScreen />} />
                  <Route path="/kyc" element={<VideoKYC />} />
                  <Route path="/processing" element={<Processing />} />
                  <Route path="/result" element={<Result />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/disbursement" element={<Disbursement />} />

                  {/* User Portal Routes */}
                  <Route path="/user/auth" element={<UserAuth />} />
                  <Route path="/user/profile" element={<PublicProfile />} />
                  <Route
                    path="/user/dashboard"
                    element={
                      <UserProtectedRoute>
                        <UserDashboard />
                      </UserProtectedRoute>
                    }
                  />

                  {/* Admin Routes */}
                  <Route path="/admin/auth" element={<AdminAuth />} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </UserAuthProvider>
            </LoanProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
