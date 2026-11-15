import "server-only";
import { createHash, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import type { ContractRow, Json } from "@/lib/supabase/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContractStatus = "draft" | "sending" | "sent" | "signed" | "declined";

export interface ContractEvent {
  at: string;
  label: string;
}

export interface ContractRecord {
  id: string;
  title: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  body: string;
  originalFilename?: string;
  storedFilename?: string;
  senderSignature?: string;
  recipientSignature?: string;
  signerName?: string;
  responseMessage?: string;
  status: ContractStatus;
  tokenHash?: string;
  expiresAt?: string;
  sentAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
  events: ContractEvent[];
}

export interface ContractInput {
  title: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  body: string;
  originalFilename?: string;
  storedFilename?: string;
  senderSignature?: string;
}

const contractColumns =
  "id,owner_id,data,status,token_hash,expires_at,version,created_at,updated_at";

function isContractRecord(value: unknown): value is ContractRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const statuses: ContractStatus[] = ["draft", "sending", "sent", "signed", "declined"];
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.senderName === "string" &&
    typeof record.senderEmail === "string" &&
    typeof record.recipientName === "string" &&
    typeof record.recipientEmail === "string" &&
    typeof record.body === "string" &&
    typeof record.status === "string" &&
    statuses.includes(record.status as ContractStatus) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.events) &&
    record.events.every(
      (event) =>
        event &&
        typeof event === "object" &&
        typeof event.at === "string" &&
        typeof event.label === "string",
    )
  );
}

function contractFromRow(row: ContractRow): ContractRecord {
  if (!isContractRecord(row.data) || row.data.id !== row.id || row.data.status !== row.status) {
    throw new Error("CONTRACT_RECORD_INVALID");
  }
  return row.data;
}

function contractToJson(contract: ContractRecord): Json {
  return JSON.parse(JSON.stringify(contract)) as Json;
}

function rowValues(contract: ContractRecord) {
  return {
    data: contractToJson(contract),
    status: contract.status,
    token_hash: contract.tokenHash ?? null,
    expires_at: contract.expiresAt ?? null,
    updated_at: contract.updatedAt,
  };
}

export async function listContracts(userId: string): Promise<ContractRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(contractColumns)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => contractFromRow(row as ContractRow));
}

export async function getContract(
  userId: string,
  id: string,
): Promise<ContractRecord | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(contractColumns)
    .eq("owner_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? contractFromRow(data as ContractRow) : undefined;
}

export async function createContract(
  userId: string,
  input: ContractInput,
  id = randomUUID(),
): Promise<ContractRecord> {
  const now = new Date().toISOString();
  const contract: ContractRecord = {
    ...input,
    id,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    events: [{ at: now, label: "초안 생성" }],
  };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("contracts").insert({
    id,
    owner_id: userId,
    ...rowValues(contract),
  });
  if (error) throw error;
  return contract;
}

export async function updateContract(
  userId: string,
  id: string,
  update: (contract: ContractRecord) => ContractRecord,
): Promise<ContractRecord | undefined> {
  const supabase = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error: readError } = await supabase
      .from("contracts")
      .select(contractColumns)
      .eq("owner_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!row) return undefined;

    const current = contractFromRow(row as ContractRow);
    const next = update(current);
    if (next === current) return current;
    if (next.id !== current.id) {
      throw new Error("CONTRACT_ID_CHANGED");
    }

    const { data: updated, error: updateError } = await supabase
      .from("contracts")
      .update({ ...rowValues(next), version: row.version + 1 })
      .eq("owner_id", userId)
      .eq("id", id)
      .eq("version", row.version)
      .select(contractColumns)
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return contractFromRow(updated as ContractRow);
  }

  throw new Error("CONTRACT_UPDATE_CONFLICT");
}

export async function findContractByToken(
  token: string,
): Promise<ContractRecord | undefined> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return undefined;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(contractColumns)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const suppliedHash = Buffer.from(tokenHash, "hex");
  const storedHash = Buffer.from(data.token_hash ?? "", "hex");
  if (
    storedHash.length !== suppliedHash.length ||
    !timingSafeEqual(storedHash, suppliedHash)
  ) {
    return undefined;
  }
  return contractFromRow(data as ContractRow);
}

export async function updateContractByToken(
  token: string,
  update: (contract: ContractRecord) => ContractRecord,
): Promise<ContractRecord | undefined> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return undefined;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseAdminClient();
  const { data: row, error: readError } = await supabase
    .from("contracts")
    .select(contractColumns)
    .eq("token_hash", tokenHash)
    .eq("status", "sent")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return undefined;

  const current = contractFromRow(row as ContractRow);
  const next = update(current);
  if (next.id !== current.id) {
    throw new Error("CONTRACT_ID_CHANGED");
  }
  const { data: updated, error: updateError } = await supabase
    .from("contracts")
    .update({ ...rowValues(next), version: row.version + 1 })
    .eq("id", row.id)
    .eq("owner_id", row.owner_id)
    .eq("status", "sent")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .eq("version", row.version)
    .select(contractColumns)
    .maybeSingle();
  if (updateError) throw updateError;
  return updated ? contractFromRow(updated as ContractRow) : undefined;
}

export function createSigningToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  };
}

export function isValidSignatureData(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 1_500_000 &&
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateContractInput(
  value: Record<string, unknown>,
): ContractInput | undefined {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const senderName = typeof value.senderName === "string" ? value.senderName.trim() : "";
  const senderEmail = typeof value.senderEmail === "string" ? value.senderEmail.trim() : "";
  const recipientName =
    typeof value.recipientName === "string" ? value.recipientName.trim() : "";
  const recipientEmail =
    typeof value.recipientEmail === "string" ? value.recipientEmail.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const originalFilename =
    typeof value.originalFilename === "string" ? value.originalFilename : undefined;
  const storedFilename =
    typeof value.storedFilename === "string" ? value.storedFilename : undefined;
  const senderSignature = value.senderSignature;

  if (
    title.length < 2 ||
    title.length > 120 ||
    !senderName ||
    senderName.length > 100 ||
    !isValidEmail(senderEmail) ||
    !recipientName ||
    recipientName.length > 100 ||
    !isValidEmail(recipientEmail) ||
    (!body && !storedFilename) ||
    body.length > 100_000 ||
    (senderSignature !== undefined &&
      senderSignature !== "" &&
      !isValidSignatureData(senderSignature))
  ) {
    return undefined;
  }

  return {
    title,
    senderName,
    senderEmail,
    recipientName,
    recipientEmail,
    body,
    originalFilename,
    storedFilename,
    senderSignature:
      typeof senderSignature === "string" && isValidSignatureData(senderSignature)
        ? senderSignature
        : undefined,
  };
}
