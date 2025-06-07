# Zero Wire Video Generation System
# Makefile for starting all services

# Configuration
FRONTEND_PORT=8080
VIDEO_WATCHER_LOG=video-watcher.log
FRONTEND_LOG=frontend.log

# Colors for output
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

.PHONY: help install start stop restart status logs clean clean-files dev frontend video-watcher audio-test

# Default target
help:
	@echo "$(GREEN)Zero Wire Video Generation System$(NC)"
	@echo "Available commands:"
	@echo "  $(YELLOW)make install$(NC)     - Install all dependencies"
	@echo "  $(YELLOW)make start$(NC)       - Start all services"
	@echo "  $(YELLOW)make stop$(NC)        - Stop all services"
	@echo "  $(YELLOW)make restart$(NC)     - Restart all services"
	@echo "  $(YELLOW)make status$(NC)      - Check service status"
	@echo "  $(YELLOW)make logs$(NC)        - Show service logs"
	@echo "  $(YELLOW)make clean$(NC)       - Stop all processes and clean files"
	@echo "  $(YELLOW)make clean-files$(NC) - Clean temporary files only (no process stop)"
	@echo "  $(YELLOW)make dev$(NC)         - Start development mode (frontend + watcher)"
	@echo ""
	@echo "Individual services:"
	@echo "  $(YELLOW)make frontend$(NC)    - Start frontend only (port $(FRONTEND_PORT))"
	@echo "  $(YELLOW)make video-watcher$(NC) - Start video watcher only"
	@echo "  $(YELLOW)make audio-test$(NC)  - Test audio generation"

# Install all dependencies
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	@echo "Installing root dependencies..."
	npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing video-editing dependencies..."
	cd video-editing && npm install
	@echo "$(GREEN)All dependencies installed!$(NC)"

# Start all services
start: check-ports
	@echo "$(GREEN)Starting all services...$(NC)"
	@$(MAKE) frontend &
	@sleep 2
	@$(MAKE) video-watcher &
	@echo "$(GREEN)All services started!$(NC)"
	@echo "Frontend: http://localhost:$(FRONTEND_PORT)"
	@echo "Run 'make status' to check service status"
	@echo "Run 'make logs' to view logs"

# Start development mode (most common use case)
dev: check-ports
	@echo "$(GREEN)Starting development mode...$(NC)"
	@echo "Frontend will be available at: http://localhost:$(FRONTEND_PORT)"
	@echo "Press Ctrl+C to stop all services"
	@$(MAKE) frontend & \
	sleep 3 && \
	$(MAKE) video-watcher & \
	wait

# Start frontend only
frontend: check-port-available
	@echo "$(GREEN)Starting frontend on port $(FRONTEND_PORT)...$(NC)"
	cd frontend && PORT=$(FRONTEND_PORT) npm run dev 2>&1 | tee ../$(FRONTEND_LOG) &
	@echo "Frontend started on http://localhost:$(FRONTEND_PORT)"

# Start video watcher only
video-watcher:
	@echo "$(GREEN)Starting video watcher...$(NC)"
	cd video-editing && node auto-video-generator.js 2>&1 | tee ../$(VIDEO_WATCHER_LOG) &
	@echo "Video watcher started (monitoring for audio files)"

# Test audio generation
audio-test:
	@echo "$(GREEN)Testing audio generation...$(NC)"
	cd zero-wire/Spark-TTS && python chunk_clone.py "Hello, this is a test of the audio generation system" --target-level 0.8 --compression-ratio 6.0

# Stop all services
stop:
	@echo "$(YELLOW)Stopping all services...$(NC)"
	@pkill -f "next dev" || true
	@pkill -f "auto-video-generator.js" || true
	@pkill -f "chunk_clone.py" || true
	@echo "$(GREEN)All services stopped!$(NC)"

# Restart all services
restart: stop
	@sleep 2
	@$(MAKE) start

# Check service status
status:
	@echo "$(GREEN)Service Status:$(NC)"
	@echo -n "Frontend (Next.js): "
	@if pgrep -f "next dev" > /dev/null; then echo "$(GREEN)Running$(NC)"; else echo "$(RED)Stopped$(NC)"; fi
	@echo -n "Video Watcher: "
	@if pgrep -f "auto-video-generator.js" > /dev/null; then echo "$(GREEN)Running$(NC)"; else echo "$(RED)Stopped$(NC)"; fi
	@echo -n "Audio Generation: "
	@if pgrep -f "chunk_clone.py" > /dev/null; then echo "$(GREEN)Running$(NC)"; else echo "$(YELLOW)Ready (starts on demand)$(NC)"; fi
	@echo ""
	@echo "Port usage:"
	@echo "  Frontend: $(FRONTEND_PORT)"
	@echo "  Video Watcher: File-based monitoring"

# Show logs
logs:
	@echo "$(GREEN)Recent Frontend Logs:$(NC)"
	@if [ -f $(FRONTEND_LOG) ]; then tail -n 20 $(FRONTEND_LOG); else echo "No frontend logs found"; fi
	@echo ""
	@echo "$(GREEN)Recent Video Watcher Logs:$(NC)"
	@if [ -f $(VIDEO_WATCHER_LOG) ]; then tail -n 20 $(VIDEO_WATCHER_LOG); else echo "No video watcher logs found"; fi

# Clean temporary files, logs, and stop all processes
clean:
	@echo "$(YELLOW)Stopping all processes and cleaning...$(NC)"
	@echo "Killing processes on port $(FRONTEND_PORT)..."
	@lsof -ti:$(FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "Stopping all related Node.js processes..."
	@pkill -f "next dev" 2>/dev/null || true
	@pkill -f "auto-video-generator.js" 2>/dev/null || true
	@pkill -f "chunk_clone.py" 2>/dev/null || true
	@sleep 1
	@echo "Cleaning temporary files and logs..."
	rm -f $(FRONTEND_LOG) $(VIDEO_WATCHER_LOG)
	rm -rf frontend/.next
	rm -rf video-editing/temp/* 2>/dev/null || true
	rm -rf zero-wire/Spark-TTS/audiooutput/chunk_*.wav 2>/dev/null || true
	rm -rf video-editing/generated-videos/*.processing 2>/dev/null || true
	@echo "$(GREEN)Cleanup complete! All processes stopped and files cleaned.$(NC)"

# Clean only temporary files (original clean behavior)
clean-files:
	@echo "$(YELLOW)Cleaning temporary files and logs...$(NC)"
	rm -f $(FRONTEND_LOG) $(VIDEO_WATCHER_LOG)
	rm -rf frontend/.next
	rm -rf video-editing/temp/* 2>/dev/null || true
	rm -rf zero-wire/Spark-TTS/audiooutput/chunk_*.wav 2>/dev/null || true
	rm -rf video-editing/generated-videos/*.processing 2>/dev/null || true
	@echo "$(GREEN)File cleanup complete!$(NC)"

# Check if ports are available
check-ports: check-port-available

check-port-available:
	@if lsof -Pi :$(FRONTEND_PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "$(RED)Error: Port $(FRONTEND_PORT) is already in use!$(NC)"; \
		echo "Please change FRONTEND_PORT in Makefile or stop the service using this port."; \
		lsof -Pi :$(FRONTEND_PORT) -sTCP:LISTEN; \
		exit 1; \
	fi

# Quick health check
health:
	@echo "$(GREEN)System Health Check:$(NC)"
	@echo -n "Node.js: "
	@if command -v node > /dev/null; then echo "$(GREEN)Available ($(shell node --version))$(NC)"; else echo "$(RED)Not found$(NC)"; fi
	@echo -n "Python: "
	@if command -v python > /dev/null; then echo "$(GREEN)Available ($(shell python --version))$(NC)"; else echo "$(RED)Not found$(NC)"; fi
	@echo -n "NPM: "
	@if command -v npm > /dev/null; then echo "$(GREEN)Available ($(shell npm --version))$(NC)"; else echo "$(RED)Not found$(NC)"; fi
	@echo ""
	@echo "Project directories:"
	@echo -n "  Frontend: "
	@if [ -d "frontend" ]; then echo "$(GREEN)✓$(NC)"; else echo "$(RED)✗$(NC)"; fi
	@echo -n "  Video Editing: "
	@if [ -d "video-editing" ]; then echo "$(GREEN)✓$(NC)"; else echo "$(RED)✗$(NC)"; fi
	@echo -n "  Spark-TTS: "
	@if [ -d "zero-wire/Spark-TTS" ]; then echo "$(GREEN)✓$(NC)"; else echo "$(RED)✗$(NC)"; fi

# Development shortcuts
build:
	@echo "$(GREEN)Building frontend...$(NC)"
	cd frontend && npm run build

lint:
	@echo "$(GREEN)Running linter...$(NC)"
	cd frontend && npm run lint

# Watch logs in real-time
watch-logs:
	@echo "$(GREEN)Watching logs (press Ctrl+C to stop)...$(NC)"
	@if [ -f $(FRONTEND_LOG) ] && [ -f $(VIDEO_WATCHER_LOG) ]; then \
		tail -f $(FRONTEND_LOG) $(VIDEO_WATCHER_LOG); \
	elif [ -f $(FRONTEND_LOG) ]; then \
		tail -f $(FRONTEND_LOG); \
	elif [ -f $(VIDEO_WATCHER_LOG) ]; then \
		tail -f $(VIDEO_WATCHER_LOG); \
	else \
		echo "No log files found. Start services first with 'make start' or 'make dev'"; \
	fi 