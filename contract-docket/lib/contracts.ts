import { createHash, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

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

const dataDirectory = path.join(process.cwd(), ".local-data");
const recordsPath = path.join(dataDirectory, "contracts.json");
const uploadsPath = path.join(dataDirectory, "uploads");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataDirectory() {
  await mkdir(uploadsPath, { recursive: true });
}

async function readAll(): Promise<ContractRecord[]> {
  await ensureDataDirectory();
  try {
    const contents = await readFile(recordsPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (!Array.isArray(parsed)) {
      throw new Error("Contract data must be an array.");
    }
    return parsed as ContractRecord[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeAll(records: ContractRecord[]) {
  await ensureDataDirectory();
  const temporaryPath = `${recordsPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), { mode: 0o600 });
  await rename(temporaryPath, recordsPath);
}

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function listContracts(): Promise<ContractRecord[]> {
  return (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getContract(id: string): Promise<ContractRecord | undefined> {
  return (await readAll()).find((contract) => contract.id === id);
}

export async function createContract(input: ContractInput): Promise<ContractRecord> {
  return withWriteLock(async () => {
    const now = new Date().toISOString();
    const contract: ContractRecord = {
      ...input,
      id: randomUUID(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      events: [{ at: now, label: "초안 생성" }],
    };
    const records = await readAll();
    records.push(contract);
    await writeAll(records);
    return contract;
  });
}

export async function updateContract(
  id: string,
  update: (contract: ContractRecord) => ContractRecord,
): Promise<ContractRecord | undefined> {
  return withWriteLock(async () => {
    const records = await readAll();
    const index = records.findIndex((contract) => contract.id === id);
    if (index === -1) return undefined;
    const next = update(records[index]);
    records[index] = next;
    await writeAll(records);
    return next;
  });
}

export async function findContractByToken(
  token: string,
): Promise<ContractRecord | undefined> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return undefined;
  const suppliedHash = createHash("sha256").update(token).digest();
  const records = await readAll();
  return records.find((contract) => {
    if (!contract.tokenHash) return false;
    const storedHash = Buffer.from(contract.tokenHash, "hex");
    return (
      storedHash.length === suppliedHash.length &&
      timingSafeEqual(storedHash, suppliedHash)
    );
  });
}

export function createSigningToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  };
}

export function getUploadsPath() {
  return uploadsPath;
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
