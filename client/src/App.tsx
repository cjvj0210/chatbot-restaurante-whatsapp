import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import ChatSimulator from "./pages/ChatSimulator";
import Simulator from "./pages/Simulator";
import Menu from "./pages/Menu";
import Orders from "./pages/Orders";
import Reservations from "./pages/Reservations";
import Settings from "./pages/Settings";
import Debug from "./pages/Debug";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/chat-simulator" component={ChatSimulator} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/menu" component={Menu} />
        <Route path="/orders" component={Orders} />
        <Route path="/reservations" component={Reservations} />
        <Route path="/settings" component={Settings} />
        <Route path="/debug" component={Debug} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
