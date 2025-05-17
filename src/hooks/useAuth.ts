import { useState, useEffect } from "react";
import { getAuthData, clearAuthData } from "@/lib/auth";
import { LoginResponse, Result } from "@/types";

type AuthState = {
  user: LoginResponse | null;
  loading: boolean;
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const authData = getAuthData();
    setState({
      user: authData.ok ? authData.value : null,
      loading: false,
    });
  }, []);

  const logout = (): Result<null, string> => {
    const result = clearAuthData();
    if (result.ok) {
      setState({ user: null, loading: false });
    }
    return result;
  };

  return { ...state, logout };
};
