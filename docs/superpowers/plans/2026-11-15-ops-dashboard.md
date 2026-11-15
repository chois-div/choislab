# 초이스랩 운영 대시보드 (`/ops/`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 흩어진 포트폴리오·견적서·아임웹 문의·전자계약(준비중) 운영 현황을 비밀번호 하나로 들어가서 한눈에 보는 대시보드(`/ops/index.html`)와, 아임웹 Secret Key를 안전하게 보관하면서 사이트별 최근 문의 건수를 계산해주는 작은 백엔드(`ops-api`)를 만든다.

**Architecture:** choislab 레포는 정적 GitHub Pages 사이트이므로 `/ops/index.html` 한 파일로 비밀번호 게이트+대시보드를 구현한다 (`/quote/index.html`, `/admin/index.html`과 동일 패턴: 빌드 도구 없음, 인라인 CSS/JS). 비밀번호의 진짜 값은 어디에도 새로 저장하지 않고, 기존 `/quote/`가 쓰는 Google Apps Script의 `action=ping`에 그대로 물어봐서 검증한다. 아임웹 Secret Key는 브라우저에 노출하면 안 되므로, `ops-api`라는 작은 Node/Express 서버(Render 무료 티어, Docker 없이 Node 런타임만 사용)를 새로 만들어 환경변수로 보관하고, `/api/inquiries` 하나만 외부에 노출한다. `ops-api`도 자체 비밀번호를 만들지 않고 들어온 키를 그대로 같은 Apps Script에 물어봐서 검증한다.

**Tech Stack:** 프론트엔드는 순수 HTML/CSS/바닐라 JS (프레임워크 없음). 백엔드는 Node.js 20 + Express + cors, 빌트인 `node:test`로 순수 로직 유닛 테스트. 배포는 GitHub Pages(choislab 레포, main 브랜치 push 시 자동 배포)와 Render(Node 웹 서비스, `ops-api/` 서브디렉토리를 Root Directory로 지정).

## Global Constraints

- 새 비밀번호를 만들지 않는다 — `/quote/`가 이미 쓰는 비밀번호와 Google Apps Script 엔드포인트(`https://script.google.com/macros/s/AKfycbya2VGDKr3OM36OPpTVWASN8MNKCIcYyap6myrvPeAhWhPO7f4EAy9nylOcS4sw2H4/exec`)를 그대로 재사용한다.
- 아임웹 API Key/Secret은 절대 브라우저/클라이언트 코드에 두지 않는다. 서버(`ops-api`) 환경변수에만 존재한다.
- `/ops/`는 `robots.txt`에서 차단하고 페이지에 `<meta name="robots" content="noindex">`를 넣는다. 공개 네비게이션·sitemap.xml·llms.txt에는 올리지 않는다.
- `contract-docket/`의 실제 배포(Supabase 프로젝트 생성, 호스팅, SMTP)는 이번 범위가 아니다. 대시보드의 계약 카드는 정적 "준비 중" 텍스트만 보여준다.
- 아임웹 방문자/트래픽 통계는 만들지 않는다 (아임웹 공식 API에 해당 기능 자체가 없음을 조사로 확인함).
- 자동화 테스트 프레임워크를 새로 들이지 않는다 — Node 빌트인 `node:test`만 쓴다 (별도 패키지 설치 없음).
- 설계 근거 문서: `docs/superpowers/specs/2026-11-15-ops-dashboard-design.md` (사용자 승인 완료).

---

### Task 1: `ops-api` 프로젝트 뼈대 + 헬스체크

**Files:**
- Create: `ops-api/package.json`
- Create: `ops-api/src/index.js`
- Create: `ops-api/.env.example`
- Create: `ops-api/.gitignore`

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: `GET /api/health` → `{ ok: true }`. 이후 모든 Task가 이 Express 앱(`app`)에 라우트를 추가한다.

- [ ] **Step 1: `ops-api/package.json` 작성**

```json
{
  "name": "ops-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test src/**/*.test.js"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2"
  }
}
```

- [ ] **Step 2: `ops-api/.gitignore` 작성**

```
node_modules
.env
```

- [ ] **Step 3: `ops-api/.env.example` 작성**

```
PORT=4100
ALLOWED_ORIGIN=https://chois-lab.site
APPS_SCRIPT_ENDPOINT=https://script.google.com/macros/s/AKfycbya2VGDKr3OM36OPpTVWASN8MNKCIcYyap6myrvPeAhWhPO7f4EAy9nylOcS4sw2H4/exec

# 아임웹 고객 사이트 목록. JSON 배열 문자열로 한 줄에 넣는다.
# 각 사이트는 아임웹 관리자 → 환경설정 → 외부 서비스 연동(API)에서 Key/Secret 발급.
IMWEB_SITES=[{"name":"부산요트투어","key":"REPLACE_ME","secret":"REPLACE_ME"}]
```

- [ ] **Step 4: `ops-api/src/index.js` 작성 (헬스체크만)**

```js
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4100;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://chois-lab.site';

app.set('trust proxy', true);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === ALLOWED_ORIGIN) return callback(null, true);
      return callback(new Error('허용되지 않은 출처입니다.'));
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`ops-api listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 5: 로컬 실행으로 검증**

```bash
cd ops-api && npm install && npm start &
sleep 1
curl -s http://localhost:4100/api/health
```

Expected: `{"ok":true}`

- [ ] **Step 6: 서버 종료 후 커밋**

```bash
kill %1
cd /Users/choidongil/projects/choislab
git add ops-api/package.json ops-api/src/index.js ops-api/.env.example ops-api/.gitignore ops-api/package-lock.json
git commit -m "ops-api: 프로젝트 뼈대 및 헬스체크 엔드포인트"
```

---

### Task 2: Apps Script 비밀번호 검증 함수 + 미들웨어

**Files:**
- Create: `ops-api/src/verifyOpsKey.js`
- Create: `ops-api/src/verifyOpsKey.test.js`
- Modify: `ops-api/src/index.js`

**Interfaces:**
- Consumes: Task 1의 `app`, `ALLOWED_ORIGIN` 패턴.
- Produces: `verifyOpsKey(key)` — `Promise<boolean>`, 키가 맞으면 `true`, 틀리거나 네트워크 실패면 `false`. `requireOpsKey` Express 미들웨어 — `X-Ops-Key` 헤더가 없거나 틀리면 `401 { error: '인증 실패' }`, 맞으면 `next()`. 이후 Task 4가 `/api/inquiries`에 이 미들웨어를 붙인다.

- [ ] **Step 1: `ops-api/src/verifyOpsKey.js` 작성**

```js
const APPS_SCRIPT_ENDPOINT =
  process.env.APPS_SCRIPT_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbya2VGDKr3OM36OPpTVWASN8MNKCIcYyap6myrvPeAhWhPO7f4EAy9nylOcS4sw2H4/exec';

// 비밀번호의 진짜 값은 여기 없다 — /quote/가 이미 쓰는 Google Apps Script에게
// "이 키로 ping 찍으면 통과되냐"고 매번 물어봐서 판단한다. ops-api 쪽에
// 별도의 비밀번호 해시를 저장하지 않음으로써 단일 진실 공급원을 유지한다.
export async function verifyOpsKey(key) {
  if (!key || typeof key !== 'string') return false;
  try {
    const url = `${APPS_SCRIPT_ENDPOINT}?key=${encodeURIComponent(key)}&action=ping`;
    const res = await fetch(url, { redirect: 'follow' });
    const data = await res.json();
    return Boolean(data && data.ok === true);
  } catch {
    return false;
  }
}

export function requireOpsKey() {
  return async function (req, res, next) {
    const key = req.header('X-Ops-Key');
    const ok = await verifyOpsKey(key);
    if (!ok) {
      return res.status(401).json({ error: '인증 실패' });
    }
    next();
  };
}
```

- [ ] **Step 2: `ops-api/src/verifyOpsKey.test.js` 작성 (fetch를 스텁으로 교체)**

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { verifyOpsKey } from './verifyOpsKey.js';

let originalFetch;

before(() => {
  originalFetch = global.fetch;
});

after(() => {
  global.fetch = originalFetch;
});

test('올바른 키면 true를 반환한다', async () => {
  global.fetch = async (url) => {
    assert.ok(String(url).includes('action=ping'));
    return { json: async () => ({ ok: true, rows: 3 }) };
  };
  assert.equal(await verifyOpsKey('correct-hash'), true);
});

test('틀린 키면 false를 반환한다', async () => {
  global.fetch = async () => ({ json: async () => ({ ok: false, error: '인증 실패' }) });
  assert.equal(await verifyOpsKey('wrong-hash'), false);
});

test('네트워크 에러가 나도 false를 반환한다 (던지지 않음)', async () => {
  global.fetch = async () => {
    throw new Error('network down');
  };
  assert.equal(await verifyOpsKey('anything'), false);
});

test('빈 키는 요청 없이 바로 false', async () => {
  global.fetch = async () => {
    throw new Error('호출되면 안 됨');
  };
  assert.equal(await verifyOpsKey(''), false);
  assert.equal(await verifyOpsKey(undefined), false);
});
```

- [ ] **Step 3: 테스트 실행해서 통과 확인**

```bash
cd ops-api && node --test src/verifyOpsKey.test.js
```

Expected: 4 tests, 0 fail.

- [ ] **Step 4: `ops-api/src/index.js`에 임시 보호 라우트 추가해서 실제 Apps Script로 검증**

`app.get('/api/health', ...)` 다음에 추가:

```js
import { requireOpsKey } from './verifyOpsKey.js';

app.get('/api/_check-auth', requireOpsKey(), (_req, res) => {
  res.json({ ok: true });
});
```

- [ ] **Step 5: 실제 비밀번호로 수동 검증**

```bash
cd ops-api && npm start &
sleep 1
echo "틀린 비밀번호:"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4100/api/_check-auth -H "X-Ops-Key: wrong"
echo "맞는 비밀번호로 — 실제 /quote/ 비밀번호를 SHA-256으로 변환한 값을 넣어서 확인:"
# 브라우저 콘솔에서: crypto.subtle.digest('SHA-256', new TextEncoder().encode('실제비밀번호')) 로 해시를 구해서 아래에 대입
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4100/api/_check-auth -H "X-Ops-Key: <실제_해시값>"
kill %1
```

Expected: 틀린 비밀번호는 401, 맞는 비밀번호는 200.

- [ ] **Step 6: 커밋**

```bash
git add ops-api/src/verifyOpsKey.js ops-api/src/verifyOpsKey.test.js ops-api/src/index.js
git commit -m "ops-api: Apps Script 기반 비밀번호 검증 미들웨어"
```

---

### Task 3: 아임웹 API 클라이언트 모듈

**Files:**
- Create: `ops-api/src/imweb.js`
- Create: `ops-api/src/imweb.test.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈, `global.fetch`만 사용).
- Produces:
  - `getAccessToken({ key, secret })` → `Promise<string>` (access_token), 실패 시 throw.
  - `getUnitCode(accessToken)` → `Promise<string>` (사이트의 첫 번째 unitCode), 실패 시 throw.
  - `countRecentSubmissions(accessToken, unitCode, sinceDate)` → `Promise<number>` (totalCount), 실패 시 throw.
  - `getRecentInquiryCount({ key, secret }, sinceDate)` → `Promise<number>` — 위 세 함수를 순서대로 묶어서 실행하는 조합 함수. Task 4가 사이트별로 이 함수 하나만 호출한다.

아임웹 공식 API 문서(`developers-docs.imweb.me`)에서 확인한 정확한 스펙:
- 토큰 발급: `GET https://api.imweb.me/v2/auth?key=<KEY>&secret=<SECRET>` → `{"msg":"SUCCESS","code":200,"access_token":"..."}`
- 사이트 정보: `GET https://openapi.imweb.me/site-info` + 헤더 `Authorization: Bearer <access_token>` → `{"statusCode":200,"data":{"siteCode":"...","unitList":[{"unitCode":"...","name":"...","currency":"..."}]}}`
- 입력폼 제출 건수: `GET https://openapi.imweb.me/community/form-submissions?page=1&limit=1&unitCode=<unitCode>&formSubmitTimeType=GTE&formSubmitTime=<ISO날짜>` + 헤더 `Authorization: Bearer <access_token>` → `{"statusCode":200,"data":{"totalCount":N,"totalPage":...,"currentPage":1,"pageSize":1,"unitCode":"...","list":[...]}}`. `limit=1`로 호출해도 `data.totalCount`는 필터링된 전체 개수이므로 목록 전체를 받을 필요가 없다.

- [ ] **Step 1: `ops-api/src/imweb.js` 작성**

```js
const AUTH_BASE = 'https://api.imweb.me/v2';
const API_BASE = 'https://openapi.imweb.me';

export async function getAccessToken({ key, secret }) {
  const url = `${AUTH_BASE}/auth?key=${encodeURIComponent(key)}&secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data || data.code !== 200 || !data.access_token) {
    throw new Error(`아임웹 토큰 발급 실패: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export async function getUnitCode(accessToken) {
  const res = await fetch(`${API_BASE}/site-info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  const unitList = body && body.data && body.data.unitList;
  if (!Array.isArray(unitList) || unitList.length === 0 || !unitList[0].unitCode) {
    throw new Error(`아임웹 사이트 정보 조회 실패: ${JSON.stringify(body)}`);
  }
  return unitList[0].unitCode;
}

export async function countRecentSubmissions(accessToken, unitCode, sinceDate) {
  const params = new URLSearchParams({
    page: '1',
    limit: '1',
    unitCode,
    formSubmitTimeType: 'GTE',
    formSubmitTime: sinceDate.toISOString(),
  });
  const res = await fetch(`${API_BASE}/community/form-submissions?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!body || !body.data || typeof body.data.totalCount !== 'number') {
    throw new Error(`아임웹 입력폼 제출 조회 실패: ${JSON.stringify(body)}`);
  }
  return body.data.totalCount;
}

export async function getRecentInquiryCount({ key, secret }, sinceDate) {
  const accessToken = await getAccessToken({ key, secret });
  const unitCode = await getUnitCode(accessToken);
  return countRecentSubmissions(accessToken, unitCode, sinceDate);
}
```

- [ ] **Step 2: `ops-api/src/imweb.test.js` 작성 (fetch 스텁으로 3개 함수 + 조합 함수 검증)**

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getAccessToken, getUnitCode, countRecentSubmissions, getRecentInquiryCount } from './imweb.js';

let originalFetch;
before(() => { originalFetch = global.fetch; });
after(() => { global.fetch = originalFetch; });

test('getAccessToken은 성공 응답에서 access_token을 반환한다', async () => {
  global.fetch = async (url) => {
    assert.ok(String(url).includes('key=k1'));
    assert.ok(String(url).includes('secret=s1'));
    return { json: async () => ({ msg: 'SUCCESS', code: 200, access_token: 'tok-abc' }) };
  };
  const token = await getAccessToken({ key: 'k1', secret: 's1' });
  assert.equal(token, 'tok-abc');
});

test('getAccessToken은 실패 응답이면 throw한다', async () => {
  global.fetch = async () => ({ json: async () => ({ code: 401 }) });
  await assert.rejects(() => getAccessToken({ key: 'bad', secret: 'bad' }));
});

test('getUnitCode는 unitList의 첫 번째 unitCode를 반환한다', async () => {
  global.fetch = async (url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer tok-abc');
    return {
      json: async () => ({
        statusCode: 200,
        data: { siteCode: 'S1', unitList: [{ unitCode: 'u-1', name: '테스트 사이트' }] },
      }),
    };
  };
  const unitCode = await getUnitCode('tok-abc');
  assert.equal(unitCode, 'u-1');
});

test('getUnitCode는 unitList가 비어있으면 throw한다', async () => {
  global.fetch = async () => ({ json: async () => ({ statusCode: 200, data: { unitList: [] } }) });
  await assert.rejects(() => getUnitCode('tok-abc'));
});

test('countRecentSubmissions은 totalCount를 반환하고 쿼리를 올바르게 만든다', async () => {
  global.fetch = async (url, opts) => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('unitCode'), 'u-1');
    assert.equal(u.searchParams.get('formSubmitTimeType'), 'GTE');
    assert.equal(opts.headers.Authorization, 'Bearer tok-abc');
    return { json: async () => ({ statusCode: 200, data: { totalCount: 4, list: [] } }) };
  };
  const count = await countRecentSubmissions('tok-abc', 'u-1', new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(count, 4);
});

test('getRecentInquiryCount은 세 단계를 순서대로 묶어서 최종 건수를 반환한다', async () => {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/v2/auth')) {
      return { json: async () => ({ code: 200, access_token: 'tok-xyz' }) };
    }
    if (String(url).includes('/site-info')) {
      return { json: async () => ({ statusCode: 200, data: { unitList: [{ unitCode: 'u-9' }] } }) };
    }
    return { json: async () => ({ statusCode: 200, data: { totalCount: 7, list: [] } }) };
  };
  const count = await getRecentInquiryCount({ key: 'k', secret: 's' }, new Date());
  assert.equal(count, 7);
  assert.equal(calls.length, 3);
});
```

- [ ] **Step 3: 테스트 실행**

```bash
cd ops-api && node --test src/imweb.test.js
```

Expected: 6 tests, 0 fail.

- [ ] **Step 4: 커밋**

```bash
git add ops-api/src/imweb.js ops-api/src/imweb.test.js
git commit -m "ops-api: 아임웹 API 클라이언트 모듈 (토큰·유닛코드·제출건수)"
```

- [ ] **Step 5 (실제 키 발급 후 수동 검증 — 지금은 건너뛰고 Task 5에서 다시 확인):**

사용자가 실제 아임웹 Key/Secret을 전달하면, 아래로 한 번 실행해서 진짜 응답 구조가 문서와 일치하는지 확인한다.

주의할 점: 아임웹 OpenAPI 문서는 `formSubmitTime`을 배열 타입으로 정의하지만(`['2021-01-01T00:00:00.000Z']`), 정확한 와이어 포맷(`formSubmitTime=값` 단일 키로 보내도 되는지, `formSubmitTime[]=값`처럼 배열 표기가 필요한지)은 문서에 명시돼 있지 않다. 현재 `imweb.js`는 `URLSearchParams`로 단일 키-값을 보낸다. 만약 실제 호출에서 날짜 필터가 무시되고 전체 기간의 `totalCount`가 나온다면(필터링이 전혀 안 된 것처럼 보이면), `countRecentSubmissions`의 쿼리 생성 부분을 `formSubmitTime[]=` 형태로 바꿔보고 재검증한다. 만약 `totalCount`가 실제와 다르면(예: 시간대 차이로 하루 어긋남), `formSubmitTime`에 넘기는 날짜를 조정한다.

```bash
cd ops-api
node -e "
import('./src/imweb.js').then(async (m) => {
  const count = await m.getRecentInquiryCount(
    { key: process.env.TEST_KEY, secret: process.env.TEST_SECRET },
    new Date(Date.now() - 7*24*60*60*1000)
  );
  console.log('최근 7일 문의 건수:', count);
});
"
```

---

### Task 4: `/api/inquiries` 엔드포인트 — 사이트별 병렬 조회 + 에러 격리

**Files:**
- Modify: `ops-api/src/index.js`
- Create: `ops-api/src/inquiries.js`
- Create: `ops-api/src/inquiries.test.js`

**Interfaces:**
- Consumes: Task 2의 `requireOpsKey`, Task 3의 `getRecentInquiryCount`.
- Produces: `buildInquiriesReport(sites, sinceDate, getRecentInquiryCountFn)` → `Promise<Array<{name, count}|{name, error}>>`. `GET /api/inquiries` (보호됨) → `{ sites: [...] }`. `/ops/index.html`(Task 9)이 이 JSON을 그대로 렌더링한다.

- [ ] **Step 1: `ops-api/src/inquiries.js` 작성 — 로직을 index.js에서 분리해 테스트 가능하게**

```js
// 사이트 하나가 실패해도 나머지 사이트 결과에 영향을 주지 않도록
// Promise.allSettled로 묶는다.
export async function buildInquiriesReport(sites, sinceDate, getRecentInquiryCountFn) {
  const results = await Promise.allSettled(
    sites.map((site) => getRecentInquiryCountFn(site, sinceDate))
  );

  return results.map((result, i) => {
    const name = sites[i].name;
    if (result.status === 'fulfilled') {
      return { name, count: result.value };
    }
    return { name, error: result.reason?.message || '조회 실패' };
  });
}

export function parseSitesFromEnv(envValue) {
  if (!envValue) return [];
  try {
    const parsed = JSON.parse(envValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && s.name && s.key && s.secret);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: `ops-api/src/inquiries.test.js` 작성**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInquiriesReport, parseSitesFromEnv } from './inquiries.js';

test('모든 사이트가 성공하면 건수를 그대로 반환한다', async () => {
  const sites = [{ name: 'A' }, { name: 'B' }];
  const fakeFn = async (site) => (site.name === 'A' ? 3 : 5);
  const report = await buildInquiriesReport(sites, new Date(), fakeFn);
  assert.deepEqual(report, [{ name: 'A', count: 3 }, { name: 'B', count: 5 }]);
});

test('한 사이트가 실패해도 나머지는 정상 반환된다', async () => {
  const sites = [{ name: 'A' }, { name: 'B' }];
  const fakeFn = async (site) => {
    if (site.name === 'A') throw new Error('토큰 발급 실패');
    return 5;
  };
  const report = await buildInquiriesReport(sites, new Date(), fakeFn);
  assert.deepEqual(report, [
    { name: 'A', error: '토큰 발급 실패' },
    { name: 'B', count: 5 },
  ]);
});

test('parseSitesFromEnv는 올바른 JSON 배열을 파싱한다', () => {
  const sites = parseSitesFromEnv('[{"name":"A","key":"k","secret":"s"}]');
  assert.deepEqual(sites, [{ name: 'A', key: 'k', secret: 's' }]);
});

test('parseSitesFromEnv는 필드가 빠진 항목을 걸러낸다', () => {
  const sites = parseSitesFromEnv('[{"name":"A","key":"k","secret":"s"},{"name":"B"}]');
  assert.deepEqual(sites, [{ name: 'A', key: 'k', secret: 's' }]);
});

test('parseSitesFromEnv는 빈 값/잘못된 JSON이면 빈 배열을 반환한다', () => {
  assert.deepEqual(parseSitesFromEnv(''), []);
  assert.deepEqual(parseSitesFromEnv(undefined), []);
  assert.deepEqual(parseSitesFromEnv('not json'), []);
});
```

- [ ] **Step 3: 테스트 실행**

```bash
cd ops-api && node --test src/inquiries.test.js
```

Expected: 5 tests, 0 fail.

- [ ] **Step 4: `ops-api/src/index.js`에서 임시 라우트(`/api/_check-auth`)를 지우고 실제 라우트로 교체**

`import { requireOpsKey } from './verifyOpsKey.js';`는 Task 2에서 이미 추가했으므로 다시 쓰지 않는다. 그 줄 아래에 새 import를 추가한다:

```js
import { getRecentInquiryCount } from './imweb.js';
import { buildInquiriesReport, parseSitesFromEnv } from './inquiries.js';
```

`app.get('/api/_check-auth', ...)` 블록 전체를 지우고 그 자리에:

```js
const SITES = parseSitesFromEnv(process.env.IMWEB_SITES);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

app.get('/api/inquiries', requireOpsKey(), async (_req, res) => {
  const sinceDate = new Date(Date.now() - SEVEN_DAYS_MS);
  const sites = await buildInquiriesReport(SITES, sinceDate, getRecentInquiryCount);
  res.json({ sites });
});
```

- [ ] **Step 5: 로컬에서 전체 흐름 확인 (사이트 목록이 비어있어도 빈 배열로 정상 응답하는지)**

```bash
cd ops-api && npm start &
sleep 1
curl -s http://localhost:4100/api/inquiries -H "X-Ops-Key: wrong"
echo
curl -s http://localhost:4100/api/inquiries -H "X-Ops-Key: <실제_해시값>"
kill %1
```

Expected: 첫 번째는 `{"error":"인증 실패"}` (401), 두 번째는 `{"sites":[]}` (아직 `IMWEB_SITES` 환경변수를 안 넣었으므로 빈 배열이 정상).

- [ ] **Step 6: 커밋**

```bash
git add ops-api/src/index.js ops-api/src/inquiries.js ops-api/src/inquiries.test.js
git commit -m "ops-api: /api/inquiries 엔드포인트 (사이트별 병렬 조회 + 에러 격리)"
```

---

### Task 5: `ops-api` Render 배포

**Files:**
- Create: `ops-api/README.md`

**Interfaces:**
- Consumes: Task 1~4에서 완성된 `ops-api/` 전체.
- Produces: `https://<서비스명>.onrender.com/api/inquiries` 라이브 엔드포인트. Task 9가 이 URL을 `/ops/index.html`에서 호출한다.

- [ ] **Step 1: `ops-api/README.md` 작성**

```markdown
# ops-api

초이스랩 운영 대시보드(`/ops/`)의 아임웹 문의 건수 조회 백엔드. 아임웹 Secret Key를
브라우저에 노출하지 않기 위해 존재하는 서버 전용 프록시.

## 로컬 실행

\`\`\`bash
npm install
cp .env.example .env
npm start
\`\`\`

## 환경변수

| 이름 | 설명 |
|---|---|
| `PORT` | 기본 4100 |
| `ALLOWED_ORIGIN` | CORS 허용 출처. 운영에서는 `https://chois-lab.site` |
| `APPS_SCRIPT_ENDPOINT` | `/quote/`와 공유하는 Google Apps Script 주소 (비밀번호 검증용) |
| `IMWEB_SITES` | JSON 배열 문자열. 각 사이트의 아임웹 관리자 → 환경설정 → 외부 서비스 연동(API)에서 발급받은 `{"name","key","secret"}` 목록 |

## Render 배포

1. Render 대시보드 → New → Web Service → 이 GitHub 레포(`chois-div/choislab`) 선택
2. Root Directory: `ops-api`
3. Runtime: Node (Docker 아님)
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment에 위 4개 환경변수 등록 (`IMWEB_SITES`는 실제 사이트 Key/Secret으로)
7. 배포 완료 후 `GET <서비스 URL>/api/health`로 `{"ok":true}` 확인
```

- [ ] **Step 2: 커밋 후 push**

```bash
git add ops-api/README.md
git commit -m "ops-api: README 및 Render 배포 가이드"
git push origin main
```

- [ ] **Step 3: Render에서 README의 절차대로 실제 배포 (사용자 확인 필요 — Render 콘솔 조작은 에이전트가 직접 로그인할 수 없으므로, 사용자가 진행하거나 사용자 동석 하에 진행)**

- [ ] **Step 4: 배포 후 실제 엔드포인트로 검증**

```bash
curl -s https://<실제-서비스-주소>.onrender.com/api/health
curl -s https://<실제-서비스-주소>.onrender.com/api/inquiries -H "X-Ops-Key: <실제_해시값>"
```

Expected: health는 `{"ok":true}`, inquiries는 `IMWEB_SITES`에 등록한 사이트 수만큼의 결과 배열 (아직 실제 키를 안 넣었다면 빈 배열이거나 404 — `IMWEB_SITES` 미설정 시 `parseSitesFromEnv`가 빈 배열을 반환하므로 에러 없이 `{"sites":[]}`).

---

### Task 6: `/ops/index.html` — 비밀번호 게이트

**Files:**
- Create: `ops/index.html`

**Interfaces:**
- Consumes: 없음 (새 정적 페이지의 시작점).
- Produces: 비밀번호 통과 시 `document.body.classList.add('unlocked')` + 메모리 변수 `KEY`. Task 7~10이 `KEY`를 그대로 사용해 각 카드의 데이터를 요청한다.

- [ ] **Step 1: `ops/index.html` 작성 — 기본 레이아웃 + 비밀번호 게이트만 (카드는 다음 Task들에서 채움)**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>초이스랩 운영 대시보드</title>
<style>
  :root {
    --black: #0B1220; --white: #F2F4F8; --accent: #1F5FD1;
    --gray1: #111827; --gray2: #1C2333; --gray4: #9a9a9a;
    --border: rgba(255,255,255,0.08); --radius-md: 20px; --radius-pill: 100px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--black); color: var(--white);
    font-family: -apple-system, 'Pretendard', sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .lock-box {
    width: 100%; max-width: 360px; padding: 32px; text-align: center;
  }
  .lock-box h1 { font-size: 20px; margin-bottom: 24px; }
  .lock-box input {
    width: 100%; padding: 14px 16px; border-radius: var(--radius-md);
    border: 1px solid var(--border); background: var(--gray1); color: var(--white);
    font-size: 15px; margin-bottom: 12px;
  }
  .lock-box button {
    width: 100%; padding: 14px; border-radius: var(--radius-pill);
    border: none; background: var(--accent); color: var(--white);
    font-size: 15px; font-weight: 700; cursor: pointer;
  }
  .lock-box button:disabled { opacity: 0.5; cursor: default; }
  .lock-msg { min-height: 20px; font-size: 13px; color: var(--gray4); margin-top: 10px; }
  .lock-msg.err { color: #ff6b6b; }

  body.unlocked .lock-box { display: none; }
  .dashboard { display: none; max-width: 960px; margin: 0 auto; padding: 48px 24px; }
  body.unlocked .dashboard { display: block; }
  .dashboard h1 { font-size: 24px; margin-bottom: 32px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .card {
    background: var(--gray1); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 24px; text-decoration: none; color: inherit; display: block;
  }
  .card h2 { font-size: 15px; color: var(--gray4); margin: 0 0 12px; font-weight: 600; }
  .card .big { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .card .sub { font-size: 13px; color: var(--gray4); }
  .card.disabled { opacity: 0.5; cursor: default; }
</style>
</head>
<body>

<div class="lock-box">
  <h1>초이스랩 운영 대시보드</h1>
  <input type="password" id="pw" placeholder="비밀번호" autocomplete="off" />
  <button type="button" id="unlockBtn">확인</button>
  <div class="lock-msg" id="lockMsg"></div>
</div>

<div class="dashboard">
  <h1>운영 현황</h1>
  <div class="cards" id="cards">
    <!-- 카드는 Task 7~10에서 채운다 -->
  </div>
</div>

<script>
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbya2VGDKr3OM36OPpTVWASN8MNKCIcYyap6myrvPeAhWhPO7f4EAy9nylOcS4sw2H4/exec';
  var KEY = ''; // 비밀번호의 SHA-256 해시. 메모리에만 두고 저장하지 않음.

  function sha256hex(s) {
    if (!(window.crypto && crypto.subtle)) {
      return Promise.reject(new Error('보안 연결이 아닙니다. https 주소로 열어주세요.'));
    }
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  var pwInput = document.getElementById('pw');
  var lockMsg = document.getElementById('lockMsg');
  var unlockBtn = document.getElementById('unlockBtn');

  function unlock() {
    var pw = pwInput.value;
    if (!pw) { lockMsg.textContent = '비밀번호를 입력해 주세요.'; lockMsg.className = 'lock-msg err'; return; }
    lockMsg.textContent = '확인 중…'; lockMsg.className = 'lock-msg';
    unlockBtn.disabled = true;

    sha256hex(pw).then(function (hex) {
      return fetch(ENDPOINT + '?key=' + encodeURIComponent(hex) + '&action=ping', { redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          unlockBtn.disabled = false;
          if (res && res.ok) {
            KEY = hex;
            document.body.classList.add('unlocked');
            pwInput.value = '';
            lockMsg.textContent = '';
            if (window.onOpsUnlocked) window.onOpsUnlocked(KEY);
          } else {
            lockMsg.textContent = '비밀번호가 맞지 않습니다.';
            lockMsg.className = 'lock-msg err';
          }
        });
    }).catch(function (err) {
      unlockBtn.disabled = false;
      lockMsg.textContent = err.message;
      lockMsg.className = 'lock-msg err';
    });
  }

  unlockBtn.addEventListener('click', unlock);
  pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });
  pwInput.focus();
</script>
</body>
</html>
```

- [ ] **Step 2: 로컬 정적 서버로 직접 확인**

```bash
cd /Users/choidongil/projects/choislab && python3 -m http.server 8735 &
sleep 1
open http://localhost:8735/ops/
```

틀린 비밀번호 입력 → "비밀번호가 맞지 않습니다." 표시되는지, 실제 `/quote/` 비밀번호 입력 → 잠금 화면이 사라지고 "운영 현황" 제목이 보이는지 브라우저에서 직접 확인.

- [ ] **Step 3: 서버 종료 후 커밋**

```bash
kill %1
git add ops/index.html
git commit -m "ops: /ops/index.html 비밀번호 게이트 (기존 /quote/ 비밀번호 재사용)"
```

---

### Task 7: 포트폴리오 카드

**Files:**
- Modify: `ops/index.html`

**Interfaces:**
- Consumes: Task 6의 `window.onOpsUnlocked(KEY)` 훅, `#cards` 컨테이너.
- Produces: `#cards` 안에 포트폴리오 카드 1개. `renderPortfolioCard()` 함수.

- [ ] **Step 1: `#cards` 안에 카드 placeholder 추가**

`<div class="cards" id="cards">` 바로 다음 줄에:

```html
<a class="card" id="cardPortfolio" href="/admin/">
  <h2>포트폴리오</h2>
  <div class="big" id="portfolioCount">—</div>
  <div class="sub">클릭해서 관리</div>
</a>
```

- [ ] **Step 2: `</script>` 태그 바로 앞에 렌더 함수와 훅 연결 추가**

```js
function renderPortfolioCard() {
  fetch('/data/portfolio.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var count = (data && data.portfolio && data.portfolio.length) || 0;
      document.getElementById('portfolioCount').textContent = count + '건';
    })
    .catch(function () {
      document.getElementById('portfolioCount').textContent = '불러오기 실패';
    });
}

window.onOpsUnlocked = function (key) {
  renderPortfolioCard();
};
```

- [ ] **Step 3: 로컬에서 확인**

```bash
cd /Users/choidongil/projects/choislab && python3 -m http.server 8735 &
sleep 1
open http://localhost:8735/ops/
```

비밀번호 통과 후 포트폴리오 카드에 `data/portfolio.json`의 실제 항목 수(`python3 -c "import json; print(len(json.load(open('data/portfolio.json'))['portfolio']))"`로 미리 확인한 값)와 같은 숫자가 뜨는지 확인.

- [ ] **Step 4: 커밋**

```bash
kill %1
git add ops/index.html
git commit -m "ops: 포트폴리오 카드 (data/portfolio.json 직접 fetch)"
```

---

### Task 8: 견적서 카드

**Files:**
- Modify: `ops/index.html`

**Interfaces:**
- Consumes: Task 6의 `KEY`, `ENDPOINT`, `window.onOpsUnlocked`.
- Produces: `#cards` 안에 견적서 카드 1개. `renderQuoteCard(key)` 함수.

- [ ] **Step 1: 포트폴리오 카드 다음에 견적서 카드 placeholder 추가**

```html
<a class="card" id="cardQuote" href="/quote/">
  <h2>견적서</h2>
  <div class="big" id="quoteCount">—</div>
  <div class="sub" id="quoteLatest">클릭해서 관리</div>
</a>
```

- [ ] **Step 2: 렌더 함수 추가, `onOpsUnlocked`에서 호출**

```js
function renderQuoteCard(key) {
  fetch(ENDPOINT + '?key=' + encodeURIComponent(key) + '&action=list', { redirect: 'follow' })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error);
      document.getElementById('quoteCount').textContent = res.list.length + '건';
      var latest = res.list[0];
      document.getElementById('quoteLatest').textContent = latest
        ? (latest.project || latest.client || latest.docNo)
        : '클릭해서 관리';
    })
    .catch(function () {
      document.getElementById('quoteCount').textContent = '불러오기 실패';
    });
}
```

`window.onOpsUnlocked` 안에 `renderQuoteCard(key);` 한 줄 추가 (기존 `renderPortfolioCard();` 아래).

- [ ] **Step 3: 로컬에서 확인**

```bash
cd /Users/choidongil/projects/choislab && python3 -m http.server 8735 &
sleep 1
open http://localhost:8735/ops/
```

견적서 카드 건수가 `/quote/`를 직접 열어서 "목록 새로고침" 했을 때 보이는 건수와 일치하는지 확인.

- [ ] **Step 4: 커밋**

```bash
kill %1
git add ops/index.html
git commit -m "ops: 견적서 카드 (기존 Apps Script action=list 재사용)"
```

---

### Task 9: 아임웹 문의 카드

**Files:**
- Modify: `ops/index.html`

**Interfaces:**
- Consumes: Task 6의 `KEY`, `window.onOpsUnlocked`. Task 5에서 배포된 `ops-api`의 실제 URL.
- Produces: `#cards` 안에 사이트별 문의 건수를 보여주는 카드 1개. `renderInquiryCard(key)` 함수.

- [ ] **Step 1: 견적서 카드 다음에 아임웹 문의 카드 placeholder 추가 (링크 없는 `div`로 — 사이트가 여러 개라 단일 링크가 없음)**

```html
<div class="card" id="cardInquiry">
  <h2>아임웹 문의 (최근 7일)</h2>
  <div id="inquiryList" class="sub">불러오는 중…</div>
</div>
```

- [ ] **Step 2: `OPS_API_BASE` 상수와 렌더 함수 추가**

`var KEY = '';` 바로 아래에:

```js
var OPS_API_BASE = 'https://ops-api.onrender.com'; // Task 5에서 실제 배포된 주소로 교체
```

렌더 함수:

```js
function renderInquiryCard(key) {
  var el = document.getElementById('inquiryList');
  fetch(OPS_API_BASE + '/api/inquiries', { headers: { 'X-Ops-Key': key } })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || !Array.isArray(res.sites)) throw new Error('잘못된 응답');
      if (res.sites.length === 0) {
        el.textContent = '등록된 사이트 없음';
        return;
      }
      el.innerHTML = '';
      res.sites.forEach(function (site) {
        var row = document.createElement('div');
        row.textContent = site.error
          ? (site.name + ': 조회 실패')
          : (site.name + ': ' + site.count + '건');
        el.appendChild(row);
      });
    })
    .catch(function () {
      el.textContent = '불러오기 실패';
    });
}
```

`window.onOpsUnlocked` 안에 `renderInquiryCard(key);` 한 줄 추가.

- [ ] **Step 3: Task 5에서 받은 실제 `ops-api` Render URL로 `OPS_API_BASE` 값 교체**

- [ ] **Step 4: 로컬에서 확인 (ops-api가 실제 아임웹 키를 가지고 배포돼 있어야 의미 있는 결과가 나옴)**

```bash
cd /Users/choidongil/projects/choislab && python3 -m http.server 8735 &
sleep 1
open http://localhost:8735/ops/
```

브라우저 개발자 도구 Network 탭에서 `/api/inquiries` 호출이 실제 `ops-api` 주소로 나가는지, 사이트별 건수 줄이 등록된 사이트 수만큼 나오는지 확인. 사이트 1곳의 Key/Secret을 Render 환경변수에서 일부러 틀리게 바꿔서 그 줄만 "조회 실패"로 뜨고 나머지는 정상인지도 확인.

- [ ] **Step 5: 커밋**

```bash
kill %1
git add ops/index.html
git commit -m "ops: 아임웹 문의 카드 (ops-api /api/inquiries 연동)"
```

---

### Task 10: 계약(전자계약) 플레이스홀더 카드

**Files:**
- Modify: `ops/index.html`

**Interfaces:**
- Consumes: 없음 (정적 카드, 네트워크 요청 없음).
- Produces: `#cards` 안의 마지막 4번째 카드.

- [ ] **Step 1: 아임웹 문의 카드 다음에 추가**

```html
<div class="card disabled" id="cardContract">
  <h2>전자계약</h2>
  <div class="big">준비 중</div>
  <div class="sub">contract-docket 실배포 예정</div>
</div>
```

- [ ] **Step 2: 로컬에서 4개 카드가 모두 보이는지 확인**

```bash
cd /Users/choidongil/projects/choislab && python3 -m http.server 8735 &
sleep 1
open http://localhost:8735/ops/
```

- [ ] **Step 3: 커밋**

```bash
kill %1
git add ops/index.html
git commit -m "ops: 전자계약 준비중 플레이스홀더 카드"
```

---

### Task 11: 검색엔진 노출 차단 + 최종 배포 + 전체 체크리스트

**Files:**
- Modify: `robots.txt`

**Interfaces:**
- Consumes: Task 6~10에서 완성된 `/ops/index.html` 전체.
- Produces: 완전히 배포된 `/ops/` 대시보드.

- [ ] **Step 1: `robots.txt`에 `/ops/` 차단 추가**

현재:
```
User-agent: *
Allow: /
Disallow: /quote/
Disallow: /admin/

Sitemap: https://chois-lab.site/sitemap.xml
```

변경 후:
```
User-agent: *
Allow: /
Disallow: /quote/
Disallow: /admin/
Disallow: /ops/

Sitemap: https://chois-lab.site/sitemap.xml
```

- [ ] **Step 2: `sitemap.xml`과 `llms.txt`에 `/ops/`가 들어가 있지 않은지 확인 (들어가 있으면 제거)**

```bash
grep -i "ops" sitemap.xml llms.txt
```

Expected: 아무 결과도 없어야 함 (애초에 추가한 적 없으므로 통과할 것).

- [ ] **Step 3: 커밋 및 push**

```bash
cd /Users/choidongil/projects/choislab
git add robots.txt
git commit -m "robots.txt: /ops/ 크롤링 차단 추가"
git push origin main
```

- [ ] **Step 4: GitHub Pages 배포 완료 대기 후 라이브 전체 체크리스트 실행**

```bash
for i in $(seq 1 10); do
  status=$(gh run list --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"')
  echo "check $i: $status"
  if [[ "$status" == completed* ]]; then break; fi
  sleep 15
done
```

라이브(`https://chois-lab.site/ops/`)에서 브라우저로 직접 확인:
- [ ] 틀린 비밀번호 → 대시보드 안 열림
- [ ] 올바른 비밀번호(`/quote/`와 동일) → 대시보드 열림
- [ ] 포트폴리오 건수 = `data/portfolio.json` 실제 항목 수
- [ ] 견적서 건수 = `/quote/`에서 보이는 목록과 일치
- [ ] 아임웹 문의 카드 = 등록된 사이트 수만큼 줄 표시, 각 건수가 대략 맞음
- [ ] 사이트 1곳 Key/Secret을 의도적으로 틀리게 해도 그 줄만 실패, 나머지 정상
- [ ] `curl -sI https://chois-lab.site/ops/ | grep -i x-robots` 또는 페이지 소스에서 `noindex` 메타 태그 확인
- [ ] `curl -s https://chois-lab.site/robots.txt | grep ops` → `Disallow: /ops/` 확인

모두 통과하면 완료.
