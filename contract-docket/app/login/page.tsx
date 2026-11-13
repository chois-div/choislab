import { LoginWorkspace } from "@/components/login-workspace";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginWorkspace errorCode={error} />;
}
