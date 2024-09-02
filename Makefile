# 定义变量
APP_NAME = notion-integration
DOCKER_IMAGE = $(APP_NAME):latest
TZ ?= Asia/Shanghai

# 默认目标
.PHONY: all
all: build

# 构建Docker镜像
.PHONY: build
build:
	docker build  --network=host -t $(DOCKER_IMAGE) .

# 运行Docker容器
.PHONY: run
run:
	docker run -d \
			--network host \
			--restart always \
			-e TZ=$(TZ) \
			-e PORT=23003 \
			-e http_proxy=http://127.0.0.1:15777 \
			-e https_proxy=http://127.0.0.1:15777 \
			$(DOCKER_IMAGE)

# 停止并删除Docker容器
.PHONY: stop
stop:
	docker stop $$(docker ps -q --filter ancestor=$(DOCKER_IMAGE))
	docker rm $$(docker ps -aq --filter ancestor=$(DOCKER_IMAGE))

# 清理Docker镜像
.PHONY: clean
clean:
	docker rmi $(DOCKER_IMAGE)

# 安装依赖
.PHONY: install
install:
	npm install

# 启动开发服务器
.PHONY: dev
dev:
	npm start

# 帮助信息
.PHONY: help
help:
	@echo "可用的命令："
	@echo "  make build  - 构建Docker镜像"
	@echo "  make run    - 运行Docker容器"
	@echo "  make stop   - 停止并删除Docker容器"
	@echo "  make clean  - 清理Docker镜像"
	@echo "  make install- 安装依赖"
	@echo "  make dev    - 启动开发服务器"