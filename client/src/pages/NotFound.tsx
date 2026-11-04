import { LOGO_URL } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FEFAF4] px-4 py-12 text-[#34221D]">
      <Card className="w-full max-w-lg shadow-sm border border-[#E8D8D0] bg-white rounded-3xl">
        <CardContent className="px-6 sm:px-10 py-10 sm:py-12 text-center">
          <img
            src={LOGO_URL}
            alt="AfroPuppyYoga"
            className="w-16 h-16 object-contain mx-auto mb-6"
          />
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-50 rounded-full" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="font-display text-7xl font-medium text-[#34221D] mb-3">
            404
          </h1>

          <h2 className="font-display text-2xl font-medium text-[#34221D] mb-4">
            Page Not Found
          </h2>

          <p className="font-body text-[#71574F] text-base mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-primary hover:bg-primary-hover text-[#34221D] px-8 min-h-12 py-3 rounded-full transition-colors motion-reduce:transition-none duration-200"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
