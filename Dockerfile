# Use official Node.js version 20 image
FROM node:20

# Set working directory inside container
WORKDIR /app

# Copy package.json files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port 3000 for API
EXPOSE 3000

# Start server
CMD ["npm", "start"]
