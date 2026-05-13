# ===== Build stage =====
FROM node:20-alpine AS build

WORKDIR /app

# Install frontend dependencies
COPY package*.json ./

RUN npm install --legacy-peer-deps

# Copy frontend source code
COPY . .

# React backend API URL
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Build React production files
RUN npm run build


# ===== Runtime stage =====
FROM nginx:alpine

# Copy React build output to Nginx static folder
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]