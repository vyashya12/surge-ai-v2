"use client";

import { useEffect, useState } from "react";
import { getAllDiagnosisValidations } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthData } from "@/lib/auth";
import { DiagnosisValidation } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSidebarCollapse } from "@/contexts/sidebarContext";

type PageState = {
  data: DiagnosisValidation[] | null;
  loading: boolean;
  error: string | null;
};

const loadData =
  (setState: (fn: (prev: PageState) => PageState) => void) => async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const authData = getAuthData();
    const token = authData.ok ? authData.value.token : null;
    const result = await getAllDiagnosisValidations(token)();
    setState((prev) => ({
      ...prev,
      data: result.ok ? result.value : null,
      loading: false,
      error: result.ok ? null : result.error,
    }));
  };

export default function ValidationPage() {
  const [state, setState] = useState<PageState>({
    data: null,
    loading: true,
    error: null,
  });

  const { isCollapsed } = useSidebarCollapse();

  useEffect(() => {
    loadData(setState)();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-8">
      <p className="font-bold text-xl">Validation</p>
      <Card
        className={`mt-8 overflow-x-auto ${
          isCollapsed ? "w-[84rem]" : "w-[70rem]"
        }`}
      >
        <CardHeader>
          <CardTitle>Diagnosis Validations</CardTitle>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <p>Loading...</p>
          ) : state.error ? (
            <p className="text-red-500">Error: {state.error}</p>
          ) : state.data && state.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Patient Summary</TableHead>
                  <TableHead>Doctor Summary</TableHead>
                  <TableHead>Notes Summary</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.data.map((diagnosis) => (
                  <TableRow key={diagnosis.id}>
                    <TableCell>{diagnosis.diagnosis}</TableCell>
                    <TableCell>
                      {diagnosis.diagnosis_probability.toFixed(2)}%
                    </TableCell>
                    <TableCell>{diagnosis.patient_summary}</TableCell>
                    <TableCell>{diagnosis.doctor_summary}</TableCell>
                    <TableCell>{diagnosis.notes_summary || "N/A"}</TableCell>
                    <TableCell>
                      {new Date(diagnosis.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p>No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
