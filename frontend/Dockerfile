# Use official Node.js image (Alpine for a smaller footprint)
FROM node:20-alpine

# Set work directory
WORKDIR /app

# Copy package.json and package-lock.json before other files
# This optimizes Docker's layer caching for faster subsequent builds
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the Next.js project code
COPY . ./

# Expose the port Next.js runs on
EXPOSE 3000

# Command to run the development server
CMD ["npm", "run", "dev"]
