"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastContainer } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

const schema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const { signUp, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ full_name, email, password }: FormData) => {
    const { ok, error } = await signUp({ full_name, email, password });
    if (ok) {
      toast.success("Account created successfully! Please sign in.");
      setTimeout(() => router.push("/login"), 1500);
      return;
    }
    toast.error(error ?? "Registration failed. Please try again.");
  };

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join KhataApp today"
      footerText="Already have an account?"
      footerHref="/login"
      footerLinkLabel="Sign in"
    >
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="John Doe"
          error={errors.full_name?.message}
          required
          {...register("full_name")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          required
          {...register("email")}
        />
        <PasswordInput
          label="Password"
          placeholder="Min. 8 characters"
          error={errors.password?.message}
          required
          {...register("password")}
        />
        <PasswordInput
          label="Confirm Password"
          placeholder="Repeat your password"
          error={errors.confirm_password?.message}
          required
          {...register("confirm_password")}
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create Account
        </Button>
      </form>
    </AuthShell>
  );
}
