프론트엔드 TypeScript와 백엔드 Python 문법을 동시에 검사합니다.

1. 프론트엔드: `cd frontend && npx tsc --noEmit`
2. 백엔드: `cd backend && python3 -c "import py_compile; import glob; [py_compile.compile(f, doraise=True) for f in glob.glob('app/**/*.py', recursive=True)]"`
3. 에러가 있으면 파일 위치와 원인을 명확히 알려주고 수정 방안 제시
4. 에러가 없으면 "타입 체크 통과" 알림
