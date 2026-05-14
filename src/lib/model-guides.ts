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
