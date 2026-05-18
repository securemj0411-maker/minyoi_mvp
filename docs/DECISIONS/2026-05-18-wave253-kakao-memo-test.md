# 2026-05-18 Wave 253 — Kakao memo notification test

## 결정

- 카카오 로그인 scope를 `profile_nickname profile_image talk_message`로 통일했다.
- `/debug` 운영 페이지에 카카오톡 테스트 알림 패널을 추가했다.
- 테스트 패널은 현재 Supabase 세션의 `provider_token`을 사용해 현재 로그인한 카카오 계정의 `나와의 채팅방`으로 메시지를 보낸다.
- 발송 API는 운영자 인증 뒤에서만 동작하게 했다.
- 기본 텍스트 템플릿 발송과 Kakao Developers 커스텀 템플릿 ID 발송을 둘 다 지원한다.

## 이유

- MVP retention 실험은 비즈메시지/알림톡 심사 전에 `나에게 보내기`로 권한, 토큰, 링크 설정을 먼저 검증하는 것이 가장 빠르다.
- 기존 로그인 세션은 `talk_message` 권한이 없을 수 있으므로 `/debug`에서 카카오 재동의 버튼을 제공한다.
- 커스텀 템플릿은 콘솔 링크/인자 설정에 막힐 수 있어 기본 텍스트 템플릿을 먼저 성공시키는 경로를 열어둔다.

## 보류

- 카카오 provider token/refresh token의 DB 저장은 보류했다. 자동 retention 발송을 붙일 때 암호화 저장, refresh, opt-out, 발송 빈도 제한을 같이 설계한다.
- 브랜드 발신 알림톡/친구톡은 카카오 비즈채널과 검수 플로우가 필요하므로 이번 wave 대상이 아니다.

## 검증

- `tests/kakao-memo-contract.test.ts`에 scope, debug panel, Kakao memo route 계약을 추가했다.
