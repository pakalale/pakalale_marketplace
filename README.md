# Pakalale

## Before you do anything,ensure you create .env file for our backend connection

## Run Locally
## method 1

Install [Node.js 20](https://nodejs.org/)
```bash
## first run
npm ci
## then
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app uses `MONGODB_URI` to connect to MongoDB. Without it, the app tries `mongodb://localhost:27017/pakalale`. For image uploads, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

## method 2 Run with Docker

Install Docker, then create a `.env` file in the project directory with the settings needed for your environment. For example:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
NEXTAUTH_SECRET=replace-with-a-random-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Cloudinary settings are needed for image uploads. Keep `.env` private; do not commit credentials. Build and run the container:

```bash
docker build -t pakalale .
docker run --rm --name pakalale --env-file .env -p 3000:3000 pakalale
```

Open [http://localhost:3000](http://localhost:3000). The container runs the production build and the custom server, including Socket.IO. Docker does not start MongoDB for you: `MONGODB_URI` must point to a database reachable from inside the container. In particular, `localhost` inside the container refers to the container itself, not the host machine.
