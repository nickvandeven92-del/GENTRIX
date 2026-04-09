import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebshopProvider, CartDrawer, AnalyticsProvider } from "@/webshop";
import { AuthProvider } from "@/context/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import Index from "./pages/Index.tsx";
import ShopPage from "./pages/ShopPage.tsx";
import ProductPage from "./pages/ProductPage.tsx";
import CheckoutPage from "./pages/CheckoutPage.tsx";
import WishlistPage from "./pages/WishlistPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import OwnerClientsPage from "./pages/owner/OwnerClientsPage.tsx";
import { LegacyProductRedirect } from "./components/LegacyShopRedirects.tsx";

import DashboardLayout from "./webshop/dashboard/DashboardLayout";
import DashboardOverview from "./webshop/dashboard/DashboardOverview";
import DashboardProducts from "./webshop/dashboard/DashboardProducts";
import DashboardProductEdit from "./webshop/dashboard/DashboardProductEdit";
import DashboardCategories from "./webshop/dashboard/DashboardCategories";
import DashboardInventory from "./webshop/dashboard/DashboardInventory";
import DashboardOrders from "./webshop/dashboard/DashboardOrders";
import DashboardSettings from "./webshop/dashboard/DashboardSettings";
import DashboardDiscounts from "./webshop/dashboard/DashboardDiscounts";
import DashboardReviews from "./webshop/dashboard/DashboardReviews";
import DashboardAnalytics from "./webshop/dashboard/DashboardAnalytics";

const queryClient = new QueryClient();

const defaultShopSlug = import.meta.env.VITE_DEFAULT_CLIENT_SLUG ?? "demo-kapper";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <WebshopProvider>
              <AnalyticsProvider>
                <Toaster />
                <Sonner />
                <CartDrawer />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/owner/clients" element={<OwnerClientsPage />} />

                  <Route path="/shop" element={<Navigate to={`/shop/c/${defaultShopSlug}`} replace />} />
                  <Route path="/shop/checkout" element={<Navigate to={`/shop/c/${defaultShopSlug}/checkout`} replace />} />
                  <Route path="/shop/wishlist" element={<Navigate to={`/shop/c/${defaultShopSlug}/wishlist`} replace />} />
                  <Route path="/shop/product/:slug" element={<LegacyProductRedirect />} />

                  <Route path="/shop/c/:clientSlug" element={<ShopPage />} />
                  <Route path="/shop/c/:clientSlug/product/:slug" element={<ProductPage />} />
                  <Route path="/shop/c/:clientSlug/checkout" element={<CheckoutPage />} />
                  <Route path="/shop/c/:clientSlug/wishlist" element={<WishlistPage />} />

                  <Route
                    path="/dashboard"
                    element={
                      <RequireAuth>
                        <DashboardLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<DashboardOverview />} />
                    <Route path="products" element={<DashboardProducts />} />
                    <Route path="products/:id" element={<DashboardProductEdit />} />
                    <Route path="categories" element={<DashboardCategories />} />
                    <Route path="inventory" element={<DashboardInventory />} />
                    <Route path="orders" element={<DashboardOrders />} />
                    <Route path="discounts" element={<DashboardDiscounts />} />
                    <Route path="reviews" element={<DashboardReviews />} />
                    <Route path="analytics" element={<DashboardAnalytics />} />
                    <Route path="settings" element={<DashboardSettings />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AnalyticsProvider>
            </WebshopProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
