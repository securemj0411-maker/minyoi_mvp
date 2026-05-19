# 2026-05-19 Wave 364 — 모달 nav 유기적 전환 (사진 → bar)

사용자 요청: "사진 밑으로 내려서 사진이 끝나면 ← 랑 홈아이콘 그 부분 네비게이션 바 생기고 유기적으로 가능?"

## 결정

**IntersectionObserver로 사진 visibility 추적 → 두 nav 전환**:

### (A) 사진 보임 → Floating icon
- `absolute top-3 left-3` + `text-white` + `drop-shadow`
- 카드/배경 X (icon only)
- 사진 위에 떠 있음

### (B) 사진 사라지면 → Sticky nav bar
- `absolute inset-x-0 top-0` + `bg-[#fffdf9]/95 backdrop-blur` + `border-b`
- zinc-900 icon (cream 배경에 잘 보임)
- hover 시 `bg-zinc-100` 원형 (탭 가능)
- 사이트 톤 (cream + zinc)

### 전환
- `transition-opacity duration-200`
- 둘 다 항상 mount, opacity로 전환 (DOM 일관성)
- `pointer-events-none` + `tabIndex` 토글로 안 보이는 쪽은 클릭/포커스 차단

## 구현

```ts
const photoRef = useRef<HTMLDivElement | null>(null);
const [photoVisible, setPhotoVisible] = useState(true);

useEffect(() => {
  if (!open || activeRevealPid == null) return;
  const photoEl = photoRef.current;
  const scrollEl = scrollAreaRef.current;
  if (!photoEl || !scrollEl) return;
  const observer = new IntersectionObserver(
    ([entry]) => setPhotoVisible(entry.isIntersecting),
    { root: scrollEl, threshold: 0.1 },
  );
  observer.observe(photoEl);
  return () => observer.disconnect();
}, [open, activeRevealPid]);
```

- `root: scrollEl` — scroll context는 scrollAreaRef
- `threshold: 0.1` — 사진 10% 이상 보이면 visible
- mount/unmount는 activeRevealPid (다른 매물 reveal 시 reset)

## 변경 파일

`src/components/pack-reveal-modal.tsx`:
- `photoRef` useRef 신설
- `photoVisible` useState (default true)
- IntersectionObserver useEffect
- `RevealCardItem`에 `photoRef?: React.RefObject<HTMLDivElement | null>` prop 추가
- `RevealProductImage` 외부 wrapper `<div ref={photoRef}>` 추가
- 첫 매물에만 `photoRef` 전달 (`idx === 0 ? photoRef : undefined`)
- floating nav: `opacity-100` / `opacity-0` photoVisible 따라
- sticky nav bar 신규 추가 (반대 opacity)
- 둘 다 `pointer-events-auto` on button, `none` on parent (보이지 않을 땐 button도 비활성)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗
- mount race: cleanup으로 안전 (observer.disconnect)

## 시각 흐름

```
스크롤 위치 0 ─────────── 사진 영역 끝
    사진 보임                사진 사라짐
    ↓                       ↓
  (A) 흰 icon              (B) cream bar
   drop-shadow              zinc icon
   사진 위 floating         border-b 구분
                            (사이트 톤)
```
