# 2026-05-21 Wave440 — Supreme x TNF Baltoro dryloft bait 차단

## 배경

- Wave438에서 보류했던 `노스페이스드라이로프 ... 슈프림노스페이스발토로원판` 계열을 재검토했다.
- 이 row는 실제 Supreme x TNF Baltoro가 아니라 설명상 `17FW 슈노 발토로 패딩의 베이스로 사용된 패딩`이라고 적힌 일반 TNF DryLoft 계열이었다.
- Baltoro 차단 후에도 설명의 실측 `Shoulder 50` 때문에 `bag-tnf-supreme-shoulder`로 2차 오염될 위험이 있었다.

## 결정

- `clothing-tnf-supreme-baltoro` must-not에 `드라이로프`, `dryloft`, `dry loft`, `원판`을 추가했다.
- `bag-tnf-supreme-shoulder`는 `shoulder bag`은 유지하되 bare English `shoulder`를 must-contain에서 제거했다.
  - 이유: 의류 실측 표기 `Shoulder 50`이 가방 신호로 오인될 수 있다.
  - Korean `숄더/숄더백`은 실제 가방 매물에서 흔하므로 유지했다.

## DB sync 결과

- `clothing-tnf-supreme-baltoro -> null`: 1건
  - pid `168911196`
  - `(s) OG 노스페이스드라이로프 슈프림노스페이스발토로 노스페이스패딩`
- 해당 row의 parsed/pool row도 삭제했다.

## 검증

- dryloft/원판 row 중 `clothing-tnf-supreme-baltoro` 또는 `bag-tnf-supreme-shoulder` 잔존: 0
- regression:
  - 실제 `구매희망시 내부라벨` 포함 발토로는 계속 `clothing-tnf-supreme-baltoro`
  - dryloft bait는 null

## 보류

- 일반 TNF DryLoft 자체를 별도 SKU로 만들지는 않았다. 현재 목표는 Supreme x TNF 비교군 오염 제거다.
