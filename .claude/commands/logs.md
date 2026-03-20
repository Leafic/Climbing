Docker 컨테이너 로그를 확인합니다.

인자: $ARGUMENTS (backend, frontend, db 중 선택, 없으면 전체)

1. 인자가 있으면 해당 서비스 로그만 확인: `docker compose logs --tail=50 $ARGUMENTS`
2. 인자가 없으면 전체 로그: `docker compose logs --tail=30`
3. 에러가 보이면 원인을 분석하고 해결 방안 제시
