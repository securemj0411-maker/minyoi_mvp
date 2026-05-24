# 2026-05-24 Wave 783 — 운영자 회원 목록 프로필 사진 확인

## 결정
- 카카오 로그인 기반 회원은 Supabase Auth metadata 안에 프로필 사진 URL이 들어올 수 있으므로, 운영자 회원 목록에서 사진 유무를 바로 확인할 수 있게 한다.
- 별도 Supabase schema 변경 없이 Auth admin users 응답의 `user_metadata`, `raw_user_meta_data`, `identities.identity_data`를 안전하게 읽어 `http/https` 이미지 URL만 UI로 전달한다.

## 구현
- 회원 row에 `profileImageUrl`을 추가하고, 카카오/Supabase에서 흔히 쓰는 `avatar_url`, `picture`, `profile_image_url`, `thumbnail_image_url` 계열 key를 fallback으로 탐색한다.
- 회원 목록에는 작은 프로필 썸네일을 표시하고, 썸네일 또는 drawer의 `PROFILE PHOTO` 버튼을 누르면 큰 이미지 모달을 띄운다.
- 외부 이미지 요청은 `referrerPolicy="no-referrer"`로 처리하고, 원본 링크는 새 탭으로 열 수 있게 했다.

## 보류
- Supabase Auth metadata를 별도 profile 테이블로 정규화하는 작업은 하지 않았다. 현재 요구는 운영자 확인용 UI 노출이며, 로그인/권한 정책 변경은 없다.
