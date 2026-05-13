import { evaluatePhase2Escrow, isPhase2EscrowEnabled } from "@/lib/ai-l2-escrow";

const eligibleRow = {
  category: "smartphone",
  comparable_key: "iphone|iphone_15_pro|128gb|self",
  parse_confidence: 0.9,
  needs_review: true,
};

const checks = {
  gate_off_default: {
    enabled: isPhase2EscrowEnabled(),
    decision: evaluatePhase2Escrow({ parsed: eligibleRow, selectedSoFar: 0 }),
  },
  gate_on_eligible: (() => {
    process.env.AI_L2_ESCROW_PHASE2_ENABLED = "1";
    const d = evaluatePhase2Escrow({ parsed: eligibleRow, selectedSoFar: 0 });
    delete process.env.AI_L2_ESCROW_PHASE2_ENABLED;
    return d;
  })(),
  gate_on_broad_blocked: (() => {
    process.env.AI_L2_ESCROW_PHASE2_ENABLED = "1";
    const d = evaluatePhase2Escrow({
      parsed: { ...eligibleRow, comparable_key: "smartphone|generic" },
      selectedSoFar: 0,
    });
    delete process.env.AI_L2_ESCROW_PHASE2_ENABLED;
    return d;
  })(),
  gate_on_low_conf_blocked: (() => {
    process.env.AI_L2_ESCROW_PHASE2_ENABLED = "1";
    const d = evaluatePhase2Escrow({
      parsed: { ...eligibleRow, parse_confidence: 0.4 },
      selectedSoFar: 0,
    });
    delete process.env.AI_L2_ESCROW_PHASE2_ENABLED;
    return d;
  })(),
  gate_on_cap_blocked: (() => {
    process.env.AI_L2_ESCROW_PHASE2_ENABLED = "1";
    const d = evaluatePhase2Escrow({ parsed: eligibleRow, selectedSoFar: 999 });
    delete process.env.AI_L2_ESCROW_PHASE2_ENABLED;
    return d;
  })(),
};

const oracle = {
  gate_off_default: checks.gate_off_default.enabled === false
    && checks.gate_off_default.decision.eligible === false
    && checks.gate_off_default.decision.reason === "gate_off",
  gate_on_eligible: checks.gate_on_eligible.eligible === true
    && checks.gate_on_eligible.flag === "ai_escrow_pending",
  gate_on_broad_blocked: checks.gate_on_broad_blocked.eligible === false
    && checks.gate_on_broad_blocked.reason === "comparable_key_not_narrow",
  gate_on_low_conf_blocked: checks.gate_on_low_conf_blocked.eligible === false
    && checks.gate_on_low_conf_blocked.reason === "parse_confidence_below_floor",
  gate_on_cap_blocked: checks.gate_on_cap_blocked.eligible === false
    && checks.gate_on_cap_blocked.reason === "per_run_cap_reached",
};

const allPass = Object.values(oracle).every(Boolean);
console.log(JSON.stringify({ checks, oracle, allPass }, null, 2));
process.exit(allPass ? 0 : 1);
