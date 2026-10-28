FROM node:22-alpine

# Fuso do food park nos logs e na hora das vendas (pode trocar com a variável TZ).
RUN apk add --no-cache tzdata
ENV TZ=America/Fortaleza

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Dependências em camada separada: mudar só o código não reinstala nada.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

USER node
EXPOSE 3000

# O Easypanel (Traefik) encaminha para a porta 3000; o app escuta em 0.0.0.0.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/saude" > /dev/null || exit 1

#   Com DATABASE_URL  -> Postgres; as migrações rodam sozinhas ao subir.
#   SEED_DEMO=true    -> banco vazio nasce com o food park de demonstração.
#   Sem DATABASE_URL  -> demonstração em memória (some a cada deploy).
CMD ["node", "server/main.js"]
