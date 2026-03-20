Cloudflare 터널을 실행하여 로컬 서비스를 외부에 공개합니다.

1. 현재 실행 중인 cloudflared 프로세스가 있는지 확인 (`pgrep -f cloudflared`)
2. 있으면 기존 프로세스 종료
3. `cloudflared tunnel --url http://localhost:3000` 실행 (백그라운드)
4. 터널 URL을 사용자에게 알려주기 (로그에서 trycloudflare.com URL 추출)
