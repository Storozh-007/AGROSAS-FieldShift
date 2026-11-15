# Запуск на macOS

1. Установите и запустите [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) для своего процессора. Проверка: `docker info`. На Apple Silicon официальный образ PostGIS запускается с эмуляцией amd64.
2. В каталоге проекта: `./fieldshift start`.
3. Откройте http://localhost:8080. API: http://localhost:8080/api/docs.
4. При необходимости добавьте пример хозяйства: `./fieldshift seed`. Seed не выполняется при каждом старте. Примерные границы явно помечены.
5. Остановка: `./fieldshift stop`. Volume базы сохраняется.

Первый запуск скачивает образы и собирает зависимости. Понадобятся интернет и свободное место. Секреты создаются автоматически в `.runtime/prod.env` (права 0600); файлы исключены из Git и Docker build context. Не удаляйте этот файл при сохранённом volume: пароль должен оставаться прежним.

Development: `./fieldshift --mode dev start`. Отдельные секреты, Compose project и volume; тот же порт 8080, поэтому сначала остановите prod. Исходники frontend/backend монтируются для hot reload. Prod использует standalone Next.js без bind mount исходников.

Ранее созданная macOS-база не переключается и не удаляется. Чтобы скопировать её данные в контейнер: `./fieldshift import-local --confirm-replace`. Команда создаёт резервную копию контейнерной базы перед заменой; локальная база остаётся целой. Нужен установленный pg_dump совместимой версии. Альтернатива: `./fieldshift restore /absolute/path/file.dump --confirm-replace`.

Платформа доступна только с этого Mac: gateway привязан к 127.0.0.1. Порты базы и backend не опубликованы. Для iPhone нужен отдельно настроенный доверенный HTTPS-доступ.
