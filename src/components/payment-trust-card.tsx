"use client";

import Link from "next/link";
import { PAYMENT_ACCOUNT_HOLDER } from "@/lib/payment-account";

const BUSINESS_LOOKUP_URL = "https://moneypin.biz/bizno/detail/5636200789/";

export default function PaymentTrustCard() {
  return (
    <div className="rounded-[16px] border border-zinc-200 bg-white px-3.5 py-3 ring-1 ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-zinc-400">
            사업자 확인
          </div>
          <div className="mt-1 break-keep text-[13px] font-black text-zinc-950 dark:text-zinc-50">
            예금주와 사업자 상호가 같습니다.
          </div>
        </div>
        <a
          href={BUSINESS_LOOKUP_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full bg-[#ebf2ff] px-3 py-1.5 text-[11px] font-black text-[#3182f6] transition hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-200"
        >
          사업자 조회
        </a>
      </div>
      <div className="mt-3 grid grid-cols-[86px_1fr] gap-x-3 gap-y-1.5 text-[11.5px] font-bold leading-5">
        <div className="text-zinc-400">상호</div>
        <div className="text-zinc-800 dark:text-zinc-200">득템잡이</div>
        <div className="text-zinc-400">예금주</div>
        <div className="text-zinc-800 dark:text-zinc-200">
          {PAYMENT_ACCOUNT_HOLDER}
        </div>
        <div className="text-zinc-400">대표자</div>
        <div className="text-zinc-800 dark:text-zinc-200">이민제</div>
        <div className="text-zinc-400">사업자번호</div>
        <div className="font-black tabular-nums text-zinc-950 dark:text-zinc-50">
          563-62-00789
        </div>
        <div className="text-zinc-400">고객센터</div>
        <div className="text-zinc-800 dark:text-zinc-200">
          010-8168-5816 · mj12270411@gmail.com
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
          입금 계좌 실명 일치
        </span>
        <Link
          href="/refund-policy"
          className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          환불정책 보기
        </Link>
      </div>
    </div>
  );
}
