#!/bin/bash
# ─────────────────────────────────────────
# Oracle Cloud VM 초기 세팅 스크립트
# 사용법: ssh로 접속 후 이 스크립트 실행
#   chmod +x server-setup.sh && ./server-setup.sh
# ─────────────────────────────────────────
set -e

echo "=== 1/6 시스템 업데이트 ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== 2/6 스왑 메모리 2GB 추가 (1GB RAM 보완) ==="
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "=== 3/6 Docker 설치 ==="
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

echo "=== 4/6 Docker Compose 설치 ==="
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "=== 5/6 방화벽 포트 오픈 (80, 443) ==="
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "=== 6/6 프로젝트 디렉토리 생성 ==="
mkdir -p ~/climbing
cd ~/climbing
mkdir -p nginx

echo ""
echo "========================================="
echo " 세팅 완료!"
echo "========================================="
echo ""
echo " 다음 단계:"
echo " 1. 로그아웃 후 재접속 (docker 그룹 적용)"
echo "    exit && ssh ubuntu@<서버IP>"
echo ""
echo " 2. ~/climbing/.env 파일 생성:"
echo "    nano ~/climbing/.env"
echo "    ---"
echo "    POSTGRES_USER=climbing_user"
echo "    POSTGRES_PASSWORD=<강력한비밀번호>"
echo "    POSTGRES_DB=climbing_db"
echo "    GOOGLE_API_KEY=<구글API키>"
echo "    GITHUB_REPO=<github유저명/레포명>"
echo "    ---"
echo ""
echo " 3. GitHub Actions에 Secrets 등록:"
echo "    - ORACLE_SSH_KEY: VM의 SSH 프라이빗 키"
echo "    - ORACLE_HOST: VM의 공인 IP"
echo "    - ORACLE_USER: ubuntu"
echo ""
echo " 4. main에 push하면 자동 배포됩니다!"
echo "========================================="
