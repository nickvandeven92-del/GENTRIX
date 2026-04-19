import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BusinessProvider } from "@/context/BusinessContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import BookingPageLive from "./pages/BookingPageLive";
import DashboardSlugPrompt from "./pages/DashboardSlugPrompt";
import { LiveBusinessProvider } from "./context/LiveBusinessProvider";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import DashboardServices from "./pages/dashboard/DashboardServices";
import DashboardEmployees from "./pages/dashboard/DashboardEmployees";
import DashboardSchedules from "./pages/dashboard/DashboardSchedules";
import DashboardBreaks from "./pages/dashboard/DashboardBreaks";
import DashboardDaysOff from "./pages/dashboard/DashboardDaysOff";
import DashboardAppointments from "./pages/dashboard/DashboardAppointments";
import DashboardSettings from "./pages/dashboard/DashboardSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BusinessProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="book/:slug" element={<BookingPageLive />} />
            <Route path="demo" element={<BookingPage />} />

            <Route path="dashboard" element={<DashboardSlugPrompt />} />
            <Route
              path="dashboard/:ownerSlug"
              element={
                <LiveBusinessProvider>
                  <DashboardLayout />
                </LiveBusinessProvider>
              }
            >
              <Route index element={<DashboardOverview />} />
              <Route path="diensten" element={<DashboardServices />} />
              <Route path="medewerkers" element={<DashboardEmployees />} />
              <Route path="roosters" element={<DashboardSchedules />} />
              <Route path="pauzes" element={<DashboardBreaks />} />
              <Route path="vrije-dagen" element={<DashboardDaysOff />} />
              <Route path="afspraken" element={<DashboardAppointments />} />
              <Route path="instellingen" element={<DashboardSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BusinessProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
