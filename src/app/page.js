'use client';

import { useState } from 'react';
import FileUpload from './components/FileUpload';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            S3 Multipart Upload Tester
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Test your scalable S3 backend with multipart uploads
          </p>
        </header>

        <FileUpload />

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Backend running on http://localhost:3001</p>
        </footer>
      </div>
    </div>
  );
}
