FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy source code
COPY . .

# Install dependencies
RUN go mod tidy

# Build the binary
# Build the binary for macOS (Host OS)
ENV CGO_ENABLED=0
ENV GOOS=darwin
ENV GOARCH=arm64
RUN go build -o vps-plugin main.go

# Final Stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/vps-plugin .
# Copy frontend dist if needed (assuming it's built on host and mounted or copied)
# For now, we assume dev mode where frontend is separate or mounted

# Expose port (internal)
EXPOSE 8080

# Run
CMD ["./vps-plugin"]
