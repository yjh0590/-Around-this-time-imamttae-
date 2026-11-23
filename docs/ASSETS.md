# 이미지 자산

2026-11-23에 기본 내장 imagegen 도구로 생성했다. CLI/API 경로는 사용하지 않았다. 저장소에서 외부 생성 이미지 경로를 참조하지 않는다.

## 디자인 비교 시안

- 파일: `docs/seasonal-home-concept.png`
- 용도: 사계절 UI 방향을 확인하는 참고 이미지. 실행 화면 자체가 아니다.
- 최종 프롬프트 요약: Korean app “이맘때” four mobile home screens side by side; identical clean white card UI, pale warm gray background, centered consistent rounded warm-white pebble mascot, spring sage cardigan with flower, summer pale blue shirt and straw hat, autumn oatmeal knit and terracotta scarf, winter cream puffer and mittens; date, task card, seasonal story, today/calendar/records navigation; restrained seasonal accents, legible Korean, generous whitespace.

## 실행 화면 캐릭터

- 파일: `assets/seasonal-companion.png`
- 용도: 왼쪽부터 봄·여름·가을·겨울의 동일 폭 4패널 스프라이트. CSS의 `background-size: 400% auto`와 위치로 각 계절을 표시한다.
- 참고 이미지: 위 사계절 홈 시안.
- 최종 프롬프트: “Create a production illustration sprite sheet for the app shown in the reference. ONLY character illustrations, no UI, no text. One wide landscape image divided into exactly FOUR EQUAL WIDTH vertical panels across the image. Each panel is identical scale and placement and has the same solid warm offwhite background #f8f9f7. Entire characters fully inside each panel, plenty of whitespace top and sides. Left to right: SPRING the same cute warm-white rounded pebble mascot wearing sage cardigan holding small pink flower, tiny sprouts at feet and pink petals. SUMMER same mascot wearing pale blue airy shirt straw hat with tiny leaf and faint ripples at feet. AUTUMN same mascot wearing oatmeal knit and terracotta scarf with tiny golden leaves at feet. WINTER same mascot wearing cream puffer coat muted red scarf and mittens with small snow mounds at feet. Faithfully match the reference mascot's two dot eyes, smile, rounded body tiny arms and feet and high quality soft matte clay 3D knitted clothes rendering. All four mascots same height and centered at exactly 12.5%,37.5%,62.5%,87.5% of image width, ground same baseline. No borders, no panel dividers, no lettering, no extraneous objects. Use a wide 3:1 image composition. Artwork fills each panel vertically while allowing 10% top and bottom margin.”

앱 아이콘 `assets/icon.svg`와 UI 선형 아이콘은 직접 작성한 벡터다. 생성 캐릭터의 형태를 변경할 때 기존 자산과 브랜드 원칙을 함께 확인한다.
