# 1. 크롬 브라우저와 부품이 다 들어있는 '풀옵션' 환경 선택
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

# 2. 필요한 라이브러리 목록 복사 및 설치
COPY package*.json ./
RUN npm install

# 3. 모든 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 4. 서버 실행 (Railway는 3000번 포트를 씁니다)
EXPOSE 3000
CMD ["npm", "start"]
