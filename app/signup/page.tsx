import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Create account · McGill Martlet" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  return <AuthPage mode="signup" searchParams={await searchParams} />;
}
