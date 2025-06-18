"use client";

import { useEffect, useState } from "react";
import { getAllDiagnosisValidations } from "@/lib/api";
import { getAuthData } from "@/lib/auth";
import { DiagnosisValidation } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PageState = {
  data: DiagnosisValidation[] | null;
  loading: boolean;
  error: string | null;
};

const ITEMS_PER_PAGE = 10;

const HEADERS = [
  { key: "diagnosis", label: "Diagnosis", maxWidth: "max-w-[12rem]" },
  { key: "probability", label: "Probability", maxWidth: "max-w-[10rem]" },
  {
    key: "patient_summary",
    label: "Patient Summary",
    maxWidth: "max-w-[14rem]",
  },
  { key: "doctor_summary", label: "Doctor Summary", maxWidth: "max-w-[14rem]" },
  { key: "notes_summary", label: "Notes Summary", maxWidth: "max-w-[14rem]" },
  { key: "created_at", label: "Created At" },
];

const loadData =
  (setState: React.Dispatch<React.SetStateAction<PageState>>) => async () => {
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

const getDiagnoses = (d: DiagnosisValidation) =>
  d.diagnosis.length > 0
    ? d.diagnosis.map((entry) => entry.diagnosis || "N/A").join(", ")
    : "N/A";

const getProbabilities = (d: DiagnosisValidation) =>
  d.diagnosis.length > 0
    ? d.diagnosis
        .map((entry) => `${(entry.likelihood || 0).toFixed(2)}%`)
        .join(", ")
    : "N/A";

const renderCell = (
  key: string,
  row: DiagnosisValidation,
  className?: string
) => {
  let content: string = "N/A";

  if (key === "diagnosis") {
    content = getDiagnoses(row);
  } else if (key === "probability") {
    content = getProbabilities(row);
  } else if (key === "created_at") {
    return <TableCell key={key}>{new Date(row.created_at).toLocaleString()}</TableCell>;
  } else {
    content = (row as any)[key] || "N/A";
  }

  return (
    <TableCell key={key}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="truncate whitespace-nowrap text-ellipsis max-w-[200px]">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-words whitespace-pre-line text-sm leading-relaxed p-2">
            {content}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TableCell>
  );
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

  const paginatedData =
    state.data?.slice((active - 1) * ITEMS_PER_PAGE, active * ITEMS_PER_PAGE) ??
    [];

  return (
    <div className="min-h-screen w-full bg-gray-50 p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-xl font-bold">Validation</h1>

      <Card
        className={`mx-auto w-full transition-all duration-300 min-h-[75vh] ${
          isCollapsed ? "lg:max-w-[90vw]" : "lg:max-w-[75vw]"
        }`}
      >
        <CardHeader>
          <CardTitle>Diagnosis Validations</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {state.loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading...</div>
          ) : state.error ? (
            <div className="p-6 text-sm text-red-500">Error: {state.error}</div>
          ) : paginatedData.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    {HEADERS.map((col) => (
                      <TableHead
                        key={col.key}
                        className="uppercase text-xs font-semibold text-gray-600"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedData.map((row, idx) => (
                    <TableRow
                      key={row.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      {HEADERS.map((col) =>
                        renderCell(col.key, row, col.maxWidth)
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end border-t p-4">
        <DefaultPagination
          active={active}
          setActive={setActive}
          totalItems={state.data?.length ?? 0}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </div>
  );
}
