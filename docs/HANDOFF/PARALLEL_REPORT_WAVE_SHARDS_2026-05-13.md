# Parallel Report-Wave Shards

이 문서는 **병렬 에이전트에게 복붙으로 던질 shard 작업표**다.

## Worker Prompt Template

```text
너는 report-only shard worker다.
아래 shard 하나만 맡아서 끝까지 진행해.
global meta chain(parser-report-manifest / parser-manifest-audit / parser-registry-backlog-signals / parser-next-work-queue)은 절대 실행하지 마.
runtime/public/candidate_pool/DDL/catalog/parser 실변경 금지.
끝나면 생성된 report-wave-* 산출물과 핵심 수치만 짧게 보고해.
서브에이전트 써도 된다. 단 같은 shard를 다른 에이전트와 중복 실행하지 마.
```

## Finalizer Prompt Template

```text
너는 finalizer다.
모든 shard worker가 끝난 뒤에만 실행해.
global meta chain까지 마감하고 manifest/audit/backlog/queue를 닫아.
runtime/public/candidate_pool/DDL/catalog/parser 실변경 금지.
```

## Shards

### Worker A — smartwatch

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group smartwatch-wearables
```

### Worker B — earphone

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group earphone-airpods-galaxybuds
```

### Worker C — headphone

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group headphone-airpodsmax
```

### Worker D — monitor

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group monitor-modelcode
```

### Worker E — desktop

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group desktop-fullunit
```

### Worker F — game-console

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group game-console-body
```

### Worker G — camera

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group camera-package
```

### Worker H — speaker

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group speaker-portable
```

### Worker I — home-appliance

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group home-appliance-vacuum
```

### Worker J — phones anchor trio

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --wave phones-anchor-trio-bottleneck
```

## Finalizer

finalizer는 아래 둘 중 하나만 실행:

### Finalizer 1 — generic meta close

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group smartwatch-wearables --with-meta
```

설명:
- `--with-meta`는 packet 재실행 없이 전역 parser meta chain만 닫는다
- 이름은 smartwatch group이지만 실제론 global meta close 트리거 용도

### Finalizer 2 — phones wave already self-closing

`phones-anchor-trio-bottleneck`는 자체적으로 manifest/audit까지만 닫는다.  
따라서 별도 전역 finalizer가 필요하면 Finalizer 1을 마지막에 한 번만 돌려 전체 queue/backlog까지 닫는다.

## One-shot Supervisor

worker/finalizer를 직접 나눠 붙이기 싫으면 이 한 줄로 끝낸다:

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-supervisor.ts --concurrency 3
```

이 명령은:
- shard 10개를 병렬 실행하고
- 전부 성공하면
- finalizer(meta-only)를 자동 실행한다.
