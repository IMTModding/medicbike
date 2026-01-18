import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SplashScreen } from "@/components/SplashScreen";
import { RealtimeNotificationProvider } from "@/components/RealtimeNotificationProvider";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash on first visit in session
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    return !hasSeenSplash;
  });

  useEffect(() => {
    if (!showSplash) return;
    sessionStorage.setItem('hasSeenSplash', 'true');
  }, [showSplash]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeNotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
            <BrowserRouter>
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
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </RealtimeNotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
