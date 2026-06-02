# Wave 1005 Cron Warning Triage

Date: 2026-06-02 KST

## Trigger

Telegram operational alerts showed `source: bunjang` remained `healthy -> healthy`, but warning lines were attached:

- `daangn_price_sweep_worker_a: 12% failed (2/17)`
- `Market: 11% failed (1/9)`
- later `Lifecycle: 6% failed (1/18)`

## Findings

- The alert source label is `bunjang` because `source_health` writes the global operational alert bundle while evaluating Bunjang source health. It does not mean Bunjang itself was blocked.
- Recent DB inspection found a wider 11:30-13:10 KST failure wave in `mvp_collect_runs`, mostly:
  - `stale running run auto-marked after 3m`
  - `stale running run auto-marked after 8m`
  - Supabase/PostgREST statement timeouts around raw/listing patch and lifecycle claim RPC.
- `mvp_cron_executions` for the specifically mentioned workers showed current successful runs, so the user-facing cron path had recovered; the degraded health row was carrying failures still inside the source-health time window.
- Vercel env did not show `PIPELINE_STALE_RUN_MINUTES`, so the 3-minute marker was not a production env override.
- `mvp_collect_runs.request_meta.vercelDeploymentUrl` showed stale 3-minute marker rows from multiple Vercel worker projects.
- `minyoi-mvp-daangn-c` was still on a 2026-05-30 production deployment, before the Wave 1002 stale marker default moved 3/6 minutes to 8 minutes.

## Action Taken

- Redeployed `minyoi-mvp-daangn-c` from a clean detached worktree at `b9fab90a` (`wave 1004`) to avoid including unrelated dirty local files.
- Deployment succeeded:
  - production URL: `https://minyoi-mvp-daangn-ecvdqthcy-securemj0411-7703s-projects.vercel.app`
  - alias: `https://minyoi-mvp-daangn-c.vercel.app`

## Verification

- Before redeploy, recent 45-minute DB check showed `mvp_collect_runs` failures had already stopped: failed `0`, stale3 `0`, stale8 `0`.
- After redeploy, recent 60-minute check still showed failed `0`, stale3 `0`, stale8 `0`.
- After the alias moved, new `daangn-c` rows were observed on the new deployment URL:
  `minyoi-mvp-daangn-ecvdqthcy-securemj0411-7703s-projects.vercel.app`.
  Recent 10-minute check showed failed `0`, stale3 `0`.
- Source health remained `degraded` at 13:32 KST because prior failures were still inside the health window, but `operationalAlerts` was empty.

## Decision

- Treat the pasted early-morning alert as a warning, not a full outage.
- Treat the later 11:30-13:10 KST wave as a real DB/worker pressure incident with recovery.
- Keep the 8-minute stale marker policy. The old 3-minute marker is too aggressive for market/score/recovery workers and creates false failure noise.
- Continue watching the next source-health windows; status should recover once old failed rows age out.

## Follow-Up

- If 3-minute stale rows reappear after this deploy, inspect which deployment URL produced them and redeploy/disable that worker project.
- Consider adding a source-health alert formatter note so `source: bunjang` does not obscure that some warning lines are global worker alerts.
- Consider a small admin/debug table column or metric showing `vercelDeploymentUrl` grouped by failure reason for faster worker drift detection.
