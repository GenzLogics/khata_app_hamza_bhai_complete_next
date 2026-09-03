import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerHref: string;
  footerLinkLabel: string;
  children: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  footerText,
  footerHref,
  footerLinkLabel,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <span className="text-xl font-bold text-white">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-sm text-gray-500">
          {footerText}{" "}
          <Link href={footerHref} className="font-medium text-blue-600 hover:text-blue-700">
            {footerLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
