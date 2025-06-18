import React from "react";
import { Input } from "@/components/ui/input";

import type { Vitals } from "./AudioRecorder";

interface VitalsFormProps {
  vitals: Vitals;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof Vitals
  ) => void;
}

const VitalsForm: React.FC<VitalsFormProps> = ({ vitals, onChange }) => (
  <div className="mt-4">
    <h3 className="font-semibold mb-2 text-base sm:text-lg">Vitals (Optional)</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input
        type="text"
        value={vitals.blood_pressure || ""}
        onChange={(e) => onChange(e, "blood_pressure")}
        placeholder="Blood Pressure (e.g., 120/80)"
        className="w-full bg-white"
      />
      <Input
        type="text"
        value={vitals.heart_rate_bpm || ""}
        onChange={(e) => onChange(e, "heart_rate_bpm")}
        placeholder="Heart Rate (bpm, e.g., 60-100)"
        className="w-full bg-white"
      />
      <Input
        type="text"
        value={vitals.respiratory_rate_bpm || ""}
        onChange={(e) => onChange(e, "respiratory_rate_bpm")}
        placeholder="Respiratory Rate (bpm, e.g., 12-20)"
        className="w-full bg-white"
      />
      <Input
        type="text"
        value={vitals.spo2_percent || ""}
        onChange={(e) => onChange(e, "spo2_percent")}
        placeholder="SpO2 (%)"
        className="w-full bg-white"
      />
      <Input
        type="number"
        value={vitals.pain_score ?? ""}
        onChange={(e) => onChange(e, "pain_score")}
        placeholder="Pain Score (0-10)"
        min={0}
        max={10}
        className="w-full bg-white"
      />
      <Input
        type="number"
        value={vitals.weight_kg ?? ""}
        onChange={(e) => onChange(e, "weight_kg")}
        placeholder="Weight (kg)"
        className="w-full bg-white"
      />
      <Input
        type="number"
        value={vitals.height_cm ?? ""}
        onChange={(e) => onChange(e, "height_cm")}
        placeholder="Height (cm)"
        className="w-full bg-white"
      />
      <Input
        type="number"
        value={vitals.temperature_celsius ?? ""}
        onChange={(e) => onChange(e, "temperature_celsius")}
        placeholder="Temperature (°C)"
        step="0.1"
        className="w-full bg-white"
      />
    </div>
  </div>
);

export default VitalsForm;
