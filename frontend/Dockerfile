# frontend/Dockerfile

FROM node:20-alpine

# Katalog roboczy w kontenerze
WORKDIR /app

# W trybie dev kod będzie montowany z hosta jako volume,
# więc nie kopiujemy go tutaj. Wszystko będzie w /app z hosta.

# Domyślna komenda: zainstaluj zależności (jeśli trzeba) i odpal dev server
CMD ["sh", "-c", "npm install && npm run dev"]
