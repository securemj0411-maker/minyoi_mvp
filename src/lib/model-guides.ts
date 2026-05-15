export type ModelGuideSectionType =
  | "overview"
  | "option_axes"
  | "confusion_points"
  | "resell_checkpoints"
  | "our_filter_rules";

export type ModelGuideSection = {
  type: ModelGuideSectionType;
  title: string;
  items: string[];
};

export type ModelGuideSource = {
  sourceType: "official" | "trusted_editorial" | "internal_rule";
  label: string;
  url?: string;
  note?: string;
};

export type ModelGuideParserHints = {
  mustSplitAxes: string[];
  positiveSignals: string[];
  ambiguousSignals: string[];
  negativeSignals: string[];
  partsSignals: string[];
  manualReviewSignals: string[];
};

export type ModelGuide = {
  guideKey: string;
  // Wave 83: tablet/laptop/desktop/game_console/headphone/speaker/watch/sport_golf 추가
  category:
    | "earphone"
    | "smartwatch"
    | "tablet"
    | "laptop"
    | "desktop"
    | "game_console"
    | "headphone"
    | "speaker"
    | "watch"
    | "sport_golf"
    | "home_appliance"
    | "monitor"
    | "camera";
  family: string;
  model: string;
  variantScope?: string;
  title: string;
  summary: string;
  quickFacts: string[];
  parserHints: ModelGuideParserHints;
  sections: ModelGuideSection[];
  sources: ModelGuideSource[];
  match: {
    skuIds?: string[];
    comparableKeys?: string[];
    aliases?: string[];
    familyHints?: string[];
  };
};

export type ModelGuideLookupInput = {
  skuId?: string | null;
  comparableKey?: string | null;
  skuName?: string | null;
  name?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(haystack: string, needle: string) {
  if (!haystack || !needle) return false;
  return haystack.includes(needle);
}

export const MODEL_GUIDES: ModelGuide[] = [
  {
    guideKey: "guide:earphone:airpods-pro-2-usbc",
    category: "earphone",
    family: "airpods",
    model: "airpods_pro_2",
    variantScope: "usb-c-fullset",
    title: "AirPods Pro 2 USB-C 기준 공략",
    summary: "이 공략은 USB-C 축으로 분류된 프로 2를 볼 때 참고하는 가이드입니다. 유닛 단품, 케이스 단품, 라이트닝 축이 섞이면 시세가 바로 왜곡됩니다.",
    quickFacts: ["2세대", "USB-C 축", "노이즈 캔슬링 기본"],
    parserHints: {
      mustSplitAxes: ["connector", "fullset_vs_parts"],
      positiveSignals: ["usb-c", "usbc", "c타입", "프로 2", "pro 2"],
      ambiguousSignals: ["프로2", "에어팟 프로2", "본체"],
      negativeSignals: ["lightning", "8핀"],
      partsSignals: ["유닛", "왼쪽", "오른쪽", "케이스", "충전케이스"],
      manualReviewSignals: ["커넥터 미표기", "본체만", "세대 모순"],
    },
    match: {
      comparableKeys: ["airpods|airpods_pro_2|usbc"],
      aliases: ["airpods pro 2", "에어팟 프로 2", "에어팟프로2", "usb c", "usbc"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "AirPods Pro 2는 리셀 수요가 안정적인 편이지만, 커넥터와 구성품 혼동이 생기면 같은 상품끼리 비교가 깨집니다.",
          "지금 공략은 USB-C 본품 기준으로 보는 흐름을 전제로 합니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "USB-C / Lightning은 같은 이름처럼 보여도 다른 비교군입니다.",
          "본체 풀세트와 유닛 단품, 케이스 단품은 절대 섞지 않습니다.",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "제목에 프로 2만 있고 USB-C 여부가 빠진 매물은 주의합니다.",
          "왼쪽 유닛, 오른쪽 유닛, 충전 케이스만 따로 파는 글이 매우 자주 섞입니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "박스/이어팁/케이블 유무보다 먼저 본품 세트인지 확인합니다.",
          "생활기스보다 커넥터/세대 혼동이 수익 계산에 더 치명적입니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "유닛 단품, 케이스 단품, 부품성 키워드가 잡히면 추천 풀에서 제외합니다.",
          "커넥터가 불명확하면 내부 검토로 보내고 바로 추천하지 않습니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods 공식 제품 페이지", url: "https://www.apple.com/airpods-pro/" },
      { sourceType: "internal_rule", label: "option-parser AirPods connector rule" },
    ],
  },
  {
    guideKey: "guide:earphone:airpods-4-anc",
    category: "earphone",
    family: "airpods",
    model: "airpods_4",
    variantScope: "anc",
    title: "AirPods 4 ANC(노이즈 캔슬링) 기준 공략",
    summary: "이 공략은 AirPods 4 중 ANC(노이즈 캔슬링) 축으로 분류된 경우 참고하는 가이드입니다. 일반형과 섞이면 차익이 그럴듯해 보여도 잘못된 비교가 됩니다.",
    quickFacts: ["AirPods 4", "ANC(노이즈 캔슬링)", "USB-C 축"],
    parserHints: {
      mustSplitAxes: ["anc", "fullset_vs_parts"],
      positiveSignals: ["anc", "노캔", "노이즈 캔슬링", "에어팟4 anc"],
      ambiguousSignals: ["에어팟4", "airpods 4"],
      negativeSignals: ["non anc", "일반형", "노캔 없음"],
      partsSignals: ["본체", "유닛", "왼쪽", "오른쪽", "케이스"],
      manualReviewSignals: ["anc 미표기", "본체만", "단품"],
    },
    match: {
      comparableKeys: ["airpods|airpods_4|usbc|anc"],
      aliases: ["airpods 4 anc", "에어팟 4 anc", "에어팟4 anc", "노캔", "노이즈 캔슬링"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "AirPods 4는 같은 4세대 안에서도 ANC 유무에 따라 가격축이 갈립니다.",
          "리셀 초보가 가장 자주 헷갈리는 축이라 공략 문구를 꼭 같이 봐야 합니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "ANC(노이즈 캔슬링) / 일반형(non-ANC)",
          "본품 세트 / 케이스 단품 / 유닛 단품",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "판매자가 노캔이라고 쓰지 않았다고 해서 non-ANC로 단정하면 안 됩니다.",
          "반대로 AirPods 4라는 이름만 보고 ANC 모델처럼 계산하는 것도 위험합니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "ANC 여부가 불명확하면 바로 매입하지 말고 추가 사진/설명을 확인합니다.",
          "구성품보다 먼저 모델 축이 맞는지 확인하는 편이 수익 방어에 좋습니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "ANC 축을 못 잡으면 `unknown_anc`로 내부 검토에 보내고 바로 추천하지 않습니다.",
          "유닛/케이스 단품은 별도 parts 흐름으로 분리합니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods 4 공식 제품 페이지", url: "https://www.apple.com/airpods-4/" },
      { sourceType: "internal_rule", label: "option-parser AirPods 4 ANC rule" },
    ],
  },
  {
    guideKey: "guide:earphone:airpods-4-no-anc",
    category: "earphone",
    family: "airpods",
    model: "airpods_4",
    variantScope: "non-anc",
    title: "AirPods 4 일반형(non-ANC) 기준 공략",
    summary: "이 공략은 ANC 없는 일반형 축으로 분류된 AirPods 4를 볼 때 참고하는 가이드입니다. 같은 AirPods 4라도 ANC 모델과 섞이면 안 됩니다.",
    quickFacts: ["AirPods 4", "일반형(non-ANC)", "USB-C 축"],
    parserHints: {
      mustSplitAxes: ["anc", "fullset_vs_parts"],
      positiveSignals: ["non anc", "일반형", "노캔 없음", "에어팟4 일반형"],
      ambiguousSignals: ["에어팟4", "airpods 4"],
      negativeSignals: ["anc", "노캔", "노이즈 캔슬링"],
      partsSignals: ["본체", "유닛", "케이스", "왼쪽", "오른쪽"],
      manualReviewSignals: ["anc 미표기", "본체만", "단품"],
    },
    match: {
      comparableKeys: ["airpods|airpods_4|usbc|no_anc"],
      aliases: ["airpods 4 non anc", "에어팟 4 일반형", "에어팟4 일반형", "노캔 없음", "non anc"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "AirPods 4 기본형은 이름만 보면 ANC 모델과 매우 헷갈립니다.",
          "초기 리셀에서는 같은 세대 안 옵션 혼동이 가격 오판으로 바로 이어집니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: ["일반형(non-ANC) 여부", "본품 세트 여부"],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "판매글 제목에 AirPods 4만 있고 ANC 언급이 없으면 기본형과 ANC형이 섞일 수 있습니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "수익 계산 전에 ANC 여부를 먼저 고정합니다.",
          "노캔 없는 기본형을 ANC처럼 계산하면 과대 차익이 잡힙니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "ANC 여부가 모호하면 추천 풀 진입을 보류합니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods 4 공식 제품 페이지", url: "https://www.apple.com/airpods-4/" },
      { sourceType: "internal_rule", label: "option-parser AirPods 4 ANC split rule" },
    ],
  },
  {
    guideKey: "guide:earphone:airpods-max",
    category: "earphone",
    family: "airpods",
    model: "airpods_max",
    variantScope: "family",
    title: "AirPods Max 기준 공략",
    summary: "이 공략은 AirPods Max family를 볼 때 참고하는 가이드입니다. 세대/커넥터 혼동이 핵심이고, 라이트닝과 USB-C를 같은 시세 축처럼 보면 안 됩니다.",
    quickFacts: ["AirPods Max", "세대 구분", "커넥터 축 주의"],
    parserHints: {
      mustSplitAxes: ["connector", "generation"],
      positiveSignals: ["airpods max", "에어팟 맥스", "에어팟맥스"],
      ambiguousSignals: ["미개봉", "새상품", "스페이스 그레이"],
      negativeSignals: ["케이스만", "이어패드만"],
      partsSignals: ["이어패드", "케이블", "케이스"],
      manualReviewSignals: ["unknown_connector", "unknown_generation", "색상만 표기"],
    },
    match: {
      skuIds: ["airpods-max"],
      aliases: ["airpods max", "에어팟 맥스", "에어팟맥스"],
      comparableKeys: ["earphone|airpods_max"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "AirPods Max는 겉보기엔 단순하지만 세대와 커넥터 차이를 놓치기 쉽습니다.",
          "고가 모델이라 축이 한 번만 섞여도 차익 계산이 크게 흔들립니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: ["Lightning / USB-C", "세대 표현", "본품/이어패드/케이스 분리 여부"],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "**\"AirPods Max 2\" = USB-C 모델** (Apple 공식 명칭은 그냥 \"AirPods Max (USB-C)\"이지만 매물에선 \"2세대\"/\"Max 2\"로 자주 부름).",
          "**\"AirPods Max\" 또는 \"맥스 1세대\" = Lightning 모델** (2020-12 출시 원본).",
          "1세대 또는 2세대처럼 혼합 표현이 들어간 매물은 바로 확정하지 않습니다.",
          "케이스만, 이어패드만, 충전 케이블만 올라오는 부품성 매물이 많습니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "고가 모델일수록 세대/커넥터 축이 먼저고, 구성품은 그 다음입니다.",
          "상태가 좋아 보여도 세대가 흔들리면 과감하게 보수적으로 봅니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "세대가 `unknown_generation`이면 바로 추천하지 않습니다.",
          "커넥터가 불명확한 경우도 내부 검토로 돌립니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods Max 공식 제품 페이지", url: "https://www.apple.com/airpods-max/" },
      { sourceType: "internal_rule", label: "AirPods Max generation review gate" },
    ],
  },
  // Wave 127 (2026-05-16): airpods-max-usbc 별도 guide. 사용자 코멘트 (pid 384785809):
  // "맥스2랑 맥스랑 같은거임?" — 매물 표시 명확화 필요.
  {
    guideKey: "guide:earphone:airpods-max-usbc",
    category: "earphone",
    family: "airpods",
    model: "airpods_max_usbc",
    variantScope: "usbc-fullset",
    title: "AirPods Max (USB-C) = 매물 \"Max 2\" 동일 모델",
    summary: "AirPods Max USB-C 모델 (2024-09 출시, msrp ₩769,000). 매물에선 \"맥스 2\" / \"2세대\"로 자주 부르지만 Apple 공식은 \"AirPods Max (USB-C)\" 단일 명칭. Lightning 1세대 (2020-12)와 시세 다름 — 시세 축 분리 필수.",
    quickFacts: ["USB-C 모델", "= 매물 \"Max 2\"", "Lightning 1세대와 분리"],
    parserHints: {
      mustSplitAxes: ["connector"],
      positiveSignals: ["airpods max", "에어팟맥스", "usb-c", "usbc", "c타입", "타입c", "맥스 2", "맥스2"],
      ambiguousSignals: ["미개봉", "새상품", "2세대", "신형"],
      negativeSignals: ["라이트닝", "lightning", "8핀", "케이스만", "이어패드만"],
      partsSignals: ["이어패드", "케이블", "케이스"],
      manualReviewSignals: ["unknown_connector"],
    },
    match: {
      skuIds: ["airpods-max-usbc"],
      aliases: ["airpods max usb-c", "에어팟 맥스 usb-c", "에어팟맥스 c타입", "맥스 2", "맥스2"],
      comparableKeys: ["earphone|airpods_max_usbc", "earphone|airpods_max|usbc"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "**Apple 공식 명칭은 \"AirPods Max (USB-C)\".** 매물에선 \"맥스 2\" / \"2세대\"로 부르는 경우 많음 — 같은 모델임.",
          "2024-09 출시. msrp ₩769,000 (Lightning 1세대 ₩712,000보다 약간 높음).",
          "헤드폰 자체 변화 거의 없음 (스타터 동일, 케이블만 USB-C 변경 + 색상 옵션 변경).",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "**USB-C 명시** (\"C타입\" / \"usbc\" / \"맥스 2\") = 이 모델.",
          "**라이트닝 명시** = 별도 모델 (airpods-max), 시세 축 다름.",
          "**미개봉/새상품/풀박스** — 가격대 다름.",
        ],
      },
      {
        type: "confusion_points",
        title: "사용자가 자주 헷갈리는 포인트",
        items: [
          "\"**Max 2**\" 매물 = USB-C 모델 (별도 hardware 아니라 커넥터 변경 + 색상).",
          "\"**Max 2세대**\" = 같은 USB-C 모델 (Apple 공식 \"2세대\" 표시 X but 매물 셀러 부름).",
          "Lightning vs USB-C 가격 차이 ~₩100K (USB-C가 더 높음, 신형).",
          "색상 신규 (\"스타라이트\", \"미드나이트\" 등) = USB-C 모델만 있음.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "USB-C/C타입/맥스 2 명시 매물만 이 lane.",
          "라이트닝 매물 섞이면 시세 왜곡 큼 — 셀러에게 확인 필수.",
          "새 색상 (스카이 블루, 오렌지, 퍼플, 미드나이트, 스타라이트)이면 USB-C 거의 확정.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "USB-C/C타입/맥스 2 명시 매물만 흡수 (mustContain group).",
          "라이트닝 명시 매물은 별도 lane (airpods-max).",
          "단순 \"에어팟 맥스\" 단독 (커넥터 미명시)는 broad airpods-max로 흐름 (Lightning 1세대 가정).",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods Max (USB-C) 공식 페이지", url: "https://www.apple.com/airpods-max/" },
      { sourceType: "internal_rule", label: "airpods-max-usbc mustContain USB-C 강제" },
    ],
  },
  {
    guideKey: "guide:earphone:airpods-pro-2-lightning",
    category: "earphone",
    family: "airpods",
    model: "airpods_pro_2",
    variantScope: "lightning-fullset",
    title: "AirPods Pro 2 라이트닝(8핀) 축 공략",
    summary: "이 공략은 라이트닝(8핀) 축으로 분류된 프로 2를 볼 때 참고하는 가이드입니다. USB-C 세대처럼 보여도 다른 가격축으로 봐야 하고, 본체 풀세트인지도 같이 확인해야 합니다.",
    quickFacts: ["2세대", "라이트닝(8핀) 축", "본품 세트 우선"],
    parserHints: {
      mustSplitAxes: ["connector", "fullset_vs_parts"],
      positiveSignals: ["lightning", "8핀", "라이트닝", "프로 2", "pro 2"],
      ambiguousSignals: ["프로2", "에어팟 프로2", "본체"],
      negativeSignals: ["usb-c", "c타입", "usbc"],
      partsSignals: ["유닛", "케이스", "충전케이스", "왼쪽", "오른쪽"],
      manualReviewSignals: ["커넥터 미표기", "본체만", "세대 모순"],
    },
    match: {
      comparableKeys: ["airpods|airpods_pro_2|lightning"],
      aliases: ["airpods pro 2 8핀", "airpods pro 2 lightning", "에어팟 프로 2 8핀", "에어팟 프로 2 라이트닝", "에어팟프로2 8핀"],
      familyHints: ["airpods"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "같은 프로 2라도 Lightning과 USB-C는 서로 다른 시세 축입니다.",
          "특히 중고 제목에서 커넥터를 생략하는 경우가 많아, 표면상 모델명만 믿으면 과대 차익이 잡히기 쉽습니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "Lightning / USB-C",
          "본품 세트 / 유닛 단품 / 케이스 단품",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "‘프로2’만 크게 써두고 커넥터를 숨긴 매물은 꼭 추가 사진을 확인합니다.",
          "충전케이스만 올라온 글이 제목상으론 본품처럼 보일 수 있습니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "커넥터부터 고정한 뒤 구성품과 상태를 봅니다.",
          "박스 유무보다 본품 세트 여부와 커넥터 축이 수익 계산에 더 중요합니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "커넥터가 빠진 프로 2는 내부 검토 없이 바로 추천하지 않습니다.",
          "본체/유닛/케이스 혼합 표현이 보이면 parts 흐름으로 제외합니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods Pro 공식 제품 페이지", url: "https://www.apple.com/airpods-pro/" },
      { sourceType: "internal_rule", label: "airpods_pro2_connector_missing hold rule" },
    ],
  },
  {
    guideKey: "guide:smartwatch:apple-watch-ultra-2",
    category: "smartwatch",
    family: "applewatch",
    model: "applewatch_ultra_2",
    variantScope: "ultra-2",
    title: "Apple Watch Ultra 2 공략",
    summary: "Ultra 라인은 이름이 강해서 쉬워 보이지만, 시리즈/SE와 섞이지 않게 먼저 선을 그어야 합니다.",
    quickFacts: ["Ultra 2", "49mm", "Cellular 계열"],
    parserHints: {
      mustSplitAxes: ["family", "size", "connectivity"],
      positiveSignals: ["ultra 2", "울트라 2", "49mm"],
      ambiguousSignals: ["애플워치", "ultra"],
      negativeSignals: ["se", "series"],
      partsSignals: ["스트랩", "밴드", "충전기"],
      manualReviewSignals: ["size 미표기", "라인 혼합", "본체 아닌 액세서리 중심"],
    },
    match: {
      aliases: ["apple watch ultra 2", "애플워치 울트라 2", "애플워치 울트라2"],
      familyHints: ["apple watch", "애플워치"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Apple Watch Ultra 2는 일반 시리즈/SE와 다른 가격축으로 봐야 하는 상위 라인입니다.",
          "같은 Apple Watch라는 이유만으로 섞이면 차익이 과장됩니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: ["Ultra 라인 여부", "크기", "셀룰러 계열 여부"],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "스트랩/밴드 포함 여부는 보조 가치일 뿐 본체 라인 혼동보다 중요하지 않습니다.",
          "일반 시리즈와 같은 범주로 비교하면 안 됩니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "본체 모델군을 먼저 고정하고, 그 다음 상태와 구성품을 봅니다.",
          "스트랩 몇 개 더 준다는 문구보다 본체 모델 정확도가 훨씬 중요합니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "밴드만, 충전기만, 케이스만은 추천 풀에서 제외합니다.",
          "같은 Apple Watch여도 Ultra/Series/SE가 섞이면 공개하지 않습니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple Watch Ultra 2 공식 제품 페이지", url: "https://www.apple.com/apple-watch-ultra-2/" },
      { sourceType: "internal_rule", label: "smartwatch option parser / readiness rules" },
    ],
  },
  {
    guideKey: "guide:smartwatch:apple-watch-se",
    category: "smartwatch",
    family: "applewatch",
    model: "applewatch_se",
    variantScope: "se",
    title: "Apple Watch SE 공략",
    summary: "SE는 세대와 사이즈가 자주 섞입니다. 겉보기엔 비슷해도 세대가 다르면 시세가 다릅니다.",
    quickFacts: ["SE", "세대 주의", "사이즈 확인"],
    parserHints: {
      mustSplitAxes: ["generation", "size", "connectivity"],
      positiveSignals: ["watch se", "애플워치 se", "애플워치se"],
      ambiguousSignals: ["애플워치", "se"],
      negativeSignals: ["ultra", "series 10", "series 9"],
      partsSignals: ["스트랩", "밴드", "충전기"],
      manualReviewSignals: ["세대 미표기", "사이즈 미표기", "gps/cellular 미표기"],
    },
    match: {
      aliases: ["apple watch se", "애플워치 se", "애플워치se"],
      familyHints: ["apple watch", "애플워치"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Apple Watch SE는 입문형이라 거래량이 많지만, 그만큼 혼합 노이즈도 많습니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: ["SE 세대", "사이즈", "GPS / Cellular"],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "SE라는 이름만 보고 세대를 건너뛰면 차익 계산이 흔들립니다.",
          "41/45 같은 시리즈 축과 헷갈리기 쉬워서 제목만 믿으면 위험합니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "먼저 SE 몇 세대인지 확인합니다.",
          "그다음 사이즈와 연결 축을 고정합니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "세대/사이즈가 불명확하면 내부 검토로 보내고 바로 추천하지 않습니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple Watch SE 공식 제품 페이지", url: "https://www.apple.com/apple-watch-se/" },
      { sourceType: "internal_rule", label: "smartwatch SE generation parser rule" },
    ],
  },
  {
    guideKey: "guide:smartwatch:apple-watch-series",
    category: "smartwatch",
    family: "applewatch",
    model: "applewatch_series",
    variantScope: "series",
    title: "Apple Watch Series 공략",
    summary: "Apple Watch 일반 Series 라인은 세대, 사이즈, GPS/Cellular 축이 동시에 섞이기 쉽습니다. 같은 Apple Watch라도 SE/Ultra와는 따로 봐야 합니다.",
    quickFacts: ["Series", "사이즈 구분", "GPS/Cellular"],
    parserHints: {
      mustSplitAxes: ["generation", "size", "connectivity"],
      positiveSignals: ["series", "시리즈", "s10", "s9", "series 10", "series 9"],
      ambiguousSignals: ["애플워치", "apple watch"],
      negativeSignals: ["ultra", "se"],
      partsSignals: ["스트랩", "밴드", "충전기"],
      manualReviewSignals: ["세대 미표기", "사이즈 미표기", "gps/cellular 미표기"],
    },
    match: {
      aliases: ["apple watch series", "애플워치 series", "애플워치 시리즈", "애플워치 s10", "애플워치 s9", "apple watch s10", "apple watch s9"],
      familyHints: ["apple watch", "애플워치"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Apple Watch Series는 거래량이 많아서 차익 기회도 있지만, 그만큼 세대/사이즈 혼합 노이즈도 큽니다.",
          "겉보기엔 비슷해도 SE나 Ultra와는 완전히 다른 가격축으로 봐야 합니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "Series 세대",
          "41mm / 45mm 또는 세대별 크기 축",
          "GPS / Cellular",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "스트랩 이름이나 색상에 시선이 끌리면 본체 세대를 놓치기 쉽습니다.",
          "제목에 ‘애플워치 시리즈’만 적고 세대를 생략한 글은 보수적으로 봐야 합니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "먼저 Series 몇 세대인지, 그 다음 크기와 Cellular 여부를 고정합니다.",
          "스트랩 구성보다 본체 세대/사이즈 정확도가 수익 계산에 훨씬 중요합니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "세대, 사이즈, 연결 축이 하나라도 빠지면 내부 검토로 보냅니다.",
          "SE/Ultra/Series가 섞이는 표현은 공개 추천으로 바로 올리지 않습니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Apple Watch 공식 제품 페이지", url: "https://www.apple.com/apple-watch-series-10/" },
      { sourceType: "internal_rule", label: "smartwatch size/connectivity parser rules" },
    ],
  },
  {
    guideKey: "guide:smartwatch:galaxy-watch-7",
    category: "smartwatch",
    family: "galaxywatch",
    model: "galaxywatch_7",
    variantScope: "watch-7",
    title: "Galaxy Watch 7 공략",
    summary: "Galaxy Watch는 크기와 Bluetooth/LTE 축이 가장 중요합니다. 같은 세대라도 40mm, 44mm, LTE가 섞이면 바로 다른 비교군입니다.",
    quickFacts: ["Watch 7", "40/44mm", "Bluetooth/LTE"],
    parserHints: {
      mustSplitAxes: ["size", "connectivity", "classic_boundary"],
      positiveSignals: ["watch 7", "워치7", "44mm", "40mm", "bluetooth", "lte"],
      ambiguousSignals: ["갤럭시 워치", "galaxy watch"],
      negativeSignals: ["ultra", "classic"],
      partsSignals: ["스트랩", "밴드", "충전기"],
      manualReviewSignals: ["size 미표기", "bluetooth/lte 미표기", "클래식 혼합"],
    },
    match: {
      aliases: ["galaxy watch 7", "갤럭시 워치7", "갤럭시워치7"],
      familyHints: ["galaxy watch", "갤럭시 워치", "갤럭시워치"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Galaxy Watch 7은 크기와 연결 방식만 섞이지 않아도 비교 정확도가 훨씬 좋아집니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: ["40mm / 44mm", "Bluetooth / LTE", "일반형 / Classic 구분"],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "워치7과 워치 클래식을 같은 축처럼 보면 안 됩니다.",
          "44mm Bluetooth와 44mm LTE도 따로 보는 게 맞습니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "사이즈와 LTE 여부를 먼저 고정하고, 그 다음 상태를 봅니다.",
          "충전기/스트랩 포함은 보조 가치로만 봅니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "사이즈/연결 축이 불명확하면 ready 풀에 올리지 않습니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Samsung Galaxy Watch 7 공식 제품 페이지", url: "https://www.samsung.com/global/galaxy/galaxy-watch7/" },
      { sourceType: "internal_rule", label: "smartwatch size/connectivity parser rules" },
    ],
  },
  {
    guideKey: "guide:smartwatch:galaxy-watch-ultra",
    category: "smartwatch",
    family: "galaxywatch",
    model: "galaxywatch_ultra",
    variantScope: "ultra",
    title: "Galaxy Watch Ultra 공략",
    summary: "Galaxy Watch Ultra는 일반 Watch 7보다 가격대가 훨씬 높습니다. 같은 Galaxy Watch라는 이유로 40/44mm 일반형과 섞으면 안 됩니다.",
    quickFacts: ["Watch Ultra", "상위 라인", "일반형과 분리"],
    parserHints: {
      mustSplitAxes: ["family", "connectivity"],
      positiveSignals: ["watch ultra", "워치 울트라", "워치울트라"],
      ambiguousSignals: ["갤럭시 워치", "galaxy watch"],
      negativeSignals: ["watch 7", "40mm", "44mm", "classic"],
      partsSignals: ["스트랩", "밴드", "충전기"],
      manualReviewSignals: ["ultra 일반형 혼합", "본체 아닌 액세서리 중심"],
    },
    match: {
      aliases: ["galaxy watch ultra", "갤럭시 워치 울트라", "갤럭시워치 울트라", "갤럭시 워치울트라"],
      familyHints: ["galaxy watch", "갤럭시 워치", "갤럭시워치"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Galaxy Watch Ultra는 이름 자체가 강하지만, 실제 중고 제목에선 일반 Watch 7과 섞여 보일 수 있습니다.",
          "상위 라인이라 가격축이 따로 움직이고, 밴드 구성보다 본체 라인 구분이 먼저입니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "Ultra 라인 여부",
          "Bluetooth / LTE 표기",
          "본체 / 스트랩 / 충전기 분리 여부",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "‘갤럭시 워치 울트라’ 제목에 밴드 키워드가 크게 들어가면 본체 라인보다 액세서리에 눈이 갈 수 있습니다.",
          "일반 Watch 7과 같은 Galaxy Watch 축으로 합치면 차익이 과장됩니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "먼저 Ultra 본체가 맞는지 고정하고, 그 다음 상태와 구성품을 봅니다.",
          "스트랩 추가 구성은 보조 가치로만 봅니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "본체보다 스트랩/액세서리 중심 매물은 제외합니다.",
          "Ultra와 일반형 혼합 가능성이 있으면 공개 추천보다 내부 검토를 우선합니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Samsung Galaxy Watch Ultra 공식 제품 페이지", url: "https://www.samsung.com/global/galaxy/galaxy-watch-ultra/" },
      { sourceType: "internal_rule", label: "smartwatch family boundary rule" },
    ],
  },
  {
    guideKey: "guide:earphone:galaxy-buds3-pro",
    category: "earphone",
    family: "galaxybuds",
    model: "galaxy_buds3_pro",
    variantScope: "pro",
    title: "Galaxy Buds3 Pro 공략",
    summary: "Galaxy Buds 계열은 본체 세트, 유닛 단품, 케이스 단품 혼합이 심합니다. Buds3 Pro는 일반 Buds3와도 따로 봐야 합니다.",
    quickFacts: ["Buds3 Pro", "일반형과 분리", "단품 혼합 주의"],
    parserHints: {
      mustSplitAxes: ["family", "fullset_vs_parts"],
      positiveSignals: ["buds3 pro", "버즈3 프로", "갤럭시 버즈3 프로"],
      ambiguousSignals: ["버즈3", "갤럭시 버즈"],
      negativeSignals: ["일반 buds3", "fe"],
      partsSignals: ["유닛", "왼쪽", "오른쪽", "케이스", "충전케이스", "본체"],
      manualReviewSignals: ["pro 여부 미표기", "본체 표현 모호", "단품 의심"],
    },
    match: {
      aliases: ["galaxy buds3 pro", "갤럭시 버즈3 프로", "갤럭시버즈3 프로", "버즈3 프로"],
      familyHints: ["galaxy buds", "갤럭시 버즈", "갤럭시버즈"],
    },
    sections: [
      {
        type: "overview",
        title: "모델 개요",
        items: [
          "Galaxy Buds3 Pro는 같은 버즈 계열 안에서도 일반형과 가격축이 다릅니다.",
          "이어폰 카테고리는 유닛/케이스 단품 노이즈가 많아서, 모델명보다 구성 확인이 더 중요해질 때가 많습니다.",
        ],
      },
      {
        type: "option_axes",
        title: "같이 봐야 하는 옵션 축",
        items: [
          "Buds3 Pro / 일반 Buds3",
          "본품 세트 / 충전 케이스 단품 / 좌우 유닛 단품",
        ],
      },
      {
        type: "confusion_points",
        title: "자주 헷갈리는 포인트",
        items: [
          "‘본체’라는 말이 충전 케이스를 뜻하는지, 이어버드 세트를 뜻하는지 불명확한 경우가 많습니다.",
          "버즈3와 버즈3 Pro를 같은 모델처럼 계산하면 차익이 과장됩니다.",
        ],
      },
      {
        type: "resell_checkpoints",
        title: "리셀 체크포인트",
        items: [
          "Pro 여부보다 먼저 전체 본품인지 확인하고, 그 다음 일반형과 분리합니다.",
          "이어버드 양쪽이 다 있는지와 충전 케이스 포함 여부를 꼭 확인합니다.",
        ],
      },
      {
        type: "our_filter_rules",
        title: "우리 시스템 기준",
        items: [
          "좌/우 유닛 단품, 충전 케이스 단품, 혼합 부품성 매물은 공개 추천에서 제외합니다.",
          "일반 Buds3와 Pro가 섞일 수 있는 표현은 내부 검토 우선입니다.",
        ],
      },
    ],
    sources: [
      { sourceType: "official", label: "Samsung Galaxy Buds3 Pro 공식 제품 페이지", url: "https://www.samsung.com/global/galaxy/galaxy-buds3-pro/" },
      { sourceType: "internal_rule", label: "earphone parts/accessory exclusion rules" },
    ],
  },

  // Wave 83 batch 1 — tablet / laptop / desktop (research-backed via parallel agents 2026-05-14)
  {
    guideKey: "guide:tablet:ipad-pro",
    category: "tablet",
    family: "ipad",
    model: "ipad_pro",
    title: "iPad Pro 기준 공략",
    summary: "iPad Pro는 칩(M2/M4) + 사이즈(11/13) + 용량(128~2TB) + Wi-Fi/셀룰러 4축이 시세를 결정. 세대 번호(11=4세대/5세대, 12.9=6세대/13=7세대) 매핑이 까다로워 매물 표기가 자주 어긋남.",
    quickFacts: ["M2 (2022) / M4 (2024)", "11 / 13 (구 12.9)", "8GB(256/512) vs 16GB(1TB+) RAM", "Pencil Pro(M4) vs Pencil 2(M2)"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "storage_gb", "connectivity"],
      positiveSignals: ["m2", "m4", "11인치", "13인치", "12.9인치", "와이파이", "wifi", "셀룰러", "cellular", "4세대", "5세대", "6세대", "7세대"],
      ambiguousSignals: ["아이패드 프로", "ipad pro", "아이패드프로", "최신"],
      negativeSignals: ["미니", "에어", "(m1)", " m1 "],
      partsSignals: ["펜슬만", "애플펜슬만", "키보드만", "매직키보드만", "케이스만", "충전기만", "액정만", "배터리만"],
      manualReviewSignals: ["용량 미표기", "세대 미표기", "5g", "lte", "유심", "missing_wifi_context"],
    },
    match: {
      skuIds: ["ipad-pro", "ipad-pro-11-m4-256-wifi", "ipad-pro-13-m4-256-wifi", "ipad-pro-11-m2-256-wifi", "ipad-pro-13-m2-256-wifi"],
      aliases: ["아이패드 프로", "ipad pro", "아이패드프로", "ipadpro"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "활성 세대: M4 (2024.5, Pencil Pro+USB-C), M2 (2022, Pencil 2). M5 (2025.10)는 출시 6개월 이내라 매물 매우 적음.",
        "M4 11/13인치 + M2 11/12.9인치가 Bunjang 주력. M1 (3세대 11/5세대 12.9, 2021)은 별도 시세군.",
        "RAM은 용량 tier로 자동 결정: 256/512GB = 8GB, 1TB+ = 16GB (M4 기준). 사용자 선택 옵션 아님.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 세대 (M5 > M4 > M2 > M1): 세대당 30~40만원 격차 (M4 11/256 ~110만 vs M2 11/256 ~75만).",
        "화면 사이즈 (11 vs 13/12.9): 35~50만원 차이.",
        "저장 (128/256/512/1TB/2TB): 단계당 15~25만원.",
        "Wi-Fi vs Wi-Fi+Cellular: Cellular가 15~20만원 비쌈.",
        "Apple Pencil 호환성: M4/M5 = Pencil Pro + Pencil(USB-C), M2/M1 = Pencil 2 + Pencil(USB-C). 끼워팔이 시 호환 검증.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "사이즈 명칭 변화: M2까지는 \"12.9인치\", M4부터 \"13인치\" (실측 동일). 둘 다 검색해야 정합.",
        "세대 번호 ↔ 칩 매핑 11인치: 3세대=M1, 4세대=M2, 5세대=M4, 7세대=M5 (6세대 없음).",
        "세대 번호 ↔ 칩 매핑 12.9/13인치: 5세대=M1, 6세대=M2, 7세대=M4, 8세대=M5.",
        "M2 vs M4 표기 누락 매물: \"최신\"이라고만 적힌 매물 detail 검증 필수.",
        "12.9 5세대 (M1) ≠ 12.9 6세대 (M2). 4세대 12.9 (A12Z 2020)는 또 다른 세대.",
        "silent_cellular_risk: 셀룰러 명시 없이 \"5G/LTE/유심\" 키워드 등장 시 review.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 효율 + 액정 상태 + Apple Care 잔여 = 본품 가치 영향.",
        "정품 액세서리 (펜슬 Pro, Magic Keyboard, Smart Folio) 포함 시 별도 가산 — 매물 가격과 본품 단독가 분리 평가.",
        "\"펜슬 포함\" 매물에서 펜슬 세대 호환성 검증 (예: M4 + Pencil 2는 불호환).",
        "USB-C 케이블, 충전기, 매뉴얼, 박스 풀구성은 +1~3만원 정도.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 칩 + 사이즈 + 256GB + Wi-Fi 4축 명시 매물만 진입 (현재 4 lane: 11/13인치 × M2/M4 × 256GB Wi-Fi).",
        "broad ipad-pro는 narrow 흡수 안 된 매물 전체 흡수 — 시세 학습용, 사용자 노출 안 함.",
        "wrong-generation guard: M2 lane mustNotContain에 \"(m1)\" 박혀 잘못된 칩 매물 거름.",
        "케이스/펜슬/키보드/충전기 단품은 parts 분류로 reject.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad Pro 공식 specs (현행 M5)", url: "https://www.apple.com/kr/ipad-pro/specs/" },
      { sourceType: "official", label: "Apple Support iPad Pro 11(4세대) M2", url: "https://support.apple.com/ko-kr/111842" },
      { sourceType: "official", label: "Apple Support iPad Pro 12.9(6세대) M2", url: "https://support.apple.com/ko-kr/111841" },
      { sourceType: "official", label: "Apple Support iPad Pro M4 (2024)", url: "https://support.apple.com/ko-kr/119892" },
      { sourceType: "internal_rule", label: "ipad option-parser chip/screen/storage axis rules + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:tablet:ipad-air",
    category: "tablet",
    family: "ipad",
    model: "ipad_air",
    title: "iPad Air 기준 공략",
    summary: "iPad Air는 M2(2024)/M3(2025) + 11/13인치 + 128~1TB 저장 + Wi-Fi/셀룰러 4축. 2024년 처음 11/13 사이즈 분리, 그 전 (M1까지)은 10.9인치 단독. 구세대(M1/A14)와 절대 비교 금지.",
    quickFacts: ["M2 (6세대) / M3 (7세대)", "11 / 13인치 (2024~)", "8GB RAM 고정", "Pencil Pro + Pencil(USB-C)"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "storage_gb", "connectivity"],
      positiveSignals: ["m2", "m3", "m4", "11인치", "13인치", "와이파이", "wifi", "셀룰러", "cellular", "6세대", "7세대"],
      ambiguousSignals: ["아이패드 에어", "ipad air", "아이패드에어"],
      negativeSignals: ["프로", "미니", "(m1)", " m1 ", "10.9", "a14", "5세대", "4세대"],
      partsSignals: ["펜슬만", "케이스만", "키보드만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "용량 미표기", "사이즈 미표기", "5g", "lte", "유심", "missing_11in_context"],
    },
    match: {
      skuIds: ["ipad-air", "ipad-air-m2-11-256-wifi", "ipad-air-m3-11-256-wifi"],
      aliases: ["아이패드 에어", "ipad air", "아이패드에어", "ipadair"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "M2 (2024.5, 6세대) + M3 (2025.3, 7세대)가 현재 주력. M4 Air (2026.3)는 최신이라 매물 거의 없음.",
        "Air 라인은 2024년 (M2)부터 11/13 사이즈 분리. 그 전 M1 (5세대, 2022)까지는 10.9인치 단독.",
        "Pro와 달리 RAM 고정 (M2/M3 = 8GB). 사용자 선택 옵션 없음.",
        "Apple Pencil 호환: Pencil Pro + Pencil(USB-C) + Pencil 2 — Pro만 인정하는 줄 알았는데 M2/M3/M4 Air는 셋 다 호환.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 세대 (M3 > M2 > M1): 세대당 10~15만원 (Pro보다 격차 작음).",
        "화면 사이즈 (11 vs 13): 15~25만원 차이.",
        "저장 용량 (128/256/512/1TB): 단계당 10~15만원. Air는 1TB까지, 2TB 옵션 없음.",
        "Wi-Fi vs Cellular: 15만원 cellular 비쌈.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "세대 ↔ 칩: 5세대 = M1 (2022, 10.9), 6세대 = M2 (2024, 11/13), 7세대 = M3 (2025, 11/13).",
        "\"에어 4세대\" (2020, A14) 매물은 절대 narrow lane 진입 금지 — 시세 절반 수준의 구세대.",
        "13인치 \"에어\"가 \"프로 13\"으로 잘못 분류되지 않게 mustNotContain \"에어\" 필수 (catalog 박혀 있음).",
        "silent_cellular_risk: \"에어 11 M3 256GB\" 단독이면 Wi-Fi/Cellular 미상 → review. sample에서 4건 detail에서 cellular 발견.",
        "missing_11in_context: title에 \"11\" 없고 description에만 있는 경우 review (13인치 매물 잘못 흡수 방지).",
        "\"에어 + 펜슬 1\" 매물 = Pencil 1은 iPad 10세대 전용. 끼워팔이 또는 비호환 의심.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 효율 + 액정 무파손 + Apple Care 잔여 = 풀시세.",
        "정품 박스 풀구성 + Pencil Pro 또는 Magic Keyboard 포함 시 +5~10만원.",
        "M2 lane 실측 시세: median 89만원 (range 78~120만원, 2026-05-13 검증).",
        "M3는 출시 1년차 — 시세 방어 강함, 매물 회전 안정.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 11인치 + 256GB + Wi-Fi 명시 매물만 (M2/M3 각 1 lane).",
        "13인치, 128GB, 512GB는 broad ipad-air로 흡수 — 시세 학습만, 사용자 노출 안 함.",
        "M3 lane mustNotContain: \"(m1)\", \"(m2)\", \"(m4)\", \" m1 \", \" m2 \", \" m4 \" 박힘.",
        "구세대 (4/5세대 A14/M1)은 narrow 진입 자동 차단.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad Air 공식 specs (현행 M4)", url: "https://www.apple.com/kr/ipad-air/specs/" },
      { sourceType: "official", label: "Apple Support iPad Air M2", url: "https://support.apple.com/ko-kr/119891" },
      { sourceType: "internal_rule", label: "ipad-air narrow lane disambiguation + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:tablet:ipad-mini",
    category: "tablet",
    family: "ipad",
    model: "ipad_mini",
    title: "iPad Mini 기준 공략",
    summary: "iPad mini는 6세대(A15, 2021)와 7세대(A17 Pro, 2024.11) 두 활성 갈래. 8.3인치 단일 사이즈에 외관 거의 동일이라 세대 혼동이 가장 큰 함정 — 시세 격차 ~25만원.",
    quickFacts: ["mini 7 = A17 Pro (2024.11)", "mini 6 = A15 (2021)", "8.3인치 단일", "Pencil 호환성 mini 6/7 다름"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "storage_gb", "connectivity"],
      positiveSignals: ["a17 pro", "a17", "7세대", "7 세대", "a15", "6세대", "와이파이", "wifi", "셀룰러", "cellular", "미니 7", "미니7", "미니 6"],
      ambiguousSignals: ["아이패드 미니", "ipad mini", "아이패드미니"],
      negativeSignals: ["에어", "프로", "5세대", "4세대"],
      partsSignals: ["케이스만", "충전기만", "펜슬만"],
      manualReviewSignals: ["세대 미표기", "5g", "lte", "유심"],
    },
    match: {
      skuIds: ["ipad-mini", "ipad-mini-7-128-wifi"],
      aliases: ["아이패드 미니", "ipad mini", "아이패드미니", "ipadmini"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "mini 7 (2024.11, A17 Pro, 128/256/512GB) = 현재 신상. Apple Intelligence 지원 — mini 라인 처음.",
        "mini 6 (2021, A15, 64/256GB) = 단종됐지만 Bunjang 매물 많음. Apple Intelligence 미지원.",
        "8.3인치 Liquid Retina, USB-C 단일 폼팩터. 외관으로 세대 분별 불가 — 텍스트로만 판별.",
        "색상: mini 7 (Blue/Purple/Starlight/Space Grey), mini 6 (Space Grey/Pink/Purple/Starlight).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (mini 7 vs mini 6): 25~30만원 격차 (A17 Pro + Apple Intelligence + USB-C 3.1 Gen 2).",
        "저장 용량 (mini 7: 128/256/512, mini 6: 64/256): 단계당 ~10만원.",
        "Wi-Fi vs Cellular: 15만원 cellular 비쌈.",
        "색상: 시세 영향 거의 0 (Purple/Blue 약간 인기).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "mini 6 vs mini 7 외관 완전 동일 — chip 명시 (A17 Pro / A15) 또는 세대 번호 명시만 신뢰.",
        "Apple Pencil 호환성 변경: mini 7 = Pencil Pro + Pencil(USB-C). Pencil 2 불호환.",
        "mini 6 = Pencil 2 + Pencil(USB-C). Pencil Pro 불호환.",
        "\"미니 7 + 펜슬 2\" 매물 = 펜슬 불호환 (안 붙음) — 끼워팔이 의심.",
        "\"미니 6 + 펜슬 프로\" 매물 = 마찬가지로 불호환.",
        "구세대 mini 5 (A12, 7.9인치) / mini 4 (A8, 7.9인치) 등은 외관 다름 (7.9인치, home button) — narrow 진입 자동 차단.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "휴대성 좋아 회전 빠른 편 (sold ≤7d 비율 높음).",
        "정품 박스 풀구성 + Apple Care 잔여 = 풀시세 +5~10만원.",
        "외장 무파손 + 액정 깨끗 = 시세 안정.",
        "출시 직후 (mini 7, 2024.11+) 미개봉 매물은 정가 근접.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 mini 7 + 128GB + Wi-Fi 명시만 (현재 1 lane).",
        "mini 7 lane mustNotContain: \"미니 6\", \"mini 6\", \"6세대\" — mini 6 격리.",
        "broad ipad-mini는 6/7세대 모두 흡수하되 사용자 노출 안 함 (시세 학습용).",
        "8.3인치는 catalog에 미박힘 — option-parser default 8.3in 처리.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad mini 공식 specs (현행 7세대)", url: "https://www.apple.com/kr/ipad-mini/specs/" },
      { sourceType: "official", label: "Apple Support iPad mini 6 (단종)", url: "https://support.apple.com/en-us/111972" },
      { sourceType: "internal_rule", label: "ipad-mini A17 Pro detection + Wave 83 verified" },
    ],
  },
  // Wave 83 batch 1 추가 — ipad-10 신규 가이드
  {
    guideKey: "guide:tablet:ipad-10",
    category: "tablet",
    family: "ipad",
    model: "ipad_10",
    title: "iPad 10세대 기준 공략",
    summary: "iPad 10세대 (A14 Bionic, 2022)는 entry-level iPad 중 USB-C로 전환된 첫 모델. 가격대 좁고 (40~60만원) 회전 빠른 편. 9세대 (Home button + Lightning)와 외관 완전 다름.",
    quickFacts: ["A14 Bionic (2022.10)", "10.9인치 USB-C", "64/256GB", "Pencil 1 (어댑터 필요) + Pencil USB-C"],
    parserHints: {
      mustSplitAxes: ["storage_gb", "connectivity"],
      positiveSignals: ["10세대", "10 세대", "10th", "ipad 10", "아이패드 10세대", "a14"],
      ambiguousSignals: ["아이패드 10", "아이패드10세대", "아이패드10"],
      negativeSignals: ["프로", "에어", "미니", "9세대", "11세대", "lightning", "라이트닝"],
      partsSignals: ["케이스만", "펜슬만", "키보드만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "5g", "lte", "유심"],
    },
    match: {
      skuIds: ["ipad-10"],
      aliases: ["아이패드 10세대", "ipad 10", "아이패드10세대", "ipad10"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "2022.10 출시 entry-level iPad. Lightning → USB-C 전환된 첫 entry 모델 (이전 9세대까지 Lightning).",
        "10.9인치 Liquid Retina, A14 Bionic, 64/256GB, Wi-Fi / Wi-Fi+Cellular.",
        "색상: Silver / Pink / Blue / Yellow.",
        "모델번호: A2696(Wi-Fi), A2757(Cellular). 2025년 11세대(A16) 출시 후 단종 진행 중.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "저장 용량 (64 vs 256): ~10만원 격차.",
        "Wi-Fi vs Cellular: 10~15만원 cellular 비쌈.",
        "색상: 거의 시세 영향 0.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "iPad 9세대 (10.2인치, A13, Home button, Lightning) vs iPad 10세대 — 외관 완전 다름. 9세대는 home button 있음.",
        "iPad 11세대 (2025, A16, 10.9인치) vs 10세대 — 외관 거의 동일. chip + 출시 시기로 분별.",
        "\"아이패드 10인치\" 매물 — 9세대 (10.2)를 잘못 적은 건지 10.9 (10세대)인지 모호. 세대 명시 필수.",
        "Apple Pencil 호환 주의 (가장 큰 함정): Pencil 1은 USB-C 어댑터 필요 (Pencil 1 끝이 Lightning), Pencil(USB-C) 직접 호환, Pencil 2/Pro 둘 다 불호환.",
        "\"아이패드 10세대 + 펜슬 2\" 매물 = 호환 안 됨 — 끼워팔이 의심.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "Entry-level이라 가격대 좁음 (40~60만원 중심).",
        "정품 박스 + Apple Care 잔여 = +5만원.",
        "Magic Keyboard Folio (10세대 전용) 포함 시 별도 가산.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane 없음. broad ipad-10 SKU만 등재.",
        "mustContain: [\"아이패드/ipad\", \"10세대/10 세대/10th/ipad 10\"].",
        "mustNotContain: \"프로\", \"에어\", \"미니\", \"9세대\" + TABLET_NOISE.",
        "64GB / 256GB / Wi-Fi / Cellular 모두 broad 흡수 — 시세 학습은 broad 단위.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple Support iPad(10세대)", url: "https://support.apple.com/ko-kr/111968" },
      { sourceType: "official", label: "Apple iPad lineup (현행)", url: "https://www.apple.com/kr/ipad/specs/" },
      { sourceType: "internal_rule", label: "ipad-10 broad SKU + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:laptop:macbook-pro",
    category: "laptop",
    family: "macbook",
    model: "macbook_pro",
    title: "MacBook Pro 기준 공략",
    summary: "MacBook Pro는 14/16인치 × M3/M3 Pro/M3 Max/M4/M4 Pro/M4 Max × RAM(8~128GB) × SSD(512GB~8TB) — 옵션 조합 가장 많음. \"M3\" 텍스트만 보면 8GB 기본형(130만원)과 18GB Pro(180만원)이 섞여 시세 50~70만원 왜곡. M5(2026.3)는 신상.",
    quickFacts: ["M3/M3 Pro/M3 Max + M4/M4 Pro/M4 Max", "14 vs 16인치 (Pro/Max만 16)", "RAM 8~128GB", "M4부터 RAM 16GB base"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "chip_variant", "screen_size", "ram_gb", "ssd_gb"],
      positiveSignals: ["m3", "m3 pro", "m3 max", "m4", "m4 pro", "m4 max", "m5", "14인치", "16인치", "8gb", "16gb", "18gb", "24gb", "36gb", "48gb", "64gb", "512gb", "1tb", "2tb"],
      ambiguousSignals: ["맥북프로", "macbook pro", "맥프", "맥북 프로"],
      negativeSignals: ["에어", "air", " m1 ", " m2 ", "intel", "터치바", "touch bar", "13인치"],
      partsSignals: ["충전기만", "magsafe만", "어댑터만", "케이블만", "케이스만", "슬리브만", "액정만", "배터리만", "키보드만", "메인보드", "로직보드"],
      manualReviewSignals: ["ram 미표기", "ssd 미표기", "사이클 미표기", "cto", "영문 키보드"],
    },
    match: {
      skuIds: ["macbook-pro", "macbook-pro-14-m3-18-512"],
      aliases: ["맥북프로", "macbook pro", "맥북 프로", "맥프", "macbookpro"],
      familyHints: ["macbook"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "M3 (2023.11), M4 (2024.11) 세대 + M5 (2026.3, Apple 현재 판매). 칩 변형: 일반 / Pro / Max 3-tier.",
        "14인치는 일반/Pro/Max 모두, 16인치는 Pro/Max만. M3 14\" 일반 기본 8GB/512GB ~ M3 Max 14\" 36GB/1TB 까지.",
        "M4부터 RAM base 16GB 상향 (M3는 8GB 기본). SSD 옵션 512GB~8TB.",
        "Apple model code 표기 시 신뢰도 최상 — MRX33KH/A(M3 Pro), MR/MRW/MRX/MUW=M3, MX/MCX=M4.",
        "Bunjang 중고: M3/M4 dense (Apple 신품 판매중단), M5는 출시 직후라 매물 적음.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 변형 (M3 < M3 Pro < M3 Max < M4 < M4 Pro < M4 Max < M5/Pro/Max): 100~200만원+ 격차.",
        "화면 사이즈 (14 / 16): 30~50만원. Pro/Max만 16\" 옵션.",
        "RAM (8/16/18/24/36/48/64/96/128GB): 단계당 10~30만원.",
        "SSD (512GB/1TB/2TB/4TB/8TB): 단계당 10~30만원.",
        "배터리 사이클 (100 미만 = S급, 500+ = 디스카운트), Apple Care+ 잔여 (12개월+ = +5~15만원), 색상 (Space Black, Pro 이상만).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 M3 8GB 기본형 vs M3 Pro 18GB — 같은 \"M3\" 텍스트, 시세 50~70만원 차이. \"Pro\" 명시 + RAM 18GB+ + 모델코드 MRX* 둘 다 봐야 안전.",
        "M3 Max 36GB ≈ M4 Pro 24GB 비슷한 시세대 — 칩 세대 우선 확인.",
        "14\" M3 Pro vs 16\" M3 Pro — RAM 같고 사이즈만 다름, 16\"가 30만원 비쌈.",
        "13\" MacBook Pro M2 (Touch Bar 마지막, 2022) 매물이 \"맥북 프로 13\"으로 들어옴 — M2 Air와 혼동, Pro 명시 + 13인치 명시 모두 봐야.",
        "Intel MacBook Pro 13 (2020 M1 이전, Touch Bar) — 시세 70~100만원대, 별도 시세군. narrow 제외 권장.",
        "CTO 모델 (Custom-To-Order, 비표준 RAM/SSD 조합): \"CTO\" 명시 매물은 narrow lane 진입 잠재 차단.",
        "영문 키보드 매물: 약 5만원 디스카운트 (한국 사용자 90%는 한글).",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 사이클 100 미만 = 신품급 (시세 +10만원), 200~500 = A급, 500+ = 디스카운트, 1000+ = 배터리 교체 권장.",
        "Apple Care+ 잔여 12개월+ = +5~15만원.",
        "정품 박스 + USB-C 충전기 + MagSafe + 매뉴얼 = 풀구성, +3~5만원.",
        "M3 14\" (8GB/512GB): 130~180만원 (median ~160). M3 Pro (18GB/512GB): 150~210만원 (median ~180).",
        "M4 14\" (16GB/512GB): 180~230만원. M3 Max / M4 Pro: 250만원+. M4 Max / M3 Max 16\": 320만원+.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 칩 변형 + 사이즈 + RAM + SSD 4축 모두 명시 매물만 (현재 1 lane: 14\"/M3 Pro/18GB/512GB).",
        "broad macbook-pro는 narrow 미충족 매물 흡수 — 시세 학습용, 사용자 노출 안 함.",
        "narrow lane mustNotContain: \"에어/air\", \"16인치\", \" m1 \"/\" m2 \"/\" m4 \", 비표준 RAM/SSD, 메인보드/액정만/부품/침수/매입.",
        "M3 narrow lane replay (2026-05-13): skuMatch 33%, complete 0% — D등급 (M3 vs M3 Pro 모호로 AI L2 후보화 추천).",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple MacBook Pro 공식 specs (현행 M5)", url: "https://www.apple.com/kr/macbook-pro/specs/" },
      { sourceType: "official", label: "Apple Support MacBook Pro 14\" M3", url: "https://support.apple.com/ko-kr/111842" },
      { sourceType: "official", label: "Apple Support MacBook Pro 14\" M4", url: "https://support.apple.com/ko-kr/121553" },
      { sourceType: "internal_rule", label: "macbook option-parser generation/ram/ssd rules + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:laptop:macbook-air",
    category: "laptop",
    family: "macbook",
    model: "macbook_air",
    title: "MacBook Air 기준 공략",
    summary: "MacBook Air는 13/15인치 × M1/M2/M3/M4 × RAM(8~24GB) × SSD(256GB~2TB). M2 13\"(8GB/256GB) 매물이 가장 dense — median 85만원. M4(2025.3)부터 RAM 16GB base 상향. 리셀 회전 빠름 (대학생/직장인 수요).",
    quickFacts: ["M2 (2022.7) / M3 (2024.3) / M4 (2025.3) / M5 (2026.3)", "13 vs 15인치 (M2부터 15\")", "M3까지 8GB base, M4부터 16GB", "M1(2020)은 broad 흡수"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "ram_gb", "ssd_gb"],
      positiveSignals: ["m2", "m3", "m4", "m5", "13인치", "13형", "15인치", "15형", "8gb", "16gb", "24gb", "32gb", "256gb", "512gb", "1tb", "미드나이트", "스타라이트", "스카이 블루"],
      ambiguousSignals: ["맥북에어", "macbook air", "맥북 에어", "에어"],
      negativeSignals: ["프로", "pro", " m1 ", "터치바", "intel"],
      partsSignals: ["충전기만", "magsafe만", "어댑터만", "케이블만", "케이스만", "슬리브만", "액정만", "배터리만", "키스킨만", "메인보드"],
      manualReviewSignals: ["ram 미표기", "ssd 미표기", "사이클 미표기"],
    },
    match: {
      skuIds: ["macbook-air", "macbook-air-m2-13-256", "macbook-air-m3-13-256"],
      aliases: ["맥북에어", "macbook air", "맥북 에어", "macbookair"],
      familyHints: ["macbook"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "M2 (2022.7, 13\" 기본 8GB/256GB ₩1,690,000), M3 (2024.3, 13/15\"), M4 (2025.3, RAM 16GB base 상향), M5 (2026.3, Apple 현재 판매, Sky Blue 신규 색상).",
        "Air 라인은 M2부터 15\" 추가. M1까지는 13\" 단독.",
        "Bunjang 중고 dense: M2/M3 13인치가 핵심 매물 풀. M1 (2020.11, 8GB/256GB)은 시세 60~80만원대로 별도 시세군이지만 모집단 큼.",
        "Apple Care+ 잔여 12개월+ = +5~10만원, 사이클 100 미만 신품급 +10만원.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 변형 (M1 < M2 < M3 < M4 < M5): 단계당 20~40만원 격차.",
        "화면 사이즈 (13 / 15): 20~30만원 (15\"가 비쌈).",
        "RAM (8/16/24/32GB): 단계당 15~25만원. M2/M3 8GB 기본, M4부터 16GB.",
        "SSD (256/512/1TB/2TB): 단계당 10~20만원.",
        "색상 (Midnight / Starlight / Silver / Space Gray / Sky Blue): 시세 영향 거의 0.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 M2 13\"(8GB/256GB) vs M3 13\"(8GB/256GB) — 시세 30만원 차이 (M2 80만 vs M3 110만). chip 명시 필수.",
        "M1 (2020) vs M2 (2022): M1 60~80만, M2 80~100만. 매물 풀에서 M1이 가장 많음 (4~5년차).",
        "15\" M2 (~100만) vs 13\" M3 (~110만): 비슷한 시세대 — 화면사이즈 확인 필수.",
        "M2 8GB \"깡통\"/\"기본형\" vs M2 16GB: RAM 따라 15만원 차이. \"기본형\" 키워드 명시.",
        "M4 base RAM 16GB: M4 매물에 RAM 미상이면 자동 16GB 추정 가능.",
        "MacBook Pro 13\" M1/M2 (Touch Bar) 매물이 \"맥북 M1/M2 13\"으로 들어옴 — Pro/Air 명시 필수.",
        "신규 Sky Blue (M5만, 2026.3): 출시 직후라 매물 거의 없음.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 효율 95%+ + 외장 무파손 + 풀박스 = 풀시세.",
        "USB-C 어댑터/케이블/MagSafe 포함 = +1~3만원.",
        "M2 13\" (8GB/256GB) median ~85만원. M3 13\" (8GB/256GB) ~110만원, M3 16GB ~125만원.",
        "M2 lane replay: skuMatch 51%, complete 64.6% (precision stop). M3 lane: 52% / 51.6%.",
        "Apple Care+ 잔여 매물은 +5만원 가산.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 M2/M3 + 13인치 + 256GB + 8GB 명시 매물만 (현재 2 lane).",
        "M2 lane mustContain에 \"8gb\"/\"기본형\"/\"깡통\" 박힘 — RAM 16GB 매물 격리.",
        "lane mustNotContain: \"프로/pro\", \"15인치\", \" m1 \"/\" m3 \"/\" m4 \", 비표준 RAM/SSD, 메인보드/액정만/부품/침수/매입.",
        "M1은 broad macbook-air SKU로 흡수, narrow 진입 차단.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple MacBook Air 공식 specs (현행 M5)", url: "https://www.apple.com/kr/macbook-air/specs/" },
      { sourceType: "official", label: "Apple Support MacBook Air 13/15 M2", url: "https://support.apple.com/ko-kr/111867" },
      { sourceType: "official", label: "Apple Support MacBook Air M3", url: "https://support.apple.com/ko-kr/118552" },
      { sourceType: "internal_rule", label: "macbook-air narrow lane + Wave 83 verified" },
    ],
  },

  // Wave 83 batch 2 — game_console + headphone (research-backed via parallel agents)
  {
    guideKey: "guide:game_console:ps5",
    category: "game_console",
    family: "ps5",
    model: "ps5",
    title: "PlayStation 5 기준 공략",
    summary: "PS5는 1세대 디스크/디지털 (2020.11) + 슬림 디스크/디지털 (2023.11) + Pro (2024.11) 5-way split. 슬림은 디스크 드라이브 탈착 가능 구조라 디지털 + 별매 드라이브 = 디스크 동등. **Pro는 narrow lane 절대 제외** (시세 90~110만원, 일반 25~65만원).",
    quickFacts: ["1세대 (2020.11)", "슬림 (2023.11, 30% 작아짐)", "Pro (2024.11, GPU 67% 강력)", "CFI-1000/2000/7000 시리즈"],
    parserHints: {
      mustSplitAxes: ["model_variant", "fullset_vs_parts", "controller_count"],
      positiveSignals: ["디스크", "디지털", "슬림", "1세대", "초기형", "cfi-1000", "cfi-2000"],
      ambiguousSignals: ["ps5", "플스5", "플레이스테이션 5", "본체"],
      negativeSignals: ["pro", "ps5 pro", "플스5 프로", "ps5pro", "ps4", "ps3", "psvr", "vr2"],
      partsSignals: ["컨트롤러만", "듀얼센스만", "dualsense만", "이어셋만", "충전독만", "도크만", "헤드셋만", "카메라만", "ssd만", "리모컨만", "기프트", "gift card", "psn", "psvr"],
      manualReviewSignals: ["디스크/디지털 미표기", "구성품 모호", "게임 포함", "타이틀 포함", "번들"],
    },
    match: {
      skuIds: ["ps5-disc-standard", "ps5-digital-standard", "ps5-slim-disc", "ps5-slim-digital"],
      aliases: ["ps5", "플스5", "플레이스테이션 5", "playstation 5", "ps 5"],
      familyHints: ["ps5", "playstation", "플스"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "1세대 디스크 (2020.11, CFI-1000A/1100/1200): UHD 블루레이 일체형, 825GB SSD, 4.5kg, 정가 698,000원.",
        "1세대 디지털 (2020.11, CFI-1000B): 디스크 드라이브 X, 디스크 게임 불가, 정가 568,000원.",
        "슬림 디스크 (2023.11, CFI-2000A): 1TB SSD, 30% 작아짐, 디스크 드라이브 탈착 가능, 정가 628,000원.",
        "슬림 디지털 (2023.11, CFI-2000B): 디스크 드라이브 별매 (~14만원), 정가 498,000원.",
        "Pro (2024.11, CFI-7000): 2TB SSD, GPU 67% 강력, 디스크 별매. 정가 ~110만원. **별도 시세군, narrow lane 제외**.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "모델 변형: 1세대 디스크/디지털 vs 슬림 디스크/디지털 vs Pro — 시세 격차 5~80만원.",
        "디스크 vs 디지털: 5~13만원 격차 (디지털이 저렴).",
        "컨트롤러 1개 (기본) vs 2개 (+8만원) vs 충전독 추가 (+5만원).",
        "구성품: 본체만 vs 풀박스 vs 게임 포함 번들 (1~3개 게임 시 +5~30만원).",
        "한정판 (30주년 그레이 / 그란투리스모7 / 스파이더맨2 등) = 시세 가산.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"PS5\" 단독 → 디스크/디지털 모호, 1세대/슬림 모호 → narrow 진입 차단.",
        "🔥 Pro vs 일반 — 가장 위험. Pro 시세 90~110만, 일반 25~65만. catalog mustNotContain \"ps5 pro\", \"플스5 프로\", \"ps5pro\" strict reject.",
        "슬림 디지털 + 디스크 드라이브 별도 부착 = 슬림 디스크 동등 가치.",
        "CFI-1000 (초기) vs CFI-1200 (개선판) — 발열/소음 차이만, 시세 영향 미미.",
        "PS4 (다른 세대) → catalog mustNotContain.",
        "PSVR / PSVR2 (액세서리, 별도 제품) → mustNotContain \"psvr\", \"vr2\".",
        "30주년 한정판 / GT7 한정 등 별도 시세군 — 일반 매물과 섞이면 시세 가산 평가 어려움.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "보증 잔여 + 풀박스 + 컨트롤러 1개 정상 = 기본 시세.",
        "컨트롤러 추가, 충전독, 헤드셋, 게임 디스크 포함 = 별도 가산 (번들 분리 평가).",
        "1세대 매물은 단종 진행 중이지만 매물 흔함 (혼재).",
        "Pro 매물은 narrow lane 별도 진입 결정 — 현재 미진입.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: 디스크/디지털/슬림 명시 + 본체 명확 매물만 (4 lane).",
        "Pro 격리: mustNotContain \"ps5 pro\", \"플스5 프로\", \"ps5pro\" 박힘.",
        "단품 parts reject: 컨트롤러만/듀얼센스만/충전독만/헤드셋만/카메라만/SSD만/디스크 드라이브만.",
        "PS Plus / PSN 기프트 카드 reject (별도 거래 상품).",
        "VR / VR2 / PSVR 별도 카테고리 (현재 미커버).",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "PlayStation 5 한국 공식", url: "https://www.playstation.com/ko-kr/ps5/" },
      { sourceType: "official", label: "PS5 specs", url: "https://www.playstation.com/ko-kr/ps5/specifications/" },
      { sourceType: "official", label: "PS5 Slim 공지", url: "https://www.playstation.com/ko-kr/ps5/ps5-slim/" },
      { sourceType: "official", label: "PS5 Pro 공지", url: "https://www.playstation.com/ko-kr/ps5/ps5-pro/" },
      { sourceType: "internal_rule", label: "game-console-parser PS5 + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:game_console:switch-oled",
    category: "game_console",
    family: "nintendo_switch",
    model: "switch_oled",
    title: "Nintendo Switch OLED 기준 공략",
    summary: "Switch OLED (2021.10.08, HEG-001) 7\"인치 OLED + 64GB + 유선 LAN. 일반 Switch (HAC-001) / Lite (HDH-001) / Switch 2 (2025.06) 모두 다른 시세군. 풀박+게임 번들 30건 중 23건 bundle_review — owner policy 미정.",
    quickFacts: ["2021.10 (HEG-001)", "7\" OLED 화면", "64GB 내장", "Switch 2 (2025.06)와 분리"],
    parserHints: {
      mustSplitAxes: ["model_variant", "fullset_vs_parts"],
      positiveSignals: ["oled", "올레드", "7인치", "heg-001", "조이콘"],
      ambiguousSignals: ["스위치", "닌텐도 스위치", "switch"],
      negativeSignals: ["라이트", "lite", "switch 2", "스위치 2", "switch2", "스위치2", "hdh-001", "hac-001"],
      partsSignals: ["조이콘만", "독만", "프로콘만", "프로 컨트롤러만", "케이스만", "거치대만", "어댑터만", "게임만", "게임 카드", "게임 팩", "기프트", "gift"],
      manualReviewSignals: ["oled 미표기", "구성품 모호", "풀세트", "게임 포함", "타이틀 포함", "조이콘 별도"],
    },
    match: {
      skuIds: ["switch-oled"],
      aliases: ["스위치 oled", "닌텐도 스위치 oled", "switch oled", "switch 올레드", "스위치 올레드", "닌텐도 스위치 올레드"],
      familyHints: ["switch", "nintendo", "닌텐도"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "2021.10.08 출시, 모델번호 HEG-001. 7\" OLED (일반 6.2\" LCD 대비), 64GB 내장 (일반 32GB), 유선 LAN 지원, 향상된 거치대.",
        "정가 414,000원. 시세 ~24~31만원 (2026.5 시점).",
        "Switch 2 (2025.06.05 출시, 7.9\" LCD 1080p HDR) 한국 풀린 후 OLED 시세 하락 진행 중.",
        "색상: 화이트 / 네온블루-네온레드 / 스플래툰3 한정 / 젤다 티어스오브킹덤 한정 / 마리오 레드 / 포켓몬 스칼렛바이올렛 한정.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "본체만 vs 풀박스 vs 게임 포함 번들 — 5~15만원 격차.",
        "한정판 (스플래툰3 / 젤다 / 마리오 레드 등) +20~50% 가산.",
        "조이콘 색상: 네온 표준, 화이트, 한정판 — 시세 영향 작음.",
        "조이콘 드리프트 (스틱 결함) 무 + 화면 무파손 = 풀시세.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 \"닌텐도 스위치\" 단독 표기 → OLED인지 일반(HAC-001)인지 모호. 일반 시세 ~15만, OLED ~25~30만. **시세 1.5~2배 격차**.",
        "Switch 2 (2025.06): 시세 ~60만+. catalog `mustNotContain: \"스위치 2\", \"switch 2\", \"스위치2\", \"switch2\"` strict.",
        "Switch Lite (HDH-001): 핸드헬드 전용, 도크 X, 조이콘 분리 X. 시세 ~10~15만. `mustNotContain: \"라이트\", \"lite\"`.",
        "한정판 가산 누락 — \"스플래툰3 에디션\" 명시 안 한 매물은 일반 OLED로 분류, 시세 가산 못 잡음.",
        "\"본체만(조이콘 별도)\" 매물 = 조이콘 빠진 본체 = parts. 일반 본체와 시세 다름.",
        "모델번호 HEG-001 명시 = OLED 확정. HAC-001 = 일반, HDH-001 = Lite.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "조이콘 드리프트 검사 — 매물 시세 영향 큼.",
        "정품 박스 + 매뉴얼 + 도크 + 조이콘 그립 + AC 어댑터 + HDMI 케이블 = 풀구성.",
        "게임 다수 포함 시 게임당 1~3만원 가산 평가 (bundle_review 트리거).",
        "한정판 박스 보존 시 한정판 프리미엄 유지.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"OLED\" 또는 \"올레드\" 명시 매물만 (1 lane: switch-oled).",
        "mustNotContain: \"스위치 2\", \"switch 2\", \"라이트\", \"lite\" — 분리.",
        "⚠️ **owner_decision_pending**: bundle policy (full_set vs body_only 분리) 미정 — LAUNCH_PLAN §3.5.A. 풀박+게임 30건 중 23건 bundle_review → 정책 미정 → public 미공개.",
        "parts reject: 조이콘만/프로콘만/독만/케이스만/게임만/SD카드만/어댑터만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Nintendo Korea Switch OLED", url: "https://www.nintendo.co.kr/switch/oled/" },
      { sourceType: "official", label: "Nintendo Korea 하드웨어", url: "https://www.nintendo.co.kr/products/hardware/" },
      { sourceType: "official", label: "Switch 2 (2025.06)", url: "https://www.nintendo.co.kr/switch2/" },
      { sourceType: "internal_rule", label: "game-console-parser OLED + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:headphone:bose-qc-ultra",
    category: "headphone",
    family: "bose",
    model: "bose_qc_ultra",
    title: "Bose QuietComfort Ultra 헤드폰 기준 공략",
    summary: "Bose QC Ultra Headphones (2023.10 출시) Snapdragon Sound + Immersive Audio. 2세대 (2025.09) 출시로 배터리 23→30h, 마이크 4→6개. \"보스 QC\" 단독은 35/45/Ultra 어느 모델인지 모호 — narrow 차단. **이어버드와 절대 분리** (별도 제품).",
    quickFacts: ["1세대 (2023.10)", "2세대 (2025.09, 30h 배터리)", "Snapdragon Sound + Immersive Audio", "정가 ₩599,000"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["qc 울트라", "qc ultra", "ultra", "울트라", "quietcomfort ultra", "헤드폰", "headphone", "헤드셋"],
      ambiguousSignals: ["보스 qc", "bose qc", "qc"],
      negativeSignals: ["qc45", "qc 45", "qc35", "qc 35", "qc25", "qc15", "이어버드", "earbuds"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이블만", "케이스만", "충전기만", "트랜스미터만"],
      manualReviewSignals: ["세대 미표기", "1세대/2세대 모호"],
    },
    match: {
      skuIds: ["bose-qc-ultra-headphones"],
      aliases: ["보스 qc 울트라", "bose qc ultra", "qc ultra", "qc울트라", "quietcomfort ultra"],
      familyHints: ["bose"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "1세대 (2023.10): aptX Adaptive (Snapdragon Sound), Immersive Audio, ActiveSense ANC, 24h 배터리, USB-C, 정가 599,000원.",
        "2세대 (2025.09): 배터리 23→30h, USB-C 무손실 오디오, 마이크 4→6개, LDAC 추가, 정가 ~650,000원.",
        "색상 (1세대): Black / White Smoke / Sandstone (한국 한정 컬러).",
        "색상 (2세대): Black / Driftwood Sand / Midnight Violet / Diamond 60주년 한정 (Diamond White).",
        "Bunjang 매물 시세: 220~330k (1세대) / 400~450k (2세대 미개봉).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (1세대 2023 / 2세대 2025) — 매물 표기 안 한 경우 색상/배터리시간으로 추정 곤란.",
        "색상 — Driftwood Sand / Midnight Violet = 2세대 신규 컬러.",
        "60주년 다이아몬드 한정 (2025): +30~50k 가산.",
        "본품 + 케이스 + 충전 케이블 = 풀구성. 트랜스미터 동글(별매 ~150k) 포함 시 가산.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 QC Ultra Headphones vs QC Ultra Earbuds — 별도 제품, 별도 시세 (이어버드 ~200k, 헤드폰 ~250k). catalog `mustNotContain: \"이어버드\", \"earbuds\"`.",
        "QC Ultra vs QC45 — 별도 SKU, 시세 ~100k 격차. catalog 격리 박힘.",
        "1세대 vs 2세대 표기 누락 — 가격 + 충전시간 + 색상명만으로 추정 어려움.",
        "\"보스 QC\" 단독 = 35/45/Ultra 모호 → narrow 차단.",
        "QC Ultra와 \"QuietComfort Headphones\" (2024 보급형, Ultra 빼고 출시) 혼동 — 별도 모델, 현재 미커버.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 케이스 + 외장 무파손 + 풀구성 = 풀시세.",
        "이어패드 마모 + 헤드밴드 늘어남 시 시세 -3~5만원.",
        "60주년 다이아몬드 한정판은 박스/시리얼 확인 시 한정판 프리미엄.",
        "Trans­mitter 동글 (Bose USB-C Audio Transmitter, 별매 150k) 포함 매물은 가산.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 \"Ultra\" 또는 \"울트라\" + \"헤드폰/headphone/헤드셋\" 명시 매물만.",
        "mustNotContain: qc45/qc35/qc25/이어버드/earbuds 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이블만/케이스만/트랜스미터만.",
        "SoundLink (스피커) 격리 — `\"soundlink\"`, `\"사운드링크\"`.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Bose QC Ultra Headphones", url: "https://www.bose.com/p/headphones/bose-quietcomfort-ultra-headphones" },
      { sourceType: "official", label: "Bose Korea 헤드폰", url: "https://www.bose.com/c/headphones" },
      { sourceType: "internal_rule", label: "headphone Bose generation + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:headphone:sony-wh-1000xm5",
    category: "headphone",
    family: "sony_wh1000xm",
    model: "sony_wh1000xm5",
    title: "Sony WH-1000XM5 기준 공략",
    summary: "WH-1000XM5 (2022.05.20) — XM4 대비 외관 완전 다름 (슬림 헤드밴드 + 비접이식). LDAC + 30h 배터리 + 8 마이크. XM6 (2025.05) 출시 후 시세 하락 진행 중. **세대 단독 표기 \"XM\"은 위험**.",
    quickFacts: ["2022.05.20 출시", "비접이식 (XM4 접이식과 다름)", "LDAC + 30h 배터리", "정가 ₩499,000"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["wh 1000xm5", "wh1000xm5", "wh-1000xm5", "1000xm5", "xm5"],
      ambiguousSignals: ["소니 헤드폰", "wh1000", "1000xm"],
      negativeSignals: ["xm3", "xm4", "xm6", "wf-", "wf 1000", "ult900n", "ch720n", "ch520"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이블만", "케이스만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "xm 단독"],
    },
    match: {
      skuIds: ["sony-wh-1000xm5"],
      aliases: ["wh 1000xm5", "wh1000xm5", "wh-1000xm5", "소니 xm5", "1000xm5"],
      familyHints: ["sony", "wh1000xm", "소니"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Sony WH-1000XM 시리즈 5세대 (2022.05.20 출시, 정가 499,000원).",
        "XM4 대비 디자인 완전 변경 — 슬림 헤드밴드 + 매끄러운 컵 + **비접이식** (XM4는 접이식).",
        "LDAC 지원 (Snapdragon Sound), 8 마이크 ANC, 30시간 배터리, USB-C, LE Audio 지원.",
        "색상: Black / Platinum Silver / Midnight Blue (한정) / Smoky Pink (한정).",
        "XM6 (2025.05) 출시 — XM6는 다시 접이식 복귀 + QN3 프로세서. XM5 단종 진행 추정.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (XM3 < XM4 < XM5 < XM6) — 세대당 시세 ~100k 격차.",
        "색상 — Midnight Blue / Smoky Pink 한정 +30~50k 가산.",
        "본품 + 케이스 + USB-C 케이블 + 3.5mm Aux 케이블 + 비행기 어댑터 = 풀구성.",
        "펌웨어 (LE Audio 업데이트 후 매물 = 가산).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 \"소니 헤드폰\" / \"WH\" / \"1000XM\" 단독 표기 — XM3/4/5/6 어느 세대인지 모호. narrow 진입 차단.",
        "XM4 (접이식) vs XM5 (비접이식) — 외관 완전 다름. 사진/표기로 즉시 분별 가능.",
        "XM5 → XM6 (2025.05) — 시세 격차 ~200k+. catalog `mustNotContain: \"xm6\"` 박힘. \"미개봉 최신 XM6\" 사기 매물 (XM5 발송) 해외 사례 있음.",
        "WF-1000XM 시리즈 (이어버드) — 별도 제품. `\"wf-\"`, `\"wf 1000\"` mustNotContain.",
        "ULT900N / CH520 등 별도 Sony 헤드폰 라인 — mustNotContain 박혀 격리.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 케이스 + 풀구성 + 무파손 = 풀시세.",
        "이어패드 교체 시점 확인 — 1년+ 사용 시 마모 큼, 시세 -3~5만원.",
        "Bunjang 시세 ~250~340k (color/풀구성 따라).",
        "XM6 출시 후 (2025.05+) 자연 시세 하락 진행 중.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 \"XM5\" / \"WH-1000XM5\" / \"WH1000XM5\" 명시 매물만.",
        "mustNotContain: xm3/xm4/xm6/wf-/ult900n/ch720n/ch520 — 모두 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이블만/케이스만/충전기만.",
        "WF-1000XM (이어버드 시리즈) 격리.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Sony Korea WH-1000XM5", url: "https://www.sony.co.kr/electronics/headband-headphones/wh-1000xm5" },
      { sourceType: "official", label: "Sony WH-1000XM5 specs", url: "https://www.sony.com/ko/electronics/in-ear-headphones/wh-1000xm5/specifications" },
      { sourceType: "internal_rule", label: "headphone Sony WH generation + Wave 83 verified" },
    ],
  },

  // Wave 83 batch 3 — 새 카테고리 watch / sport_golf (Wave 67)
  {
    guideKey: "guide:watch:gshock-ga2100",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_ga2100",
    title: "Casio G-Shock GA-2100 (카시오크) 기준 공략",
    summary: "GA-2100 (2019, \"카시오크\" 별명) — Royal Oak 닮은 8각형 베젤. Carbon Core Guard + 200m 방수. 우측 라이트 버튼이 GA-2200 (2022 후속, 전면 라이트 버튼)과 구분 포인트. 콜라보 한정판 시세 +50~200%.",
    quickFacts: ["2019 출시, 정가 ₩169,000", "Carbon Core Guard 8각형", "GA-2200 후속과 분리 필수", "GMW-B5000 풀메탈과 시세 5배+ 격차"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["ga 2100", "ga2100", "ga-2100", "카시오크", "지얄오크", "지샥오크"],
      ambiguousSignals: ["지샥", "g shock", "g-shock", "8각형 지샥", "팔각 지샥"],
      negativeSignals: ["ga 2200", "ga2200", "ga-b2100", "gmw b5000", "gmw-b5000", "풀메탈 5000", "dw 5600", "dw5600", "gm-2100", "gma-s2100"],
      partsSignals: ["밴드만", "스트랩만", "줄만", "베젤만", "유리만", "쉬라우드만", "케이스만"],
      manualReviewSignals: ["모델명 미표기", "ga-s2100", "gam-s2100", "다이아 커스텀", "지르코니아 파베", "버스트다운"],
    },
    match: {
      skuIds: ["watch-casio-gshock-ga2100"],
      aliases: ["ga 2100", "ga2100", "ga-2100", "지샥 ga-2100", "지샥 카시오크", "카시오크", "지얄오크"],
      familyHints: ["g shock", "gshock", "g-shock", "카시오", "casio"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "2019 출시 G-Shock 베스트셀러. \"카시오크\" 애칭은 Audemars Piguet Royal Oak 닮은 8각형 베젤에서 유래.",
        "Carbon Core Guard 케이스 + 200m 방수 + LED 백라이트 + 5 알람.",
        "기본 변형 (GA-2100-1A 블랙 / -1A1 올블랙 / -2A 네이비 / -4A 레드 / -7A 화이트 / 1A4 베이지 베젤 등).",
        "후속/변형: GA-2110 (2020 컬러 변형), GA-2200 (2022 후속, 전면 라이트 버튼), GA-B2100 (2021 솔라+Bluetooth, 별도 모델).",
        "한정판: Rich Brian (2022), Coca-Cola 140주년 (2026), Hiroshima Toyo Carp (2025 일본 한정) — 시세 +50~200%.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상/에디션 — 1A1 기본 7~10만, 컬러/스켈레톤 +20~50%, 콜라보 한정 +50~200%.",
        "케이스 (정품 박스/매뉴얼/시계줄 여분).",
        "사용 상태 (유리 기스, 베젤 변색, 밴드 마모, 액정).",
        "정품 vs 병행 (DR 접미사 = 일본 정식).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 GA-2100 (2019, 우측 라이트 버튼) vs **GA-2200 (2022 후속, 전면 라이트 버튼)** — 디자인 매우 유사 but 별개 모델. catalog에 \"ga-2200\" mustNotContain 추가 필요 (현재 미박힘).",
        "GA-2100 (수지) vs GM-2100 (스테인리스 베젤 + 수지 케이스) — Bunjang에서 GM-2100을 \"카시오크 풀메탈\"로 잘못 표기 사례 있음.",
        "GA-2100 vs GMW-B5000 — 시세 5배+ 격차 (수지 vs 풀메탈). 모델 코드 완전 다름.",
        "GA-2100 vs GMA-S2100 (여성용 미드사이즈, 42.9mm 슬림 케이스) — 단가 낮음.",
        "GA-B2100 (솔라/블루투스 후속) — catalog mustContain이 \"ga-2100\"만 잡음 → \"ga-b2100\" 매칭 X. 별도 SKU 검토 필요.",
        "\"지샥\" 단독 표기 — DW-5600/GA-2100/GMW-B5000 등 다양 → narrow 차단.",
        "가품 risk: \"GA-S2100\" / \"GAM-S2100\" 등 가짜 모델코드 매물 다수.",
        "BAPE GA-2100 = BAPE 콜라보는 주로 GM-2100/GM-6900 — \"BAPE GA-2100\" 단독 표기는 가품/커스텀 의심.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 + 케이스 + 시계줄 여분 = 풀시세.",
        "기스/유리 손상 시 -3~5만원.",
        "한정판 박스 보존 시 한정판 프리미엄 유지 (Rich Brian / Coca-Cola 등).",
        "Bunjang 시세: 기본형 7~10만, 컬러/스켈레톤 12~18만, 콜라보 15~30만.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: GA-2100 또는 카시오크 명시 매물만.",
        "mustNotContain: ga-2200/dw-5600/gmw-b5000/gm-2100/gma-s2100 — 다른 G-Shock 시리즈 격리.",
        "broad G-Shock은 모델 미상 매물 흡수, 시세 신뢰도 낮음.",
        "parts reject: 밴드만/스트랩만/베젤만/유리만/케이스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio Korea GA-2100-1A1", url: "https://www.casio-intl.com/kr/ko/wat/watch_detail/GA-2100-1A1/" },
      { sourceType: "official", label: "Casio US GA-2100 시리즈", url: "https://www.casio.com/us/watches/gshock/products/analog-digital/ga-2100/" },
      { sourceType: "official", label: "G-Central GA-2200 비교", url: "https://www.g-central.com/specs/g-shock-ga-2200/" },
      { sourceType: "internal_rule", label: "G-Shock variant disambiguation + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:watch:gshock-dw5600",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_dw5600",
    title: "Casio G-Shock DW-5600 기준 공략",
    summary: "DW-5600 (1996~) — G-Shock 정통 사각형 디자인. 군대시계/학생시계로 유명. 기본 DW-5600BB-1 (올블랙) 시세 6~9만. 콜라보 한정판 (BAPE/Stussy/이니에스타/슈프림/Ader/피갈레/Beams 등)이 다수, 시세 +50~500%. **GMW-B5000 풀메탈과 분리 핵심**.",
    quickFacts: ["1996~ 라인 (DW-5600E 오리지널)", "DW-5600BB-1 올블랙 = 가장 흔함", "콜라보 한정판 ↑↑", "DW-B5600 (블루투스)와 분리"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["dw 5600", "dw5600", "dw-5600", "지샥 5600", "스퀘어 지샥", "사각 지샥"],
      ambiguousSignals: ["지샥", "g shock", "쥐샥", "5600"],
      negativeSignals: ["gmw b5000", "gmw-b5000", "풀메탈", "dw-b5600", "g-5600", "gw-m5610", "ga-2100", "dw-5610"],
      partsSignals: ["밴드만", "스트랩만", "줄만", "베젤만", "유리만", "케이스만", "시계줄", "버클만", "커스텀 키트"],
      manualReviewSignals: ["모델명 미표기", "콜라보 명시 없음", "이미테이션", "복각", "homage", "오마주"],
    },
    match: {
      skuIds: ["watch-casio-gshock-dw5600"],
      aliases: ["dw 5600", "dw5600", "dw-5600", "지샥 dw-5600", "지샥 5600"],
      familyHints: ["g shock", "gshock", "g-shock", "카시오", "casio"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "1996 출시. G-Shock 정체성 그 자체인 정통 사각형 디자인. 30년+ 모듈 거의 동일.",
        "기본형 변형: DW-5600E-1V (오리지널), DW-5600BB-1 (올블랙 매트, 가장 흔함), DW-5600BBR-1 (블랙+레드), DW-5600BCE-1 (베이지/타운), DW-5600SKE-7 (스켈레톤 화이트), DW-5600MS-1 (밀리터리/매트).",
        "정가 ~75,000원, Bunjang 기본 매물 시세 6~9만.",
        "콜라보 한정판 매우 많음 (BAPE / Stussy / Joshua Vides / Ader Error / Pigalle / Beams / 이니에스타 / Hodinkee 등) — +50% ~ +500%.",
        "후속/관련: DW-5610 (모듈 업데이트, 버튼 배치 변경 — DW-5600과 별개), DW-B5600 (블루투스, 별개), GW-M5610 (솔라+전파, 별개).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상/에디션 — 기본 BB 6~9만, 한정 콜라보 15~50만 (Ader Error 130만+).",
        "케이스 (정품 박스/매뉴얼/스티커/태그).",
        "사용 상태 (베젤 변색, 밴드 변색, 액정).",
        "정품 vs 가품 — 메탈 스트랩 변형(DW-5600HR)은 가품 매물 多, 정품 매물도 케이스째 reject 사례 있음.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 DW-5600 (수지, 클래식) vs **GMW-B5000 (풀메탈, 5600 베이스)** — 같은 스퀘어 실루엣이지만 케이스 재질 + 가격 차원 완전 다름. 시세 5~10배+ 격차. catalog mustNotContain `gmw-b5000`, `풀메탈` 박힘.",
        "DW-5600 vs GW-M5610 (솔라+전파, 동일 스퀘어) — 솔라/전파 기능 차이로 시세 1.5~2배 차이.",
        "DW-5600 vs DW-B5600 (블루투스 변형) — 모델 코드 다름, 별개.",
        "\"5600\" 단독 표기 — DW-5600/GW-M5610/GMW-B5000 중 무엇인지 모호.",
        "\"BAPE DW-5600\" 표기 — 실제 BAPE 콜라보는 주로 GM-6900에서 발매. DW-5600 BAPE 정식 라인은 거의 없음 → 가품/커스텀 의심.",
        "DW-5600HR (메탈 스트랩 변형) — 정품 매물도 가품 혼재로 reject 사례 발생.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 + 태그 = 풀시세.",
        "콜라보판은 박스 + 패키지 + 컬래버 굿즈 보존 시 한정판 프리미엄.",
        "베젤/밴드 커스텀 (사제 메탈 케이스 등) 매물 — 가치 하락 vs 정품 풀세트 = 가치 상승.",
        "Bunjang 시세: BB 6~9만, 콜라보 15~50만+ (Ader Error 130만+).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 DW-5600 명시 매물만 (GMW-B5000 분리).",
        "mustNotContain: gmw-b5000/풀메탈/dw-b5600/gw-m5610/ga-2100 격리.",
        "콜라보 한정판은 별도 시세군으로 추가 검토 (가격 분포 매우 wide).",
        "parts reject: 밴드만/스트랩만/베젤만/유리만/케이스만/커스텀 키트.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio US DW-5600BB-1", url: "https://www.casio.com/us/watches/gshock/product.DW-5600BB-1/" },
      { sourceType: "official", label: "Casio US DW-5600BCE-1", url: "https://www.casio.com/us/watches/gshock/product.DW-5600BCE-1/" },
      { sourceType: "official", label: "G-Shock 5600 시리즈 전체", url: "https://www.casio.com/us/watches/gshock/products/type/5600/" },
      { sourceType: "internal_rule", label: "G-Shock DW-5600 + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:watch:gshock-gmwb5000",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_gmwb5000",
    title: "Casio G-Shock GMW-B5000 (풀메탈 5000) 기준 공략",
    summary: "GMW-B5000 (2018~) — DW-5600 디자인의 풀메탈 + 솔라 + 블루투스 버전. 정가 99만원, Bunjang 시세 40~110만+. 한정판 (35주년 티타늄 / 40주년 레인보우 / Eric Haze 콜라보 등) 시세 더 큼. **DW-5600과 절대 분리** (시세 5~10배 차이).",
    quickFacts: ["2018 출시, 정가 ₩990,000", "풀메탈 케이스 (스테인리스/티타늄)", "솔라 충전 + Bluetooth", "35/40주년 한정 + Eric Haze 콜라보"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["gmw b5000", "gmwb5000", "gmw-b5000", "풀메탈 5000", "풀메탈", "지샥 5000풀메탈", "5000 풀메탈"],
      ambiguousSignals: ["b5000", "5000", "풀메탈 지샥"],
      negativeSignals: ["dw 5600", "dw5600", "ga 2100", "gm-5600", "gm-s5600", "mr-g", "mrg"],
      partsSignals: ["밴드만", "스트랩만", "베젤만", "유리만", "케이스만", "디버클 밴드만", "정품 우레탄밴드 단품"],
      manualReviewSignals: ["모델명 미표기", "커스텀", "mrg 커스텀", "사제"],
    },
    match: {
      skuIds: ["watch-casio-gshock-gmwb5000"],
      aliases: ["gmw b5000", "gmwb5000", "gmw-b5000", "풀메탈 5000", "지샥 풀메탈", "지샥 b5000", "지샥 5000풀메탈"],
      familyHints: ["g shock", "gshock", "g-shock", "카시오"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "2018 출시 G-Shock 풀메탈 라인 최고 인기 모델. DW-5600 베이스에 스테인리스/티타늄 케이스 + 솔라 + Bluetooth.",
        "기본형: GMW-B5000D-1 (실버, ₩990k 정가), GMW-B5000D-1C (빨테), GMW-B5000GD-1 (IP블랙/흑떱, 40~64만), GMW-B5000GD-9 (풀골드).",
        "프리미엄 변형: GMW-B5000TFG-9 (티타늄+IP골드, 35주년 ~107만), GMW-B5000TFC (티타늄+카모, 200~560만), GMW-B5000T (티타늄+사파이어).",
        "한정판: GMW-B5000PG-9 (40주년 풀골드), GMW-B5000BPC-1 (40주년 레인보우 7색), GMW-B5000EH (Eric Haze 40주년 콜라보 57~80만, Bunjang 빈도 高), GMW-B5000KL (35주년 KOLOR), GMW-B5000PB (Twilight Tokyo).",
        "Bunjang 시세 분포: 실버 40~50만, IP블랙 45~50만, 티타늄 100만+, 한정판 60~110만+.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "모델 변형 — 실버 (40만대), IP블랙 (45~50만), 티타늄 (100만+), 35/40주년 한정 (60~110만).",
        "케이스 (정품 박스/매뉴얼/Casio 정품 우레탄밴드 추가품).",
        "사용 상태 (메탈 풀메탈 특성상 미세 스크래치 가격 영향 큼, \"민트급/신품급\" 표기 빈도 高).",
        "정품/병행 (DR/JF 접미사 — 일본 정식 vs 글로벌).",
        "배터리/오링 교환 이력 (\"정식 배터리 오링교환\" 명시 매물 = +가치).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 GMW-B5000 (풀메탈 5600) vs **DW-5600 풀메탈 커스텀** — DW-5600에 사제 메탈 케이스 씌운 커스텀이 \"풀메탈 지샥\"으로 잘못 표기. 모델코드 명시 필수.",
        "GMW-B5000 vs GM-5600 / GM-S5600 (수지+메탈 베젤) — 메탈 베젤만 vs 풀메탈 전체, 시세 4~5배 차이.",
        "GMW-B5000 vs MR-G (최고급) — MR-G는 100만원 단위 위, 표기 혼동 가능 (rejected 매물의 \"mrg 커스텀\" 사례).",
        "GMW-B5000D (스테인리스) vs GMW-B5000T (티타늄) — 동일 외관, 재질 차이로 50~100만원 격차.",
        "GMW-B5000 일반 vs 35/40주년 한정 — 박스/시리얼 확인 필수.",
        "커스텀 매물 비율 높음 — \"MRG 커스텀 블랙\", \"정품 우레탄밴드\" 표기 (커스텀 베젤·DLC 코팅은 가치 하락 vs 정품 풀세트는 가치 상승).",
        "rejected 샘플의 27~33만원대 매물은 부품용 또는 가품 가능성 — 시세 하한 40만원선 가드 필요.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 + 솔라 충전 정상 = 풀시세.",
        "메탈 케이스 기스 + 밴드 마모 시 -10만원+ 디스카운트.",
        "배터리/오링 교환 이력 + 정식 서비스 매물 = +5~10만원.",
        "한정판 박스/시리얼 보존 시 한정판 프리미엄 유지.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 GMW-B5000 또는 풀메탈 5000 명시 매물만.",
        "mustNotContain: dw-5600/ga-2100/gm-5600/mr-g — 다른 G-Shock 라인 격리.",
        "DW-5600 lane과 절대 분리.",
        "parts reject: 밴드만/스트랩만/베젤만/유리만/케이스만/우레탄밴드 단품.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio US GMW-B5000 시리즈", url: "https://www.casio.com/us/watches/gshock/products/type/full-metal/" },
      { sourceType: "official", label: "Casio GMW-B5000EH (Eric Haze)", url: "https://www.casio.com/us/watches/gshock/product.GMW-B5000EH-1/" },
      { sourceType: "official", label: "G-Central GMW-B5000 specs", url: "https://www.g-central.com/specs/g-shock-gmw-b5000/" },
      { sourceType: "internal_rule", label: "G-Shock GMW-B5000 + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:sport_golf:titleist-tsr2-driver",
    category: "sport_golf",
    family: "titleist",
    model: "tsr2_driver",
    title: "Titleist TSR2 드라이버 기준 공략",
    summary: "Titleist TSR2 (2022~) — forgiveness 우선 골퍼용 (TSR3보다 관용성 ↑, 큰 헤드 + 고정 무게). 한국 정가 ~95만, Bunjang 시세 풀세트 50~62만, 헤드만 35~38만. **TSi2 (이전 세대 2020.10)과 절대 분리** — i/r 한 글자 차이 매물 표기 오타 多.",
    quickFacts: ["2022 출시 (TSi 후속)", "로프트 8/9/10/11도", "헤드만 vs 풀세트 가격 분기", "GT (2024) 라인 출시 후에도 유통"],
    parserHints: {
      mustSplitAxes: ["model_variant", "loft", "shaft", "fullset_vs_parts"],
      positiveSignals: ["tsr2", "tsr 2", "타이틀리스트 tsr2", "9도", "10도", "10.5도", "11도"],
      ambiguousSignals: ["타이틀리스트", "titleist", "tsr"],
      negativeSignals: ["tsr1", "tsr3", "tsr4", "tsi2", "tsi3", "tsi", "ts2", "ts3", "gt2", "gt3", "헤드만", "풀세트"],
      partsSignals: ["헤드만", "헤드 단독", "헤드 only", "샤프트만", "그립만", "페룰만", "헤드커버만"],
      manualReviewSignals: ["모델 미표기", "로프트 미표기", "샤프트 미상", "ts2", "tsi2"],
    },
    match: {
      skuIds: ["sport-golf-titleist-tsr2-driver"],
      aliases: ["tsr2", "tsr 2", "타이틀리스트 tsr2", "tsr2 드라이버"],
      familyHints: ["titleist", "타이틀리스트"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Titleist TSR2 (2022 출시, 한국 정가 약 95만원). TSi2 후속 (\"Refined\" 의미).",
        "TSR1/2/3/4 라인 중 가장 판매량 많음 — forgiveness 우선, 페이스 전체 사용 골퍼.",
        "ATI 425 항공급 티타늄 페이스 + multi-plateau VFT (variable face thickness).",
        "로프트: 8°/9°/10°/11° (대부분 매물 9°/10°).",
        "샤프트 옵션: Tour AD 50/60/70 시리즈 (S/R/X), HZRDUS Black/Red/Smoke, TSP110/TSP310/TSP111, Tensei, Ventus, Graphite Design VR 시리즈.",
        "Bunjang 시세: 풀세트 50~62만 (median), 헤드만 35~38만, 일본 직수입 신품 62만 동일가 다수.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "로프트 (8/9/10°) — 9°가 표준, +/-1° 시세 영향 5~10%.",
        "샤프트 종류·플렉스 (S/R/X) — 투어 AD 시리즈는 +프리미엄 (조립가 50만+).",
        "헤드 vs 풀세트 — 헤드만 35~40만, 완성품 50~62만.",
        "헤드커버 포함 여부 (+1~3만).",
        "사용 상태 (페이스 마모, 솔 마모, 헤드 도장).",
        "그립 교체 이력, 정품 vs 일본 직수입 (한국 정품 보증서 유무).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 TSR2 (2022) vs **TSi2 (2020.10, 이전 세대)** — \"i/r\" 한 글자 차. TSi가 단종되며 TSR로 교체. 매물 표기 오타 빈번. catalog mustNotContain `tsi` 박힘.",
        "TSR2 vs TSR3 (같은 2022 라인업): TSR2 = forgiveness, TSR3 = 컨트롤 (SureFit CG 슬라이딩 웨이트). 시세 거의 동일.",
        "TS (2018) → TSi (2020) → TSR (2022) → GT (2024) — 4세대 라인. \"TS2\"는 2018 세대로 TSi2와 별개.",
        "\"타이틀리스트 드라이버\" 단독 — 세대 미상, narrow 매칭 불가 → AI L2 후보.",
        "헤드만 매물 비중 매우 높음 — 풀 드라이버 vs 헤드만 격리 필수.",
        "TSi2를 TSR2로 잘못 표기/오타 매물 가능성 — 모델 코드 명시 매물만 매칭.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "헤드 페이스 무파손 + 그립 정상 + 헤드 커버 포함 + 렌치 포함 = 풀시세.",
        "샤프트 교체 이력 (커스텀) — 호불호, 투어 AD 등 고가 샤프트는 가산.",
        "일본 직수입 신품 매물 62만 동일가 다수 (재고 처분 가격).",
        "Bunjang 시세 분포: 풀세트 50~62만, 헤드만 35~38만.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 TSR2 명시 매물만.",
        "mustNotContain: tsr1/tsr3/tsr4/tsi/ts2/ts3/gt 격리.",
        "헤드만/샤프트만/그립만 단품 → parts 분류 (별도 lane 검토 가치 있음).",
        "풀세트/골프세트/우드세트/아이언세트/유틸 → reject (드라이버 아님).",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Titleist Korea Drivers", url: "https://www.titleistkorea.co.kr/clubs/drivers/" },
      { sourceType: "official", label: "Titleist US TSR drivers", url: "https://www.titleist.com/clubs/drivers/" },
      { sourceType: "official", label: "GolfWRX TSR 라인업", url: "https://www.golfwrx.com/693429/2022-titleist-tsr2-tsr3-tsr4-drivers-everything-you-need-to-know/" },
      { sourceType: "internal_rule", label: "TSR vs TSi disambiguation + Wave 83 verified" },
    ],
  },
  {
    guideKey: "guide:sport_golf:titleist-tsr3-driver",
    category: "sport_golf",
    family: "titleist",
    model: "tsr3_driver",
    title: "Titleist TSR3 드라이버 기준 공략",
    summary: "Titleist TSR3 (2022~) — 정타 잘 치는 골퍼용 (TSR2보다 컨트롤 ↑, 작은 헤드 + SureFit CG 슬라이딩 웨이트 5단 조정). 한국 정가 ~95만, Bunjang 시세 풀세트 50~56만, 헤드만 32~45만. **TSi3 / TS3와 절대 분리** — 한 글자 차 매물 표기 오타 빈번.",
    quickFacts: ["2022 출시 (TSi3 후속)", "SureFit CG 슬라이딩 웨이트", "로프트 8°/9°/10°", "Speed Ring 페이스"],
    parserHints: {
      mustSplitAxes: ["model_variant", "loft", "shaft", "fullset_vs_parts"],
      positiveSignals: ["tsr3", "tsr 3", "타이틀리스트 tsr3", "surefit cg", "9도", "10도"],
      ambiguousSignals: ["타이틀리스트", "titleist", "tsr"],
      negativeSignals: ["tsr1", "tsr2", "tsr4", "tsi3", "tsi2", "tsi", "ts3", "ts2", "gt3", "gt2", "헤드만", "풀세트"],
      partsSignals: ["헤드만", "헤드 단독", "샤프트만", "그립만", "페룰만", "헤드커버만"],
      manualReviewSignals: ["모델 미표기", "로프트 미표기", "샤프트 미상", "tsi3"],
    },
    match: {
      skuIds: ["sport-golf-titleist-tsr3-driver"],
      aliases: ["tsr3", "tsr 3", "타이틀리스트 tsr3", "tsr3 드라이버"],
      familyHints: ["titleist", "타이틀리스트"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Titleist TSR3 (2022 출시, 한국 정가 약 95만원). TSi3 후속, 정타 잘 치는 + 페이드/드로우 조절 골퍼용.",
        "TSR2 대비 작은 헤드 + SureFit CG 슬라이딩 웨이트 (5단 heel/toe 위치 조정).",
        "Speed Ring 페이스 (CT/COR 스위트스팟 집중) + ATI 425 항공급 티타늄 (TSR과 동일 소재).",
        "로프트: 8°/9°/10° (TSR2보다 적음, 매물 대부분 9°/10°).",
        "샤프트 옵션: Tour AD 5S/6S, TSP110/TSP310/TSP111 S, HZRDUS Black/Red/Smoke (Project X), Tensei Pro Blue/Orange, Ventus Blue/Black, Graphite Design VR5s/VR6s.",
        "Bunjang 시세: 풀세트 50~56만 (median ~55만), 헤드만 32~45만. TSR2와 유사 가격대.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "로프트 (8/9/10°) — 9°가 표준, 정타 잘 치는 골퍼용 특성상 8/9° 매물 많음.",
        "SureFit CG 웨이트 위치 — 표기 없음 매물 多, 표기 있으면 가치 ↑.",
        "샤프트 종류·플렉스 — 투어 AD/VR/TSP 등.",
        "헤드 vs 풀세트 — 헤드만 32~45만, 풀 드라이버 50~56만 (TSR2와 유사 가격대).",
        "헤드커버 포함 여부.",
        "사용 상태 (페이스/솔 마모, 무게추 회전 자국).",
        "일본/미국 직수입 vs 한국 정품.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 TSR3 (2022) vs **TSi3 (2020.10, 이전 세대)** — \"i/r\" 한 글자 차. catalog mustNotContain `tsi` 박힘.",
        "TSR3 vs **TS3 (2018)** — 8년 차이의 다른 세대. catalog mustNotContain `ts3` 박힘.",
        "TSR3 vs TSR2 (같은 2022 라인): TSR3 = 정타+컨트롤+슬라이딩 웨이트, TSR2 = forgiveness. 시세 거의 동일.",
        "TSR3 vs TSR4 (저스핀/투어 전용) — 비슷한 가격대지만 별개.",
        "한국 매물에서 \"TSR3\"는 헤드만 매물 비중 매우 높음 (rejected 샘플 중 헤드만 비율 60%+) → 풀 드라이버 매물 발굴이 narrow 핵심.",
        "표기 혼동 패턴: \"TSI3\"는 오타 (i와 r은 키보드 거리 멈), \"Tsr3\"는 대소문자 i/r 오인.",
        "\"타이틀리스트 드라이버\" 단독 — 어느 세대인지 미상.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "헤드 페이스 + 웨이트 정상 + 풀구성 = 풀시세.",
        "샤프트 커스텀 (Mitsubishi Tensei Pro 등) — 호불호. 투어 AD 5S/6S 시리즈 빈도 高.",
        "Bunjang 시세 분포: 풀세트 50~56만, 헤드만 32~45만, 일본 직수입 신품 다수.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 TSR3 명시 매물만.",
        "mustNotContain: tsr1/tsr2/tsr4/tsi/ts3/ts2/gt 격리.",
        "TSR2 lane과 분리.",
        "헤드만/샤프트만/그립만 → parts 분류, 풀세트/우드세트 → reject (드라이버 아님).",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Titleist Korea Drivers", url: "https://www.titleistkorea.co.kr/clubs/drivers/" },
      { sourceType: "official", label: "Titleist US TSR3", url: "https://www.titleist.com/clubs/drivers/tsr3-driver" },
      { sourceType: "official", label: "GolfWRX TSR2 vs TSR3", url: "https://www.golfwrx.com/693429/2022-titleist-tsr2-tsr3-tsr4-drivers-everything-you-need-to-know/" },
      { sourceType: "official", label: "Bunkered TSR vs TSi vs TS", url: "https://www.bunkered.co.uk/gear/h2h-titleist-tsr-vs-tsi-vs-ts/" },
      { sourceType: "internal_rule", label: "TSR3 + Wave 83 verified" },
    ],
  },

  // ============================================================
  // Wave 83 batch 4 — 신규 17개 가이드 (research-backed)
  // ============================================================

  {
    guideKey: "guide:desktop:imac-m3-24",
    category: "desktop",
    family: "imac",
    model: "imac_24",
    title: "iMac 24인치 기준 공략",
    summary: "iMac 24\" Apple Silicon (M1 2021 / M3 2023 / M4 2024.11). 24인치 4.5K Retina + 7색 컬러. M1/M3/M4 외관 동일 — chip 명시 필수. 2-port vs 4-port (GPU 코어 수 차이) 시세 ~30만원 격차.",
    quickFacts: ["M1 (2021.4) / M3 (2023.11) / M4 (2024.11, 현재)", "24인치 4.5K 단일", "7색 (Blue/Purple/Pink/Orange/Yellow/Green/Silver)", "2-port vs 4-port"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "port_count", "ram_gb", "ssd_gb"],
      positiveSignals: ["m1", "m3", "m4", "24인치", "imac", "아이맥", "8gb", "16gb", "24gb", "256gb", "512gb"],
      ambiguousSignals: ["아이맥", "imac"],
      negativeSignals: ["27인치", "21인치", "21.5인치", "intel", "인텔", "5k", "macbook", "맥북", "mac mini", "맥미니", "mac studio", "맥스튜디오", "mac pro", "맥프로"],
      partsSignals: ["스탠드만", "어댑터만", "케이블만", "박스만", "케이스만", "키보드만", "마우스만"],
      manualReviewSignals: ["포트수 미표기", "ram 미표기"],
    },
    match: {
      skuIds: ["desktop-imac-m1-24", "desktop-imac-m3-24", "desktop-imac-m4-24"],
      aliases: ["아이맥", "imac", "애플 아이맥", "아이맥 24"],
      familyHints: ["imac", "아이맥"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "M1 (2021.4) 첫 Apple Silicon iMac, 24인치 4.5K Retina, 7색 (Blue/Purple/Pink/Orange/Yellow/Green/Silver), 정가 1,690,000원~.",
        "M3 (2023.11) 8-core CPU + 8-core GPU (2-port) 또는 10-core GPU (4-port), 정가 1,890,000원~.",
        "M4 (2024.11, 현재 판매) base RAM 16GB 상향, 정가 1,990,000원~.",
        "Bunjang dense 67건 (M3 가장 dense), 시세 분포 1.2M~1.55M.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 (M1 < M3 < M4): 단계당 30~50만원 격차.",
        "포트 수 (2-port vs 4-port): 20~30만원, 4-port는 GPU 10-core.",
        "RAM (8/16/24/32GB): 단계당 15~25만원.",
        "SSD (256GB/512GB/1TB/2TB): 단계당 10~20만원.",
        "색상: 가격 동일, Blue/Silver가 인기, Orange/Yellow/Pink 약간 디스카운트.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 M1 vs M3 vs M4 외관 완전 동일 — chip 명시 필수.",
        "2-port vs 4-port: 외형 차이 X, GPU 코어 차이만. \"10코어\" 명시 = 4-port.",
        "Intel iMac 21\"/27\" vs Apple Silicon iMac 24\": 사이즈 다름. \"24인치\" 명시 시 safe.",
        "외장 키보드/마우스/스탠드만 매물 빈도 높음 — \"스탠드만\"/\"어댑터만\" reject 필수.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "발열/팬 소음 / GPU 이상 등 issue 매물 reject.",
        "Apple Care+ 잔여 → +5~10만원.",
        "Bunjang 시세: M3 8GB/256GB ~1.2M, M3 16GB/256GB ~1.4~1.65M.",
        "M1 약 800k~1.0M (M3 대비 30~40% 디스카운트).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: chip + 포트수 또는 RAM 명시 매물.",
        "mustNotContain: 27인치/21인치/Retina 5K/intel/맥북/맥미니/맥스튜디오 격리.",
        "parts reject: 스탠드만/어댑터만/케이블만/키보드만/마우스만/박스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iMac 공식 specs (M4)", url: "https://www.apple.com/kr/imac/specs/" },
      { sourceType: "official", label: "Apple Support iMac M1", url: "https://support.apple.com/ko-kr/111895" },
      { sourceType: "official", label: "Apple Support iMac M3", url: "https://support.apple.com/ko-kr/118213" },
      { sourceType: "internal_rule", label: "iMac 24 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:desktop:mac-mini-m2-256",
    category: "desktop",
    family: "mac_mini",
    model: "mac_mini_m2",
    title: "Mac mini 기준 공략",
    summary: "Mac mini M2 (2023.1) base 8GB/256GB. M4 (2024.11) form factor 변경 (큰 19.7cm → 소형 12.7cm). M2 8GB/256GB vs M2 Pro 16GB/512GB 시세 2배 차이 — \"Pro\" 명시 필수.",
    quickFacts: ["M1/M2/M2 Pro/M4/M4 Pro", "M2 base 990k", "M4 form factor 변경", "Apple TV와 \"미니\" 키워드 혼동"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "ram_gb", "ssd_gb"],
      positiveSignals: ["m1", "m2", "m4", "m2 pro", "m4 pro", "mac mini", "맥미니", "맥 미니", "8gb", "16gb", "256gb", "512gb"],
      ambiguousSignals: ["맥미니", "mac mini", "미니pc"],
      negativeSignals: ["macbook", "맥북", "imac", "아이맥", "mac studio", "맥스튜디오", "mac pro", "맥프로", "apple tv", "intel"],
      partsSignals: ["어댑터만", "케이블만", "박스만", "케이스만", "충전기만"],
      manualReviewSignals: ["pro 모호", "ram 미표기"],
    },
    match: {
      skuIds: ["desktop-mac-mini-m2-256"],
      aliases: ["맥미니", "mac mini", "맥 미니", "macmini"],
      familyHints: ["mac mini", "맥미니"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Mac mini M2 (2023.1): 8GB/256GB base, 정가 990,000원. M2 Pro (2023.1): 16GB/512GB base 1,890,000원~.",
        "M4 (2024.11, 현재 판매): 16GB/512GB base 990,000원, 새 form factor (12.7×12.7cm, 큰 19.7cm form 대비 소형화).",
        "M4 Pro: 24GB/512GB base 1,890,000원~, 12-core CPU + 16-core GPU.",
        "(legacy) Mac mini M1 (2020.11): 8GB/256GB, 시세 250~400k (M2 출시 후 -40% 디스카운트).",
        "Bunjang validated 6건 @ 450k~700k (M2 base).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 변형 (M1 < M2 < M2 Pro < M4 < M4 Pro) — 단계당 30~60만원 격차.",
        "RAM (8/16/24/32/48/64GB): 단계당 15~30만원.",
        "SSD (256/512GB/1TB/2TB/4TB/8TB): 단계당 15~30만원.",
        "외부 구성품 (모니터/키보드/마우스 포함 매물 = 별개 가치).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 M2 8GB/256GB (60만) vs M2 Pro 16GB/512GB (130만) — **2배** 차이. \"Pro\" 명시 또는 RAM 16GB+ 명시.",
        "M1 vs M2 외관 동일 — chip 명시 필수.",
        "M4 (2024.11) 새 form factor: M1/M2는 큰 form (19.7cm), M4는 소형 (12.7cm). 외관 구분 가능.",
        "RAM/SSD 비분리형 — \"증설\" 표기 매물은 외장 SSD 추가.",
        "Apple TV vs Mac mini — \"맥미니\" 명시 안 되면 모호.",
        "CPU 코어 수로도 분기 가능: M1=8, M2=8, M2 Pro=10/12.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "Apple Care+ 잔여 → +5만원.",
        "미개봉/박스미개봉 매물 자주 등장 (선물 받음).",
        "Bunjang 시세: M2 (8GB/256GB) 450~700k (median 500k), Apple Care+ 포함 700k+.",
        "M1 시세: 250~400k.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: M2 명시 매물만 (1 lane).",
        "mustNotContain: m1/m3/m4 + m2 pro/m2 ultra + macbook/imac/mac studio 격리.",
        "RAM 16GB+ 또는 1TB/2TB 매물은 narrow 진입 차단 (M2 base 외).",
        "parts reject: 어댑터만/케이블만/박스만/케이스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple Mac mini 공식 (M4)", url: "https://www.apple.com/kr/mac-mini/specs/" },
      { sourceType: "official", label: "Apple Support Mac mini M2", url: "https://support.apple.com/ko-kr/111837" },
      { sourceType: "official", label: "Apple Support Mac mini M4", url: "https://support.apple.com/ko-kr/121555" },
      { sourceType: "internal_rule", label: "Mac mini + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:desktop:mac-studio",
    category: "desktop",
    family: "mac_studio",
    model: "mac_studio",
    title: "Mac Studio 기준 공략",
    summary: "Mac Studio M2 Max/Ultra (2023.6), M3 Ultra + M4 Max (2025.3, 현재 판매). Max vs Ultra 외관 거의 동일 (Ultra가 ~1cm 두꺼움) — 시세 2배 차이. **\"MAXSTUDIO 의류\" false positive 주의**.",
    quickFacts: ["M2 Max/Ultra (2023.6)", "M4 Max + M3 Ultra (2025.3, 현재)", "Max vs Ultra 외관 비슷, 가격 2배", "MAXSTUDIO 의류 격리 필수"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "chip_variant", "ram_gb", "ssd_gb"],
      positiveSignals: ["mac studio", "맥스튜디오", "맥 스튜디오", "m2 max", "m2 ultra", "m3 ultra", "m4 max", "32gb", "36gb", "48gb", "64gb", "96gb", "128gb", "192gb", "256gb", "512gb", "1tb", "2tb"],
      ambiguousSignals: ["맥스튜디오", "mac studio", "스튜디오"],
      negativeSignals: ["macbook", "맥북", "imac", "아이맥", "mac mini", "맥미니", "mac pro", "맥프로", "maxstudio 의류", "옷"],
      partsSignals: ["어댑터만", "케이블만", "박스만", "케이스만"],
      manualReviewSignals: ["max/ultra 모호", "chip 미표기"],
    },
    match: {
      skuIds: ["desktop-mac-studio-m4-max-512"],
      aliases: ["맥스튜디오", "mac studio", "맥 스튜디오", "macstudio"],
      familyHints: ["mac studio", "맥스튜디오"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Mac Studio M4 Max (2025.3, 현재 판매): 36GB/512GB base, 14-core CPU + 32-core GPU, 정가 3,290,000원.",
        "Mac Studio M3 Ultra (2025.3, 현재 판매): 96GB/1TB base (Ultra는 96GB RAM 시작), 28-core CPU + 60-core GPU, 정가 5,790,000원~.",
        "(legacy) M2 Max (2023.6): 32GB/512GB base 2,890,000원. M2 Ultra (2023.6): 64GB/1TB base 5,490,000원.",
        "(legacy) M1 Max/Ultra (2022.3): Studio 첫 모델.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 변형 (M1 Max < M1 Ultra < M2 Max < M2 Ultra < M3 Ultra < M4 Max): 단계당 100~200만원.",
        "RAM (32/36/48/64/96/128/192/256GB): 단계당 30~100만원.",
        "SSD (512GB/1TB/2TB/4TB/8TB/16TB): 단계당 30~80만원.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 M2 Max vs M2 Ultra — 외관 거의 동일 (Ultra가 ~1cm 두꺼움). \"Max\" vs \"Ultra\" 명시 필수. 시세 2배 차이.",
        "**MAXSTUDIO 의류 false positive**: Bunjang에서 \"맥스튜디오\" 검색하면 의류 브랜드 매물 다수 유입.",
        "Mac Pro (Tower, 별개 제품) vs Mac Studio — \"맥프로\"는 Mac Pro, \"맥스튜디오\"는 별개.",
        "M3 Ultra (2025.3) — M3 칩셋 기반이지만 출시는 M4 Max와 동시.",
        "M5 Studio 미출시 (2026.5 시점 확인) — Apple Korea M4 Max + M3 Ultra만 노출.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "Apple Care+ 잔여 → +10~20만원.",
        "Heavy use (영상/3D 렌더링) → 발열/팬소음 이슈 확인.",
        "Bunjang 시세 (제한 sample): M2 Max (32GB/512GB) ~1.5~2.0M, M2 Ultra (64GB/1TB) ~3.0M+, M4 Max (36GB/512GB) ~2.5~2.8M.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: M4 Max + 512GB 명시만 (현재 1 lane).",
        "mustNotContain: m1/m2/m3 + m4 pro + m2 max/m2 ultra/m2ultra + imac/맥미니/맥북/맥프로 격리.",
        "1tb/1테라/2tb/2테라/4tb/4테라 — narrow 진입 차단 (512GB lane).",
        "⚠️ MAXSTUDIO 의류 false positive 실제 발생률 측정 추가 필요.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple Mac Studio 공식 (M4 Max + M3 Ultra)", url: "https://www.apple.com/kr/mac-studio/specs/" },
      { sourceType: "official", label: "Apple Support Mac Studio M2", url: "https://support.apple.com/ko-kr/111835" },
      { sourceType: "official", label: "Apple Support Mac Studio M4 Max", url: "https://support.apple.com/ko-kr/121556" },
      { sourceType: "internal_rule", label: "Mac Studio + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:bose-qc45",
    category: "headphone",
    family: "bose",
    model: "bose_qc45",
    title: "Bose QuietComfort 45 기준 공략",
    summary: "Bose QC45 (2021.9 출시, ₩449,000) — 24시간 배터리, USB-C 충전, Aware Mode + Quiet Mode 2단. **QC35 II와 외관 거의 동일** (Bose 시그니처 디자인 유지). QC Ultra 신세대(2023)와 시세 ~100k 격차.",
    quickFacts: ["2021.9 출시, ₩449,000", "QC35 II와 외관 동일", "QC Ultra와 100k+ 격차", "24h 배터리 + USB-C"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["qc45", "qc 45", "quietcomfort 45", "보스 qc45", "보스 큐씨45", "큐씨 45"],
      ambiguousSignals: ["보스 qc", "bose qc"],
      negativeSignals: ["qc ultra", "qc울트라", "울트라", "qc35", "qc 35", "qc25", "qc15", "이어버드", "earbuds", "qc se"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이스만", "파우치만", "케이블만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "qc se", "duplicate sku"],
    },
    match: {
      skuIds: ["bose-qc45", "bose-qc45-headphones"],
      aliases: ["보스 qc45", "bose qc45", "qc45", "quietcomfort 45", "보스 큐씨45"],
      familyHints: ["bose"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "2021.9 출시, 정가 449,000원. QC35 II 후속, 24h 배터리, USB-C 충전, 3.5mm Aux + USB-C 입력.",
        "Aware Mode + Quiet Mode 2단 ANC.",
        "색상: Triple Black / White Smoke / Eggshell / Midnight Blue / Stone Blue.",
        "Bunjang 시세: ~200k 수준 (QC Ultra ~250k 대비 50k 격차).",
        "QC SE (2023.9): 케이스/디자인만 변경, 기능 동일 — 가격 -50k 인하판.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (블랙/화이트스모크/에그쉘/미드나잇블루/스톤블루).",
        "구성품 (본체만 / 풀박스 / 케이스 포함).",
        "케이블 (3.5mm Aux + USB-C 동봉).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **QC45 vs QC35 II (2018)** — 외관 매우 유사 (Bose 시그니처 유지). 사진만으로는 구분 곤란. QC35 II 시세 ~150k, QC45 ~200k.",
        "🔥 **QC45 vs QC Ultra (2023)** — Ultra가 더 비쌈 (~250k+). catalog 격리 박힘.",
        "QC45 vs QC Earbuds (이어버드 별도) — `이어버드/earbuds` reject.",
        "QC45 vs QC SE (2023.9) — SE는 외관 변경 + 가격 인하, 기능 동일. 매물 혼재 가능.",
        "QC25 / QC15 (유선 구세대) — 시세 5~10만원 낮음.",
        "**catalog 중복 SKU**: bose-qc45 + bose-qc45-headphones 두 SKU 동시 존재 (Wave 65 발견). duplicate 정합성 검증 필요.",
        "LAUNCH_PLAN 1.6c: bose_qc45 replay complete 24.4% — broad SKU 충돌 + duplicate으로 AI L2 후보.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "케이스 + 풀구성 + 무파손 = 풀시세.",
        "이어패드 마모 + 헤드밴드 늘어남 시 시세 -3~5만원.",
        "케이스/파우치 단품 매물 빈도 높음 — accessory_or_parts_only 트리거.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: QC45 명시 매물만.",
        "mustNotContain: qc ultra/울트라/qc35/qc25/이어버드 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이스만/파우치만/케이블만.",
        "⚠️ duplicate SKU (bose-qc45 + bose-qc45-headphones) 정합성 검증 필요 → Wave 별도 정리.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Bose QC45 (단종 안내)", url: "https://www.bose.com/p/headphones/bose-quietcomfort-45-headphones" },
      { sourceType: "official", label: "Bose Korea", url: "https://www.bose.kr/" },
      { sourceType: "internal_rule", label: "Bose QC45 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:sony-wh-1000xm4",
    category: "headphone",
    family: "sony_wh1000xm",
    model: "sony_wh1000xm4",
    title: "Sony WH-1000XM4 기준 공략",
    summary: "Sony WH-1000XM4 (2020.8) — LDAC + 30h 배터리 + DSEE Extreme + 멀티포인트 (펌웨어 추가). XM3와 외관 유사, XM5와 완전 다름 (접이식 vs 비접이식). replay sku 98%/complete 98% — A급 closed-set.",
    quickFacts: ["2020.8 출시, ₩459,000", "접이식 디자인", "LDAC + 30h 배터리", "A급 closed-set (98%)"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["wh 1000xm4", "wh1000xm4", "wh-1000xm4", "1000xm4", "xm4"],
      ambiguousSignals: ["소니 헤드폰", "wh1000", "xm"],
      negativeSignals: ["xm3", "xm5", "xm6", "wf-", "wf 1000", "ult900n", "ch720n", "ch520"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이블만", "케이스만", "충전기만"],
      manualReviewSignals: ["세대 미표기"],
    },
    match: {
      skuIds: ["sony-wh-1000xm4"],
      aliases: ["wh 1000xm4", "wh1000xm4", "wh-1000xm4", "소니 xm4", "1000xm4"],
      familyHints: ["sony", "wh1000xm", "소니"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Sony WH-1000XM 시리즈 4세대 (2020.8 출시, 정가 459,000원).",
        "LDAC + DSEE Extreme + 멀티포인트 (펌웨어 무료 업데이트), 30h 배터리.",
        "**접이식 디자인** (XM5 비접이식과 핵심 차이). XM6 (2025.5)는 다시 접이식 복귀.",
        "색상: Black / Platinum Silver / Midnight Blue / Silent White (한정).",
        "replay 측정 sku 98%, complete 98% — A급 closed-set, leak 감시만.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 — Silent White 한정판 +30k 가산.",
        "구성품 (본체만 / 풀박스 / 하드케이스 포함 / Aux+USB-C 케이블 포함).",
        "펌웨어 (멀티포인트 활성 펌웨어 후 매물 = 가산) — 동등 가치 (펌웨어 무료).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 XM3 (2018) vs **XM4 (2020)** — 외관 거의 동일. 사진만 보면 구분 곤란. XM3 시세 ~130k, XM4 ~160k.",
        "XM4 (접이식) vs **XM5 (2022, 비접이식)** — 외관 완전 다름. 디자인 차이로 구분 가능.",
        "XM4 vs **XM6 (2025.5)** — 시세 격차 ~200k+. catalog mustNotContain `xm6` 박힘.",
        "WF-1000XM (이어버드 시리즈) — 별도 제품, mustNotContain `\"wf-\"`, `\"wf 1000\"`.",
        "ULT900N / CH520 등 별도 Sony 헤드폰 라인 — 모두 mustNotContain 박힘.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 하드케이스 + 풀구성 + 무파손 = 풀시세 ~150~180k.",
        "이어패드 교체 시점 확인 — 1년+ 사용 시 마모 큼.",
        "Sony 펌웨어 multipoint 활성 후 매물 = 표기 가산 (기능 동등).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"XM4\" / \"WH-1000XM4\" 명시 매물만.",
        "mustNotContain: xm3/xm5/xm6/wf-/ult900n/ch720n/ch520 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이블만/케이스만/충전기만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Sony Korea WH-1000XM4 (단종)", url: "https://www.sony.co.kr/electronics/support/headband-headphones-wh-1000x-series/wh-1000xm4" },
      { sourceType: "official", label: "Sony WH-1000XM4 specs", url: "https://www.sony.co.kr/electronics/headband-headphones/wh-1000xm4" },
      { sourceType: "internal_rule", label: "Sony WH-1000XM4 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:sony-wh-1000xm6",
    category: "headphone",
    family: "sony_wh1000xm",
    model: "sony_wh1000xm6",
    title: "Sony WH-1000XM6 기준 공략",
    summary: "Sony WH-1000XM6 (2025.5 글로벌 / 2025.6 한국) — **다시 접이식** 복귀 (XM4 회귀), QN3 프로세서 (XM5 대비 7배), 12 마이크, LE Audio. 정가 599,000원. 출시 1년 미만 — **\"미개봉 XM6\" 사기 매물 위험**.",
    quickFacts: ["2025.5/6 출시, ₩599,000", "접이식 복귀 (XM4 회귀)", "QN3 프로세서 + 12 마이크", "출시 직후 매물 적음"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["wh 1000xm6", "wh1000xm6", "wh-1000xm6", "1000xm6", "xm6"],
      ambiguousSignals: ["소니 헤드폰", "xm"],
      negativeSignals: ["xm3", "xm4", "xm5", "wf-", "wf 1000", "ult900n", "ch520"],
      partsSignals: ["이어패드만", "케이블만", "케이스만"],
      manualReviewSignals: ["세대 미표기", "사기 의심", "병행수입"],
    },
    match: {
      skuIds: ["sony-wh-1000xm6"],
      aliases: ["wh 1000xm6", "wh1000xm6", "wh-1000xm6", "소니 xm6", "1000xm6"],
      familyHints: ["sony", "wh1000xm", "소니"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Sony WH-1000XM 시리즈 6세대 (2025.5 글로벌, 2025.6 한국 출시).",
        "신규 QN3 프로세서 (XM5 대비 7배 처리속도), 12 마이크, **다시 접이식 헤드밴드** (XM4 회귀), 30h 배터리, LDAC + LE Audio.",
        "ANC 강화 (XM4 + XM5 모두 능가). 정가 599,000원.",
        "색상: Black / Platinum Silver / Midnight Blue.",
        "Bunjang 매물 ~450~500k 예상 (출시 8개월~1년차).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (블랙/플래티넘 실버/미드나잇 블루).",
        "구성품 (본체만 / 풀박스 / 케이스 포함).",
        "신품 vs 미개봉 vs 중고 (출시 직후 단계).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 XM5 vs XM6 — 외관 변화 큼 (XM6 접이식 복귀, XM5 비접이식). 매물 사진으로 구분 가능.",
        "**사기 위험**: 신모델 출시 직후 단계 → 가짜/회색물품 매물 risk. \"최신 XM6 미개봉\" 후 XM5 발송 사례 해외 보고됨.",
        "병행수입품 risk — 신모델은 국내 정식 vs 해외 직구 가격 차 큼.",
        "WF-1000XM6 (이어버드 가능) 별도 제품.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "미개봉 매물 다수 (출시 직후).",
        "정품 시리얼 검증 권장 (Sony 코리아 정식 vs 병행).",
        "정품 하드케이스 + USB-C 케이블 + 비행기 어댑터 = 풀구성.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"XM6\" / \"WH-1000XM6\" strict mustContain.",
        "mustNotContain: xm5/xm4/wf-/ult900n/ch520 격리.",
        "출시 1년 미만 — 시세 학습 데이터 부족 가능, narrow lane 신중 검토.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Sony Korea WH-1000XM6", url: "https://www.sony.co.kr/electronics/headband-headphones/wh-1000xm6" },
      { sourceType: "internal_rule", label: "Sony WH-1000XM6 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:beats-solo-4",
    category: "headphone",
    family: "beats",
    model: "beats_solo_4",
    title: "Beats Solo 4 기준 공략",
    summary: "Beats Solo 4 (2024.5) — Lossless USB-C + 50h 배터리, Apple H1 칩 미탑재 (Solo Pro와 다름). **Jennie x Beats (2024.10)** 한정판 시세 +30~50%, 분포 매우 wide. Solo 3 (2016)과 외관 거의 동일.",
    quickFacts: ["2024.5 출시, ₩249,000", "Lossless USB-C + 50h 배터리", "Jennie x Beats 한정 (BLACKPINK)", "Solo 3와 외관 동일"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "limited_edition", "fullset_vs_parts"],
      positiveSignals: ["솔로 4", "솔로4", "solo 4", "solo4", "비츠 솔로4", "beats solo 4", "제니", "jennie"],
      ambiguousSignals: ["비츠 솔로", "beats solo"],
      negativeSignals: ["솔로 3", "solo 3", "솔로3", "solo3", "솔로 2", "solo 2", "solo pro", "솔로 프로", "studio pro", "스튜디오 프로", "studio 3", "studio3", "fit pro", "beats flex", "powerbeats", "닥터드레 ep"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이스만", "파우치만", "캐링백만", "케이블만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "한정판 표기 누락", "제니 미표기"],
    },
    match: {
      skuIds: ["beats-solo4"],
      aliases: ["솔로 4", "솔로4", "solo 4", "solo4", "비츠 솔로4", "beats solo 4"],
      familyHints: ["beats", "비츠"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Beats Solo 4 (2024.5 출시, 모델 A2913, 정가 249,000원).",
        "Lossless USB-C 오디오, 50h 배터리, 신규 음향 (드라이버 변경), Apple H1 chip 미탑재.",
        "기본 컬러: Matte Black / Slate Blue / Cloud Pink.",
        "**한정판: Jennie x Beats (2024.10)** Onyx Black / Ruby Red — 한정판 시세 +30~50k 가산.",
        "기타 K-pop 협업 컬러 (BLACKPINK 시리즈 등).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (Matte Black / Slate Blue / Cloud Pink / Jennie Onyx Black / Jennie Ruby Red).",
        "**Jennie 한정판 여부** (가장 큰 가격 분기).",
        "구성품 (본체만 / 풀박스 / 캐링 파우치 포함).",
        "AppleCare+ 보증 잔여.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **Jennie 한정판 시세 매우 wide** — Matte Black ~180k, Jennie Ruby Red 350~640k. **price_too_high reject 자주 발동**.",
        "**Solo 3 (2016)** → Solo 4 (2024) — 8년 시차, 외관 매우 유사. catalog mustNotContain 박힘.",
        "Solo Pro (2019, 단종) — ANC 탑재 별도 모델.",
        "Studio Pro (2023) — over-ear, 시세 ~280k. mustNotContain 박힘.",
        "Studio 3 / Fit Pro / Beats Flex / PowerBeats — 다른 라인업, 모두 격리.",
        "\"닥터드레 EP\" (단종 별도) reject 박힘.",
        "현재 LAUNCH_PLAN 작업: backfill 측정 — current parse_ready 15, Jennie 한정판 가격 상한 완화 시 확장 가능.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 캐링 파우치 + USB-C 케이블 + 무파손 = 풀시세.",
        "Jennie 한정판은 박스/패키지 보존 시 한정판 프리미엄.",
        "Bunjang 시세: 일반 ~180k, Jennie ~350~640k.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: Solo 4 명시 매물만 (replay sku 100%, complete 100%, A급 closed-set).",
        "mustNotContain: 솔로 3/2/Pro + Studio Pro/3 + Fit Pro/Flex/PowerBeats + 닥터드레 EP 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이스만/파우치만/케이블만.",
        "Jennie 한정판 매물은 별도 시세군 — 가격 상한 완화 정책 검토.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Beats Korea Solo 4", url: "https://www.beatsbydre.com/kr/headphones/solo4" },
      { sourceType: "official", label: "Beats Jennie 한정판", url: "https://www.beatsbydre.com/kr/special-editions/jennie" },
      { sourceType: "internal_rule", label: "Beats Solo 4 + Jennie limited + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:beats-studio-pro",
    category: "headphone",
    family: "beats",
    model: "beats_studio_pro",
    title: "Beats Studio Pro 기준 공략",
    summary: "Beats Studio Pro (2023.7) — USB-C Lossless + ANC + Transparency, 40h 배터리. **Studio 3 (2017)과 외관 거의 동일** (6년 시차, Beats over-ear 디자인 유지). replay sku 81.6%/complete 100% — A급 closed-set.",
    quickFacts: ["2023.7 출시, ₩449,000", "USB-C Lossless + ANC + 40h", "Studio 3와 외관 동일", "A급 closed-set (81.6%)"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["스튜디오 프로", "studio pro", "스튜디오프로", "studiopro", "비츠 스튜디오 프로", "beats studio pro"],
      ambiguousSignals: ["비츠 스튜디오", "beats studio"],
      negativeSignals: ["studio 3", "studio3", "studio 2", "studio2", "솔로", "solo 4", "solo4", "solo 3", "studio buds", "fit pro", "powerbeats", "beats flex", "이어버드", "earbuds"],
      partsSignals: ["이어패드만", "이어쿠션만", "헤드쿠션만", "케이스만", "파우치만", "케이블만", "충전기만"],
      manualReviewSignals: ["세대 미표기", "studio 단독"],
    },
    match: {
      skuIds: ["beats-studio-pro"],
      aliases: ["스튜디오 프로", "studio pro", "스튜디오프로", "studiopro", "비츠 스튜디오 프로", "beats studio pro"],
      familyHints: ["beats", "비츠"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Beats Studio Pro (2023.7 출시, 모델 A2823, 정가 449,000원).",
        "USB-C Lossless 오디오, ANC + Transparency 모드, 40h 배터리, **신규 음향 (Solo Pro 후속 같은 위치)**.",
        "색상: Black / Navy / Sandstone / Deep Brown.",
        "협업: Kim Kardashian SKIMS 한정 (2024), 기타 협업 다수.",
        "Bunjang 시세 ~280k 수준.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (블랙/네이비/샌드스톤/딥 브라운/한정판).",
        "구성품 (본체만 / 풀박스 / 케이스 포함).",
        "USB-C 케이블 / 3.5mm Aux 케이블 동봉.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **Studio 3 (2017) vs Studio Pro (2023)** — 6년 시차, 외관 거의 동일 (Beats over-ear 디자인 유지). \"Studio Pro\" / \"스튜디오 프로\" 명시 필수.",
        "**Studio Pro vs Solo 4** — Pro는 over-ear, Solo는 on-ear. 매물에서 \"스튜디오\" vs \"솔로\" 표기 명확.",
        "Studio Buds / Studio Buds + (이어버드) — 별개 제품. `이어버드/earbuds` reject.",
        "Studio Pro 출시 후 Studio 3 단종 — 시세 ~150k 격차.",
        "Beats Fit Pro / PowerBeats / Beats Flex — 이어폰 라인업, 별개.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 케이스 + 풀구성 + 무파손 = 풀시세.",
        "이어패드 + 헤드쿠션 마모 시 시세 -3~5k.",
        "Bunjang 시세 ~280k (median).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"Studio Pro\" / \"스튜디오 프로\" / \"studiopro\" 명시 매물만.",
        "mustNotContain: studio 3/2 + 솔로 + studio buds + fit pro + powerbeats + 이어버드 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이스만/파우치만/케이블만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Beats Korea Studio Pro", url: "https://www.beatsbydre.com/kr/headphones/studio-pro" },
      { sourceType: "official", label: "Beats 한국", url: "https://www.beatsbydre.com/" },
      { sourceType: "internal_rule", label: "Beats Studio Pro + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:headphone:sony-wh-ch520",
    category: "headphone",
    family: "sony_wh",
    model: "sony_wh_ch520",
    title: "Sony WH-CH520 기준 공략",
    summary: "Sony WH-CH520 (2023.3) — Sony 저가형 무선 헤드폰, ANC 미탑재, 50h 배터리, DSEE 업스케일링, USB-C. **CH720N (ANC 탑재 상위)과 분리 핵심**. 정가 79,000원, 중고 35~70k. replay sku 98%/complete 98% — A급.",
    quickFacts: ["2023.3 출시, ₩79,000", "ANC 미탑재 (저가형)", "50h 배터리, 147g", "CH720N (ANC)과 분리"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["wh-ch520", "wh ch520", "whch520", "ch520"],
      ambiguousSignals: ["wh-ch", "소니 헤드폰"],
      negativeSignals: ["ch700n", "ch710n", "ch720n", "ch500", "ult900n", "ult wear", "ultwear", "1000xm", "xm3", "xm4", "xm5", "xm6", "linkbuds", "wf-"],
      partsSignals: ["이어패드만", "이어쿠션만", "케이스만", "파우치만", "케이블만", "충전기만"],
      manualReviewSignals: ["모델 미표기", "ch 단독"],
    },
    match: {
      skuIds: ["sony-wh-ch520"],
      aliases: ["wh-ch520", "wh ch520", "whch520", "ch520", "소니 ch520"],
      familyHints: ["sony", "소니"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Sony WH-CH520 (2023.3 출시, 정가 79,000원).",
        "ANC 미탑재 (저가형 분류), 50h 배터리, DSEE 음질 업스케일링, USB-C, 147g (가벼움).",
        "색상: Black / White / Beige / Blue.",
        "포지셔닝: 학생/입문용. 정가 자체가 낮아 중고와 시세 격차 작음.",
        "Bunjang 시세 35~70k 수준.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (블랙/화이트/베이지/블루).",
        "구성품 (본체만 / 풀박스).",
        "신품 vs 중고 — 정가 낮아 격차 작음.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 CH520 (ANC 미탑재, 2023) vs **CH720N (ANC 탑재, 2023 동시 출시)** — 시세 ~50k 격차. catalog `mustNotContain: ch720n` 박힘.",
        "CH700N / CH710N (구세대 ANC) — 외관 유사. `mustNotContain: ch700n, ch710n`.",
        "CH500 (구세대 유선) — 별도 모델. `mustNotContain: ch500`.",
        "1000XM 시리즈 (XM3/4/5/6) 격리 — 가격대 완전 다름.",
        "LinkBuds 시리즈 (WF-) — 이어버드 별개.",
        "ULT Wear / ULT900N — 베이스 부스트 헤드폰 별도.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "신품 매물 다수 — 정가 79k라 박스 풀구성 매물 흔함.",
        "이어패드 마모 적음 (사용기간 짧음).",
        "Bunjang 시세 35~70k.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"WH-CH520\" / \"CH520\" strict mustContain.",
        "mustNotContain: ch700n/ch710n/ch720n/ch500/ult900n/ult wear + 1000xm 전 세대 + wf-/linkbuds 격리.",
        "parts reject: 이어패드만/이어쿠션만/케이스만/케이블만.",
        "replay sku 98%, complete 98% — A급 closed-set, leak 감시만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Sony Korea WH-CH520", url: "https://www.sony.co.kr/electronics/headband-headphones/wh-ch520" },
      { sourceType: "official", label: "Sony WH-CH520 specs", url: "https://www.sony.com/electronics/headband-headphones/wh-ch520/specifications" },
      { sourceType: "internal_rule", label: "Sony CH520 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:speaker:jbl-flip-6",
    category: "speaker",
    family: "jbl",
    model: "jbl_flip_6",
    title: "JBL Flip 6 기준 공략",
    summary: "JBL Flip 6 (2021.11) — USB-C, IP67, 12h 재생, Bluetooth 5.1, PartyBoost. **Flip 7 (2025.2) 출시 후 시세 자연 하락**. Flip 5/7 모두 USB-C라 단자로 세대 구분 불가 — IP 등급/Bluetooth 버전/트위터로 구분.",
    quickFacts: ["2021.11 출시", "USB-C + IP67 + 12h", "Flip 5/7과 USB-C 동일", "median 75~80k"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["flip 6", "flip6", "플립 6", "플립6", "jbl flip 6"],
      ambiguousSignals: ["jbl flip", "플립", "jbl 플립"],
      negativeSignals: ["flip 5", "flip5", "플립 5", "플립5", "flip 7", "flip7", "플립 7", "플립7", "flip 4", "플립 4", "flip 3"],
      partsSignals: ["케이블만", "충전기만", "usb만", "스트랩만", "끈만", "박스만", "케이스만"],
      manualReviewSignals: ["세대 미표기"],
    },
    match: {
      skuIds: ["speaker-jbl-flip-6"],
      aliases: ["jbl flip 6", "flip 6", "flip6", "플립 6", "플립6", "jbl 플립6"],
      familyHints: ["jbl"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "JBL Flip 6 (2021.11~12 출시, 정가 149,000원).",
        "USB-C, IP67 방진방수, 12h 재생, Bluetooth 5.1, PartyBoost (스피커 다중 연결), 트위터 + 우퍼 2-way 구조.",
        "구세대 Flip 5 (2019): USB-C, IPX7 (방진 없음), Bluetooth 4.2 — 시세 절반.",
        "신세대 Flip 7 (2025.2): USB-C 무손실 오디오, IP68, 14~16h (PlayTime Boost), Bluetooth 5.4, Auracast, PushLock — 출시 후 Flip 6 자연 하락 진행 중.",
        "색상 7~11종: Black / Blue / Red / White / Gray / Green / Pink / Teal / Navy / 스쿼드(카모) 한정.",
        "Bunjang median 75~80k (Flip 7 출시 후), 신품 미개봉 130k~.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (Flip 5 / 6 / 7) — 세대당 시세 30~50% 격차.",
        "색상 — 한정판 (스쿼드/카모) +1~2만원.",
        "본품 + 충전 케이블(USB-C→USB-A 동봉) = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 Flip 5/6/7 모두 USB-C 단자 — **단자로 세대 구분 불가**. IP 등급 (Flip 5 IPX7 / Flip 6 IP67), Bluetooth 버전 (4.2 / 5.1 / 5.4), 트위터 유무로 구분.",
        "Flip 4 (3세대 전, 2017) — Micro-USB. 매물 사진의 단자가 Micro-USB면 Flip 4.",
        "\"JBL Flip\" 단독 — 세대 미상 (manual review).",
        "Flip 7 출시(2025.2) 후 Flip 6 시세 50~100k로 자연 하락.",
        "한정판 스쿼드/카모 에디션 별도 시세 (+1~3만원).",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "본품 + 충전 케이블 + 박스 = 풀구성 (박스 유무는 +0.5~1만).",
        "Bunjang median 75~80k, 신품 미개봉 130k~.",
        "한정판 박스 보존 시 한정판 프리미엄.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"Flip 6\" / \"Flip6\" / \"플립 6\" / \"플립6\" + \"JBL/제이비엘\" 명시 매물만.",
        "**Flip 5/7 격리 룰 추가 필요** (현재 catalog mustNotContain 없음 — patch 후보).",
        "parts reject: 케이블만/충전기만/스트랩만/박스만.",
        "JBL 충전 단독 (제품 아닌 충전기) reject.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "JBL Korea Flip 6", url: "https://www.jbl.com/kr/portable-speakers/FLIP6-.html" },
      { sourceType: "official", label: "JBL Korea Flip 시리즈", url: "https://www.jbl.com/kr/flip-series/" },
      { sourceType: "internal_rule", label: "JBL Flip 6 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:speaker:marshall-emberton-ii",
    category: "speaker",
    family: "marshall",
    model: "marshall_emberton_ii",
    title: "Marshall Emberton II 기준 공략",
    summary: "Marshall Emberton II (2022.5) — USB-C, IP67, 30h, BT 5.1, Stack Mode. **Emberton III (2024.8.26)** 출시로 자연 하락. 한국 매물 크림 색상 60%+ 압도. \"마샬\" 단독 검색 시 기타 앰프/거치형 스피커/헤드폰 다 매칭 — 격리 필수.",
    quickFacts: ["2022.5 출시, ₩219,000", "USB-C + IP67 + 30h", "Emberton III (2024.8) 후속", "크림/블랙 색상"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["emberton ii", "emberton 2", "엠버튼2", "엠버튼 2", "마샬 엠버튼2", "marshall emberton ii"],
      ambiguousSignals: ["엠버튼", "emberton", "마샬"],
      negativeSignals: ["emberton iii", "emberton 3", "엠버튼3", "엠버튼 3", "emberton i", "emberton 1", "willen", "tufton", "stockwell", "kilburn", "middleton", "stanmore", "acton", "woburn", "major", "minor", "monitor", "기타 앰프", "guitar amp", "콤보앰프"],
      partsSignals: ["케이블만", "충전기만", "스트랩만", "박스만"],
      manualReviewSignals: ["세대 미표기", "엠버튼 단독"],
    },
    match: {
      skuIds: ["speaker-marshall-emberton-ii"],
      aliases: ["marshall emberton ii", "emberton ii", "엠버튼2", "엠버튼 2", "마샬 엠버튼2", "마샬 엠버튼 2"],
      familyHints: ["marshall", "마샬"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Marshall Emberton II (2022.5 출시, 정가 219,000원).",
        "USB-C 충전, IP67 방진방수, 30h 재생, Bluetooth 5.1, Stack Mode (다중 스피커 연결).",
        "구세대 Emberton I (1세대, 2020): USB-C, IPX7 (방진 X), 20h — 시세 70~80% (단종).",
        "신세대 Emberton III (2024.8.26): USB-C, IP67, **32h**, BT 5.3 LE + Auracast, 내장 마이크/스피커폰, 별도 전원 버튼 — 정가 ~280k.",
        "색상: 블랙 앤 브라스 / **크림** (한국 매물 60%+).",
        "Bunjang validated 16건 @ 140~200k, median ~150k (신품 미개봉 다수).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (I / II / III) — 세대당 시세 20~40% 격차.",
        "색상 — 크림 vs 블랙 시세 거의 동일 (한국은 크림 인기).",
        "본품 + USB-C 케이블(C→C 동봉, 본체 직진) = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **\"엠버튼\" 단독 검색** = I/II/III 모두 매칭. catalog는 `emberton ii / 엠버튼 2` 명시 필수.",
        "Emberton III (2024.8) 출시 후 II 시세 자연 하락 진행 중.",
        "**\"마샬\" 단독 검색** = 기타 앰프 + 거치형 (Stanmore/Acton/Woburn) + 헤드폰 (Major V / Monitor II) 다 매칭 → 격리 필수 (`기타 앰프`, `콤보앰프` mustNotContain 박힘).",
        "다른 마샬 포터블 (Willen II / Tufton / Stockwell II / Kilburn II / Middleton) — 모두 별개 모델.",
        "Marshall Korea 페이지 존재 여부 불확실 — global 페이지가 ko 언어 지원.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "본품 + USB-C 케이블 + 박스 = 풀구성.",
        "Bunjang median ~150k (신품 미개봉 다수), 사용감 매물 140~160k.",
        "Emberton III 출시 후 II 자연 하락.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: Emberton II / 엠버튼 2 명시 매물만.",
        "mustNotContain: emberton iii/i / willen/tufton/stockwell/kilburn/middleton/stanmore/acton/woburn / major/monitor (헤드폰) / 기타 앰프 — 모두 격리.",
        "parts reject: 케이블만/충전기만/스트랩만/박스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Marshall Emberton II", url: "https://www.marshall.com/global/en/speakers/emberton-ii" },
      { sourceType: "official", label: "Marshall Korea", url: "https://www.marshall.com/ko/kr" },
      { sourceType: "internal_rule", label: "Marshall Emberton II + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:speaker:bose-soundlink-flex",
    category: "speaker",
    family: "bose_soundlink",
    model: "bose_soundlink_flex",
    title: "Bose SoundLink Flex 기준 공략",
    summary: "Bose SoundLink Flex (2021.9 1세대 / 2024.9 2세대) — USB-C + IP67 + 12h. 2세대는 BT 5.3 + 디자인 미세 변경. **SE (2023 한정 색상) vs 2세대 vs SE2 표기 혼동** — catalog 세대 분리 룰 없음.",
    quickFacts: ["1세대 (2021.9) / 2세대 (2024.9)", "USB-C + IP67 + 12h", "SE/2세대/SE2 표기 혼동", "Bunjang 83~160k"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["soundlink flex", "사운드링크 플렉스", "sound link flex", "플렉스"],
      ambiguousSignals: ["보스 사운드링크", "bose soundlink", "보스"],
      negativeSignals: ["mini", "미니", "revolve", "리볼브", "color", "컬러", "micro", "마이크로", "max", "macs", "사운드바", "soundbar", "qc", "quietcomfort", "이어버드", "earbuds"],
      partsSignals: ["케이블만", "충전기만", "스트랩만", "loop만", "박스만"],
      manualReviewSignals: ["세대 미표기", "se vs 2세대 모호"],
    },
    match: {
      skuIds: ["speaker-bose-soundlink-flex"],
      aliases: ["soundlink flex", "사운드링크 플렉스", "보스 사운드링크 플렉스", "bose soundlink flex"],
      familyHints: ["bose"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "1세대 (2021.9): USB-C, IP67, 12h, Bluetooth 4.2, 정가 219,000원.",
        "SE (특별판, 2023): 1세대 동일 스펙 + 새 색상 (사이프러스 그린 / 화이트 스모크 등 한정). 단순 색상 SKU.",
        "2세대 (2024.9): USB-C, IP67, 12h, **Bluetooth 5.3**, 미세 디자인 개선 (재배치된 버튼, 상태 LED 추가, 재생/일시정지 전용).",
        "색상 1세대: 블랙 / 화이트 스모크 / 스톤 블루 / 사이프러스 그린.",
        "색상 SE 한정판: 그린 리미티드 등.",
        "색상 2세대: 블랙 / 샌드스톤 / 블루 더스트 / 알파인 세이지.",
        "Bunjang validated 17건 @ 83~160k, median ~115~120k.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (1세대 / 2세대) — 2024.9 이후 매물 혼재, 시세 격차 ~20%.",
        "색상 — SE/한정판 +1~2만원.",
        "본품 + USB-C 케이블 + 손목 스트랩 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **SE vs 2세대 vs SE2 표기 혼동** — Bunjang 매물에서 \"SE\"가 한정 색상(2023)을 의미하는지 2세대(2024)를 의미하는지 제목만으론 알 수 없음. detail 확인 필수.",
        "\"SE2\"는 비공식 표기 (공식 명칭은 SoundLink Flex 2nd Gen).",
        "\"Soundlink\" vs \"SoundLink\" 대소문자 변형 흡수 필요.",
        "**\"보스 사운드링크\" 단독** = Mini/Revolve/Color/Micro/Max 모두 매칭 → 격리 필수.",
        "\"Bose 블루투스 스피커\" 단독 — 모델 미상 (manual review).",
        "1세대/2세대 모두 USB-C 사용 (Micro-USB 시기 없음).",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "본품 + USB-C 케이블 + 스트랩 = 풀구성.",
        "Bunjang 시세: 1세대 80~130k, 2세대 100~150k, 미개봉 신상 130~160k.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: SoundLink Flex 명시 매물만.",
        "mustNotContain: mini/revolve/color/micro/max/사운드바/qc/이어버드 격리 완료.",
        "⚠️ **2세대 분리 룰 없음** — 향후 catalog 분기 필요 (현재 1세대/2세대 동일 lane 흡수).",
        "parts reject: 케이블만/충전기만/스트랩만/loop만/박스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Bose SoundLink Flex 글로벌", url: "https://www.bose.com/c/portable-speakers" },
      { sourceType: "official", label: "Bose Korea SoundLink Flex", url: "https://www.bose.co.kr/ko_kr/products/speakers/portable_speakers/soundlink-flex-bluetooth-speaker.html" },
      { sourceType: "internal_rule", label: "Bose SoundLink Flex + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:speaker:bose-soundlink-mini-ii",
    category: "speaker",
    family: "bose_soundlink",
    model: "bose_soundlink_mini_ii",
    title: "Bose SoundLink Mini II 기준 공략",
    summary: "Bose SoundLink Mini II (2015.6, Micro-USB) + Mini II SE (2019.10, USB-C). **충전 단자로 SE/일반판 명확 구분 가능** (Micro-USB = 일반, USB-C = SE). 매물 매우 적음 (Wave 20 validated 1건).",
    quickFacts: ["2015.6 출시 (Mini II)", "2019.10 SE (USB-C)", "충전 도크/크래들 구조", "Wave 20 measure 1건"],
    parserHints: {
      mustSplitAxes: ["generation", "color_variant", "fullset_vs_parts"],
      positiveSignals: ["soundlink mini ii", "soundlink mini 2", "사운드링크 미니 2", "사운드링크 미니 ii", "보스 사운드링크 미니 2", "보스 미니 2"],
      ambiguousSignals: ["사운드링크미니", "보스 미니", "soundlink mini"],
      negativeSignals: ["mini i ", "mini 1", "미니 1", "flex", "revolve", "color", "micro", "max", "qc", "quietcomfort", "사운드바", "soundbar"],
      partsSignals: ["케이블만", "충전기만", "도크만", "충전 도크만", "크래들만", "cradle만", "충전 어댑터만", "박스만"],
      manualReviewSignals: ["se 표기 없음", "se vs 일반 모호"],
    },
    match: {
      skuIds: ["speaker-bose-soundlink-mini-ii"],
      aliases: ["soundlink mini ii", "soundlink mini 2", "사운드링크 미니 2", "보스 사운드링크 미니 2", "보스 미니 2"],
      familyHints: ["bose"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Mini II 일반판 (2015.6 출시): Micro-USB 충전, 10h 재생, 방수/방진 없음 (IP 등급 없음), Bluetooth 4.2, AUX-in 3.5mm.",
        "Mini II Special Edition (2019.10): **USB-C 충전**, 12h 재생, BT 4.2 (그 외 동일).",
        "구세대 Mini I (2013): Micro-USB, 7h — 단종.",
        "색상 (일반판): 카본 (짙은 그레이) / 펄 (흰색).",
        "색상 (SE): 트리플 블랙 / 럭스 실버.",
        "Wave 20 validated 1건 @ 120k — 매물 매우 적음 (단종 직전).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (Mini I / Mini II / Mini II SE) — **충전 단자로 명확 구분**.",
        "일반판 / SE — SE는 USB-C + 색상 차별 + 12h 배터리. 시세 +1~3만원.",
        "본품 + 충전 도크(크래들 형식) + USB 케이블 + 어댑터 = 풀구성.",
        "도크는 Mini II 고유 특징 — 본체와 묶음 가치.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **충전 단자로 SE/일반판 구분이 가장 확실**: Micro-USB = 일반판(2015), USB-C = SE(2019).",
        "색상 표기 혼란: Mini II \"카본\"과 SE \"트리플 블랙\" 둘 다 검은색 계열 — 색상만으론 판별 안 됨.",
        "\"보스 미니\" 단독 = Mini I 매물도 섞임. catalog `mini i ` mustNotContain 박힘.",
        "충전 도크/크래들 단품 매물 多 — 본체 아닌데 비싸 보임. parts reject.",
        "시세 매물 매우 적음 (Wave 20 validated 1건, 단종 직전).",
        "오래된 모델 → 배터리 수명 저하 매물 多. 시세 분포 wide (50~130k).",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "본체 + 충전 도크 + 케이블 + 어댑터 = 풀구성.",
        "배터리 정상 작동 확인 필수 (배터리 광탈 매물 多).",
        "Bunjang 시세 50~130k (단종 진행 중, 매물 적음).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"Mini II\" / \"미니 2\" 명시 매물만.",
        "mustNotContain: mini i / flex/revolve/color/micro/max + 사운드바 + qc/quietcomfort 격리.",
        "⚠️ **SE 변형 별도 분리 룰 없음** — USB-C SE 매물도 같은 lane 흡수. 매물 표본 적어 보류 추천.",
        "parts reject: 케이블만/충전기만/도크만/크래들만/어댑터만/박스만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Bose press release Mini II (2015)", url: "https://www.bose.com/pressroom/bose-introduces-new-soundlink-mini-bluetooth-speaker-ii" },
      { sourceType: "official", label: "Bose SoundLink lineup", url: "https://www.bose.com/c/portable-speakers" },
      { sourceType: "internal_rule", label: "Bose SoundLink Mini II + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:earphone:airpods-gen",
    category: "earphone",
    family: "airpods",
    model: "airpods_gen",
    title: "AirPods 1/2/3세대 기준 공략",
    summary: "AirPods 1세대(2016.12)/2세대(2019.3)/3세대(2021.10) — 1/2/3세대 모두 Lightning. 4세대(2024.9)부터 USB-C. **1세대 vs 2세대 외관 동일** (모델 번호로만 구분). **3세대 vs Pro 1세대 디자인 유사**로 혼동 자주. catalog에 1세대 SKU 부재.",
    quickFacts: ["1세대 (2016.12)", "2세대 (2019.3, 유선/무선 케이스)", "3세대 (2021.10, 짧은 스템)", "4세대 USB-C부터 (2024.9)"],
    parserHints: {
      mustSplitAxes: ["generation", "case_type", "fullset_vs_parts"],
      positiveSignals: ["1세대", "2세대", "3세대", "에어팟 1", "에어팟 2", "에어팟 3", "에어팟1", "에어팟2", "에어팟3", "airpods 1", "airpods 2", "airpods 3", "무선충전", "유선충전"],
      ambiguousSignals: ["에어팟", "airpods"],
      negativeSignals: ["프로", "pro", "맥스", "max", "4세대", "airpods 4", "anc", "usb-c", "usbc", "c타입"],
      partsSignals: ["왼쪽만", "오른쪽만", "왼유닛", "우유닛", "유닛만", "한쪽만", "케이스만", "충전케이스만", "박스만", "케이블만"],
      manualReviewSignals: ["세대 미표기", "에어팟 단독", "1세대 vs 2세대 모호"],
    },
    match: {
      skuIds: ["airpods-2", "airpods-3"],
      aliases: ["에어팟", "airpods", "에어팟 1세대", "에어팟 2세대", "에어팟 3세대"],
      familyHints: ["airpods", "에어팟"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "AirPods 1세대 (2016.12, A1722/A1523): Lightning, W1 칩, 5h, 더블탭 조작. 단종. 시세 3~5만 (배터리 노후 매물 多).",
        "AirPods 2세대 (2019.3.20, A2031/A2032): Lightning, H1 칩, Hey Siri, 5h. **유선 충전 케이스** + **무선 충전 케이스 (Qi 호환)** 별도 SKU.",
        "AirPods 3세대 (2021.10.26): Lightning + MagSafe 무선 충전, H1 칩, **짧은 스템** 디자인, IPX4 방수, 공간 음향, 포스 센서, 6h.",
        "AirPods 4 / 4 ANC (2024.9~): USB-C, H2 칩 — 별도 SKU.",
        "색상: 모든 세대 화이트 단일.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (1/2/3/4) — 외관으로 명확 구분: 1·2세대 = 긴 스템, 3세대 = 짧은 스템+넓은 케이스, 4세대 = 짧은 스템+더 작은 케이스+USB-C.",
        "케이스 충전 방식 (2세대 한정): 유선만 (Lightning) vs 무선 (Lightning + Qi) — 별도 SKU.",
        "본품 풀구성: 본체 + 충전 케이스 + Lightning 케이블 (1/2/3세대) / USB-C (4세대).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **1세대 vs 2세대 외관 동일** — 모델 번호로만 구분 (1세대 A1722/A1523, 2세대 A2031/A2032). 시리얼/케이스 안쪽 모델 번호 사진 필수.",
        "🔥 **3세대 vs Pro 1세대** — 둘 다 짧은 스템 디자인 유사. Pro 1세대는 실리콘 이어팁 + ANC, 3세대는 일반형 (이어팁 X).",
        "2세대 유선 vs 무선 충전 케이스 — 시세 약 1만원 격차.",
        "4세대 (2024.9) 출시 후 2/3세대 시세 자연 하락.",
        "\"에어팟\" 단독 — 세대 미상 (manual review).",
        "케이스만, 본체만(왼쪽/오른쪽 한쪽만) 단품 매물 빈도 매우 높음 — parts reject.",
        "**1세대 catalog 부재** — 단종 + 매물 적음으로 미등록. 자급제 broad 흡수 risk.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "1세대: 배터리 노후 (작동 의심 매물 多) → 시세 매우 낮음.",
        "2세대 유선/무선 본품 + 케이스 + 케이블 = 풀구성.",
        "3세대: MagSafe 충전 정상 작동 확인 필수.",
        "Bunjang AirPods broad 검증 (38건 클린) — 2/3세대 매물 거의 없음 (자연 하락 + 노후).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: airpods-2 (2세대), airpods-3 (3세대) catalog 등재.",
        "mustNotContain: \"프로/pro/맥스/max\" + \"4세대/airpods 4/anc/usb-c\" 격리.",
        "parts reject: 왼쪽만/오른쪽만/유닛만/한쪽만/케이스만/박스만/케이블만.",
        "⚠️ **1세대 SKU 없음** — 향후 매물 자급제 broad 흡수 risk, 모니터링 필요.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods 한국", url: "https://www.apple.com/kr/airpods/" },
      { sourceType: "official", label: "Apple AirPods 비교", url: "https://www.apple.com/kr/airpods/compare/" },
      { sourceType: "official", label: "Apple Support 에어팟 확인하기", url: "https://support.apple.com/ko-kr/109525" },
      { sourceType: "internal_rule", label: "AirPods 1/2/3 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:earphone:airpods-pro-1",
    category: "earphone",
    family: "airpods",
    model: "airpods_pro_1",
    title: "AirPods Pro 1세대 기준 공략",
    summary: "AirPods Pro 1세대 (2019.10.30) — Lightning, H1 칩, ANC + 트랜스패런시, IPX4. **무선 충전 케이스 (2019)** + **MagSafe 충전 케이스 (2021.10 업데이트)** 변형. **Pro 2 Lightning과 외관 거의 동일** (모델 번호로만 구분). Bunjang ~80~130k.",
    quickFacts: ["2019.10 출시 (Lightning)", "무선 vs MagSafe 케이스 변형", "Pro 2 Lightning과 외관 동일", "이어팁 S/M/L 3쌍"],
    parserHints: {
      mustSplitAxes: ["generation", "case_type", "fullset_vs_parts"],
      positiveSignals: ["에어팟 프로 1세대", "에어팟프로 1세대", "에어팟프로1", "airpods pro 1", "airpods pro 1세대", "에어팟 프로 1", "magsafe", "8핀", "lightning", "라이트닝"],
      ambiguousSignals: ["에어팟 프로", "airpods pro"],
      negativeSignals: ["2세대", "2nd", "3세대", "3rd", "맥스", "max", "usb-c", "usbc", "c타입", "타입c"],
      partsSignals: ["왼쪽만", "오른쪽만", "왼유닛", "우유닛", "유닛만", "한쪽만", "케이스만", "충전 케이스만", "이어팁만", "팁만", "실리콘 팁만", "본체만", "박스만", "케이블만"],
      manualReviewSignals: ["세대 미표기", "8핀 단독 (pro 1/2 모호)"],
    },
    match: {
      skuIds: ["airpods-pro-1"],
      aliases: ["에어팟 프로 1세대", "에어팟프로 1세대", "에어팟프로1", "airpods pro 1", "에어팟 프로 1"],
      familyHints: ["airpods", "에어팟"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "AirPods Pro 1세대 (2019.10.30 출시, 정가 329,000원, 모델 A2083/A2084).",
        "Lightning 충전, H1 칩, ANC + 트랜스패런시 모드, IPX4 방수, 4.5h (ANC on), 실리콘 이어팁 S/M/L 3쌍 동봉.",
        "**케이스 변형**: 무선 충전 케이스 (2019 출시, Lightning + Qi), MagSafe 충전 케이스 (2021.10 업데이트, Lightning + MagSafe + Qi + 스피커 추가).",
        "두 케이스 모두 펌웨어 호환. 외관 거의 동일하나 케이스 하단 스피커 그릴 유무로 구분.",
        "Bunjang 시세 ~80~130k (Pro 2/3 출시 후 하락 진행).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (Pro 1 / Pro 2 Lightning / Pro 2 USB-C / Pro 3).",
        "케이스 충전 방식 (무선 vs MagSafe) — 한국 매물에서 거의 구분 안 함, 동일 시세 흡수.",
        "본품 풀구성: 본체 + 충전 케이스 + Lightning 케이블 + 실리콘 팁 S/M/L.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "AppleCare+ 보증 잔여.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 **Pro 1 vs Pro 2 Lightning 외관 거의 동일** — 둘 다 8핀 케이스. 모델 번호로 구분 (Pro 1: A2083/A2084, Pro 2 Lightning: A2698/A2699).",
        "\"에어팟 프로 8핀\" 표기 — Pro 1 또는 Pro 2 Lightning 어느 것인지 모호. catalog 룰에 따라 Pro 2가 우선 흡수 가능.",
        "\"에어팟 프로 2세대 미개봉\" — 8핀인지 USB-C인지 추가 확인. Bunjang \"미개봉 c타입\" 명시 vs 단순 \"미개봉\" 구분.",
        "Pro 1 시세 하락 진행 중 (Pro 2/Pro 3 출시 영향). Pro 2 USB-C 미개봉 ~200k 수준, Pro 1 중고 80~130k.",
        "이어팁만/본체만/케이스만 단품 매물 매우 多 — parts evidence 43.8% (160건 중 70건).",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 케이스 + Lightning 케이블 + 이어팁 S/M/L 풀구성 = 풀시세.",
        "MagSafe 케이스 변형 매물 = +5~10k 추가 (Find My 핑 가능).",
        "이어팁 마모 + 본체 기스 + 케이스 변색 시 -10~20k.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"에어팟 프로 1세대\" / \"airpods pro 1\" / \"프로 1\" + \"1st/1세대\" 명시 매물만.",
        "mustNotContain: 2세대/2nd/max/usb-c/usbc/c타입/타입c 격리.",
        "parts reject: 왼쪽만/오른쪽만/유닛만/한쪽만/케이스만/이어팁만/본체만/박스만/케이블만.",
        "⚠️ **무선/MagSafe 케이스 SKU 분리 없음** — 풀구성 매물 흡수.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods Pro 1 specs (Wireless)", url: "https://support.apple.com/en-us/111861" },
      { sourceType: "official", label: "Apple AirPods Pro 1 specs (MagSafe)", url: "https://support.apple.com/en-us/111859" },
      { sourceType: "internal_rule", label: "AirPods Pro 1 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:earphone:airpods-pro-3",
    category: "earphone",
    family: "airpods",
    model: "airpods_pro_3",
    title: "AirPods Pro 3 기준 공략",
    summary: "AirPods Pro 3 (2025.9.19, $249) — USB-C only, H2 칩 개선, **ANC 4배 (vs Pro 1, 2배 vs Pro 2)**, **심박 센서**, IP57 방수/방진. 이어팁 XS/S/M/L 4사이즈. Bunjang ~220~250k (출시 8개월차). replay 100% complete — A급.",
    quickFacts: ["2025.9.19 출시 (USB-C only)", "심박 센서 + 피트니스 통합", "IP57 (Pro 2 IP54 대비 상향)", "이어팁 4사이즈 (XS/S/M/L)"],
    parserHints: {
      mustSplitAxes: ["generation", "fullset_vs_parts"],
      positiveSignals: ["에어팟 프로 3", "에어팟프로3", "에어팟 프로3", "airpods pro 3", "에어팟 프로 3세대", "에어팟프로 3세대", "프로 3"],
      ambiguousSignals: ["에어팟 프로", "airpods pro"],
      negativeSignals: ["1세대", "1st", "2세대", "2nd", "맥스", "max", "라이트닝", "lightning", "8핀"],
      partsSignals: ["왼쪽만", "오른쪽만", "유닛만", "한쪽만", "케이스만", "충전 케이스만", "이어팁만", "팁만", "본체만", "박스만", "케이블만"],
      manualReviewSignals: ["3세대 모호 (AirPods 3세대 일반형과 혼동)"],
    },
    match: {
      skuIds: ["airpods-pro-3"],
      aliases: ["에어팟 프로 3", "에어팟프로3", "에어팟 프로3", "airpods pro 3", "에어팟 프로 3세대"],
      familyHints: ["airpods", "에어팟"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "AirPods Pro 3 (2025.9.19 출시, $249 USD / ~₩369,000 추정 한국가, 모델 A3026/A3050 등).",
        "USB-C + MagSafe + Qi + Apple Watch 충전기 호환 케이스, H2 칩 (개선).",
        "**ANC 4배 (vs Pro 1, 2배 vs Pro 2)**, **심박 센서 (LED 256Hz 발광 + 가속도계)**, IP57 방수/방진 (Pro 2 IP54 대비 상향).",
        "8h (ANC on), 6.5h (심박 센서 on).",
        "이어팁 XS/S/M/L (4사이즈, Pro 2 대비 1사이즈 추가).",
        "Bunjang 시세 ~220~250k (출시 직후 미개봉 매물 비중 높음, 시세 상한 200k 후반대).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 (Pro 1 / Pro 2 Lightning / Pro 2 USB-C / **Pro 3**).",
        "**USB-C 단일** — Pro 3은 Lightning 변형 없음.",
        "본품 풀구성: 본체 + 충전 케이스 (USB-C) + USB-C 케이블 + 실리콘 팁 XS/S/M/L.",
        "신품 vs 미개봉 vs 중고 (출시 8개월차, 미개봉 多).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 \"에어팟 프로 3세대\" — \"3세대\"가 AirPods 3세대(2021 일반형)와 혼동 가능 → \"프로\" 키워드 + \"3\" 동시 매칭 필수.",
        "Pro 2 USB-C와 외관 비슷하지만 케이스 안쪽 모델 번호로 구분 (Pro 3: A3026/A3050).",
        "**Lightning 표기 매물은 Pro 3 아님** (Pro 1/2 Lightning).",
        "**사기/병행수입품 위험** — 신모델 출시 직후 단계에서 가짜/회색물품 매물 증가 risk.",
        "심박 센서 + 피트니스 앱 통합 — 50+ 운동 추적 (구매 의향에 영향).",
        "케이스 IP57 등급 — Pro 2 IP54의 먼지 부분 등급 대비 완전 방진/방수 상향.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "출시 8개월차 — 미개봉 매물 비중 매우 높음, 시세 정가 근접.",
        "정품 시리얼 검증 권장 (국내 정식 vs 병행수입).",
        "Bunjang 시세 220~250k.",
        "AppleCare+ 잔여 매물 = +10k 가산.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: \"에어팟 프로 3\" / \"airpods pro 3\" / \"프로 3\" + \"3세대/3 세대/3rd\" 명시 매물만.",
        "mustNotContain: 1세대/1st/2세대/2nd/맥스/max/라이트닝/lightning/8핀 격리.",
        "parts reject: 왼쪽만/오른쪽만/유닛만/한쪽만/케이스만/이어팁만/본체만/박스만/케이블만.",
        "**replay 100% complete (LAUNCH_PLAN 1.6c, A급 stop 상태)** — USB-C only 명시로 connector unknown 0%.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple AirPods Pro 3", url: "https://www.apple.com/airpods-pro/" },
      { sourceType: "official", label: "Apple AirPods Pro 3 specs", url: "https://www.apple.com/airpods-pro/specs/" },
      { sourceType: "official", label: "Apple newsroom (2025.9)", url: "https://www.apple.com/newsroom/2025/09/introducing-airpods-pro-3-the-ultimate-audio-experience/" },
      { sourceType: "official", label: "Apple Korea AirPods", url: "https://www.apple.com/kr/airpods/" },
      { sourceType: "internal_rule", label: "AirPods Pro 3 + Wave 83 verified" },
    ],
  },

  {
    guideKey: "guide:watch:seiko-5-sports-srpd",
    category: "watch",
    family: "seiko_5",
    model: "seiko_5_sports_srpd",
    title: "Seiko 5 Sports SRPD (5KX) 기준 공략",
    summary: "Seiko 5 Sports SRPD (5KX, 2019~) — 4R36 자동 무브먼트, 42.5mm 케이스. SRPD51 (페놉시), SRPD55 (올블랙), SRPD61 (Hulk 그린), SRPD83 (Street 시리즈) 등 다수. JDM (SBSA001 등)과 인터내셔널 (SRPD) 동일 모델. **SKX 빈티지와 분리** + **Prospex 상위 라인과 분리**.",
    quickFacts: ["2019~ (SKX 단종 후속)", "4R36 자동, 42.5mm", "SRPD = SBSA (JDM 동일)", "Bunjang 20~47만"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["srpd", "5kx", "seiko 5 sports", "세이코 5 스포츠", "sbsa", "오토메틱", "오토매틱"],
      ambiguousSignals: ["세이코 5", "seiko 5", "세이코"],
      negativeSignals: ["skx", "prospex", "프로스펙스", "presage", "astron", "ssk", "복각", "homage", "오마주", "이미테이션"],
      partsSignals: ["밴드만", "스트랩만", "메탈 브레이슬릿만", "베젤만", "유리만", "크라운만", "케이스만", "무브먼트만", "다이얼만"],
      manualReviewSignals: ["모델 코드 미표기", "5kx 단독"],
    },
    match: {
      skuIds: ["watch-seiko-5-sports-srpd"],
      aliases: ["srpd", "5kx", "seiko 5 sports", "세이코 5 스포츠", "세이코 5 srpd", "세이코 5 5kx"],
      familyHints: ["seiko", "세이코"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Seiko 5 Sports SRPD 시리즈 (2019~ SKX007 후속, \"5KX\" 별칭으로 통칭).",
        "4R36 자동 무브먼트, 42.5mm 케이스, 100m 방수.",
        "변형 (전부 인기 多): SRPD51 = SBSA001 (페놉시 베이젤+블루 다이얼), SRPD53 (블랙+파란/실버), SRPD55K1 (올블랙 SKX007 후속), SRPD61 (Hulk 그린-온-그린), SRPD65 (블랙-온-블랙 건메탈), SRPD75 (옐로우), SRPD79 (올블랙 = SBSA019 JDM), SRPD83 (Street 시리즈), SRPD89 (Street).",
        "Bunjang 시세 20~47만원 (변형/색상별).",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "모델 코드/색상 — Pepsi/Hulk/올블랙 인기 +20~30% 프리미엄.",
        "케이스 (정품 박스 + 보증서 + 텍).",
        "사용 상태 (베젤 변색, 다이얼, 메탈 브레이슬릿 마모).",
        "무브먼트 상태 (자동 — 데이/데이트 정상, 시간 정확도 ±일변동).",
        "스트랩 (정품 메탈 vs 나토/나일론 교체).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "🔥 SRPD (5KX, 2019~) vs **SKX (단종, 2019 이전, SKX007/009)** — SKX 빈티지가 SRPD보다 시세 높을 수 있음. SKX 별도 라인.",
        "**SRPD 인터내셔널 vs SBSA JDM** — SRPD51 == SBSA001, SRPD55 == SBSA017 — 동일 모델 다른 발매처. JDM은 \"Made in Japan\" 다이얼, 일본어 매뉴얼. 시세 격차 미미.",
        "**Seiko 5 vs Seiko Prospex** — Prospex는 다이버/스포츠 상위 라인 (50만~). 시세 1.5~3배 차이. mustNotContain `prospex` 필수.",
        "Seiko 5 vs Presage / Astron — 클래식/솔라/GPS 상위 라인, 가격대 완전 다름.",
        "**5KX vs 5 GMT (SSK 시리즈)** — GMT는 SSK001/017/019 별도, 자동 GMT 기능 추가, 시세 +50%.",
        "가품 risk: \"복각 / homage / 오마주\" 표기 매물 — mustNotContain 박힘.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 보증서 + 정품 메탈 브레이슬릿 = 풀시세.",
        "Bunjang 시세: SRPD51 (페놉시) 20~31만, SRPD61 (Hulk) 25~30만, SRPD89 47만.",
        "스트랩 교체 (나토/나일론) → 정품 브레이슬릿 포함 시 추가 가치.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane: SRPD / 5KX / Seiko 5 Sports 명시 매물만.",
        "mustNotContain: skx/prospex/presage/astron/ssk/복각/homage/오마주/이미테이션 격리.",
        "parts reject: 밴드만/스트랩만/메탈 브레이슬릿만/베젤만/유리만/크라운만/케이스만/무브먼트만/다이얼만.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Seiko Korea 5 Sports", url: "https://www.seikowatches.com/kr-ko/products/5-sports" },
      { sourceType: "official", label: "Seiko US 5 Sports 라인업", url: "https://www.seikowatches.com/us-en/products/5sports/lineup" },
      { sourceType: "official", label: "Seiko SRPD51 공식", url: "https://www.seikowatches.com/us-en/products/5sports/srpd51" },
      { sourceType: "internal_rule", label: "Seiko 5 Sports SRPD + Wave 83 verified" },
    ],
  },
];

const MIN_GUIDE_MATCH_SCORE = 60;

export function findModelGuide(input: ModelGuideLookupInput): ModelGuide | null {
  const skuId = normalize(input.skuId);
  const comparableKey = normalize(input.comparableKey);
  const skuName = normalize(input.skuName);
  const listingName = normalize(input.name);

  let best: { guide: ModelGuide; score: number } | null = null;

  for (const guide of MODEL_GUIDES) {
    let score = 0;

    for (const id of guide.match.skuIds ?? []) {
      if (skuId && skuId === normalize(id)) score = Math.max(score, 100);
    }

    for (const key of guide.match.comparableKeys ?? []) {
      const normalizedKey = normalize(key);
      if (comparableKey && comparableKey === normalizedKey) score = Math.max(score, 95);
      else if (comparableKey && comparableKey.startsWith(normalizedKey)) score = Math.max(score, 90);
    }

    for (const alias of guide.match.aliases ?? []) {
      const normalizedAlias = normalize(alias);
      if (includesNormalized(skuName, normalizedAlias)) score = Math.max(score, 80);
      if (includesNormalized(listingName, normalizedAlias)) score = Math.max(score, 75);
    }

    for (const familyHint of guide.match.familyHints ?? []) {
      const normalizedHint = normalize(familyHint);
      if (includesNormalized(skuName, normalizedHint) || includesNormalized(listingName, normalizedHint)) {
        score = Math.max(score, 45);
      }
    }

    if (!best || score > best.score) {
      if (score > 0) best = { guide, score };
    }
  }

  if (!best || best.score < MIN_GUIDE_MATCH_SCORE) return null;
  return best.guide;
}

export function getGuideParserHints(input: ModelGuideLookupInput): ModelGuideParserHints | null {
  return findModelGuide(input)?.parserHints ?? null;
}
