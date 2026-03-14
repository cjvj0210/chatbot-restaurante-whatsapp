import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";

// Páginas públicas críticas — carregadas de forma síncrona (SEO/conversão)
import Pedido from "./pages/Pedido";
import Checkout from "./pages/Checkout";
import Confirmacao from "./pages/Confirmacao";
import PrintOrder from "./pages/PrintOrder";
import PublicTest from "./pages/PublicTest";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// Páginas admin — carregadas lazily (reduz bundle inicial)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ChatSimulator = lazy(() => import("./pages/ChatSimulator"));
const Simulator = lazy(() => import("./pages/Simulator"));
const Menu = lazy(() => import("./pages/Menu"));
const Orders = lazy(() => import("./pages/Orders"));
const Reservations = lazy(() => import("./pages/Reservations"));
const Settings = lazy(() => import("./pages/Settings"));
const Customers = lazy(() => import("./pages/Customers"));
const Debug = lazy(() => import("./pages/Debug"));
const TestConversations = lazy(() => import("./pages/TestConversations"));

function AdminFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Rotas públicas sem autenticação */}
      <Route path="/teste" component={PublicTest} />
      <Route path="/pedido/:sessionId" component={Pedido} />
      <Route path="/pedido/:sessionId/checkout" component={Checkout} />
      <Route path="/pedido/:sessionId/confirmacao" component={Confirmacao} />
      <Route path="/print-order/:orderId" component={PrintOrder} />
      <Route path="/privacidade" component={PrivacyPolicy} />

      {/* Rotas autenticadas com DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Suspense fallback={<AdminFallback />}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/chat-simulator" component={ChatSimulator} />
              <Route path="/simulator" component={Simulator} />
              <Route path="/menu" component={Menu} />
              <Route path="/orders" component={Orders} />
              <Route path="/reservations" component={Reservations} />
              <Route path="/settings" component={Settings} />
              <Route path="/customers" component={Customers} />
              <Route path="/debug" component={Debug} />
              <Route path="/conversas-teste" component={TestConversations} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
