import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import FillRatePredictor from "./pages/FillRatePredictor";
import BreederCalculator from "./pages/BreederCalculator";
import InvoiceSubmit from "./pages/InvoiceSubmit";
import InvoiceDashboard from "./pages/InvoiceDashboard";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/predictor"} component={FillRatePredictor} />
      <Route path={"/breeder-calculator"} component={BreederCalculator} />
      <Route path={"/submit-invoice"} component={InvoiceSubmit} />
      <Route path={"/admin/invoices"} component={InvoiceDashboard} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
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
