# 한국 수어 인식기 (Korean Sign Language Recognizer)

실시간 한국 수어를 인식하여 한국어 텍스트로 변환하고 음성으로 읽어주는 웹 애플리케이션입니다.

A web application that recognizes Korean sign language in real-time, converts it to Korean text, and reads it aloud.

---

## 주요 기능 (Features)

- 웹캠을 통한 실시간 양손 추적 (MediaPipe Hands)
- 한국어 자음 10개 인식 (ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅅ, ㅇ, ㅈ, ㅎ)
- 기본 단어 5개 인식 (안녕하세요, 감사합니다, 사랑합니다, 도와주세요, 괜찮아요)
- 한국어 TTS (Web Speech API)로 음성 출력
- 디바운싱 + 확인 시스템으로 중복 입력 방지
- 인식 신뢰도 실시간 표시
- 카메라/모델 로딩 에러 처리
- 반응형 디자인

---

## 기술 스택 (Tech Stack)

| 구분 | 기술 |
|------|------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Hand Tracking | `@mediapipe/tasks-vision` (HandLandmarker) |
| Classification | Rule-based classifier (확장 가능) |
| TTS | Web Speech API |
| Icons | lucide-react |
| Fonts | Pretendard, Space Grotesk |

---

## 설치 및 실행 (Installation & Run)

### 1. 의존성 설치 / Install dependencies
```bash
npm install
```

### 2. 개발 서버 실행 / Run dev server
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.
The browser will open at `http://localhost:5173`.

> ⚠️ 카메라 권한은 `localhost` 또는 HTTPS 환경에서만 허용됩니다.
> Camera permissions only work on `localhost` or HTTPS.

### 3. 프로덕션 빌드 / Production build
```bash
npm run build
npm run preview
```

---

## 프로젝트 구조 (Project Structure)

```
korean-sign-language/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── README.md
└── src/
    ├── main.tsx                       # 앱 진입점 / Entry point
    ├── App.tsx                        # 메인 컴포넌트 / Main component
    │
    ├── components/                    # UI 컴포넌트 / UI components
    │   ├── CameraPreview.tsx          # 카메라 + 랜드마크 오버레이
    │   ├── KoreanTextOutput.tsx       # 인식된 텍스트 표시
    │   ├── SpeechButton.tsx           # TTS 재생 버튼
    │   ├── ResetButton.tsx            # 텍스트 초기화 버튼
    │   ├── ConfidenceIndicator.tsx    # 신뢰도/현재 제스처 표시
    │   ├── ErrorMessage.tsx           # 에러 메시지
    │   └── GestureGuide.tsx           # 제스처 사용법 가이드
    │
    ├── services/                      # 비즈니스 로직 / Business logic
    │   ├── HandTrackingService.ts     # MediaPipe Hands 서비스
    │   ├── GestureClassifier.ts       # 제스처 분류기 (규칙 기반)
    │   └── SpeechService.ts           # 한국어 TTS 서비스
    │
    ├── hooks/
    │   └── useHandTracking.ts         # 손 추적 라이프사이클 훅
    │
    ├── data/
    │   └── gesturePatterns.ts         # 자음/단어 패턴 정의
    │
    ├── types/
    │   └── index.ts                   # 전역 타입 정의
    │
    └── styles/
        ├── index.css                  # 전역 스타일
        └── App.css                    # 컴포넌트 스타일
```

---

## 인식 가능한 제스처 (Supported Gestures)

### 자음 (한 손)
| 문자 | 손 모양 |
|------|---------|
| ㄱ | 엄지 + 검지 펴기 (L자 모양) |
| ㄴ | 검지만 펴기 |
| ㄷ | 엄지 + 검지 + 중지 펴기 |
| ㄹ | 검지 + 중지 + 약지 펴기 |
| ㅁ | 주먹 (모두 굽힘) |
| ㅂ | 엄지 제외 4개 손가락 펴기 |
| ㅅ | 검지 + 중지 펴기 (V자) |
| ㅇ | 엄지 + 검지로 원 만들기 (OK) |
| ㅈ | 엄지 + 소지 펴기 |
| ㅎ | 5개 손가락 모두 펴기 (보자기) |

### 단어 (양 손)
| 단어 | 손 모양 |
|------|---------|
| 안녕하세요 | 양손 모두 활짝 펴기 |
| 감사합니다 | 양손 모두 주먹 |
| 사랑합니다 | 양손 모두 검지 + 소지 펴기 |
| 도와주세요 | 한 손은 주먹, 다른 손은 펼친 손바닥 |
| 괜찮아요 | 양손 모두 엄지만 펴기 (따봉) |

> ⚠️ 이 패턴은 학습용 단순화 모델이며 실제 한국 수어와 정확히 일치하지 않습니다.
> 실제 KSL은 손 모양뿐 아니라 움직임, 방향, 위치까지 의미에 포함하는 복잡한 시각 언어입니다.

---

## 사용 방법 (How to Use)

1. 브라우저에서 앱을 열고 카메라 권한을 허용합니다.
2. 카메라가 켜지면 손을 카메라 앞에 들어 올립니다.
3. 위의 제스처 표를 참고하여 손 모양을 만듭니다.
4. 손 모양을 **약 0.8초간** 안정적으로 유지하면 텍스트에 추가됩니다.
5. "음성으로 읽기" 버튼을 누르면 한국어 TTS로 읽어줍니다.
6. "초기화" 버튼으로 텍스트를 지울 수 있습니다.

---

## 인식 로직 (Recognition Logic)

```
1. requestAnimationFrame으로 매 프레임 실행
   ↓
2. MediaPipe HandLandmarker로 손 21개 랜드마크 감지
   ↓
3. 손가락 5개의 펴짐/굽힘 상태 계산 (TIP-WRIST vs PIP-WRIST 거리)
   ↓
4. 양손이면 단어 패턴 먼저 매칭, 아니면 자음 매칭
   ↓
5. 추가 조건 검증 (예: ㅇ은 엄지-검지 거리가 손바닥 너비의 50% 이하)
   ↓
6. 신뢰도 0.85 이상이면 후보로 채택
   ↓
7. 확인 시스템: 같은 제스처가 0.8초간 유지되면 텍스트에 추가
   ↓
8. 디바운스: 같은 제스처는 1.5초 이내 재추가 불가
```

---

## 테스트 안내 (Testing)

### 수동 테스트 체크리스트
- [ ] 카메라 권한 허용 시 비디오가 표시되는가?
- [ ] 카메라 권한 거부 시 안내 메시지가 표시되는가?
- [ ] 손을 들어 올리면 랜드마크가 캔버스에 그려지는가?
- [ ] 왼손/오른손이 다른 색(주황/청록)으로 표시되는가?
- [ ] 각 자음 제스처가 인식되는가?
- [ ] 같은 제스처를 계속 들고 있어도 0.8초마다 한 번씩만 추가되는가?
- [ ] 단어 제스처(양손)가 자음보다 우선 인식되는가?
- [ ] "음성으로 읽기" 클릭 시 한국어로 읽히는가?
- [ ] "초기화" 클릭 시 텍스트가 지워지는가?
- [ ] 화면을 좁혀도 레이아웃이 무너지지 않는가?

### 브라우저 호환성
- Chrome 90+ ✓ (권장)
- Edge 90+ ✓
- Safari 14+ ✓ (Web Speech API 지원)
- Firefox 90+ ✓ (음성 품질은 다소 낮을 수 있음)

> 모바일 브라우저는 MediaPipe 성능이 다소 떨어질 수 있습니다.

---

## 향후 개선 아이디어 (Future Improvements)

### 단기 (Short-term)
- [ ] **TensorFlow.js 학습 모델 적용**: 규칙 기반 → 신경망으로 교체
- [ ] **데이터 수집 모드**: 사용자가 직접 제스처를 녹화하여 학습 데이터 생성
- [ ] **모음 (ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ) 추가**
- [ ] **자모 결합 → 음절 자동 생성** (예: ㄱ+ㅏ → 가)
- [ ] **사용자 캘리브레이션**: 사용자의 손 크기에 맞게 임계값 자동 조정
- [ ] **모바일 최적화**: 후면 카메라 옵션, 터치 UI

### 중기 (Mid-term)
- [ ] **시간 시계열 모델 (LSTM)**: 움직임이 있는 KSL 제스처 인식
- [ ] **대화 히스토리 저장**: localStorage 또는 Supabase 연동
- [ ] **다국어 지원**: 영어/일본어 수어 모드 추가
- [ ] **실시간 자막 모드**: 음성 → 수어 애니메이션 변환 (역방향)
- [ ] **WebRTC 영상 통화 통합**: 청각 장애인 화상 통화 보조

### 장기 (Long-term)
- [ ] **문장 단위 인식**: 단어 시퀀스 → 자연스러운 한국어 문장 변환 (Claude API 연동)
- [ ] **3D 수어 아바타**: Three.js로 텍스트 → 수어 애니메이션 표시
- [ ] **PWA 변환**: 오프라인 사용 가능 (모델을 로컬에 캐시)
- [ ] **접근성 인증**: WCAG 2.1 AA 준수
- [ ] **공공 데이터 연동**: 국립국어원 한국수어사전 API 활용

---

## 알려진 제한사항 (Known Limitations)

1. **단순화된 규칙 기반 분류기**: 실제 KSL과 정확히 일치하지 않습니다.
2. **움직임 미지원**: 정적인 손 모양만 인식하며, 손의 움직임은 무시됩니다.
3. **조명 의존성**: 어두운 환경에서 MediaPipe의 정확도가 떨어집니다.
4. **카메라 거리**: 카메라로부터 약 30~80cm 거리에서 가장 잘 작동합니다.
5. **단일 사용자**: 한 번에 한 명의 손만 안정적으로 인식됩니다.

---

## 라이선스 (License)

MIT License — 자유롭게 사용, 수정, 배포 가능합니다.

---

## 참고 자료 (References)

- [MediaPipe Hand Landmarker Documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [국립국어원 한국수어사전](https://sldict.korean.go.kr/)
