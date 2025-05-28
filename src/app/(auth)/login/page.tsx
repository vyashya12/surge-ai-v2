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
    <div className="flex min-h-screen items-center justify-around bg-gray-50">
      <div className='text-center flex flex-col gap-4 justify-center'>
        <p className="text-2xl font-bold">Surge AI</p>
        <p className="text-md ">AI-Powered Transcription for Cleaner, Faster Clinical Notes.</p>
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
                      <Input
                        type="password"
                        placeholder="Password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-red-500">
                  {form.formState.errors.root.message}
                </p>
              )}
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
