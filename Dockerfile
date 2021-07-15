FROM node:12 AS console-builder

WORKDIR /skupper-console/
COPY . .
RUN yarn install && yarn build

FROM registry.access.redhat.com/ubi8-minimal

WORKDIR /app
COPY --from=console-builder /skupper-console/build/ console
