const DEFAULT_URL =
  process.env.AGENT_BRIDGE_URL?.trim() || "http://127.0.0.1:3000/api/debug/agent-bridge";

type Command = "push" | "pull" | "ack" | "health";

function parseArgs(argv: string[]) {
  const [commandRaw, ...rest] = argv;
  const command = (commandRaw ?? "") as Command;
  const options: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "1";
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function usage() {
  console.log(`agent-bridge usage:
  tsx scripts/agent-bridge.ts push --from codex --to claude --text "..."
  tsx scripts/agent-bridge.ts pull --agent codex [--limit 20]
  tsx scripts/agent-bridge.ts ack --agent codex --ids id1,id2
  tsx scripts/agent-bridge.ts health

Optional env:
  AGENT_BRIDGE_URL=http://localhost:3000/api/debug/agent-bridge
  AGENT_BRIDGE_SECRET=...
`);
}

function requestHeaders() {
  const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
  return {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || !["push", "pull", "ack", "health"].includes(command)) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === "health") {
    const res = await fetch(`${DEFAULT_URL}?mode=health`, { headers: requestHeaders() });
    const text = await res.text();
    console.log(text);
    process.exitCode = res.ok ? 0 : 1;
    return;
  }

  if (command === "pull") {
    const agent = options.agent ?? "";
    const limit = options.limit ?? "20";
    const includeAcked = options["include-acked"] === "1" ? "&include_acked=1" : "";
    const res = await fetch(
      `${DEFAULT_URL}?agent=${encodeURIComponent(agent)}&limit=${encodeURIComponent(limit)}${includeAcked}`,
      { headers: requestHeaders() },
    );
    const text = await res.text();
    console.log(text);
    process.exitCode = res.ok ? 0 : 1;
    return;
  }

  if (command === "ack") {
    const agent = options.agent ?? "";
    const ids = (options.ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const res = await fetch(DEFAULT_URL, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({
        mode: "ack",
        agent,
        ids,
      }),
    });
    const text = await res.text();
    console.log(text);
    process.exitCode = res.ok ? 0 : 1;
    return;
  }

  const from = options.from ?? "";
  const to = options.to ?? "";
  const text = options.text ?? "";
  const res = await fetch(DEFAULT_URL, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({
      mode: "push",
      from,
      to,
      text,
    }),
  });
  const body = await res.text();
  console.log(body);
  process.exitCode = res.ok ? 0 : 1;
}

void main();
