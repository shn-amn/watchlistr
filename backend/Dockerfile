# ---- build stage ----
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/watchlistr-api .

# ---- runtime stage ----
FROM gcr.io/distroless/static-debian12:nonroot
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=build /out/watchlistr-api /watchlistr-api
EXPOSE 3000
ENTRYPOINT ["/watchlistr-api"]
