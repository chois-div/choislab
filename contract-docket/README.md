# 계약 파일

계약 초안 작성부터 전자 서명 요청과 회신 확인까지 이어지는 Next.js 앱입니다. 계약 데이터는 Supabase Database에, PDF는 비공개 Supabase Storage 버킷에 저장합니다.

## 제공 기능

- 계약 내용을 직접 작성하거나 15MB 이하 PDF를 업로드하고 초안을 수정
- 마우스·터치로 서명을 그리거나 PNG/JPG 서명 이미지를 삽입
- 계약 본문 또는 PDF 미리보기와 참여자·진행 기록 확인
- 설정한 SMTP 계정으로 14일 만료 서명 링크를 실제 발송
- 수신자가 링크에서 계약서를 확인하고 서명하거나 거절 회신
- 발신자 대시보드에서 계약 상태와 SMTP 회신 알림 확인
- 이메일 매직 링크 인증, 이메일 허용 목록 및 사용자별 데이터 접근 제한

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. Supabase와 SMTP가 설정되지 않은 상태에서는 로그인, 데이터 저장, 이메일 발송을 사용할 수 없습니다.

## Supabase 설정

1. Supabase 프로젝트를 만들고 Project URL, anon/public key, service role key를 준비합니다.
2. Supabase SQL Editor에서 [`supabase/migrations/202611050001_contract_security.sql`](./supabase/migrations/202611050001_contract_security.sql)의 SQL을 실행합니다. 이 마이그레이션은 `contracts` 테이블의 사용자별 조회 RLS 정책, 비공개 `contract-files` 버킷 및 Storage 정책을 설정합니다. 데이터 쓰기는 로그인한 사용자를 확인하는 서버 API에서만 수행하며, 클라이언트의 직접 테이블 쓰기 정책은 만들지 않습니다.
3. Supabase Authentication에서 이메일 로그인과 매직 링크를 설정하고, 공개 회원 가입을 비활성화합니다. 로그인 가능한 이메일 계정은 Supabase Dashboard에서 미리 생성하거나 초대합니다.
4. `.env.local`에 Supabase 프로젝트 URL과 anon/public key를 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 넣습니다. `SUPABASE_SERVICE_ROLE_KEY`에는 service role key를 설정합니다.
5. `CONTRACT_ACCESS_EMAILS`에 접근을 허용할 이메일을 쉼표로 구분해 지정합니다. 예: `owner@example.com,operator@example.com`. Supabase 계정과 이 허용 목록에 모두 포함된 사용자만 대시보드에 접근할 수 있습니다.
6. Supabase Authentication의 URL 설정에 로컬 `http://localhost:3000/auth/callback`과 운영 `https://<운영 도메인>/auth/callback`을 허용 redirect URL로 추가합니다. `APP_URL`에는 앱의 기본 URL을 설정합니다.

service role key는 서버에서만 사용합니다. `NEXT_PUBLIC_` 접두사를 붙이지 말고, 저장소에 커밋하거나 브라우저 코드에서 사용하지 마세요. Vercel 배포 시에도 필요한 환경 변수를 서버 환경 변수로 등록하고, 공개 배포 전에 실제 접근 제어와 파일 저장을 검증하세요.

## 이메일 발송

`.env.local`에 SMTP 서버 정보를 설정하고 `APP_URL`을 지정해야 합니다. 일반적으로 SMTP 587 포트는 `SMTP_SECURE=false`, 465 포트는 `SMTP_SECURE=true`를 사용합니다. `MAIL_FROM`은 SMTP 계정에서 발신이 허용된 주소를 사용하세요. 외부 공개 주소는 HTTPS여야 합니다. SMTP 설정이 없거나 발송이 실패하면 계약은 발송 완료로 표시되지 않습니다. 서명 완료 또는 거절 회신 후 발신자 알림 메일도 전송합니다.

## 레퍼런스와 범위

[모두싸인 공개 홈페이지](https://modusign.co.kr/)는 문서 작성·발송·서명·보관을 잇는 전자계약 흐름을 핵심 메시지로 제시합니다. 이 앱은 요청하신 작성→날인→미리보기→이메일 링크 발송→회신을 문서 중심 화면과 수신자 서명 화면으로 구현했습니다. 브랜드 자산이나 화면을 복제하지 않았으며, 공개 홈페이지의 보안·법적 효력 메시지를 이 앱의 보증으로 가져오지 않았습니다.

서명 링크는 14일 후 만료되며 링크를 가진 사람이 서명 페이지에 접근할 수 있습니다. 수신자 본인 확인, 다중 인증, 인증된 감사 추적/증명서, 법률 효력 보증은 제공하지 않습니다. 업로드한 PDF 원본에 서명 이미지의 좌표를 지정하거나 서명을 합성하지도 않습니다. PDF는 원본 그대로 보관하고 서명 이미지·서명자 이름·회신 시각을 계약 기록에 저장합니다. 운영 데이터 사용 전에 접근 권한, 백업·보존 정책, 보안 및 관할 법률 요건을 별도로 확인하세요.
