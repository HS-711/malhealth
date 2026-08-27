# 루틴메이트 (RoutineMate)

친구들과 함께 **운동 출석**과 **하루 세끼 식단**을 기록하는 아주 간단한 웹앱입니다.
Netlify에서 완전히 무료(Free 플랜)로 돌아가도록 만들었습니다.

- 프론트엔드: 순수 HTML/CSS/JS (빌드 도구 없음)
- 백엔드: Netlify Functions (TypeScript)
- 데이터 저장: Netlify Blobs (별도 DB 설정 불필요, 배포하면 자동 생성됨)

## 기능

- 회원가입 / 로그인 (아이디 + 비밀번호, 비밀번호는 salt+hash로 저장)
- 날짜별 운동 출석 체크 (내 출석만 토글 가능, 친구들 현황은 다같이 조회)
- 이번 주 내 출석 스트릭 한눈에 보기
- **이번 주 멤버별 운동 횟수 비교** (막대그래프로 순위 표시)
- 날짜 + 아침/점심/저녁별 식단 기록, 친구들 식단 조회
- **식단 자가 점검** (1~5점 별점 + 한 줄 메모, 친구들 점수도 함께 조회)
- **하루 1장 인증샷 업로드(선택)** — 운동/식단 뭐든 자유롭게, 업로드 전 브라우저에서 자동으로 축소·압축 (최대 1024px, JPEG 품질 75%)해서 용량과 비용 부담을 최소화했습니다. 별도 이미지 DB 없이 Netlify Blobs에 바이너리로 저장됩니다.
- **이번 주 / 이번 달 요약** — 내 출석·식단 기록 통계, 멤버별 출석/평균 식단점수 랭킹, "개근왕/식단왕/기록왕" 뱃지

## 로컬에서 미리보기 (선택)

```bash
npm install -g netlify-cli
cd fitbuddy
npm install
netlify dev
```

`netlify dev`를 실행하면 Blobs와 Functions를 로컬에서 에뮬레이션해서
`http://localhost:8888` 에서 바로 테스트할 수 있어요. (Netlify 계정 로그인 필요)

## Netlify에 배포하기

1. 이 폴더를 GitHub 저장소로 올리기
   ```bash
   cd fitbuddy
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin <내 GitHub 저장소 주소>
   git push -u origin main
   ```
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → 방금 만든 GitHub 저장소 선택
3. Build settings는 `netlify.toml`에 이미 다 정의되어 있어서 그대로 **Deploy** 누르면 끝
   - Build command: 비워둬도 됨 (정적 파일이라 별도 빌드 없음)
   - Publish directory: `public`
4. 배포가 끝나면 Netlify가 자동으로 Blobs 스토어(`users`, `sessions`, `attendance`, `diet`)를 생성합니다. 별도 DB 설정 필요 없어요.
5. 나온 URL(예: `https://your-app.netlify.app`)을 친구들에게 공유하고, 각자 회원가입해서 사용하면 됩니다.

## 참고 / 한계

- 로그인은 친구들끼리 편하게 쓰는 용도로 만든 **간단한 인증**이에요. 결제 정보처럼 민감한 데이터를 다루는 서비스에는 적합하지 않습니다.
- 세션 토큰은 60일간 유효하며, 로그인 상태에서 앱을 쓸 때마다 만료 시각이 다시 60일 뒤로 밀리는 슬라이딩 방식입니다. 로그아웃하면 즉시 만료됩니다.
- 친구 목록(`/api/friends`)은 가입한 모든 사용자를 보여줘요. 특정 그룹만 보이게 하려면 추후 "그룹" 개념을 추가하면 됩니다.
- **인증샷 조회(`GET /api/photo`)는 로그인 없이도 날짜+아이디를 알면 볼 수 있어요.** 친구들끼리 편하게 쓰는 용도라 이렇게 단순화했는데, 더 엄격하게 막고 싶으면 조회에도 인증을 요구하도록 바꿀 수 있습니다.
- 사진은 업로드 전 브라우저에서 자동으로 리사이즈하기 때문에 원본 파일이 아무리 커도 실제 저장 용량은 보통 수백 KB 수준입니다. Netlify Free 플랜의 Blobs 저장 한도 안에서 친구 몇 명이 매일 써도 전혀 부족하지 않습니다.
- Netlify Free 플랜의 월 300 크레딧 안에서는 친구 몇 명이 매일 쓰는 정도로는 전혀 부족하지 않습니다.
- "이번 달" 요약은 하루하루의 출석/식단/점수를 모두 모아서 집계하는 방식이라, 탭을 열 때마다 최대 30여 건의 요청이 병렬로 나갑니다. 친구 몇 명 규모에서는 체감상 문제 없지만, 사용 인원이 아주 많아지면 캐싱을 고려할 수 있습니다.
