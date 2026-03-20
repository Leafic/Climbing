프로젝트 보안 점검을 수행합니다.

1. `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
2. `git diff --cached`와 `git diff`에서 API 키, 비밀번호, 토큰 등 민감 정보 노출 검사
3. `docker-compose.yml`에서 하드코딩된 시크릿이 있는지 확인
4. CORS 설정 확인 (backend main.py)
5. 파일 업로드 보안 (경로 탐색 방지, 크기 제한) 확인
6. 발견된 이슈를 심각도별로 정리하여 보고
