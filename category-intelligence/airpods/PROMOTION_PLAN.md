# airpods — Promotion Plan (v3)

- generated_at: 2026-05-09T08:27:28.335Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=airpods --dry-run
node scripts/promote-catalog.mjs --category=airpods --apply
```

## 반영 후보 요약

- noise rules: 20개 (6개 고신뢰)
- sku candidates: 6개 (6개 promotion 후보, 0개 risk 차단)

## pipeline.ts 후보

- parts: `왼쪽` (precision 0.80, hits 70)
- parts: `부품용` (precision 1.00, hits 31)
- accessory: `케이스` (precision 0.80, hits 141)
- parts: `오른쪽` (precision 1.00, hits 54)
- parts: `8핀` (precision 0.80, hits 57)
- parts: `문제` (precision 1.00, hits 53)

## catalog.ts 후보

- 애플-에어팟-4세대-노이즈-캔슬링-미탑재-모델-포함: 애플 에어팟 4세대 (노이즈 캔슬링 미탑재 모델 포함) / aliases=애플 에어팟 4세대 (노이즈 캔슬링 미탑재 모델 포함), 애플 에어팟 4, 노캔X, 미개봉, 새상품
- 에어팟-3세대: 에어팟 3세대 / aliases=에어팟 3세대, 판매합니다, 정상 작동, 본체, 풀박스
- 에어팟-프로-3세대: 에어팟 프로 3세대 / aliases=에어팟 프로 3세대, 미개봉, 새상품, 정품, 판매합니다
- airpods-max-1세대-8핀-실버: AirPods Max 1세대 8핀 실버 / aliases=AirPods Max 1세대 8핀 실버, 에어팟 맥스, 1세대, 실버, 풀박스
- airpods-max-미드나이트: AirPods Max 미드나이트 / aliases=AirPods Max 미드나이트, 에어팟맥스, 미드나이트, 기스, 헤드늘어짐
- airpods-pro-2세대-usb-c-타입: AirPods Pro 2세대 USB-C 타입 / aliases=AirPods Pro 2세대 USB-C 타입, 미개봉, 에어팟 프로 2, USB-C, 새제품
