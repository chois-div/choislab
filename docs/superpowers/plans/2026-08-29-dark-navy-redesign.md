# 초이스랩 다크 네이비 리디자인 (파이브프로 참고) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `chois-lab.site`를 원래 다크(순블랙+노랑/코랄) 테마에서 딥 네이비 톤 + 퍼플/블루 2색 포인트로 리터치하고, 히어로에 실제 포트폴리오 스크린샷 목업 스택을 추가하며, 포트폴리오 카드를 호버 오버레이 방식에서 항상 노출되는 카드(이미지+배지, 하단 이름/설명+원형 화살표)로 바꾼다. 참고 사이트: [fivepro.co.kr](https://fivepro.co.kr).

**Architecture:** `index.html` 하나의 인라인 `<style>`(CSS 변수 기반)과 인라인 `<script>`(portfolio.json을 fetch해 카드 HTML을 렌더링)를 수정한다. 색상은 `:root` 변수 값 교체로 대부분 자동 전파되고, 히어로 목업과 포트폴리오 카드는 마크업/JS 템플릿을 직접 수정한다.

**Tech Stack:** 순수 HTML/CSS/바닐라 JS (프레임워크 없음), GitHub Pages 배포 (`chois-div/choislab`, custom domain `chois-lab.site`, `main` 브랜치 push 시 배포).

## Global Constraints

- 이 작업은 `main`에서 새로 만든 `redesign/dark-navy` 브랜치에서 진행한다 (이미 생성·체크아웃됨, 디자인 스펙 문서 커밋 완료).
- `redesign/light-theme` 브랜치는 건드리지 않는다 (폐기 상태로 보존만, 삭제도 병합도 하지 않음).
- 배포는 `main` 브랜치에서만 발생한다. 사용자가 미리보기 후 승인하기 전까지는 `main`에 병합/푸시하지 않는다.
- 폰트는 Pretendard 유지 (변경 금지).
- nav, why-section, services, pricing, process, testimonials, CTA, marquee, footer의 레이아웃/구조/카피는 변경하지 않는다 — 이 작업의 스코프는 색상 토큰, 히어로 목업, 포트폴리오 섹션(배경+카드 구조)으로 한정한다.
- 클라이언트 로고 스트립은 추가하지 않는다 (사용자가 명시적으로 선택하지 않음).
- `portfolio.html`(상세 포트폴리오 페이지)은 이번 스코프에 포함하지 않는다.
- 팀/인물 실사진은 없으므로 만들어 넣지 않는다 — 히어로에는 실제 포트폴리오 스크린샷(`images/portfolio/*.jpg`)만 사용한다.
- 디자인 근거 문서: `docs/superpowers/specs/2026-08-29-dark-navy-redesign-design.md` (사용자 승인 완료, 시각 미리보기로 확인함).

---

### Task 1: index.html — 색상 토큰 교체

**Files:**
- Modify: `index.html:78-98` (`:root`)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: 새 다크 네이비 팔레트가 반영된 `:root`. 이후 Task는 이 토큰을 그대로 사용.

**정확한 값 교체 (12줄 중 5줄만 값 변경, 나머지 7줄은 그대로 둠):**

현재 (`index.html:78-98`):
```css
:root {
  --black: #0a0a0a;
  --white: #f5f3ee;
  --accent: #5B4FFF;
  --accent2: #FF4D4D;
  --yellow: #FFD23F;
  --violet-tint: #E4E1FF;
  --yellow-tint: #FFF3D6;
  --red-tint: #FFE2E2;
  --gray1: #141414;
  --gray2: #232323;
  --gray3: #6b6b6b;
  --gray4: #9a9a9a;
  --border: rgba(255,255,255,0.08);
  --radius-pill: 100px;
  --radius-lg: 28px;
  --radius-md: 20px;
  --font-display: 'Pretendard', sans-serif;
  --font-body: 'Pretendard', sans-serif;
  --font-mono: 'Pretendard', sans-serif;
}
```

새 값:
```css
:root {
  --black: #0B1220;
  --white: #F2F4F8;
  --accent: #5B4FFF;
  --accent2: #3D82F7;
  --yellow: #3D82F7;
  --violet-tint: #E4E1FF;
  --yellow-tint: #FFF3D6;
  --red-tint: #FFE2E2;
  --gray1: #111827;
  --gray2: #1C2333;
  --gray3: #6b6b6b;
  --gray4: #9a9a9a;
  --border: rgba(255,255,255,0.08);
  --radius-pill: 100px;
  --radius-lg: 28px;
  --radius-md: 20px;
  --font-display: 'Pretendard', sans-serif;
  --font-body: 'Pretendard', sans-serif;
  --font-mono: 'Pretendard', sans-serif;
}
```

변경되는 5개 값: `--black`(`#0a0a0a`→`#0B1220`), `--white`(`#f5f3ee`→`#F2F4F8`), `--accent2`(`#FF4D4D`→`#3D82F7`), `--yellow`(`#FFD23F`→`#3D82F7`, accent2와 동일값), `--gray1`(`#141414`→`#111827`), `--gray2`(`#232323`→`#1C2333`). `--accent`, `--violet-tint`, `--yellow-tint`, `--red-tint`, `--gray3`, `--gray4`, `--border`, radius/font 변수들은 값 변경 없음.

이 파일 안의 다른 어떤 CSS 규칙이나 마크업도 건드리지 않는다 — `:root` 블록 12줄이 유일한 변경 대상이다.

- [ ] **Step 1:** 위 6개 변수(`--black`, `--white`, `--accent2`, `--yellow`, `--gray1`, `--gray2`) 값을 새 값으로 교체한다.
- [ ] **Step 2:** 브라우저에서 `index.html`을 열어 페이지 전체가 로드되는지 확인한다 (Task 2, 3 이전이라 히어로 목업/포트폴리오 카드 구조 변경은 아직 없음 — 색만 네이비/블루로 바뀐 상태가 정상).
- [ ] **Step 3:** Git 커밋

```bash
cd ~/projects/choislab
git add index.html
git commit -m "style: swap color tokens to dark navy + blue/purple palette"
```

### Task 2: index.html — 히어로 포트폴리오 목업 스택 추가

**Files:**
- Modify: `index.html:262-276` (새 CSS 블록 삽입 위치), `index.html:1175-1179` (히어로 마크업에 목업 삽입)

**Interfaces:**
- Consumes: Task 1의 새 토큰 값 (직접 참조하는 색상 없음 — 이미지와 rgba 리터럴만 사용)
- Produces: 데스크톱(1025px 이상)에서만 보이는 히어로 우측 목업 스택. Task 3과 독립적.

**Step 1: CSS 추가**

`index.html:273-276`은 현재:
```css
@keyframes scrollPulse {
  0%, 100% { opacity: 0.3; transform: scaleY(1); }
  50% { opacity: 1; transform: scaleY(0.6); transform-origin: top; }
}
```
이 블록(276번째 줄의 닫는 `}`) 바로 다음, `/* MARQUEE */` 주석(현재 278번째 줄) 바로 앞에 아래 CSS를 새로 삽입한다:

```css

/* HERO MOCKUP STACK */
.hero-mockup-stack {
  position: absolute;
  right: 6%;
  top: 50%;
  transform: translateY(-50%);
  width: 380px;
  height: 460px;
  pointer-events: none;
  z-index: 1;
}
.hero-mockup {
  position: absolute;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
}
.hero-mockup img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hm-1 { top: 0; left: 0; width: 280px; aspect-ratio: 4/5; transform: rotate(-6deg); z-index: 1; }
.hm-2 { top: 60px; left: 90px; width: 280px; aspect-ratio: 4/5; transform: rotate(4deg); z-index: 2; }
.hm-3 { top: 20px; left: 170px; width: 200px; aspect-ratio: 3/4; transform: rotate(-2deg); z-index: 3; }
@media (max-width: 1024px) {
  .hero-mockup-stack { display: none; }
}
@media (min-width: 1025px) {
  .hero-title { max-width: 600px; }
  .hero-bottom { max-width: 620px; }
}
```

**Step 2: 마크업 추가**

`index.html:1175-1179`은 현재:
```html
  <div class="hero-scroll animate-in delay-4">
    <div class="scroll-line"></div>
    <span>Scroll</span>
  </div>
</section>
```

`</section>`(히어로 섹션 닫는 태그) 바로 앞에 아래 마크업을 추가한다 (즉 `.hero-scroll` div 다음, `</section>` 이전):

```html

  <div class="hero-mockup-stack">
    <div class="hero-mockup hm-1"><img src="images/portfolio/project-05.jpg" alt="위고런 프로젝트 스크린샷" loading="lazy"></div>
    <div class="hero-mockup hm-2"><img src="images/portfolio/project-01.jpg" alt="부산요트투어 프로젝트 스크린샷" loading="lazy"></div>
    <div class="hero-mockup hm-3"><img src="images/portfolio/project-08.jpg" alt="애드드림즈 프로젝트 스크린샷" loading="lazy"></div>
  </div>
```

결과적으로 `index.html:1175-1179` 영역은:
```html
  <div class="hero-scroll animate-in delay-4">
    <div class="scroll-line"></div>
    <span>Scroll</span>
  </div>

  <div class="hero-mockup-stack">
    <div class="hero-mockup hm-1"><img src="images/portfolio/project-05.jpg" alt="위고런 프로젝트 스크린샷" loading="lazy"></div>
    <div class="hero-mockup hm-2"><img src="images/portfolio/project-01.jpg" alt="부산요트투어 프로젝트 스크린샷" loading="lazy"></div>
    <div class="hero-mockup hm-3"><img src="images/portfolio/project-08.jpg" alt="애드드림즈 프로젝트 스크린샷" loading="lazy"></div>
  </div>
</section>
```

이미지 경로 3개(`images/portfolio/project-05.jpg`, `project-01.jpg`, `project-08.jpg`)는 저장소에 이미 존재하는 실제 파일이다 (`ls images/portfolio/`로 확인 가능). 다른 프로젝트 이미지로 바꾸지 않는다.

- [ ] **Step 1:** 위 CSS 블록을 정확한 위치(scrollPulse 키프레임 뒤, MARQUEE 주석 앞)에 삽입한다.
- [ ] **Step 2:** 위 마크업을 히어로 섹션의 `</section>` 직전에 삽입한다.
- [ ] **Step 3:** 브라우저에서 데스크톱 너비(1280px 이상)로 확인 — 히어로 우측에 3장의 스크린샷이 부채꼴로 겹쳐 보이고, 히어로 타이틀/설명/버튼과 겹치지 않아야 한다. 브라우저 창을 1024px 이하로 좁혀서 목업 스택이 사라지는지도 확인한다.
- [ ] **Step 4:** Git 커밋

```bash
git add index.html
git commit -m "feat: add hero portfolio screenshot mockup stack"
```

### Task 3: index.html — 포트폴리오 섹션 다크 통일 + 카드 구조 변경

**Files:**
- Modify: `index.html:412-489` (포트폴리오 섹션 CSS), `index.html:1049-1054` (모바일 미디어쿼리 내 포트폴리오 오버라이드), `index.html:1589-1601` (JS 카드 렌더링 템플릿 + 관련 함수)

**Interfaces:**
- Consumes: Task 1의 새 토큰 값. `data/portfolio.json`의 필드(`image`, `category`, `name`, `sub`)는 변경하지 않고 그대로 사용.
- Produces: 다크 배경의 포트폴리오 섹션, 항상 노출되는 카드 구조. 이 작업 이후 `.portfolio-overlay`, `.portfolio-tag`, `bindPortfolioTouch()`는 코드베이스에서 완전히 제거된다 — 다른 어떤 Task도 이 이름들을 참조하지 않는다.

**Step 1: 섹션 배경 + 필터탭 + "더보기" 버튼 다크 전환**

`index.html:413-415`, 현재:
```css
.portfolio-section { background: var(--white); color: var(--black); }
.portfolio-section .section-title { color: var(--black); }
.portfolio-section .section-label { background: var(--accent2); }
```
다음으로 교체:
```css
.portfolio-section { background: var(--black); color: var(--white); }
.portfolio-section .section-title { color: var(--white); }
.portfolio-section .section-label { background: var(--accent2); }
```
(`.portfolio-section .section-label` 줄은 변경 없음 — 이미 accent2로 오버라이드되어 있어 배경과 무관하게 잘 보임)

`index.html:422-437`, 현재:
```css
.filter-tab {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  padding: 10px 20px;
  background: var(--violet-tint);
  color: var(--black);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.2s;
}
.filter-tab.active, .filter-tab:hover {
  background: var(--black);
  color: var(--white);
}
```
`.filter-tab` 규칙(첫 10줄)은 변경하지 않는다 (다크 배경 위 밝은 필 배지로 그대로 잘 보임). `.filter-tab.active, .filter-tab:hover` 규칙만 다음으로 교체:
```css
.filter-tab.active, .filter-tab:hover {
  background: var(--accent);
  color: var(--white);
}
```

`index.html:514-515`, 현재:
```css
.portfolio-more .btn-secondary { border-color: var(--black); color: var(--black); }
.portfolio-more .btn-secondary:hover { background: var(--black); color: var(--white); }
```
다음으로 교체:
```css
.portfolio-more .btn-secondary { border-color: var(--white); color: var(--white); }
.portfolio-more .btn-secondary:hover { background: var(--white); color: var(--black); }
```

**Step 2: 카드 구조 CSS 교체**

`index.html:444-489`, 현재 전체:
```css
.portfolio-item {
  position: relative;
  aspect-ratio: 4/3;
  background: var(--gray1);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s ease;
}
.portfolio-item:hover { transform: translateY(-4px); }
.portfolio-item.tall { aspect-ratio: 4/5; grid-row: span 1; }
.portfolio-img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.portfolio-item:hover .portfolio-img { transform: scale(1.05); }
.portfolio-overlay {
  position: absolute; inset: 0;
  background: rgba(10,10,10,0.85);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 28px;
  opacity: 0;
  transition: opacity 0.3s;
}
.portfolio-item:hover .portfolio-overlay { opacity: 1; }
.portfolio-tag {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--yellow);
  margin-bottom: 8px;
}
.portfolio-name {
  font-size: 19px;
  font-weight: 800;
  margin-bottom: 4px;
}
.portfolio-sub { font-size: 13px; color: rgba(245,243,238,0.7); }
```

전체를 아래로 교체 (`.portfolio-item.tall`, `.portfolio-overlay`, `.portfolio-tag`는 삭제됨 — 새 구조에서 쓰이지 않는다):

```css
.portfolio-item {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--gray1);
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
}
.portfolio-item:hover { transform: translateY(-4px); }
.portfolio-img-wrap {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
}
.portfolio-badge {
  position: absolute;
  top: 14px; left: 14px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  color: var(--white);
  background: rgba(10,10,10,0.6);
  backdrop-filter: blur(6px);
  border-radius: var(--radius-pill);
  padding: 6px 14px;
}
.portfolio-img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
  display: block;
}
.portfolio-item:hover .portfolio-img { transform: scale(1.05); }
.portfolio-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 20px;
}
.portfolio-name {
  font-size: 17px;
  font-weight: 800;
  margin-bottom: 4px;
  color: var(--white);
}
.portfolio-sub { font-size: 13px; color: var(--gray4); }
.portfolio-arrow {
  flex-shrink: 0;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--white);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  text-decoration: none;
  transition: transform 0.2s ease, background 0.2s ease;
}
.portfolio-item:hover .portfolio-arrow { transform: translate(3px, -3px); background: var(--accent2); }
```

**Step 3: 모바일 미디어쿼리 내 포트폴리오 오버라이드 수정**

`index.html:1050-1052`, 현재:
```css
  .portfolio-grid { grid-template-columns: 1fr; }
  .portfolio-item { aspect-ratio: 3/2; }
  .portfolio-overlay { opacity: 1; background: linear-gradient(to top, rgba(10,10,10,0.9) 0%, transparent 60%); }
```
다음으로 교체 (`.portfolio-overlay` 줄은 삭제, `.portfolio-item`의 `aspect-ratio` 오버라이드는 `.portfolio-img-wrap`으로 이동):
```css
  .portfolio-grid { grid-template-columns: 1fr; }
  .portfolio-img-wrap { aspect-ratio: 3/2; }
```
(바로 다음 줄의 `.filter-tabs { flex-wrap: wrap; gap: 6px; margin-bottom: 32px; }`, `.filter-tab { font-size: 12px; padding: 8px 16px; }`는 변경하지 않는다.)

**Step 4: JS 카드 렌더링 템플릿 + 관련 함수 수정**

`index.html:1576-1601`, 현재:
```js
function bindPortfolioTouch() {
  document.querySelectorAll('.portfolio-item').forEach(item => {
    item.addEventListener('touchstart', () => {
      const overlay = item.querySelector('.portfolio-overlay');
      if (overlay) overlay.style.opacity = overlay.style.opacity === '1' ? '0' : '1';
    }, {passive: true});
  });
}

fetch('data/portfolio.json')
  .then(res => res.json())
  .then(data => {
    const items = data.portfolio || [];
    portfolioGrid.innerHTML = items.map(p => `
    <div class="portfolio-item" data-cat="${p.category}">
      <div class="portfolio-img" style="background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;transition:transform 0.6s ease;" loading="lazy">
      </div>
      <div class="portfolio-overlay">
        <div class="portfolio-tag">${CATEGORY_LABELS[p.category] || p.category}</div>
        <div class="portfolio-name">${p.name}</div>
        <div class="portfolio-sub">${p.sub}</div>
      </div>
    </div>`).join('');
    bindPortfolioTouch();
  })
  .catch(err => console.error('Failed to load portfolio data:', err));
```

다음으로 교체 (`bindPortfolioTouch` 함수와 그 호출부는 완전히 삭제 — 새 카드는 호버 오버레이가 없으므로 터치 토글이 필요 없다):
```js
fetch('data/portfolio.json')
  .then(res => res.json())
  .then(data => {
    const items = data.portfolio || [];
    portfolioGrid.innerHTML = items.map(p => `
    <div class="portfolio-item" data-cat="${p.category}">
      <div class="portfolio-img-wrap">
        <span class="portfolio-badge">${CATEGORY_LABELS[p.category] || p.category}</span>
        <img class="portfolio-img" src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="portfolio-info">
        <div>
          <div class="portfolio-name">${p.name}</div>
          <div class="portfolio-sub">${p.sub}</div>
        </div>
        <a class="portfolio-arrow" href="${p.image}" target="_blank" rel="noopener" aria-label="${p.name} 크게 보기">→</a>
      </div>
    </div>`).join('');
  })
  .catch(err => console.error('Failed to load portfolio data:', err));
```

`CATEGORY_LABELS`, `portfolioGrid` 변수 선언(`index.html:1573-1574`)과 `filterWork` 함수(`index.html:1605-` 이하)는 변경하지 않는다 — 그대로 새 카드 구조와 호환된다.

- [ ] **Step 1:** Step 1의 3개 CSS 블록(섹션 배경, 필터탭 active/hover, 더보기 버튼)을 정확히 교체한다.
- [ ] **Step 2:** Step 2의 카드 CSS 블록 전체를 교체한다 (`.portfolio-item.tall`, `.portfolio-overlay`, `.portfolio-tag` 삭제 확인).
- [ ] **Step 3:** Step 3의 모바일 미디어쿼리 오버라이드를 교체한다.
- [ ] **Step 4:** Step 4의 JS 템플릿을 교체하고 `bindPortfolioTouch` 함수 정의 및 호출부를 삭제한다.
- [ ] **Step 5:** 브라우저에서 확인: (a) 포트폴리오 섹션 전체가 다크 배경으로 보이는지, (b) 카드마다 이미지+배지, 하단에 이름/설명+원형 화살표가 항상(마우스 오버 없이도) 보이는지, (c) 필터 탭 클릭 시 정상 필터링되는지, (d) 브라우저 콘솔에 `bindPortfolioTouch is not defined` 같은 에러가 없는지, (e) 창을 768px 이하로 좁혀 카드가 3/2 비율로 잘 보이는지.
- [ ] **Step 6:** Git 커밋

```bash
git add index.html
git commit -m "feat: unify portfolio section to dark and rework cards to always-visible layout"
```

### Task 4: 전체 검증 + 미리보기 브랜치 푸시

**Files:** 없음 (검증 + git/push만)

- [ ] **Step 1:** `redesign/dark-navy` 브랜치에서 작업했는지 확인 (`git branch --show-current`).
- [ ] **Step 2:** index.html을 데스크톱(1440px), 태블릿(900px), 모바일(390px) 너비로 각각 스크린샷 — 히어로 목업 스택이 데스크톱에서만 보이는지, 포트폴리오 섹션이 전체 다크로 통일됐는지, 원래 있던 노랑/코랄 색이 더 이상 없는지(페이지 전체 grep으로 `#FFD23F`, `#FF4D4D` 리터럴이 CSS에 남아있지 않은지도 확인 — `:root`의 값 자체가 바뀌었으므로 리터럴로는 안 남아있어야 정상) 확인.
- [ ] **Step 3:** `git push -u origin redesign/dark-navy` — **main에는 병합하지 않는다.**
- [ ] **Step 4:** 사용자에게 로컬 미리보기 방법(브랜치 체크아웃 후 `open index.html`)을 안내하고 승인을 기다린다. 승인 후에만 `main`으로 병합/푸시하여 `chois-lab.site`에 실제 반영한다.

---

## Self-Review

- **Spec 커버리지:** 디자인 문서(`docs/superpowers/specs/2026-08-29-dark-navy-redesign-design.md`)의 4개 항목 — (1) 색상 토큰, (2) 히어로 목업 스택, (3) 포트폴리오 카드 구조 + 섹션 다크 통일(보정 포함), (4) 브랜치 전략 — 모두 Task 1-4와 Global Constraints에 반영됨.
- **플레이스홀더 스캔:** 없음 — 모든 Step에 정확한 파일/라인/전체 코드 블록 명시.
- **일관성:** Task 3에서 `.portfolio-overlay`/`.portfolio-tag`/`bindPortfolioTouch`를 완전히 제거한다고 명시했고, Task 3 Step 3(모바일 미디어쿼리)의 `.portfolio-overlay` 오버라이드 삭제도 함께 포함시켜 죽은 CSS가 남지 않도록 함. `filterWork`가 `item.style.display`만 조작하므로 카드 구조 변경과 무관하게 계속 동작함을 확인.
- **범위:** 단일 파일(`index.html`)의 CSS+JS 리스킨/리스트럭처로 범위가 명확. `portfolio.html`, `data/portfolio.json`은 스코프 밖으로 명시.
- **부작용 검토:** `--yellow`를 `--accent2`와 동일 블루값으로 통일하면서 why-section의 `.stat:nth-child(2)`, process-section의 `.process-step-num:nth-child(2)` 등 일부 out-of-scope 요소의 포인트 컬러가 퍼플/블루/블루로(기존 퍼플/노랑/코랄 대비 다양성 감소) 바뀌지만, 깨지거나 안 보이는 수준은 아니며 "2색 단순화"라는 승인된 디자인 의도의 자연스러운 결과이므로 별도 Task로 만들지 않음. `.section-label` 기본 규칙이 다크 섹션(services/pricing/process)에서 배경과 같은 색(검정→네이비)이 되는 것은 원본 사이트에도 이미 존재하던 특성이며 이번 변경으로 새로 생기는 문제가 아니므로 손대지 않음.
