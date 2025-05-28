"use client";

import { useEffect, useState, Dispatch, SetStateAction } from "react";
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
import { DefaultPagination } from "@/components/ui/pagination";

type PageState = {
  data: DiagnosisValidation[] | null;
  loading: boolean;
  error: string | null;
};

const ITEMS_PER_PAGE = 10;

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
  const [active, setActive] = useState(1);
  const { isCollapsed } = useSidebarCollapse();

  useEffect(() => {
    loadData(setState)();
  }, []);

  const totalItems = state.data ? state.data.length : 0;
  const paginatedData = state.data
    ? state.data.slice((active - 1) * ITEMS_PER_PAGE, active * ITEMS_PER_PAGE)
    : [];

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <h1 className="font-bold text-xl mb-6">Validation</h1>
      <Card
        className={`mt-6 overflow-auto h-[36rem] relative w-full max-w-7xl mx-auto ${
          isCollapsed ? "lg:max-w-[90vw]" : "lg:max-w-[80vw]"
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
          ) : paginatedData.length > 0 ? (
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
                {paginatedData.map((diagnosis) => (
                  <TableRow key={diagnosis.id}>
                    <TableCell>
                      {diagnosis.diagnosis.length > 0
                        ? diagnosis.diagnosis
                            .map((d) => d.diagnosis || "N/A")
                            .join(", ")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {diagnosis.diagnosis.length > 0
                        ? diagnosis.diagnosis
                            .map((d) => `${(d.likelihood || 0).toFixed(2)}%`)
                            .join(", ")
                        : "N/A"}
                    </TableCell>
                    <TableCell>{diagnosis.patient_summary || "N/A"}</TableCell>
                    <TableCell>{diagnosis.doctor_summary || "N/A"}</TableCell>
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
        <div className="absolute right-4 bottom-4 mt-4">
          <DefaultPagination active={active} setActive={setActive} />
        </div>
      </Card>
    </div>
  );
}
