import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CONTRACT_FILES_BUCKET } from "@/lib/supabase/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isOwnedContractFilePath(userId: string, objectPath: string) {
  const parts = objectPath.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts.every((part) => Boolean(part) && part !== "." && part !== "..")
  );
}

function assertOwnedFilePath(userId: string, objectPath: string) {
  if (!isOwnedContractFilePath(userId, objectPath)) {
    throw new Error("CONTRACT_FILE_PATH_INVALID");
  }
}

export async function createContractUpload(userId: string) {
  const objectPath = `${userId}/${randomUUID()}/${randomUUID()}.pdf`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });
  if (error) throw error;
  return { path: objectPath, token: data.token };
}

export async function verifyContractUpload(userId: string, objectPath: string) {
  assertOwnedFilePath(userId, objectPath);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .download(objectPath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteContractFile(userId: string, objectPath: string) {
  assertOwnedFilePath(userId, objectPath);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .remove([objectPath]);
  if (error) throw error;
}

export async function readContractFileForOwner(userId: string, objectPath: string) {
  assertOwnedFilePath(userId, objectPath);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .download(objectPath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function readContractFileForSigner(objectPath: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .download(objectPath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
