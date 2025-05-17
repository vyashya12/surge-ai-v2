import { LoginResponse, Result } from "@/types";

const setStorage = (key: string, value: string): Result<null, string> => {
  try {
    localStorage.setItem(key, value);
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "Storage failed" };
  }
};

const getStorage = (key: string): Result<string, string> => {
  const value = localStorage.getItem(key);
  return value ? { ok: true, value } : { ok: false, error: "Key not found" };
};

const removeStorage = (key: string): Result<null, string> => {
  try {
    localStorage.removeItem(key);
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "Removal failed" };
  }
};

export const saveAuthData = (data: LoginResponse): Result<null, string> => {
  const doctorId = data.token.split("_")[1] || ""; // Extract doctor_id from token
  if (!doctorId) {
    return { ok: false, error: "Invalid token format: missing doctor ID" };
  }
  const userWithDoctorId = {
    ...data.user,
    doctorId,
  };
  const userResult = setStorage("user", JSON.stringify(userWithDoctorId));
  if (!userResult.ok) return userResult;
  return setStorage("token", data.token);
};

export const clearAuthData = (): Result<null, string> => {
  const userResult = removeStorage("user");
  if (!userResult.ok) return userResult;
  return removeStorage("token");
};

export const getAuthData = (): Result<LoginResponse, string> => {
  const userResult = getStorage("user");
  if (!userResult.ok) return userResult;
  const tokenResult = getStorage("token");
  if (!tokenResult.ok) return tokenResult;
  return {
    ok: true,
    value: {
      user: JSON.parse(userResult.value),
      token: tokenResult.value,
      status: 200,
      message: "Successfull",
    },
  };
};
