import { SigningWorkspace } from "@/components/signing-workspace";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SigningWorkspace token={token} />;
}
