# laptop — Promotion Plan (v3)

- generated_at: 2026-05-09T11:25:14.854Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=laptop --dry-run
node scripts/promote-catalog.mjs --category=laptop --apply
```

## 반영 후보 요약

- noise rules: 20개 (4개 고신뢰)
- sku candidates: 8개 (8개 promotion 후보, 0개 risk 차단)

## pipeline.ts 후보

- buying: `매입` (precision 1.00, hits 121)
- buying: `출장` (precision 1.00, hits 70)
- buying: `번톡` (precision 1.00, hits 48)
- buying: `매입업체` (precision 1.00, hits 47)

## catalog.ts 후보

- 레노버-리전-5-15ahp10-lg-그램-17z990-va7bk-삼성-노트북-i7-15-6인치: 레노버 리전 5 15AHP10, LG 그램 17Z990-VA7BK, 삼성 노트북 i7 15.6인치 / aliases=레노버 리전 5 15AHP10, LG 그램 17Z990-VA7BK, 삼성 노트북 i7 15.6인치, 노트북, 중고, CPU, RAM
- 레노버-legion-i7-8750h-16gb-256gb-gtx1050ti: 레노버 LEGION i7 8750H 16GB 256GB GTX1050Ti / aliases=레노버 LEGION i7 8750H 16GB 256GB GTX1050Ti, 중고노트북, 게이밍 노트북, 레노버, 사양
- 맥북-프로-m4-pro-16인치-24gb-512gb-ssd: 맥북 프로 M4 Pro 16인치 24GB 512GB SSD / aliases=맥북 프로 M4 Pro 16인치 24GB 512GB SSD, 맥북 프로, 맥북 에어, M4 Pro, 배터리 효율 100
- 맥북프로-16-m4-pro-48gb-1tb: 맥북프로 16 M4 Pro 48GB 1TB / aliases=맥북프로 16 M4 Pro 48GB 1TB, 맥북프로, M4, M3, 중고노트북
- 윈도우11-노트북-인텔-cpu-8gb-ram-ssd-120-512gb: 윈도우11 노트북 인텔 CPU 8GB RAM SSD 120~512GB / aliases=윈도우11 노트북 인텔 CPU 8GB RAM SSD 120~512GB, 윈도우11, 노트북, 중고 본체, 정품인증
- apple-imac-27-inch-5k-retina-2016-2019: Apple iMac 27-inch 5K Retina (2016-2019) / aliases=Apple iMac 27-inch 5K Retina (2016-2019), 아이맥, 27인치, 5K, 레티나
- gigabyte-aorus-16x-asg-53kr-에이서-프레데터-helios-neo-v-16-phn16-72-59: GIGABYTE AORUS 16X ASG-53KR, 에이서 프레데터 Helios Neo V 16 PHN16-72-59C2, HP 오멘 16-wf0156TX, HP 오멘 16-xf0052AX, HP 오멘 슬림 16-an0005TX / aliases=GIGABYTE AORUS 16X ASG-53KR, 에이서 프레데터 Helios Neo V 16 PHN16-72-59C2, HP 오멘 16-wf0156TX, HP 오멘 16-xf0052AX, HP 오멘 슬림 16-an0005TX, 16인치, 게이밍노트북, 직거래위치, 택배가격
- macbook-pro-13인치-a1502-macbook-pro-15인치-retina-2012-macbook-pro-: MacBook Pro 13인치 A1502, MacBook Pro 15인치 Retina 2012, MacBook Pro 15인치 2017 / aliases=MacBook Pro 13인치 A1502, MacBook Pro 15인치 Retina 2012, MacBook Pro 15인치 2017, 가성비 노트북 중고, MacBook Pro, 본체, 충전기
