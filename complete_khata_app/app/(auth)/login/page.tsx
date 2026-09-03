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

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, isLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const { ok, error } = await signIn(data);
    if (ok) {
      toast.success("Signed in successfully! Welcome back.");
      setTimeout(() => router.push("/dashboard"), 1000);
      return;
    }
    toast.error(error ?? "Invalid email or password. Please try again.", 10000);
  };

  return (
    <AuthShell
      title="KhataApp"
      subtitle="Sign in to your account"
      footerText="Don't have an account?"
      footerHref="/signup"
      footerLinkLabel="Create account"
    >
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          placeholder="Password"
          error={errors.password?.message}
          required
          {...register("password")}
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </form>
    </AuthShell>
  );
}
