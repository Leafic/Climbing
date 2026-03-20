Docker 이미지를 재빌드하고 컨테이너를 재시작합니다.

1. `docker compose build` 실행
2. 빌드 완료 후 `docker compose up -d` 실행
3. `docker compose ps`로 컨테이너 상태 확인
4. 에러가 있으면 `docker compose logs --tail=30`으로 로그 확인
