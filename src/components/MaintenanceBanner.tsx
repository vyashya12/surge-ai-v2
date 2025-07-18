import { AlertTriangle } from "lucide-react";

export default function MaintenanceBanner() {
  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
      <div className="flex items-center">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" />
        <div>
          <p className="text-yellow-800 font-medium">
            System Under Maintenance
          </p>
          <p className="text-yellow-700 text-sm">
            We are currently performing scheduled maintenance. Some features may be temporarily unavailable.
          </p>
        </div>
      </div>
    </div>
  );
}