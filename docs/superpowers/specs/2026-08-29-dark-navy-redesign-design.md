# 초이스랩 다크 네이비 리디자인 (파이브프로 참고) — Design

## 배경

`chois-lab.site`는 원래 다크(순블랙) + 노랑/코랄 다색 포인트 테마였다. 앞서 라이트(화이트 + 블루/퍼플) 테마로 전환하는 작업을 `redesign/light-theme` 브랜치에서 Task 1~5까지 진행했으나, 사용자가 [fivepro.co.kr](https://fivepro.co.kr)을 참고 사이트로 제시하며 방향을 전환했다. `redesign/light-theme` 브랜치는 폐기하고(병합하지 않고 그대로 보존만), `main`의 원래 다크 테마를 베이스로 새 브랜치에서 다크 네이비 리디자인을 진행한다.

파이브프로에서 사용자가 마음에 들어한 요소 3가지:
1. 다크 네이비 톤 자체
2. 실제 인물/회의 사진이 들어간 히어로
3. 포트폴리오 카드 구성 (로고+제목+화살표, 항상 노출)

단, 팀/회의 실사진은 준비되어 있지 않으므로, 사용자 확인에 따라 이미 사이트에 있는 실제 포트폴리오 스크린샷(`images/portfolio/project-01.jpg` ~ `project-12.jpg`, `data/portfolio.json`에 이름/설명/카테고리 매핑됨)을 히어로에 활용한다. 가짜 인물 사진을 만들어 넣지 않는다.

## 범위

**변경:** 색상 토큰(네이비 톤 + 2색 포인트 체계), 히어로 섹션(포트폴리오 스크린샷 목업 배치 추가), 포트폴리오 카드 구조(호버 오버레이 → 상시 노출 카드).

**변경 없음:** nav, why-section, services, pricing, process, testimonials, CTA, marquee, footer의 레이아웃/구조/카피. 이 섹션들은 원래 다크 테마에서 이미 잘 동작하므로 손대지 않는다. Pretendard 폰트 유지. `portfolio.html`(상세 포트폴리오 페이지)은 이번 스코프에 포함하지 않는다 — 필요시 별도 작업.

**클라이언트 로고 스트립**: 사용자가 명시적으로 선택하지 않은 요소이므로 추가하지 않는다.

## 1. 색상 토큰

| 변수 | 현재(main) | 새 값 | 비고 |
|---|---|---|---|
| `--black` | `#0a0a0a` | `#0B1220` | 딥 네이비 블랙. 배경 역할 유지 |
| `--white` | `#f5f3ee` (크림) | `#F2F4F8` | 살짝 쿨톤 화이트로, 네이비와 조화 |
| `--accent` | `#5B4FFF` | 변경 없음 | 메인 퍼플 유지 (브랜드 컬러로 이미 정착) |
| `--accent2` | `#FF4D4D` (코랄) | `#3D82F7` | 블루로 교체 — 파이브프로 CTA 블루 참고 |
| `--yellow` | `#FFD23F` | `#3D82F7` (accent2와 동일값) | 파이브프로처럼 다색 포인트를 2색(퍼플+블루) 체계로 단순화. 변수명은 하위 호환을 위해 유지하되 값만 블루로 통일 |
| `--violet-tint`, `--yellow-tint`, `--red-tint` | 라이트 틴트들 | 변경 없음 | why-section(이미 라이트) 카드 배경으로 그대로 사용, 스코프 밖 |
| `--gray1` | `#141414` | `#111827` | 네이비 계열 다크 표면 (카드 배경 등) |
| `--gray2` | `#232323` | `#1C2333` | 네이비 계열 |
| `--gray3` | `#6b6b6b` | 변경 없음 | |
| `--gray4` | `#9a9a9a` | 변경 없음 | |
| `--border` | `rgba(255,255,255,0.08)` | 변경 없음 (다크 배경 위 흰 보더 그대로 유효) | |

다색 포인트를 2색으로 단순화하는 것과 관련해, `--yellow`가 배경 칩(예: `.hero-tag`, `.price-badge`, `.process-duration`)으로 쓰이는 곳은 파란색 칩이 되어 자연스럽다. 별도 마크업 변경 없이 토큰 값 교체만으로 전파된다.

## 2. 히어로 — 포트폴리오 목업 스택

현재 히어로는 `.hero-title`, `.hero-desc`, CTA 버튼만 있는 텍스트 중심 레이아웃(`index.html:1152-1179`)이다. 여기에 실제 포트폴리오 스크린샷 3장을 겹쳐진 브라우저 목업 카드로 히어로 우측에 추가한다.

**레이아웃:** 히어로를 `flex` 2단 구성으로 바꾸지 않고, 기존 텍스트 블록은 그대로 두되 `.hero` 안에 절대배치(`position: absolute`)된 `.hero-mockup-stack` 컨테이너를 우측에 추가한다 — 기존 `.hero-bg-text`(배경 워터마크)와 같은 레이어 기법을 재사용해 레이아웃 리스크를 최소화한다. 데스크톱(1024px 초과)에서만 노출하고, 태블릿/모바일에서는 `display: none`으로 숨겨 기존 반응형 레이아웃을 건드리지 않는다.

**구성:** `data/portfolio.json`의 처음 3개 항목 이미지를 정적으로 하드코딩(빌드 스텝이 없는 순수 정적 사이트이므로 JS로 동적 로드하지 않고 `<img>` 3장을 마크업에 직접 작성). 각 이미지는 카드 프레임(둥근 모서리, 얇은 보더, 그림자)으로 감싸고, `rotate`와 `translate`를 다르게 줘서 부채꼴로 겹친 느낌을 낸다.

```html
<div class="hero-mockup-stack">
  <div class="hero-mockup hm-1"><img src="images/portfolio/project-05.jpg" alt="위고런 프로젝트 스크린샷" loading="lazy"></div>
  <div class="hero-mockup hm-2"><img src="images/portfolio/project-01.jpg" alt="부산요트투어 프로젝트 스크린샷" loading="lazy"></div>
  <div class="hero-mockup hm-3"><img src="images/portfolio/project-08.jpg" alt="애드드림즈 프로젝트 스크린샷" loading="lazy"></div>
</div>
```

```css
.hero-mockup-stack {
  position: absolute;
  right: 6%;
  top: 50%;
  transform: translateY(-50%);
  width: 380px;
  height: 460px;
  pointer-events: none;
}
.hero-mockup {
  position: absolute;
  width: 280px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
}
.hero-mockup img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hm-1 { top: 0; left: 0; transform: rotate(-6deg); aspect-ratio: 4/5; z-index: 1; }
.hm-2 { top: 60px; left: 90px; transform: rotate(4deg); aspect-ratio: 4/5; z-index: 2; }
.hm-3 { top: 20px; left: 170px; width: 200px; transform: rotate(-2deg); aspect-ratio: 3/4; z-index: 3; }
@media (max-width: 1024px) { .hero-mockup-stack { display: none; } }
```

`.hero-title`, `.hero-bottom`(설명+CTA)의 `max-width`를 겹치지 않도록 `620px` 정도로 제한해 목업 스택과 텍스트가 시각적으로 부딪히지 않게 한다.

## 3. 포트폴리오 카드 — 상시 노출 구조 + 섹션 배경 다크 통일

**섹션 배경 (설계 중 발견한 보정 사항):** 현재 `.portfolio-section`은 `background: var(--white); color: var(--black)`로, 다크 페이지 중간에 흰 배경 섹션이 하나 끼워진 구조다(why-section과 동일한 패턴). 파이브프로의 포트폴리오 카드는 다크 배경 위에 있고, "다크 네이비 톤 자체"가 사용자가 꼽은 핵심 요소이므로, 포트폴리오 섹션도 흰 배경 대신 다크 네이비로 통일한다. 단 `.why-section`은 이번 스코프에서 명시적으로 제외했으므로(범위 참고) 그대로 흰 배경 유지 — 다크 통일은 포트폴리오 섹션에만 적용한다.

- `.portfolio-section { background: var(--white); color: var(--black); }` → `background: var(--black); color: var(--white);`
- `.portfolio-section .section-title { color: var(--black); }` → `color: var(--white);`
- `.filter-tab { background: var(--violet-tint); color: var(--black); }`는 유지(다크 배경 위 밝은 필 배지로 자연스럽게 동작).
- `.filter-tab.active, .filter-tab:hover { background: var(--black); color: var(--white); }` → `background: var(--accent); color: var(--white);` (다크 배경 위에서 검정 필은 배경과 거의 구분이 안 되므로 포인트 컬러로 교체)
- `.portfolio-more .btn-secondary { border-color: var(--black); color: var(--black); }` → `border-color: var(--white); color: var(--white);`
- `.portfolio-more .btn-secondary:hover { background: var(--black); color: var(--white); }` → `background: var(--white); color: var(--black);`

현재 `.portfolio-item`은 마우스 오버 시에만 `.portfolio-overlay`(반투명 다크 스크림 위 텍스트)가 나타나는 방식(`index.html:1590-1599`의 JS 템플릿). 이를 이미지 위/아래로 분리된 상시 노출 카드로 바꾼다.

**새 카드 구조 (JS 템플릿 변경, `index.html` 내 `portfolio.json` fetch 콜백):**

```html
<div class="portfolio-item" data-cat="${p.category}">
  <div class="portfolio-img-wrap">
    <span class="portfolio-badge">${CATEGORY_LABELS[p.category] || p.category}</span>
    <img class="portfolio-img" src="${p.image}" alt="${p.name}" loading="lazy">
  </div>
  <div class="portfolio-info">
    <div class="portfolio-text">
      <div class="portfolio-name">${p.name}</div>
      <div class="portfolio-sub">${p.sub}</div>
    </div>
    <a class="portfolio-arrow" href="${p.image}" target="_blank" aria-label="${p.name} 크게 보기">→</a>
  </div>
</div>
```

**CSS 변경 방향:**
- `.portfolio-item`을 세로 flex(이미지 영역 + 정보 영역)로 변경, 기존 `aspect-ratio` 고정 규칙은 이미지 영역(`.portfolio-img-wrap`)으로 옮긴다.
- `.portfolio-badge`: 이미지 좌상단에 절대배치되는 작은 필(`border-radius: var(--radius-pill)`), 다크 반투명 배경 위 흰 텍스트 — 기존 `.section-label` 스타일 재사용.
- `.portfolio-info`: 카드 하단, `justify-content: space-between`으로 텍스트와 화살표를 양끝 배치.
- `.portfolio-arrow`: 기존 `.service-arrow`(원형 44px, 다크 배경)와 동일한 시각 언어를 재사용하되, 클릭 시 원본 이미지를 새 탭으로 여는 실용적 기능을 부여한다(현재 상세 링크가 없으므로).
- 기존 `.portfolio-overlay`(오버레이 방식)와 관련 hover-toggle JS(`touchstart` 리스너 등)는 더 이상 필요 없으므로 제거한다.
- 카드 자체의 hover 효과는 유지하되(살짝 떠오르는 `translateY`), 오버레이 페이드인 대신 이미지 살짝 확대(`scale`) 정도로 축소한다.

## 4. 브랜치/배포

- 새 브랜치 `redesign/dark-navy`를 `main`에서 생성해 작업한다.
- `redesign/light-theme` 브랜치는 삭제하지 않고 그대로 둔다(병합 안 함, 참고용 보존).
- 이전과 동일하게: 사용자가 로컬에서 미리보기 후 승인해야 `main`에 병합한다. 임의로 병합/배포하지 않는다.

## Self-Review

- **플레이스홀더 스캔:** 없음 — 모든 값/코드가 구체적으로 명시됨.
- **일관성:** `--yellow`를 `--accent2`와 동일 블루값으로 통일하는 결정이 색상 표와 "다색→2색 단순화" 설명에서 일치함을 확인.
- **범위:** nav/why/services/pricing/process/testimonials/CTA/footer는 명시적으로 스코프 제외 — 사용자가 파이브프로에서 언급한 3요소(톤, 히어로, 포트폴리오 카드)에만 집중.
- **에셋 검증:** `images/portfolio/project-01.jpg` 등 실제 파일 존재 확인 완료(저장소에 12개 파일 존재), `data/portfolio.json` 필드명(`image`, `category`, `name`, `sub`) 실제 코드와 일치 확인 완료.
- **보정 이력:** 최초 초안에서 `.portfolio-section`이 흰 배경 섹션이라는 점을 놓쳐, 사용자 승인용 미리보기(다크 배경 기준)와 실제 반영 시 불일치가 생길 뻔했다. 사용자에게 알리고 3번 섹션에 다크 통일 보정을 추가했다.
