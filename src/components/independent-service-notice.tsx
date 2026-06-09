// Wave 1234 (2026-06-09): 구글애즈 'Unacceptable Business Practices' 계정 정지 대응.
//   정책 핵심 = "사업/상품 정보를 숨기거나 속여 사용자를 오인시키기" (제휴 사칭 / 못 전달하는 상품 제공).
//   기존엔 비제휴·독립서비스 고지가 footer 10px + sr-only 에만 있어 사실상 묻혀 있었음.
//   → 비로그인 랜딩(=구글 크롤러/심사가 보는 메인 surface) 본문에 '보이는' 고지 strip 추가.
//   직접 판매/중개 안 함 + 제휴 없음 + 정보는 참고용을 명시해 제휴 오인·전달불가 오인을 정면 차단.
import { DISCLAIMER_TRADEMARK_SOURCE } from "@/lib/legal-disclaimers";

export default function IndependentServiceNotice() {
  return (
    <section
      aria-label="서비스 안내"
      className="mx-auto w-full max-w-[1380px] px-4 pb-9 pt-2 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-[12.5px] leading-[1.65] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 sm:px-5">
        <p>
          <b className="font-bold text-zinc-800 dark:text-zinc-200">
            득템잡이는 독립적인 중고 시세 분석·정보 서비스
          </b>
          입니다. 번개장터·중고나라·당근마켓 등 외부 플랫폼과{" "}
          <b className="font-bold text-zinc-800 dark:text-zinc-200">제휴 관계가 없으며</b>, 각
          플랫폼에 공개된 매물 정보를 분석해 같은 모델·같은 상태끼리 시세를 비교해드립니다.
        </p>
        <p className="mt-2">
          득템잡이는 매물을{" "}
          <b className="font-bold text-zinc-800 dark:text-zinc-200">
            직접 판매하거나 중개하지 않습니다.
          </b>{" "}
          실제 거래는 외부 플랫폼에서 이용자와 판매자 간에 이루어지며, 제공되는 시세·정보는 참고용으로
          매물의 진위나 거래 결과, 수익을 보장하지 않습니다. 최종 판단과 거래는 이용자 책임입니다.
        </p>
        <p className="mt-2">{DISCLAIMER_TRADEMARK_SOURCE}</p>
        <p className="mt-2 text-zinc-500 dark:text-zinc-500">
          상호 득템잡이 · 대표 이민제 · 사업자등록번호 563-62-00789 · 문의 mj12270411@gmail.com
        </p>
      </div>
    </section>
  );
}
