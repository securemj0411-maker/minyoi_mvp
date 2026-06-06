// 테이블 프리미티브 (서버-ok, 순수 마크업).
//   TH 는 scope="col" 자동. 반응형은 ResponsiveTable(모바일 카드 / 데스크탑 테이블, CSS only).
//   클릭 가능한 행은 ./RowButton 의 RowButton 사용(키보드/포커스 포함).

import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn, FONT, INK, SURFACE } from "./tokens";

function alignClass(align?: "left" | "right" | "center"): string {
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

export function Table({
  children,
  className,
  minWidth,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number | string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse", FONT.meta, className)}
        style={minWidth ? { minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children, sticky = true }: { children: ReactNode; sticky?: boolean }) {
  return <thead className={cn(sticky && "sticky top-0 z-10", SURFACE.cardSolid)}>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b", SURFACE.line, className)}>{children}</tr>;
}

export function TH({
  children,
  className,
  align,
  ...rest
}: { children?: ReactNode; align?: "left" | "right" | "center" } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-2.5 py-2 font-bold uppercase tracking-wider",
        FONT.meta,
        INK.muted,
        alignClass(align),
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align,
  ...rest
}: { children?: ReactNode; align?: "left" | "right" | "center" } & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-2.5 py-2 align-middle", FONT.meta, INK.secondary, alignClass(align), className)}
      {...rest}
    >
      {children}
    </td>
  );
}

/** 모바일=카드(md:hidden) / 데스크탑=테이블(hidden md:block). 손수짠 이중 레이아웃 통일. */
export function ResponsiveTable({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  return (
    <>
      <div className="space-y-2 md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  );
}
