# Wave D — 전자제품 카테고리 브랜드 깊이 (smartphone/tablet/laptop)

날짜: 2026-05-20
영역: counterfeit-checklist 보강 (electronics brand-specific)
범위: smartphone (iPhone, Galaxy) + tablet (iPad, Galaxy Tab) + laptop (MacBook, Galaxy Book, LG gram, Surface, ThinkPad, 게이밍 노트북) — 10 브랜드

## 배경

Wave A (shoe) / Wave B (clothing) 와 동일한 외부 review 비판:
> "라벨/봉제/안감 3축 확인하세요'가 너무 일반적. ... 이런 모델별 가품 체크포인트가 있어야 진짜 가치 있음. 일반론은 구글링이 더 빠름"

단, 전자제품은 **가품 거의 X**. 진짜 위험은:
- **잠금** (iCloud Activation Lock / Google FRP / Microsoft 계정 / BIOS 비번)
- **부품 교체** (사제 액정/배터리/카메라/SSD)
- **IMEI 위변조** (분실/도난 → 통신사 등록 차단)
- **배터리 사이클 / 키보드 마모 / 액정 멍/번인**
- **세대 차** (M1 vs M3, RTX 4060 vs 4090 — 시세 ₩30~150만 차)

→ `counterfeitChecks` 슬롯은 "부품/잠금/IMEI 변별 포인트" 용도로 사용. UI/헬퍼는 Wave A/B 그대로 (변경 0).

## 변경

### 1. `mvp/src/lib/category-brand-depth.ts` — SMARTPHONE / TABLET / LAPTOP 블록 추가

Registry 확장:
```ts
export const CATEGORY_BRAND_DEPTH: Record<string, CategoryBrandDepth> = {
  shoe: SHOE,
  clothing: CLOTHING,
  smartphone: SMARTPHONE,   // ← Wave D
  tablet: TABLET,           // ← Wave D
  laptop: LAPTOP,           // ← Wave D
};
```

헬퍼 (`detectBrandDepth`) 변경 X → 3화면 자동 적용 (`pack-reveal-modal` + `user-reveal-dashboard` + `admin-pool-browser` 정책 그대로).

### 2. smartphone — Apple iPhone + Samsung Galaxy

**Apple iPhone (low 위험 — 가품 거의 X, 잠금/부품 위험 ↑):**
- **설정 > 일반 > 정보 > '부품 및 서비스 이력' (iOS 16.4+)** — 사제 액정/배터리/카메라/Face ID = '정품 부품 아님'
- ***#06# IMEI** — 통신사 매장에서 정상/분실 조회. 분실 IMEI = 새 회선 등록 차단
- **Apple checkcoverage.apple.com** — 시리얼/IMEI 조회. 'Apple ID 등록됨' = Activation Lock 가능성
- 박스 IMEI vs 단말 IMEI 일치 (IMEI1, IMEI2 둘 다)
- 설정 > 배터리 > 최대 용량 % (80% 미만 = 교체 필요)
- 시장: iCloud Activation Lock 영구 락, 용량별 시세 차 (256/512/1TB ₩10~20만 단계), AppleCare+ 가입 = ₩5~10만 ↑, Pro/Pro Max/Plus/mini 시세 차 큼

**Samsung Galaxy (low 위험):**
- **설정 > 휴대전화 정보 > 부품 정보 (One UI 7+, S24+)** — 사제 부품 표시
- *#06# IMEI / Samsung 멤버스 앱 / samsung.com/sec/support
- 박스 vs 단말 IMEI/시리얼 일치 (Fold/Flip은 IMEI1, IMEI2 둘 다)
- 배터리 상태 (설정 > 디바이스 케어)
- 시장: **Google FRP 잠금** (factory reset 후 이전 Google 계정 요구), 자급제 vs 통신사 약정폰 (위약금/락), S펜 (Ultra/Note) 분실/충전, Z Flip/Fold 힌지/메인 디스플레이 깨짐, Samsung Care+ 가입 시세 ↑

**skuId 분리:**
- `iphone-` → apple-iphone
- `galaxy-s`, `galaxy-z-`, `galaxy-note` → samsung-galaxy (`galaxy-tab-`, `galaxy-book-`, `galaxy-buds-`, `galaxywatch-` 와 충돌 X)

### 3. tablet — Apple iPad + Samsung Galaxy Tab

**Apple iPad (low):**
- 설정 > Apple ID 로그아웃 + '나의 찾기 해제' 시연 (Activation Lock 해제)
- checkcoverage.apple.com 시리얼 조회
- 흰/검정 풀스크린 → 액정 멍/번인 (Pro OLED 번인 위험)
- 셀룰러 모델 IMEI 조회 가능
- 시장: **Apple Pencil 호환** (Pencil 1/2/Pro — 모델별 다름. Pencil Pro = M4 전용), Wi-Fi vs Cellular ₩10~15만 차, 키보드/펜슬 풀세트 ₩10~20만 ↑, Pro 11 vs 13 / Air 11 vs 13 사이즈/세대 시세 차

**Samsung Galaxy Tab (low):**
- 셀러 Samsung 계정 + Google 계정 로그아웃 (FRP)
- Samsung 멤버스 시리얼 조회
- S펜 페어링 시연 (블루투스 S펜 vs 일반)
- 시장: FRP 잠금, S펜 분실 매물 흔함, Wi-Fi vs LTE/5G 가격 차, 키보드 풀세트 시세 ↑

**skuId 분리:** `ipad-` → apple-ipad, `galaxy-tab-` → samsung-tab

### 4. laptop — Apple MacBook + Samsung Galaxy Book + LG gram + Surface + ThinkPad + 게이밍 노트북

**Apple MacBook (low):**
- '이 Mac에 관하여' → 모델/시리얼/메모리/저장공간/그래픽
- checkcoverage.apple.com 시리얼 + AppleCare+ 잔여
- **macOS Sonoma+ '부품 및 서비스 이력'** — 사제 액정/배터리/로직보드 표시
- **Coconut Battery** 사이클 (M1+ 정상 1000 cycle / 80%+ 잔여)
- 키보드/트랙패드 시연 (2016~2019 버터플라이 = 키 눌림 흔함)
- 시장: iCloud Activation Lock (T2+Apple Silicon), **M1/M2 vs M3/M4 시세 ₩30~50만 차**, **통합 메모리 (M1+ 램/SSD 자체 교체 불가)** — 16/32GB + 256/512GB/1TB 단계별 시세 차 큼, US vs KR 키보드 (KR 우월), OLED Pro 14/16 M4+ 번인 위험

**Samsung Galaxy Book (low):**
- msinfo32, Samsung 멤버스 시리얼
- BatteryInfoView (사이클 + 잔여 용량)
- AMOLED 모델 번인 확인, 2-in-1 힌지 시연
- 시장: Microsoft 계정 락, BIOS 비번 (해제 어려움), Galaxy Book 4 vs 5 / Pro vs Ultra (Ultra = 외장 GPU), Knox 잠금, SSD/RAM 자체 교체 (CrystalDiskInfo)

**LG gram (low):**
- msinfo32, LG 멤버십 시리얼
- 그램은 가벼움 강조 → 배터리 셀 작아 노화 빠를 수 있음
- 시장: MS 계정 락, BIOS 비번, 17 vs 16 vs 15 사이즈 시세 차, Intel 12/13/14 Gen 시세 ₩20~30만 차, SSD/RAM 자체 교체

**Microsoft Surface (low — 한국 정식 적음):**
- account.microsoft.com/devices 기기 등록 조회
- 시장: MS 계정 + Bitlocker 락, Surface Pro vs Laptop vs Book 폼팩터, 배터리 일체형 (마모 후 교체 어려움), 한국 정식 X — 직구 위주

**Lenovo ThinkPad (low):**
- pcsupport.lenovo.com 시리얼 + Premier Support 가입
- 시장: MS 계정 + **BIOS Supervisor Password 둘 다 락 가능**, X1 Carbon / T / P (워크스테이션) / E (저가) 라인별 시세 차, Intel vs AMD Ryzen, 한국 정식 vs 직구, 기업 리스 반납 매물 多 (사용 시간 ↑↑)

**게이밍 노트북 (MSI/ASUS ROG/Razer/Alienware — low):**
- **GPU-Z** — 가짜 GPU 라벨 vs 실제 칩 확인 (RTX 4060 vs 4070 vs 4080 vs 4090 시세 ₩50~150만 차)
- CrystalDiskInfo (SSD 사용 시간 1000h+ = 장시간)
- BatteryInfoView (사이클 多)
- 발열/팬 테스트 — 부팅 후 idle + 게임 1판 부하 시연
- 시장: **GPU 장기 고온 손상 (80~90°C 장시간)**, 쿨링 팬 먼지/소음, 배터리 마모 50%+ 흔함, GPU/CPU 모델 정확 확인, 1년+ 사용 매물 키보드/스피커/팬 노후

**skuId / keyword 분리:**
- `macbook-` → apple-macbook
- `galaxy-book-` → samsung-book
- `lg-gram-` → lg-gram
- 키워드만 (catalog 미등록): `surface`, `thinkpad`, 게이밍 (rtx 4070/4080/asus rog/msi/alienware 등)

각 brand: counterfeitChecks 5개 + marketRisks 4~6개 + authentication 2~3개.

### 5. 테스트 — `mvp/tests/waveD-electronics-brand-depth.test.ts`

34개 케이스:
- skuId prefix 매칭 (iphone/galaxy-s/galaxy-z-/galaxy-note/ipad/galaxy-tab/macbook/galaxy-book/lg-gram)
- keyword 매칭 (한글 — 아이폰/갤럭시/아이패드/갤럭시탭/맥북/그램, 영문 — Surface/ThinkPad/ASUS ROG/MSI)
- **iOS 16.4+ '부품 및 서비스 이력' 명시 확인** (iPhone + MacBook)
- **Apple checkcoverage.apple.com 명시 확인** (iPhone)
- **iCloud Activation Lock 명시 확인** (iPhone + iPad + MacBook)
- **FRP 명시 확인** (Galaxy + Galaxy Tab)
- **Apple Pencil 호환 명시 확인** (iPad)
- **S펜 명시 확인** (Galaxy Tab)
- **Coconut Battery 명시 확인** (MacBook)
- **통합 메모리 (M1+ 램/SSD 자체 교체 불가) 명시 확인** (MacBook)
- **GPU-Z + 발열/팬 명시 확인** (게이밍 노트북)
- **galaxy- prefix split 회귀 보호** — `galaxy-tab-` 이 smartphone 카테고리로 false-match X, `galaxy-book-` 도 X, `galaxy-s*`/`galaxy-z-*` 가 tablet/laptop 으로 false-match X
- **Apple prefix split 회귀 보호** — iphone/ipad/macbook 각자 카테고리 내에서만 매칭
- shoe/clothing skuId 가 Wave D 어느 카테고리에도 false-match X
- 모든 Wave D 브랜드 = `counterfeitRisk: "low"` (전자제품 특성)
- registry 누락 검증 (10 브랜드)

## 검증

- `npx tsx --test tests/waveD-electronics-brand-depth.test.ts` — **34/34 pass**
- `npx tsx --test tests/waveA-... tests/waveB-... tests/waveD-...` — **62/62 pass** (회귀 0)
- `npx tsc --noEmit` — 우리 파일 에러 0

## 영향

전자제품 매물 reveal 시 brand 감지되면:
- 헤드라인 chip: "Apple 아이폰 (iPhone)" + "가품 거의 없음" (emerald — low risk 라벨)
- 펼침: 🎯 **"Apple 아이폰 — 모델별 변별 포인트"** 박스 안에 **"설정 > 일반 > 정보 > '부품 및 서비스 이력' (iOS 16.4+)"** + **"*#06# IMEI"** + **"checkcoverage.apple.com"** 등 5개 구체 항목
- 시장 위험: **iCloud Activation Lock 영구 락**, 용량별 시세 차, AppleCare+ 잔여 가치
- WhyTrust 가품 Q 답: "Apple 아이폰 — 가품 거의 없음. 진짜 위험은 iCloud 락 + 부품 교체. 변별: 설정 > 부품 및 서비스 이력 + *#06# IMEI 조회"

전자제품 사용자가 잘 모르는 부분:
- iOS 16.4+ 부품 이력 메뉴 (대부분 모름)
- One UI 7+ 부품 정보 (Galaxy S24+ 한정 — 대부분 모름)
- macOS Sonoma+ '부품 및 서비스 이력'
- IMEI 통신사 매장 조회 가능
- Coconut Battery / GPU-Z / CrystalDiskInfo / BatteryInfoView 무료 툴

→ 미뇨이 모달 안에서 "이 브랜드는 여기에 가서 이 화면 확인하세요" 즉시 노출. "구글링이 더 빠름" 비판 해소.

## 후속 wave

- **Wave C: bag** (별 세션에서 진행 중) — LV/Chanel/Gucci/Hermes
- **Wave E: 나머지** — watch/perfume/camera/drone/earphone/smartwatch/desktop/monitor/home_appliance

## 메모리 룰 준수

- ✅ `project_core_principle_consumer_friendly` — 전자제품은 일반인 대다수 사용 카테고리. "설정 > 일반 > 정보 > 부품 및 서비스 이력" 같은 정확한 화면 경로 명시. 전문 용어 (NAND 셀, 메인보드 패턴 등) 회피
- ✅ `feedback_decision_log_required` — 이 파일
- ✅ `feedback_ui_changes_apply_to_all_card_screens` — Wave A/B 와 동일 헬퍼라 자동
- ✅ `feedback_proceed_on_clear_wins` — 정보 깊이 보강은 명백한 win. 사전 confirm 없이 진행

## 위험

- **OS 버전 의존성** — iOS 16.4+ '부품 및 서비스 이력', One UI 7+ '부품 정보', macOS Sonoma+ '부품 및 서비스 이력' 모두 최근 OS 한정. 구 OS 매물은 이 변별 X. 사용자에게 "본인 판단 권장" 푸터 유지 (Wave A/B 와 동일).
- **galaxy- prefix 충돌** — `galaxy-s` (smartphone) vs `galaxy-tab-` (tablet) vs `galaxy-book-` (laptop) vs `galaxy-buds-` (earphone, Wave E 후속). 회귀 테스트로 cross-category leak 차단. 새 SKU 추가 시 prefix 충돌 주의 필요.
- **게이밍 노트북 broad keyword** — `rtx 4070`, `게이밍` 같은 broad keyword 는 일반 노트북에 GPU 옵션 매물 false positive 가능. 회피 위해 `asus rog`, `msi`, `alienware` 같은 라인 키워드 우선 + RTX 모델 키워드 추가.
- **Microsoft Surface / Lenovo ThinkPad — catalog 미등록** — keyword 매칭만 가능. catalog 등록 후속 wave 시 prefix 추가 필요.

## 다음

1. 사용자가 전자 매물 (특히 iPhone/Galaxy/MacBook) reveal 받아 brand 깊이 정보 확인 → 정확성 피드백 수집
2. 메뉴 경로 정확성 — iOS/Android/macOS 버전 업데이트에 따라 경로 변경 가능. 분기별 sweep 권장
3. Wave E (나머지) 착수 — earphone/smartwatch/camera (가품 거의 X but 정품 액세서리 짝퉁/리퍼 위험)
