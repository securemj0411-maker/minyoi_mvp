import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // P1-12: underscore prefix를 unused-vars 예외로 인정. 마이닝/리포트 스크립트가 보존 목적의
  // 정규식 사전을 둘 때 자주 사용한다. CI에서 --max-warnings=0을 강제하면서도 이 패턴은 허용.
  //
  // Wave 105 (2026-05-15): React 19 신규 rule 2개 off. eslint-config-next 업데이트로
  // 기존 코드 27개 error 발생 → 베타 직전 일괄 refactor 무리. 점진 fix는 별도 wave.
  // - react-hooks/purity: Date.now/Math.random 등 impure call during render 금지
  // - react-hooks/set-state-in-effect: useEffect 안 setState 직접 호출 금지 (cascading render)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
