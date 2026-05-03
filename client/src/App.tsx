import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";

// Lazy load all pages so each page only loads its own code on demand
const Home = lazy(() => import("./pages/Home"));
const FillRatePredictor = lazy(() => import("./pages/FillRatePredictor"));
const BreederCalculator = lazy(() => import("./pages/BreederCalculator"));
const InvoiceSubmit = lazy(() => import("./pages/InvoiceSubmit"));
const InvoiceDashboard = lazy(() => import("./pages/InvoiceDashboard"));
const ApplicationsDashboard = lazy(() => import("./pages/ApplicationsDashboard"));
const Careers = lazy(() => import("./pages/Careers"));
const StaffPortal = lazy(() => import("./pages/StaffPortal"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/predictor"} component={FillRatePredictor} />
        <Route path={"/breeder-calculator"} component={BreederCalculator} />
        <Route path={"/submit-invoice"} component={InvoiceSubmit} />
        <Route path="/admin/invoices" component={InvoiceDashboard} />
        <Route path="/admin/applications" component={ApplicationsDashboard} />
        <Route path={"/careers"} component={Careers} />
        <Route path={"/staff"} component={StaffPortal} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
