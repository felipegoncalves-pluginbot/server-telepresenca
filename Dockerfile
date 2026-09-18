# Usa uma imagem oficial e leve do Node.js
FROM node:20-alpine

# Define o diretório de trabalho no container
WORKDIR /usr/src/app

# Copia os arquivos de definição de dependências primeiro
COPY package*.json ./

# Instala apenas as dependências de produção para maior segurança e menor tamanho
RUN npm ci --omit=dev

# Copia o restante do código para o container
COPY . .

# A porta padrão do servidor (pode ser sobrescrita pelo Koyeb)
ENV PORT=3000
EXPOSE $PORT

# Usuário sem privilégios root por segurança
USER node

# Comando de inicialização
CMD ["npm", "start"]
