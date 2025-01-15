FROM node:20-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN \
apt-get update && \
apt-get install -y git make gcc g++ python3 && \
rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json /app
COPY pnpm-lock.yaml /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run install-deps

COPY . /app

