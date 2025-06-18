"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "@/lib/api";
import { saveAuthData } from "@/lib/auth";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

type FormValues = z.infer<typeof formSchema>;

const handleSubmit =
  (router: ReturnType<typeof useRouter>) => async (values: FormValues) => {
    const result = await login()(values);
    if (result.ok) {
      const saveResult = saveAuthData(result.value);
      if (saveResult.ok) {
        router.push("/dashboard/home");
        return { ok: true, value: null };
      }
      return saveResult;
    }
    return { ok: false, error: result.error || "Login failed" };
  };

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await handleSubmit(router)(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-around bg-gradient-to-r from-[#E3ECFF] via-[#C3D4FF] to-[#E3ECFF] animate-gradient-x">
      <div className="text-center flex flex-col gap-4 justify-center">
        <p className="text-2xl font-bold drop-shadow-md">Surge AI</p>
        <p className="text-md drop-shadow-sm">
          Copilot for doctors to smooth out the kinks in life
        </p>
      </div>
      <Card className="w-full max-w-lg py-8">
        <CardHeader>
          <CardTitle>Welcome back!</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          {...field}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <Eye size={18} />
                          ) : (
                            <EyeOff size={18} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-red-500">Invalid credentials</p>
              )}
              <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-700">
                Login
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
