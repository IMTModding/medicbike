import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { RealtimeNotificationProvider } from "@/components/RealtimeNotificationProvider";
import { NativePushProvider } from "@/components/NativePushProvider";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import HistoryPage from "./pages/HistoryPage";
import StatsPage from "./pages/StatsPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import ProfilePage from "./pages/ProfilePage";
import ChatPage from "./pages/ChatPage";
import InviteCodesPage from "./pages/InviteCodesPage";
import EmployeesPage from "./pages/EmployeesPage";
import GeneralChatPage from "./pages/GeneralChatPage";
import ResetPassword from "./pages/ResetPassword";
import NewsPage from "./pages/NewsPage";
import SettingsPage from "./pages/SettingsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TechnicalDocsPage from "./pages/TechnicalDocsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdateBanner />
          <BrowserRouter>
            <CookieConsentBanner />
            <NativePushProvider>
              <PresenceProvider>
                <RealtimeNotificationProvider>
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/availability" element={<AvailabilityPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/chat/:interventionId" element={<ChatPage />} />
                  <Route path="/invite-codes" element={<InviteCodesPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/general-chat" element={<GeneralChatPage />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/docs" element={<TechnicalDocsPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </RealtimeNotificationProvider>
              </PresenceProvider>
            </NativePushProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
