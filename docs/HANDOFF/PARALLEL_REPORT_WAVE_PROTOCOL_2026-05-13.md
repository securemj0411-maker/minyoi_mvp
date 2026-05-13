# Parallel Report-Wave Protocol

이 문서는 **여러 Codex/Claude 에이전트를 병렬로 띄워서 report-only wave를 빨리 닫는 방법**을 정의한다.

핵심 원칙:

1. **shard worker**와 **finalizer**를 분리한다.
2. shard worker는 **자기 packet만** 실행한다.
3. `parser-report-manifest`, `parser-manifest-audit`, `parser-registry-backlog-signals`, `parser-next-work-queue` 같은 **global meta chain은 오직 finalizer 1명만** 실행한다.
4. runtime / public / candidate_pool / DDL / catalog / parser 실변경은 금지한다.

## 왜 이렇게 하나

병렬 에이전트 여러 명이 동시에 `parser-manifest`나 `next-work-queue`를 갱신하면 같은 report 파일을 서로 덮어쓴다.  
그래서 병렬화는:

- worker: group-local packet 생성
- finalizer: global meta chain 마감

이 구조로만 안전하게 간다.

## 실행 모드

### 1) Group-only shard worker

한 registry group만 실행하고 끝낸다.  
global meta chain은 실행하지 않는다.

예:

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group smartwatch-wearables
```

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group camera-package
```

### 2) Group finalizer

모든 shard worker가 끝난 뒤 **한 명만** 실행한다.

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --group smartwatch-wearables --with-meta
```

주의: `--with-meta`는 이제 **packet 재실행 없이 meta chain만** 실행한다.  
절대 병렬 여러 명이 동시에 쓰지 말 것.

### 3) Pre-bundled wave

이미 묶어둔 wave key가 있으면 그대로 실행 가능.

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-wave.ts --wave phones-anchor-trio-bottleneck
```

## 간접 통신 규칙

에이전트끼리 직접 통신하지 말고, 아래 방식으로 간접적으로 맞춘다.

1. 시작할 때 shard claim을 문서에 남긴다
2. 자기 shard가 끝나면 결과 파일만 남기고 종료한다
3. finalizer가 마지막에 manifest/audit/queue를 닫는다

권장 claim 표기 위치:

- `mvp/docs/HANDOFF/PARALLEL_REPORT_WAVE_SHARDS_2026-05-13.md`

## 금지

- 같은 shard를 두 에이전트가 동시에 실행
- 둘 이상이 `--with-meta` 실행
- runtime / public / candidate_pool / DDL / catalog / parser 코드 수정
- no-touch runtime file 편집

## 추천 병렬 단위

- `smartwatch-wearables`
- `earphone-airpods-galaxybuds`
- `headphone-airpodsmax`
- `monitor-modelcode`
- `desktop-fullunit`
- `game-console-body`
- `camera-package`
- `speaker-portable`
- `home-appliance-vacuum`
- `phones-anchor-trio-bottleneck` (pre-bundled wave)

## One-shot Supervisor

사람이 worker/finalizer를 따로 복붙하지 않고, **한 번에 전 shard + finalizer**를 돌리고 싶으면:

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp && \
node --import tsx scripts/run-report-supervisor.ts --concurrency 3
```

- `--concurrency`는 동시에 돌릴 shard 수
- 기본값은 `4`
- supervisor는
  1. shard worker들을 병렬 실행
  2. 전부 성공하면
  3. finalizer(meta-only)를 자동 실행
  4. 결과를 `reports/report-supervisor-latest.{json,md}`에 남긴다
