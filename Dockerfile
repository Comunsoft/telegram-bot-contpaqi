# Dockerfile para Telegram Bot CONTPAQi
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY bot.js ./

# Variables de entorno requeridas
ENV TELEGRAM_BOT_TOKEN=""
ENV OPENAI_API_KEY=""
ENV CONTPAQI_API_URL=""
ENV CONTPAQI_API_KEY=""

# Crear usuario no privilegiado
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar propietario de archivos
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto (si es necesario)
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is running')" || exit 1

# Comando para ejecutar el bot
CMD ["node", "bot.js"]
