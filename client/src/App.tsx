import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";
import { useMetaPixel } from "./hooks/useMetaPixel";

// Lazy load all pages so each page only loads its own code on demand
const Home = lazy(() => import("./pages/Home"));
const FillRatePredictor = lazy(() => import("./pages/FillRatePredictor"));
const BreederCalculator = lazy(() => import("./pages/BreederCalculator"));
const InvoiceSubmit = lazy(() => import("./pages/InvoiceSubmit"));
const InvoiceDashboard = lazy(() => import("./pages/InvoiceDashboard"));
const ApplicationsDashboard = lazy(() => import("./pages/ApplicationsDashboard"));
const PartnershipsDashboard = lazy(() => import("./pages/PartnershipsDashboard"));
const Careers = lazy(() => import("./pages/Careers"));
const StaffPortal = lazy(() => import("./pages/StaffPortal"));
const Partnerships = lazy(() => import("./pages/Partnerships"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));
const StaffAccess = lazy(() => import("./pages/StaffAccess"));
const RunApyDashboard = lazy(() => import("./pages/RunApyDashboard"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const StaffTraining = lazy(() => import("./pages/StaffTraining"));
const SignDocuments = lazy(() => import("./pages/SignDocuments"));
const PrivateEventQuote = lazy(() => import("./pages/PrivateEventQuote"));
const PrivateEventsDashboard = lazy(() => import("./pages/PrivateEventsDashboard"));
const Loyalty = lazy(() => import("./pages/Loyalty"));
const Ethics = lazy(() => import("./pages/Ethics"));
const BreedersDashboard = lazy(() => import("./pages/BreedersDashboard"));
const RefundTracker = lazy(() => import("./pages/RefundTracker"));
const BreederAvailability = lazy(() => import("./pages/BreederAvailability"));
const PuppySchedule = lazy(() => import("./pages/PuppySchedule"));
const ScheduleCalendar = lazy(() => import("./pages/ScheduleCalendar"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Kitchener = lazy(() => import("./pages/Kitchener"));
const Hamilton = lazy(() => import("./pages/Hamilton"));
const Oakville = lazy(() => import("./pages/Oakville"));
const Corporate = lazy(() => import("./pages/Corporate"));
const PrivatePuppyYogaEvents = lazy(() => import("./pages/PrivatePuppyYogaEvents"));
const CancellationDashboard = lazy(() => import("./pages/CancellationDashboard"));
const SmsBroadcast = lazy(() => import("./pages/SmsBroadcast"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
    </div>
  );
}

function PixelPageView() {
  const { track } = useMetaPixel();
  const [location] = useLocation();
  useEffect(() => {
    // Fire PageView on every client-side route change
    track("PageView");
  }, [location, track]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PixelPageView />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/predictor"} component={FillRatePredictor} />
        <Route path={"/breeder-calculator"} component={BreederCalculator} />
        <Route path={"/submit-invoice"} component={InvoiceSubmit} />
        <Route path="/admin/invoices" component={InvoiceDashboard} />
        <Route path="/admin/applications" component={ApplicationsDashboard} />
        <Route path="/admin/partnerships" component={PartnershipsDashboard} />
        <Route path="/admin/staff-training" component={StaffTraining} />
        <Route path={"/careers"} component={Careers} />
        <Route path={"/staff"} component={StaffPortal} />
        <Route path={"/staff/training"} component={StaffTraining} />
        <Route path={"/birthday"}>{() => { window.location.replace("/private-events/quote"); return null; }}</Route>
        <Route path={"/partnerships"} component={Partnerships} />
        <Route path={"/staff-login"} component={StaffLogin} />
        <Route path={"/staff-access"} component={StaffAccess} />
        <Route path="/admin/run-apy" component={RunApyDashboard} />
        <Route path={"/admin/staff"} component={StaffManagement} />
        <Route path={"/sign"} component={SignDocuments} />
        <Route path={"/private-events/quote"} component={PrivateEventQuote} />
        <Route path="/admin/private-events" component={PrivateEventsDashboard} />
        <Route path="/admin/breeders" component={BreedersDashboard} />
        <Route path="/admin/puppy-schedule" component={PuppySchedule} />
        <Route path="/admin/schedule-calendar" component={ScheduleCalendar} />
        <Route path="/admin/refunds" component={RefundTracker} />
        <Route path="/admin/cancellation" component={CancellationDashboard} />
        <Route path="/admin/sms-broadcast" component={SmsBroadcast} />
        <Route path="/admin/sms-inbox" component={SmsInbox} />
        <Route path="/admin/review-texts" component={ReviewTexts} />
        <Route path="/admin/revenue" component={RevenueDashboard} />
        <Route path="/admin/breeder-leads/:id" component={BreederLeadDetail} />
          <Route path="/admin/staff-availability" component={StaffAvailability} />
        <Route path="/admin/breeder-leads" component={BreederLeadsDashboard} />
        <Route path="/breeder-availability" component={BreederAvailability} />
        <Route path="/loyalty" component={Loyalty} />
        <Route path="/ethics" component={Ethics} />
        {/* City SEO pages — plan-specified slugs */}
        <Route path="/puppy-yoga-kitchener" component={Kitchener} />
        <Route path="/puppy-yoga-hamilton" component={Hamilton} />
        <Route path="/puppy-yoga-oakville" component={Oakville} />
        {/* Legacy redirects — old slugs forward to new SEO slugs */}
        <Route path="/kitchener">{() => { window.location.replace("/puppy-yoga-kitchener"); return null; }}</Route>
        <Route path="/hamilton">{() => { window.location.replace("/puppy-yoga-hamilton"); return null; }}</Route>
        <Route path="/oakville">{() => { window.location.replace("/puppy-yoga-oakville"); return null; }}</Route>
        <Route path="/corporate-puppy-yoga" component={Corporate} />
        <Route path="/private-puppy-yoga-events" component={PrivatePuppyYogaEvents} />
        <Route path="/admin-login">{() => { window.location.replace("/staff-access"); return null; }}</Route>
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
const SmsInbox = lazy(() => import("./pages/SmsInbox"));
const ReviewTexts = lazy(() => import("./pages/ReviewTexts"));
const RevenueDashboard = lazy(() => import("./pages/RevenueDashboard"));
const BreederLeadsDashboard = lazy(() => import("./pages/BreederLeadsDashboard"));
const BreederLeadDetail = lazy(() => import("./pages/BreederLeadDetail"));
const StaffAvailability = lazy(() => import("./pages/StaffAvailability"));
