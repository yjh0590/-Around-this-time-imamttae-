# 기종 프레임 미리보기

서버 실행 후 <http://localhost:3000/preview>를 연다. 사용자에게 화면을 보여줄 때 기본 미리보기 경로로 사용한다.

## 조작

- **기종:** iPhone 16, iPhone 16 Pro, Galaxy S24.
- **계절:** 지금 계절·봄·여름·가을·겨울.
- **보기:** 브라우저 공간에 맞추기 또는 100% 논리 크기.
- 화면 안에서 스크롤, 메뉴 이동, 일정·기록 작성, 설정 열기 등이 실제로 동작한다.
- 기종과 계절을 바꾸어도 오늘·달력·기록 중 보고 있던 페이지를 유지한다.
- `/preview?device=galaxys24&month=10`처럼 미리보기 선택을 URL로 공유할 수 있다.

계절 선택은 iframe의 미리보기 파라미터에만 반영한다. 날짜·저장된 테마·개인 기록은 바꾸지 않는다. 단, 프레임 안에서 사용자가 작성·삭제하는 일정과 기록은 일반 앱과 같은 브라우저 저장소에 반영된다.

## 기종 기준과 한계

| 기종 | 미리보기 논리 화면 | 참고 디스플레이 픽셀 |
|---|---|---|
| iPhone 16 | 393×852 | 1179×2556 |
| iPhone 16 Pro | 402×874 | 1206×2622 |
| Galaxy S24 | 360×780 | 1080×2340 |

화면 비율은 제조사 디스플레이 치수를 참고해 3으로 나눈 대표 논리 화면이다. 특히 Android의 실제 CSS viewport는 해상도·배율·시스템 설정에 따라 달라질 수 있다. 카메라·테두리·안전 여백·상태 아이콘은 CSS로 재현한 근사치이며 제조사 공식 기기 렌더가 아니다.

이 페이지는 실제 iOS/Safari·Android/Chrome을 구동하거나 터치·키보드·운영체제 권한을 에뮬레이션하지 않는다. 최종 출시는 실제 기기에서 따로 검증해야 한다. 기본 앱 `/`의 반응형 동작은 유지한다.

- [Apple iPhone 16 공식 사양](https://support.apple.com/en-gb/121029)
- [Apple iPhone 16 Pro 공식 사양](https://support.apple.com/en-us/121031)
- [Samsung Galaxy S24 공식 사양 자료](https://images.samsung.com/is/content/samsung/assets/jp/explore/news/galaxy-s24-launch/NewsRelease_galaxy-s24-launch_240403_v3.pdf)

## 확인 화면

- [iPhone 16](device-preview-iphone16.png)
- [iPhone 16 Pro](device-preview-iphone16pro.png)
- [Galaxy S24](device-preview-galaxys24.png)

현재 앱을 Chrome에서 표시해 캡처한 화면이다. 실제 단말에서 촬영한 사진이 아니다.
