import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import FillRatePredictor from "./pages/FillRatePredictor";
import BreederCalculator from "./pages/BreederCalculator";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/predictor"} component={FillRatePredictor} />
      <Route path={"/breeder-calculator"} component={BreederCalculator} />
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
