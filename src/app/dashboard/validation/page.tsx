"use client";

import { useEffect, useState } from "react";
import { getAllDiagnosisValidations } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthData } from "@/lib/auth";
import { Diagnosis } from "@/types";

type PageState = { data: Diagnosis[] | null; loading: boolean };

const loadData =
  (setState: (fn: (prev: PageState) => PageState) => void, baseURL: string) =>
  async () => {
    const authData = getAuthData();
    const token = authData.ok ? authData.value.token : null;
    const result = await getAllDiagnosisValidations(baseURL, token)();
    setState((prev) => ({
      ...prev,
      data: result.ok ? result.value : null,
      loading: false,
    }));
  };

export const ValidationPage = () => {
  const [state, setState] = useState<PageState>({ data: null, loading: true });

  useEffect(() => {
    loadData(setState, process.env.NEXT_PUBLIC_BACKEND_API_URL!)();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Validation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis Validations</CardTitle>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <p>Loading...</p>
          ) : state.data ? (
            <pre>{JSON.stringify(state.data, null, 2)}</pre>
          ) : (
            <p>No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ValidationPage;
