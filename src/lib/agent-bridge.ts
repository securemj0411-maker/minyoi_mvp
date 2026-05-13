import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type AgentBridgeMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  ackedAt: string | null;
};

type AgentBridgeState = {
  messages: AgentBridgeMessage[];
};

const BRIDGE_DIR = path.join(process.cwd(), ".agent-bridge");
const STATE_PATH = path.join(BRIDGE_DIR, "messages.json");
const LOCK_PATH = path.join(BRIDGE_DIR, ".lock");
const STALE_LOCK_MS = 30_000;

function emptyState(): AgentBridgeState {
  return { messages: [] };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBridgeDir() {
  await mkdir(BRIDGE_DIR, { recursive: true });
}

async function ensureStateFile() {
  await ensureBridgeDir();
  try {
    await stat(STATE_PATH);
  } catch {
    await writeJsonAtomic(STATE_PATH, emptyState());
  }
}

async function readState(): Promise<AgentBridgeState> {
  await ensureStateFile();
  const raw = await readFile(STATE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as AgentBridgeState;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return emptyState();
  }
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function acquireLock() {
  await ensureBridgeDir();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await mkdir(LOCK_PATH);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("EEXIST")) {
        throw error;
      }
      try {
        const lockStat = await stat(LOCK_PATH);
        if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
          await rm(LOCK_PATH, { recursive: true, force: true });
          continue;
        }
      } catch {
        // lock disappeared between stat and read; retry immediately
      }
      await sleep(50);
    }
  }
  throw new Error("agent-bridge lock timeout");
}

async function releaseLock() {
  await rm(LOCK_PATH, { recursive: true, force: true });
}

async function withStateLock<T>(fn: (state: AgentBridgeState) => Promise<T>) {
  await acquireLock();
  try {
    const state = await readState();
    const result = await fn(state);
    await writeJsonAtomic(STATE_PATH, state);
    return result;
  } finally {
    await releaseLock();
  }
}

export async function pushBridgeMessage(input: {
  from: string;
  to: string;
  text: string;
}) {
  const payload = {
    from: input.from.trim(),
    to: input.to.trim(),
    text: input.text.trim(),
  };
  if (!payload.from || !payload.to || !payload.text) {
    throw new Error("from, to, text are required");
  }

  return withStateLock(async (state) => {
    const message: AgentBridgeMessage = {
      id: randomUUID(),
      from: payload.from,
      to: payload.to,
      text: payload.text,
      createdAt: new Date().toISOString(),
      ackedAt: null,
    };
    state.messages.push(message);
    return message;
  });
}

export async function pullBridgeMessages(input: {
  agent: string;
  limit?: number;
  includeAcked?: boolean;
}) {
  const agent = input.agent.trim();
  const limit = Math.max(1, Math.min(input.limit ?? 20, 200));
  if (!agent) throw new Error("agent is required");

  const state = await readState();
  return state.messages
    .filter((message) => message.to === agent && (input.includeAcked ? true : !message.ackedAt))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

export async function ackBridgeMessages(input: {
  agent: string;
  ids: string[];
}) {
  const agent = input.agent.trim();
  const ids = input.ids.map((id) => id.trim()).filter(Boolean);
  if (!agent) throw new Error("agent is required");
  if (ids.length === 0) throw new Error("ids are required");

  return withStateLock(async (state) => {
    const ackedAt = new Date().toISOString();
    let acked = 0;
    for (const message of state.messages) {
      if (message.to !== agent) continue;
      if (!ids.includes(message.id)) continue;
      if (message.ackedAt) continue;
      message.ackedAt = ackedAt;
      acked += 1;
    }
    return { acked, ackedAt };
  });
}

export async function bridgeHealth() {
  const state = await readState();
  const queued = state.messages.filter((message) => !message.ackedAt).length;
  const acked = state.messages.length - queued;
  return {
    queued,
    acked,
    total: state.messages.length,
    storePath: STATE_PATH,
  };
}
