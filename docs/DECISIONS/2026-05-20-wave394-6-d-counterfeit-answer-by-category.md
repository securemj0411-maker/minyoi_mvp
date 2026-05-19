# Wave 394.6.d — WhyTrust 가품 Q 답 카테고리별 분기

날짜: 2026-05-20
영역: pack-reveal-modal WhyTrustCollapse

## 배경

Wave 393.8 (5/20 일찍) `CounterfeitChecklistPanel` 카테고리별 헤드라인 박음 ("전자제품이 뭔 가품이냐" 사용자 짚음). 단 `WhyTrustCollapse` 의 가품 Q (Q[1]) 답이 여전히 generic.

> "전자제품이 뭔 가품이냐? 신발이나 옷도 아니고; 에어팟은 차이팟이나 이런거 있긴함. 에어팟같은거엔 차이팟 같은거 조심 이렇게 해도되는데"

= 카테고리별 위험 신호 다름. 폰/태블릿/노트북 = 가품 거의 X (잠금/부품이 진짜 위험). 신발/명품/에어팟 = 가품 위험 큼.

## 변경

`WhyTrustCollapse` 안 `counterfeitAnswer` 변수 추가 (`categoryFromComparableKey` 기반 12 카테고리 분기) + `qas[1].a` = `counterfeitAnswer`.

### 카테고리별 답 매핑

| 카테고리 | 답 |
|---|---|
| **shoe** | 신발 가품 위험 큼 (특히 명품/한정판). KREAM 검수 + 안창/박스/태그/시리얼 |
| **earphone** | 차이팟(가품 에어팟) 흔함. 시리얼/케이스 인증/무게(50g) 확인 |
| **bag** | 명품 가방 가품 위험 큼. 라벨/봉제/안감/시리얼 + KREAM/트렌비 인증 |
| **watch** | 명품 시계 가품 매우 큼. 보증서 + 시리얼 매칭 + AS |
| **perfume** | 공병/가짜 향료 위험. 시리얼 + 박스 인쇄 + 향 패턴 |
| **clothing** | 명품/스트릿웨어 가품 흔함 (Supreme/Stussy/BAPE). 라벨/봉제/태그 |
| **smartphone** | 가품 거의 없음. 진짜 위험 = iCloud/구글 잠금, IMEI 위변조, 부품 교체 |
| **tablet** | 가품 거의 없음. iCloud 잠금, 액정, 배터리 |
| **smartwatch** | 가품 거의 없음. iCloud, 페어링, 배터리 사이클 |
| **laptop** | 가품 거의 없음. iCloud (맥북), 부품 교체 (램/SSD), 액정, 키보드 |
| **drone** | DJI 가품 거의 없음. 활성화 (DJI 계정), 펌웨어, 배터리 사이클 |
| **camera** | 가품 거의 없음. 셔터 카운트, 렌즈 곰팡이, 센서 클리닝, AS |
| **default** | 기존 답 (의심 키워드 사전 차단 + 시리얼/보증서 권장) |

각 답 = `{condition} 분류 + 카테고리별 진짜 위험 신호 + 권장 액션`.

## 영향

- WhyTrust 첫 Q (셀러) 다음 펼치는 Q (가품) 답이 카테고리별 정확
- `CounterfeitChecklistPanel` 헤드라인 + `WhyTrustCollapse` 답 = 톤 일관 (Wave 393.8 카테고리 매핑 자연 연장)
- "폰인데 가품 위험 큼" 같은 부정확 신호 차단

## 후속

- Wave 394.6.e: 모델별/브랜드별 가품 체크포인트 (#4) — "Bird-aid 라벨", "GORE-TEX 4면 박음질" 같은 brand-specific. 별 큰 wave 가치 (브랜드 catalog 필요)
