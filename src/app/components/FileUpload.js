'use client';

import { useState } from 'react';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const API_BASE_URL = 'http://localhost:3001';

export default function FileUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [uploadDetails, setUploadDetails] = useState(null);
  const [error, setError] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [partProgress, setPartProgress] = useState([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('');
      setError('');
      setProgress(0);
      setUploadDetails(null);
      setFileUrl('');
      setPartProgress([]);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      // Step 1: Create multipart upload
      setStatus('Creating multipart upload...');
      const createResponse = await fetch(`${API_BASE_URL}/create-multipart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create multipart upload');
      }

      const { uploadId, key, bucket } = await createResponse.json();
      setUploadDetails({ uploadId, key, bucket });
      
      // Calculate number of parts
      const numParts = Math.ceil(file.size / CHUNK_SIZE);
      
      // Step 2: Get presigned URLs for all parts
      setStatus(`Getting presigned URLs for ${numParts} parts...`);
      const urlsResponse = await fetch(`${API_BASE_URL}/create-presigned-urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          key,
          parts: numParts,
        }),
      });

      if (!urlsResponse.ok) {
        throw new Error('Failed to get presigned URLs');
      }

      const { presignedUrls } = await urlsResponse.json();

      // Initialize part progress tracking
      const initialPartProgress = presignedUrls.map((item, index) => {
        const start = index * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const partSize = end - start;
        return {
          partNumber: item.partNumber,
          status: 'pending',
          progress: 0,
          size: partSize,
        };
      });
      setPartProgress(initialPartProgress);

      // Step 3: Upload all parts in parallel
      setStatus(`Uploading ${numParts} parts in parallel...`);
      const uploadedParts = [];
      let completedCount = 0;

      // Create upload function for a single part
      const uploadPart = (partNumber, url) => {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);

        // Mark part as uploading
        setPartProgress(prev => prev.map(p => 
          p.partNumber === partNumber ? { ...p, status: 'uploading', progress: 0 } : p
        ));

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              setPartProgress(prev => prev.map(p => 
                p.partNumber === partNumber ? { ...p, progress: percentComplete } : p
              ));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader('ETag');
              uploadedParts.push({
                ETag: etag,
                PartNumber: partNumber,
              });

              // Mark part as completed
              setPartProgress(prev => prev.map(p => 
                p.partNumber === partNumber ? { ...p, status: 'completed', progress: 100 } : p
              ));

              // Update overall progress
              completedCount++;
              setProgress(Math.round((completedCount / numParts) * 100));
              setStatus(`Uploading parts... ${completedCount} of ${numParts} completed`);

              resolve({ partNumber, etag });
            } else {
              reject(new Error(`Failed to upload part ${partNumber}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Failed to upload part ${partNumber}`));
          });

          xhr.open('PUT', url);
          xhr.send(blob);
        });
      };

      // Upload all parts in parallel
      const uploadPromises = presignedUrls.map(({ partNumber, url }) => 
        uploadPart(partNumber, url)
      );

      await Promise.all(uploadPromises);

      // Sort parts by PartNumber before completing (S3 requires them in order)
      uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

      // Step 4: Complete multipart upload
      setStatus('Completing upload...');
      const completeResponse = await fetch(`${API_BASE_URL}/complete-multipart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          key,
          parts: uploadedParts,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || 'Failed to complete multipart upload');
      }

      const { message, location } = await completeResponse.json();
      setStatus('Upload completed successfully!');
      setFileUrl(location || '');
      setProgress(100);

    } catch (err) {
      setError(err.message || 'Upload failed');
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setProgress(0);
    setStatus('');
    setUploadDetails(null);
    setError('');
    setFileUrl('');
    setPartProgress([]);
  };

  // Helper function to get icon for part status
  const getPartIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'uploading':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
      {/* File Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select File
        </label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-200 dark:hover:file:bg-indigo-800 disabled:opacity-50"
          />
          {file && (
            <button
              onClick={resetUpload}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* File Info */}
      {file && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">File Details</h3>
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p><span className="font-medium">Name:</span> {file.name}</p>
            <p><span className="font-medium">Size:</span> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><span className="font-medium">Type:</span> {file.type || 'unknown'}</p>
            <p><span className="font-medium">Parts:</span> {Math.ceil(file.size / CHUNK_SIZE)}</p>
          </div>
        </div>
      )}

      {/* Upload Parts Progress */}
      {partProgress.length > 0 && (
        <div className="mb-6 p-5 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Parts Progress</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {partProgress.filter(p => p.status === 'completed').length} of {partProgress.length} parts completed
              </span>
            </div>
            
            {/* Status Summary Icons */}
            <div className="flex items-center gap-4 text-sm mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">
                  {partProgress.filter(p => p.status === 'completed').length} completed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">
                  {partProgress.filter(p => p.status === 'uploading').length} uploading
                </span>
              </div>
              {partProgress.filter(p => p.status === 'pending').length > 0 && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700 dark:text-gray-300">
                    {partProgress.filter(p => p.status === 'pending').length} pending
                  </span>
                </div>
              )}
            </div>

            {/* Part Icons Overview */}
            <div className="flex flex-wrap gap-2">
              {partProgress.map((part) => (
                <div key={part.partNumber} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
                  {getPartIcon(part.status)}
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Progress */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detailed Progress</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {partProgress.map((part) => (
                <div key={part.partNumber} className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getPartIcon(part.status)}
                  </div>

                  {/* Part Size */}
                  <div className="flex-shrink-0 w-16 text-xs text-gray-500 dark:text-gray-400">
                    ({(part.size / 1024 / 1024).toFixed(1)} MB)
                  </div>

                  {/* Progress Bar */}
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          part.status === 'completed' 
                            ? 'bg-green-500' 
                            : part.status === 'uploading' 
                            ? 'bg-blue-500' 
                            : 'bg-gray-300 dark:bg-gray-500'
                        }`}
                        style={{ width: `${part.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Percentage */}
                  <div className="flex-shrink-0 w-12 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    {part.progress}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Details */}
      {uploadDetails && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Upload Session</h3>
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 font-mono break-all">
            <p><span className="font-medium">Upload ID:</span> {uploadDetails.uploadId}</p>
            <p><span className="font-medium">Key:</span> {uploadDetails.key}</p>
            <p><span className="font-medium">Bucket:</span> {uploadDetails.bucket}</p>
          </div>
        </div>
      )}

      {/* Overall Progress Bar */}
      {uploading && partProgress.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">{status}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {fileUrl && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">Upload Successful!</h3>
          <p className="text-sm text-green-700 dark:text-green-300 break-all">
            <span className="font-medium">Location:</span> {fileUrl}
          </p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={uploadFile}
        disabled={!file || uploading}
        className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading...' : 'Upload to S3'}
      </button>

      {/* API Endpoints Info */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Backend Endpoints Used</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="font-mono">
            <span className="text-green-600 dark:text-green-400 font-medium">POST</span> /create-multipart
          </div>
          <div className="font-mono">
            <span className="text-green-600 dark:text-green-400 font-medium">POST</span> /create-presigned-urls
          </div>
          <div className="font-mono">
            <span className="text-green-600 dark:text-green-400 font-medium">POST</span> /complete-multipart
          </div>
        </div>
      </div>
    </div>
  );
}

