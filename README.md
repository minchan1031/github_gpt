# D-100 입시 생존기

GitHub Pages에서 동작하는 HTML/CSS/Vanilla JavaScript 기반 정적 웹 게임입니다.
로그인과 랭킹 저장은 Supabase Auth 및 Postgres를 사용합니다.

## 구성

- `index.html`: 로그인, 로비, 게임의 세 SPA 화면
- `style.css`: 이미지 없이 구성한 반응형 UI
- `app.js`: 인증, 게임 상태, 엔딩, Top 10 랭킹 로직
- `supabase.sql`: `rankings` 테이블과 Row Level Security 정책

## 보안 모델

- 랭킹은 누구나 읽을 수 있습니다.
- 로그인한 사용자는 자신의 `user_id`가 포함된 기록만 추가할 수 있습니다.
- 브라우저에는 공개용 Supabase publishable key만 포함됩니다.
- 클라이언트에서 랭킹 수정 및 삭제 권한은 부여하지 않습니다.

> 이 프로젝트는 서버 판정 로직이 없는 정적 게임입니다. RLS는 사용자 소유권을
> 검증하지만, 개발자 도구로 조작한 점수까지 판별하지는 못합니다.

