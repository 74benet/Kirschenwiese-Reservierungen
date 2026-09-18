# Frontend Dockerfile
FROM node:20

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Backend-URL muss beim Build bekannt sein, da React sie fest einbaut
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Build the React app
RUN npm run build

# Install serve to serve the build directory
RUN npm install -g serve

# Expose the port serve runs on
EXPOSE 3000

# Serve the build directory
CMD ["serve", "-s", "build", "-l", "3000"]
