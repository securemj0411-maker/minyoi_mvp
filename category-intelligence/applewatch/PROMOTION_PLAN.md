# applewatch — Promotion Plan (v3)

- generated_at: 2026-05-09T08:27:28.335Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=applewatch --dry-run
node scripts/promote-catalog.mjs --category=applewatch --apply
```

## 반영 후보 요약

- noise rules: 18개 (4개 고신뢰)
- sku candidates: 11개 (11개 promotion 후보, 0개 risk 차단)

## pipeline.ts 후보

- parts: `부품용` (precision 0.80, hits 93)
- buying: `삽니다` (precision 1.00, hits 14)
- parts: `부품용으로` (precision 1.00, hits 53)
- buying: `매입하는` (precision 1.00, hits 9)

## catalog.ts 후보

- 애플워치-시리즈-9-gps-45mm: 애플워치 시리즈 9 GPS 45mm / aliases=애플워치 시리즈 9 GPS 45mm, 애플워치, 시리즈9, 시리즈10, GPS
- 애플워치-se-44mm-애플워치-시리즈-11-46mm: 애플워치 SE 44mm, 애플워치 시리즈 11 46mm / aliases=애플워치 SE 44mm, 애플워치 시리즈 11 46mm, 애플워치, SE, 시리즈3, 시리즈11
- apple-watch-se-3-40mm-gps: Apple Watch SE 3 40mm GPS / aliases=Apple Watch SE 3 40mm GPS, 애플워치 SE, SE3, 40mm, 배터리 성능
- apple-watch-se-40mm-apple-watch-se3-40mm-apple-watch-series-7-45: Apple Watch SE 40mm, Apple Watch SE3 40mm, Apple Watch Series 7 45mm / aliases=Apple Watch SE 40mm, Apple Watch SE3 40mm, Apple Watch Series 7 45mm, 애플워치, SE, SE3, Series 7
- apple-watch-se3-44mm-se3-40mm-se2-40mm-se1: Apple Watch SE3 44mm / SE3 40mm / SE2 40mm / SE1 / aliases=Apple Watch SE3 44mm / SE3 40mm / SE2 40mm / SE1, 애플워치, SE3, SE2, 미개봉
- apple-watch-series-10-gps-46mm: Apple Watch Series 10 GPS 46mm / aliases=Apple Watch Series 10 GPS 46mm, 애플워치, Series 10, Series 7, SE
- apple-watch-series-3: Apple Watch Series 3 / aliases=Apple Watch Series 3, 애플워치, 시리즈 3, 판매, 배터리
- apple-watch-series-3-38mm-42mm: Apple Watch Series 3 38mm / 42mm / aliases=Apple Watch Series 3 38mm / 42mm, 애플워치, 시리즈3, 38mm, 42mm
- apple-watch-series-5-44mm-series-6-40mm-series-11-46mm-se1-44mm: Apple Watch Series 5 44mm, Series 6 40mm, Series 11 46mm, SE1 44mm / aliases=Apple Watch Series 5 44mm, Series 6 40mm, Series 11 46mm, SE1 44mm, 애플워치, 시리즈, 풀박스, 배터리 성능
- apple-watch-series-6: Apple Watch Series 6 / aliases=Apple Watch Series 6, 애플워치, 시리즈6, Series 6, 본체
- apple-watch-series-7-45mm: Apple Watch Series 7 45mm / aliases=Apple Watch Series 7 45mm, 애플워치, 시리즈7, 45mm, 배터리 효율
