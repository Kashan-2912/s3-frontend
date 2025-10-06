# S3 Multipart Upload Frontend

A Next.js application to test your S3 multipart upload backend with a beautiful UI.

## Features

- ✨ Beautiful, modern UI built with Tailwind CSS
- 📤 Multipart file upload with progress tracking
- 🔄 Real-time upload status updates
- 📊 Detailed upload session information
- 🎨 Dark mode support
- 📱 Responsive design

## Getting Started

### Prerequisites

Make sure your backend is running on `http://localhost:3001`

### Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## How It Works

The frontend implements a complete multipart upload flow:

1. **Select a File**: Choose any file to upload
2. **Create Multipart Upload**: Calls `POST /create-multipart` to initialize the upload session
3. **Get Presigned URLs**: Calls `POST /create-presigned-urls` to get upload URLs for each part
4. **Upload Parts**: Uploads file chunks (5MB each) to S3 using presigned URLs
5. **Complete Upload**: Calls `POST /complete-multipart` to finalize the upload

## File Structure

```
src/
├── app/
│   ├── page.js              # Main page with upload UI
│   ├── components/
│   │   └── FileUpload.js    # Upload component with full multipart logic
│   ├── globals.css          # Global styles
│   └── layout.js            # Root layout
```

## Configuration

- **Backend URL**: `http://localhost:3001` (configured in `FileUpload.js`)
- **Chunk Size**: 5MB (configurable in `FileUpload.js`)

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-multipart` | Initialize multipart upload |
| POST | `/create-presigned-urls` | Get presigned URLs for parts |
| POST | `/complete-multipart` | Complete the upload |
