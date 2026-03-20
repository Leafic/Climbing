프로젝트 전체 상태를 한눈에 확인합니다.

1. `docker compose ps` — 컨테이너 상태
2. `git status` — 변경된 파일
3. `git log --oneline -5` — 최근 커밋
4. 포트 확인: `lsof -i :3000 -i :8000 -i :5433 | head -10`
5. cloudflared 터널 실행 여부: `pgrep -f cloudflared`
6. 결과를 간결하게 요약해서 보여주기
