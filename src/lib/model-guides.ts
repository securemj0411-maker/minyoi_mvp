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
  category: "earphone" | "smartwatch";
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
      aliases: ["airpods max", "에어팟 맥스", "에어팟맥스"],
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
