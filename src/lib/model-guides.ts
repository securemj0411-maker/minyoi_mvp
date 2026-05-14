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

  // Wave 83 batch 1 — tablet / laptop / desktop
  {
    guideKey: "guide:tablet:ipad-pro",
    category: "tablet",
    family: "ipad",
    model: "ipad_pro",
    title: "iPad Pro 기준 공략",
    summary: "iPad Pro는 칩 세대(M2/M4)와 화면 사이즈(11/13인치), 저장 용량(128~2TB), Wi-Fi vs 셀룰러 축이 모두 시세에 영향을 줍니다. 옵션 한 개라도 빠지면 같은 본품 비교가 깨집니다.",
    quickFacts: ["M2/M4 세대", "11/13인치", "Wi-Fi vs 셀룰러"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "storage_gb", "connectivity"],
      positiveSignals: ["m2", "m4", "11인치", "13인치", "와이파이", "wifi", "셀룰러", "cellular"],
      ambiguousSignals: ["아이패드 프로", "ipad pro", "기본형"],
      negativeSignals: ["미니", "에어"],
      partsSignals: ["펜슬만", "키보드만", "케이스만"],
      manualReviewSignals: ["용량 미표기", "세대 미표기", "케이스/펜슬 포함 가격"],
    },
    match: {
      skuIds: ["ipad-pro", "ipad-pro-11-m4-256-wifi", "ipad-pro-13-m4-256-wifi", "ipad-pro-11-m2-256-wifi", "ipad-pro-13-m2-256-wifi"],
      aliases: ["아이패드 프로", "ipad pro", "아이패드프로"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "iPad Pro는 칩 세대별 가격 격차가 30~50%까지 벌어집니다. M2 vs M4를 섞으면 차익 계산이 통째로 어긋납니다.",
        "11인치와 13인치는 같은 세대라도 30만원 안팎의 시세차가 있습니다.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 세대 (M2 / M4), 화면 사이즈 (11 / 13), 저장 (128/256/512/1TB/2TB), Wi-Fi vs 셀룰러 — 4축 동시 확인.",
        "Apple Pencil / Magic Keyboard 포함 여부는 가격에 25만원 이상 영향 가능.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"아이패드 프로\"만 제목에 있고 세대/사이즈/용량 빠지면 시세 비교 불가.",
        "케이스/펜슬 \"포함\" 가격을 본품 가격으로 착각하면 차익 과대평가.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 효율, 액정 상태, Apple Care 잔여 — 본품 가치에 영향.",
        "정품 액세서리 포함 시 별도 시세 (본품 단독가는 따로 잡기).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "세대/사이즈/용량/연결성 4축 명시된 매물만 narrow lane 진입.",
        "케이스만/펜슬만 단품은 parts 분류로 제외.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad Pro 공식 페이지", url: "https://www.apple.com/ipad-pro/" },
      { sourceType: "internal_rule", label: "ipad option-parser chip/screen/storage axis rules" },
    ],
  },
  {
    guideKey: "guide:tablet:ipad-air",
    category: "tablet",
    family: "ipad",
    model: "ipad_air",
    title: "iPad Air 기준 공략",
    summary: "iPad Air는 M2/M3 세대 + 11/13인치 + 64~512GB 저장 + Wi-Fi/셀룰러 4축이 핵심. 같은 \"에어\"로 묶이면 30~40% 시세 격차가 평준화돼 차익이 왜곡됩니다.",
    quickFacts: ["M2/M3 세대", "11/13인치", "Wi-Fi vs 셀룰러"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "storage_gb", "connectivity"],
      positiveSignals: ["m2", "m3", "11인치", "13인치", "와이파이", "셀룰러"],
      ambiguousSignals: ["아이패드 에어", "ipad air"],
      negativeSignals: ["프로", "미니"],
      partsSignals: ["펜슬만", "케이스만"],
      manualReviewSignals: ["세대 미표기", "용량 미표기"],
    },
    match: {
      skuIds: ["ipad-air", "ipad-air-m2-11-256-wifi", "ipad-air-m3-11-256-wifi"],
      aliases: ["아이패드 에어", "ipad air", "아이패드에어"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "iPad Air는 가격대가 60~100만원으로 회전이 빠른 편이지만, 세대/사이즈 혼동이 가장 흔합니다.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "M2 (2024) / M3 (2025) — 1년 차이지만 시세 격차 큼.",
        "11인치 / 13인치 — 13인치는 \"에어\"로도 13인치 모델이 있어 헷갈림.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"에어 4세대\"는 A14 칩 시절, M2 Air와 절대 비교 금지.",
        "구형 4/5세대 (A14/M1) 매물이 \"에어\"로 섞여 들어오면 시세 평균 왜곡.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "M2/M3 외 구세대는 별도 시세군 (Mini와 비슷한 가격대).",
        "Apple Care 잔여 + 박스 풀구성 시 +5~10만원 가능.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 M2/M3 + 11/13 + 256GB + Wi-Fi 명시만 진입.",
        "구세대 (4/5세대 A14/M1)은 broad ipad-air SKU로 흡수, narrow 진입 차단.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad Air 공식 페이지", url: "https://www.apple.com/ipad-air/" },
      { sourceType: "internal_rule", label: "ipad-air narrow lane disambiguation" },
    ],
  },
  {
    guideKey: "guide:tablet:ipad-mini",
    category: "tablet",
    family: "ipad",
    model: "ipad_mini",
    title: "iPad Mini 기준 공략",
    summary: "iPad Mini는 6세대 (A15) / 7세대 (A17 Pro) 두 갈래. 8.3인치 단일 사이즈라 세대 혼동이 가장 큰 함정.",
    quickFacts: ["6세대 A15 / 7세대 A17 Pro", "8.3인치 고정", "Wi-Fi vs 셀룰러"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "storage_gb", "connectivity"],
      positiveSignals: ["a17 pro", "7세대", "a15", "6세대", "8.3", "와이파이", "셀룰러"],
      ambiguousSignals: ["아이패드 미니", "ipad mini"],
      negativeSignals: ["에어", "프로"],
      partsSignals: ["케이스만"],
      manualReviewSignals: ["세대 미표기"],
    },
    match: {
      skuIds: ["ipad-mini", "ipad-mini-7-128-wifi"],
      aliases: ["아이패드 미니", "ipad mini", "아이패드미니"],
      familyHints: ["ipad"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "8.3인치 단일 사이즈로 사이즈 혼동은 없지만, 세대 차이로 시세 30만원 이상 벌어짐.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "6세대 (2021, A15) vs 7세대 (2024, A17 Pro) — 가격대 다름.",
        "용량 (64/128/256), Wi-Fi/셀룰러.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"아이패드 미니\"만 적힌 매물은 세대 미상 = narrow lane 진입 차단.",
        "A17 Pro 명시 매물은 7세대 확정.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "휴대성 좋아 회전 빠른 편 (sold ≤7d 비율 ↑).",
        "구세대 (1~5세대)는 골동품 시세, 본 카테고리에서 제외.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 7세대 A17 Pro + 128GB + Wi-Fi 명시만.",
        "broad ipad-mini는 6/7세대 모두 흡수하되 시세 신뢰도 낮게 표시.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple iPad Mini 공식 페이지", url: "https://www.apple.com/ipad-mini/" },
      { sourceType: "internal_rule", label: "ipad-mini A17 Pro detection" },
    ],
  },
  {
    guideKey: "guide:laptop:macbook-pro",
    category: "laptop",
    family: "macbook",
    model: "macbook_pro",
    title: "MacBook Pro 기준 공략",
    summary: "MacBook Pro는 14/16인치 × M3/M3 Pro/M3 Max/M4/M4 Pro/M4 Max × RAM(16~64GB) × SSD(512GB~4TB) — 옵션 조합이 가장 많은 카테고리. 한 축이라도 빠지면 비교 무효.",
    quickFacts: ["14/16인치", "M3/M4 + Pro/Max 칩", "RAM/SSD 폭넓음"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "ram_gb", "ssd_gb"],
      positiveSignals: ["m3", "m4", "pro", "max", "14인치", "16인치", "16gb", "18gb", "32gb", "512gb", "1tb"],
      ambiguousSignals: ["맥북프로", "macbook pro"],
      negativeSignals: ["에어", "air", "m1", "m2"],
      partsSignals: ["충전기만", "케이스만", "어댑터만"],
      manualReviewSignals: ["RAM 미표기", "SSD 미표기", "연식 미표기"],
    },
    match: {
      skuIds: ["macbook-pro", "macbook-pro-14-m3-18-512"],
      aliases: ["맥북프로", "macbook pro", "맥북 프로"],
      familyHints: ["macbook"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "MacBook Pro는 옵션 조합이 가장 많아 같은 \"맥프\"라도 70~200만원 시세 격차 가능.",
        "M3 / M4 세대 + Pro/Max 칩 변형 + 14/16인치 + RAM/SSD — 5축 모두 확인 필수.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "칩 (M3/M3 Pro/M3 Max, M4/M4 Pro/M4 Max), 사이즈 (14/16), RAM (16/18/24/32/48/64), SSD (512GB/1TB/2TB/4TB).",
        "Apple Care 잔여 / 배터리 사이클 / 외장 상태 — 별도 가산.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"맥프\"만 적힌 매물은 정보 부족 = narrow lane 진입 차단.",
        "기본형 M3 vs M3 Pro vs M3 Max — 가격 차 100만원+ 가능.",
        "16GB RAM 기본형과 36GB+ Pro 모델 혼동.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 사이클 100회 미만 + 외장 깨끗 + 풀박스 = 최고 시세.",
        "구세대 (M1/M2)는 별도 SKU로 분리, narrow lane 비교 금지.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 모든 옵션 명시 매물만 (예: 14인치/M3/18GB/512GB).",
        "옵션 추정 (예: 칩만 명시 → 연식 추정) 금지. unknown_option flag로 AI L2 후보.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple MacBook Pro 공식 페이지", url: "https://www.apple.com/macbook-pro/" },
      { sourceType: "internal_rule", label: "macbook option-parser generation/ram/ssd rules" },
    ],
  },
  {
    guideKey: "guide:laptop:macbook-air",
    category: "laptop",
    family: "macbook",
    model: "macbook_air",
    title: "MacBook Air 기준 공략",
    summary: "MacBook Air는 13/15인치 × M2/M3/M4 × RAM(8~24GB) × SSD(256GB~2TB). 기본형이 많아 가격 polluted되기 쉽고, RAM 차이가 시세에 큼.",
    quickFacts: ["13/15인치", "M2/M3/M4 세대", "8GB 기본 vs 16GB+"],
    parserHints: {
      mustSplitAxes: ["chip_generation", "screen_size", "ram_gb", "ssd_gb"],
      positiveSignals: ["m2", "m3", "m4", "13인치", "15인치", "8gb", "16gb", "24gb", "256gb", "512gb"],
      ambiguousSignals: ["맥북에어", "macbook air"],
      negativeSignals: ["프로", "pro", "m1"],
      partsSignals: ["충전기만", "케이스만"],
      manualReviewSignals: ["RAM 미표기", "SSD 미표기"],
    },
    match: {
      skuIds: ["macbook-air", "macbook-air-m2-13-256", "macbook-air-m3-13-256"],
      aliases: ["맥북에어", "macbook air", "맥북 에어"],
      familyHints: ["macbook"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "MacBook Air는 리셀 회전이 빠른 편 (대학생/직장인 수요 안정).",
        "기본형 8GB와 16GB+ 모델 시세 차이 20만원+, RAM 명시 매물만 비교.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "M2 (2022) / M3 (2024) / M4 (2025), 13/15인치, RAM (8/16/24), SSD (256/512/1TB/2TB).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"맥북에어 M2\"만 명시되고 RAM/SSD 미상 매물 = unknown_option.",
        "M1 (2020) 구형은 별도 시세군, narrow lane 제외.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "배터리 효율 95%+, 외장 무파손 = 풀시세.",
        "투인원/USB-C 어댑터 포함 시 +1~3만원.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 M2/M3/M4 + 13/15 + 8 or 16GB + 256/512GB 명시 매물만.",
        "M1은 broad에 흡수, 시세 신뢰도 낮음.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Apple MacBook Air 공식 페이지", url: "https://www.apple.com/macbook-air/" },
      { sourceType: "internal_rule", label: "macbook-air narrow lane chip/ram/ssd rules" },
    ],
  },

  // Wave 83 batch 2 — game_console + headphone (high-volume)
  {
    guideKey: "guide:game_console:ps5",
    category: "game_console",
    family: "ps5",
    model: "ps5",
    title: "PlayStation 5 기준 공략",
    summary: "PS5는 디스크 / 디지털 (디스크 드라이브 X) / 슬림 3축 + 구성품 (컨트롤러 1개 / 2개 / 추가)이 시세에 큼. 같은 \"PS5\"라도 시세 격차 20만원+.",
    quickFacts: ["디스크 / 디지털 / 슬림", "컨트롤러 1~2개", "본체만 vs 풀박스"],
    parserHints: {
      mustSplitAxes: ["model_variant", "controller_count", "fullset_vs_parts"],
      positiveSignals: ["디스크", "디지털", "슬림", "1세대", "초기형"],
      ambiguousSignals: ["ps5", "플스5", "플레이스테이션 5"],
      negativeSignals: ["pro", "ps5 pro"],
      partsSignals: ["컨트롤러만", "듀얼센스만", "이어셋만", "충전독만"],
      manualReviewSignals: ["디스크/디지털 미표기", "구성품 모호"],
    },
    match: {
      skuIds: ["ps5-disc-standard", "ps5-digital-standard", "ps5-slim-disc"],
      aliases: ["ps5", "플스5", "플레이스테이션 5", "playstation 5"],
      familyHints: ["ps5", "playstation"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "PS5는 디스크 (UHD 블루레이 가능) / 디지털 (디스크 드라이브 X) / 슬림 (2023년 11월 출시, 더 가볍고 디스크 드라이브 분리) 3축.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "디스크 vs 디지털 vs 슬림 — 시세 격차 5~15만원.",
        "컨트롤러 1개 (기본) vs 2개 (+8만원) vs 충전독 추가.",
        "1세대 초기형 vs 후기형 (CFI-1000 / CFI-1100 / CFI-1200) — 발열/소음 차이.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"PS5 디스크\"는 변형 명시이지만 \"PS5\" 단독은 디지털인지 디스크인지 모호.",
        "슬림 + 디스크 드라이브 별매 vs 슬림 + 디스크 일체형 헷갈림.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "보증 잔여 + 풀박스 + 컨트롤러 1개 정상 = 기본 시세.",
        "컨트롤러 추가, 충전독, 게임 디스크 포함 시 별도 가산.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 디스크/디지털/슬림 명시 + 본체 명확 매물만.",
        "컨트롤러만/이어셋만/충전독만 단품은 parts 분류로 제외.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "PlayStation 5 공식 페이지", url: "https://www.playstation.com/ko-kr/ps5/" },
      { sourceType: "internal_rule", label: "game-console-parser PS5 variant rules" },
    ],
  },
  {
    guideKey: "guide:game_console:switch-oled",
    category: "game_console",
    family: "nintendo_switch",
    model: "switch_oled",
    title: "Nintendo Switch OLED 기준 공략",
    summary: "Switch OLED는 본체 단독 / 풀박스 / 게임 포함 (\"풀세트\")에 따라 시세 5~15만원 격차. \"스위치\"로만 적힌 매물은 일반/라이트/OLED 헷갈림.",
    quickFacts: ["7인치 OLED 화면", "본체만 vs 풀박스", "게임 포함 여부"],
    parserHints: {
      mustSplitAxes: ["model_variant", "fullset_vs_parts"],
      positiveSignals: ["oled", "7인치", "조이콘"],
      ambiguousSignals: ["스위치", "닌텐도 스위치"],
      negativeSignals: ["라이트", "lite", "switch 2"],
      partsSignals: ["조이콘만", "독만", "스탠드만"],
      manualReviewSignals: ["OLED/일반 미표기", "구성품 모호"],
    },
    match: {
      skuIds: ["switch-oled"],
      aliases: ["스위치 oled", "닌텐도 스위치 oled", "switch oled", "switch 올레드"],
      familyHints: ["switch", "nintendo"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Switch OLED는 일반 Switch보다 7인치 유기발광 화면 + 64GB 내장 메모리 + 향상된 거치대.",
        "라이트 (Lite, 7인치 LCD) / Switch 2와 절대 혼동 금지.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "본체만 vs 본체 + 박스 vs 풀세트 (게임 + 캐리케이스 등 포함).",
        "조이콘 색상 (네온/화이트/스플래툰 등) — 시세 영향 작음.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"스위치\"만 적힌 매물은 OLED인지 일반인지 모호 → narrow 진입 차단.",
        "\"풀세트\" 의미가 박스 풀구성인지 게임 + 액세서리 포함인지 모호.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "조이콘 드리프트 (스틱 결함) 무 + 화면 무파손 = 풀시세.",
        "게임 다수 포함 시 별도 시세 (게임 1개당 +1~3만원).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 OLED 명시 매물만.",
        "본체 / 풀박스 / 풀세트 정책은 owner 결정 (현재 검토 중).",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Nintendo Switch OLED 공식 페이지", url: "https://www.nintendo.co.kr/products/hardware/" },
      { sourceType: "internal_rule", label: "game-console-parser OLED detection" },
    ],
  },
  {
    guideKey: "guide:headphone:bose-qc-ultra",
    category: "headphone",
    family: "bose",
    model: "bose_qc_ultra",
    title: "Bose QuietComfort Ultra 헤드폰 기준 공략",
    summary: "Bose QC Ultra는 QC45 / QC35 / QC25 등 구세대와 절대 비교 금지. \"보스 QC\"만 적힌 매물은 세대 모호.",
    quickFacts: ["2023년 출시", "ANC + 이머시브 오디오", "USB-C 충전"],
    parserHints: {
      mustSplitAxes: ["generation", "fullset_vs_parts"],
      positiveSignals: ["qc 울트라", "qc ultra", "ultra", "울트라"],
      ambiguousSignals: ["보스 qc", "bose qc"],
      negativeSignals: ["qc45", "qc35", "qc25"],
      partsSignals: ["이어패드만", "케이블만", "케이스만"],
      manualReviewSignals: ["세대 미표기"],
    },
    match: {
      skuIds: ["bose-qc-ultra-headphones"],
      aliases: ["보스 qc 울트라", "bose qc ultra", "qc ultra", "qc울트라"],
      familyHints: ["bose"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "QC Ultra는 Bose 라인업 최상위. 일반 QC 시리즈 (QC45/35/25)와 절대 다른 시세군.",
        "출시 1년+이지만 신제품 가격 방어가 강한 편.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "본품 + 케이스 + 충전 케이블 = 풀구성.",
        "이어패드 교체 이력 (사용감 큰 신호).",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"보스 QC\"만 적힌 매물은 Ultra인지 QC45인지 모호 → 진입 차단.",
        "QC Ultra Earbuds (무선 이어폰)와 헤드폰 절대 혼동 금지.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 케이스 포함 + 외장 깨끗 = 풀시세.",
        "이어패드 마모 + 헤드밴드 늘어남 시 시세 -3~5만원.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 \"Ultra\" 또는 \"울트라\" 명시 매물만.",
        "이어패드만/케이블만 단품은 parts 분류.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Bose QC Ultra 공식 페이지", url: "https://www.bose.com/p/headphones/bose-quietcomfort-ultra-headphones/" },
      { sourceType: "internal_rule", label: "headphone Bose generation disambiguation" },
    ],
  },
  {
    guideKey: "guide:headphone:sony-wh-1000xm5",
    category: "headphone",
    family: "sony_wh1000xm",
    model: "sony_wh1000xm5",
    title: "Sony WH-1000XM5 기준 공략",
    summary: "WH-1000XM 시리즈는 세대(XM3/XM4/XM5/XM6)별로 시세 격차 큼. 같은 \"소니 헤드폰\" 묶으면 비교 무효.",
    quickFacts: ["XM5 (2022)", "ANC 업계 최고", "USB-C 충전"],
    parserHints: {
      mustSplitAxes: ["generation", "fullset_vs_parts"],
      positiveSignals: ["wh 1000xm5", "wh1000xm5", "1000xm5", "xm5"],
      ambiguousSignals: ["소니 헤드폰", "wh1000"],
      negativeSignals: ["xm3", "xm4", "xm6"],
      partsSignals: ["이어패드만", "케이블만"],
      manualReviewSignals: ["세대 모호"],
    },
    match: {
      skuIds: ["sony-wh-1000xm5"],
      aliases: ["wh 1000xm5", "wh1000xm5", "소니 xm5", "1000xm5"],
      familyHints: ["sony", "wh1000xm"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "XM5는 Sony WH-1000X 시리즈 5세대. 4세대 XM4 대비 디자인 큰 변경 (접이식 불가).",
        "XM6 출시 후에도 시세 안정적.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "세대 명확 (XM5 / XM4 / XM3 / XM6).",
        "본품 + 케이스 + 충전 케이블 + 비행기 어댑터 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"소니 헤드폰\"만 적힌 매물은 세대 미상 → 진입 차단.",
        "XM4 (접이식) vs XM5 (비접이식) — 디자인 차이로 호불호.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "케이스 + 풀구성 + 무파손 = 풀시세.",
        "이어패드 교체 시점 확인 (1년+ 사용 시 마모 큼).",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 XM5/XM4/XM3 세대 명시 매물만.",
        "broad \"소니 헤드폰\"은 시세 신뢰도 낮음.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Sony WH-1000XM5 공식 페이지", url: "https://www.sony.co.kr/electronics/headband-headphones/wh-1000xm5" },
      { sourceType: "internal_rule", label: "headphone Sony WH generation rules" },
    ],
  },

  // Wave 83 batch 3 — 새 카테고리 watch / sport_golf (Wave 67)
  {
    guideKey: "guide:watch:gshock-ga2100",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_ga2100",
    title: "Casio G-Shock GA-2100 (카시오크) 기준 공략",
    summary: "GA-2100은 \"카시오크\" 별명으로 알려진 8각형 디자인. 색상 변형/특별판/풀메탈 5000 등 G-Shock 시리즈 내 혼동 큼.",
    quickFacts: ["8각형 디자인", "카시오크 별명", "건전지 구동"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["ga 2100", "ga2100", "카시오크"],
      ambiguousSignals: ["지샥", "g shock"],
      negativeSignals: ["ga 2200", "dw 5600", "gmw b5000", "풀메탈 5000"],
      partsSignals: ["밴드만", "스트랩만", "유리만"],
      manualReviewSignals: ["모델명 미표기"],
    },
    match: {
      skuIds: ["watch-casio-gshock-ga2100"],
      aliases: ["ga 2100", "ga2100", "지샥 ga-2100", "지샥 카시오크", "카시오크"],
      familyHints: ["g shock", "gshock", "카시오"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "GA-2100은 G-Shock 시리즈 최고 인기 모델. \"카시오크\" 애칭은 럭셔리 시계와 디자인 유사성에서 유래.",
        "기본형 (블랙/네이비/카키) 외 컬래버 한정판 시세 격차 큼.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "색상 (블랙/네이비/카키/화이트 등 기본형 vs 한정판).",
        "본체 + 박스 + 매뉴얼 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"지샥\"만 적힌 매물은 어떤 시리즈인지 모호 (DW-5600 / GA-2100 / GMW-B5000 등 다양).",
        "GA-2200 (후속) 헷갈림 — 디자인 비슷하나 모델명 다름.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 + 케이스 = 풀시세.",
        "기스/유리 손상 시 -3~5만원.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 GA-2100 또는 카시오크 명시 매물만.",
        "G-Shock broad는 모델 미상 매물 흡수, 시세 신뢰도 낮음.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio G-Shock GA-2100 공식 페이지", url: "https://www.gshock.com/" },
    ],
  },
  {
    guideKey: "guide:watch:gshock-dw5600",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_dw5600",
    title: "Casio G-Shock DW-5600 기준 공략",
    summary: "DW-5600은 G-Shock 정통 사각형 디자인. 1987년부터 이어진 라인. 다양한 컬래버판/한정판 + 기본형 가격 격차.",
    quickFacts: ["사각형 정통 디자인", "1987~ 라인", "건전지 구동"],
    parserHints: {
      mustSplitAxes: ["model_variant", "color_variant"],
      positiveSignals: ["dw 5600", "dw5600"],
      ambiguousSignals: ["지샥"],
      negativeSignals: ["ga 2100", "gmw b5000"],
      partsSignals: ["밴드만", "스트랩만"],
      manualReviewSignals: ["모델명 미표기"],
    },
    match: {
      skuIds: ["watch-casio-gshock-dw5600"],
      aliases: ["dw 5600", "dw5600", "지샥 dw-5600", "5600"],
      familyHints: ["g shock", "gshock"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "DW-5600은 G-Shock 정체성 그 자체인 모델. 1987년 출시 이후 디자인 거의 동일.",
        "기본형 (DW-5600E 블랙) 외 컬래버판 (BAPE/슈프림/포터 등) 시세 격차 매우 큼.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "DW-5600E / DW-5600BB (블랙) / 컬래버판 — 시세 다름.",
        "박스 + 매뉴얼 + 컬래버 패키지 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"5600\"만 적힌 매물은 DW-5600 (건전지) / GW-M5610 (태양광) / GMW-B5000 (풀메탈) 등 혼동.",
        "GMW-B5000은 동일 디자인이나 풀메탈 + 블루투스로 시세 5배+.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 = 풀시세.",
        "컬래버판은 박스 + 패키지 보존 시 한정판 프리미엄.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 DW-5600 명시 매물만 (GMW-B5000 분리).",
        "컬래버판은 별도 시세군으로 추가 검토.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio G-Shock DW-5600 공식 페이지", url: "https://www.gshock.com/" },
    ],
  },
  {
    guideKey: "guide:watch:gshock-gmwb5000",
    category: "watch",
    family: "casio_gshock",
    model: "gshock_gmwb5000",
    title: "Casio G-Shock GMW-B5000 (풀메탈 5000) 기준 공략",
    summary: "GMW-B5000은 DW-5600 디자인의 풀메탈 + 솔라 + 블루투스 버전. 시세 5배+ 격차로 절대 DW-5600과 비교 금지.",
    quickFacts: ["풀메탈 케이스", "솔라 충전", "블루투스 연결"],
    parserHints: {
      mustSplitAxes: ["model_variant"],
      positiveSignals: ["gmw b5000", "gmwb5000", "풀메탈 5000", "풀메탈"],
      ambiguousSignals: ["b5000", "5000"],
      negativeSignals: ["dw 5600", "ga 2100"],
      partsSignals: ["밴드만"],
      manualReviewSignals: ["모델명 미표기"],
    },
    match: {
      skuIds: ["watch-casio-gshock-gmwb5000"],
      aliases: ["gmw b5000", "gmwb5000", "풀메탈 5000", "지샥 풀메탈", "지샥 b5000"],
      familyHints: ["g shock", "gshock"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "GMW-B5000은 G-Shock 라인 최상위 메탈 버전. 가격은 일반 DW-5600의 5배+.",
        "한정판/컬래버 (실버 / 골드 / 레인보우 등) 시세 더 큼.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "기본 색상 (실버 / 골드 / 블랙 IP) vs 한정판.",
        "박스 + 솔라 충전 케이블 + 매뉴얼 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"풀메탈 5000\" / \"5000\" / \"B5000\"만 적힌 매물 모호 — DW-5600 (건전지)와 혼동 금지.",
        "솔라 충전 (sunlight charged) 시계라 배터리 잔량 표시 다름.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "정품 박스 + 매뉴얼 + 솔라 충전 정상 = 풀시세.",
        "메탈 케이스 기스 + 밴드 마모 시 시세 -10만원+.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 GMW-B5000 또는 풀메탈 5000 명시 매물만.",
        "DW-5600 lane과 절대 분리.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Casio G-Shock GMW-B5000 공식 페이지", url: "https://www.gshock.com/" },
    ],
  },
  {
    guideKey: "guide:sport_golf:titleist-tsr2-driver",
    category: "sport_golf",
    family: "titleist",
    model: "tsr2_driver",
    title: "Titleist TSR2 드라이버 기준 공략",
    summary: "TSR2는 Titleist 드라이버 라인 중간 모델. 같은 \"TSR\"이라도 1/2/3/4 시세 격차 큼.",
    quickFacts: ["2022년 출시", "9/10/11도 로프트", "샤프트 변형"],
    parserHints: {
      mustSplitAxes: ["model_variant", "loft", "shaft"],
      positiveSignals: ["tsr2", "tsr 2", "타이틀리스트 tsr2"],
      ambiguousSignals: ["타이틀리스트", "titleist", "tsr"],
      negativeSignals: ["tsr1", "tsr3", "tsr4", "tsi2"],
      partsSignals: ["헤드만", "샤프트만", "그립만"],
      manualReviewSignals: ["모델 미표기", "로프트 미표기"],
    },
    match: {
      skuIds: ["sport-golf-titleist-tsr2-driver"],
      aliases: ["tsr2", "tsr 2", "타이틀리스트 tsr2"],
      familyHints: ["titleist", "타이틀리스트"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "Titleist TSR2는 2022년 출시 드라이버. 일반 골퍼층 타깃 (TSR1보다 무게 안정, TSR3보다 관용성 ↑).",
        "TSR1/2/3/4 라인 중 가장 판매량 많음.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "로프트 (9/10/11도) — 골퍼 스윙에 따라 시세 차이 작지만 선호도 영향.",
        "샤프트 (Tensei AV Blue / HZRDUS Black / Speeder 등) — 시세 격차 5~15만원.",
        "헤드 커버 + 렌치 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "\"타이틀리스트\"만 적힌 매물은 어떤 클럽인지 모호.",
        "TSi (이전 세대) vs TSR (현 세대) — 1글자 차이로 시세 큼.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "헤드 페이스 무파손 + 그립 정상 + 헤드 커버 포함 = 풀시세.",
        "샤프트 교체 이력 (커스텀) 시 호불호.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 TSR2 명시 매물만.",
        "헤드만 / 샤프트만 단품은 parts 분류.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Titleist TSR2 공식 페이지", url: "https://www.titleist.com/clubs/drivers/tsr2-driver" },
    ],
  },
  {
    guideKey: "guide:sport_golf:titleist-tsr3-driver",
    category: "sport_golf",
    family: "titleist",
    model: "tsr3_driver",
    title: "Titleist TSR3 드라이버 기준 공략",
    summary: "TSR3는 Titleist 드라이버 라인 중상위 모델. TSR2보다 가벼우면서 컨트롤 ↑. 헤드 무게 조절 가능.",
    quickFacts: ["2022년 출시", "헤드 웨이트 조절", "컨트롤 우선"],
    parserHints: {
      mustSplitAxes: ["model_variant", "loft", "shaft"],
      positiveSignals: ["tsr3", "tsr 3", "타이틀리스트 tsr3"],
      ambiguousSignals: ["타이틀리스트", "titleist", "tsr"],
      negativeSignals: ["tsr1", "tsr2", "tsr4", "tsi3"],
      partsSignals: ["헤드만", "샤프트만"],
      manualReviewSignals: ["모델 미표기"],
    },
    match: {
      skuIds: ["sport-golf-titleist-tsr3-driver"],
      aliases: ["tsr3", "tsr 3", "타이틀리스트 tsr3"],
      familyHints: ["titleist", "타이틀리스트"],
    },
    sections: [
      { type: "overview", title: "모델 개요", items: [
        "TSR3는 Titleist 라인 중 컨트롤 + 헤드 무게 조절 기능. 중급~상급 골퍼 타깃.",
        "TSR2 대비 관용성 낮으나 핀포인트 컨트롤 ↑.",
      ]},
      { type: "option_axes", title: "같이 봐야 하는 옵션 축", items: [
        "로프트 (9/10도, TSR2보다 적음), 샤프트, 헤드 웨이트 변형.",
        "헤드 커버 + 렌치 + 추가 웨이트 = 풀구성.",
      ]},
      { type: "confusion_points", title: "자주 헷갈리는 포인트", items: [
        "TSR2 / TSR3 1글자 차 시세 격차 큼.",
        "TSR3 \"투어\" 한정판 (TSR3 SureFit Tour) 별도 시세.",
      ]},
      { type: "resell_checkpoints", title: "리셀 체크포인트", items: [
        "헤드 페이스 + 웨이트 정상 + 풀구성 = 풀시세.",
        "샤프트 커스텀 (Mitsubishi Tensei 등) 호불호.",
      ]},
      { type: "our_filter_rules", title: "우리 시스템 기준", items: [
        "narrow lane은 TSR3 명시 매물만.",
        "TSR2 lane과 분리.",
      ]},
    ],
    sources: [
      { sourceType: "official", label: "Titleist TSR3 공식 페이지", url: "https://www.titleist.com/clubs/drivers/tsr3-driver" },
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
