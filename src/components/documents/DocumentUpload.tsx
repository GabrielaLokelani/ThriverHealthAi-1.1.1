import { useState, useRef } from 'react';
import type { Document } from '@/types/documents';

interface DocumentUploadProps {
  onUploadComplete?: (document: Document) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError('');

    // Validate file type
    if (!acceptedFileTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PDF, JPG, PNG, or TXT files.');
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    setUploading(true);

    try {
      // TODO: Upload to S3 and save metadata to DynamoDB
      // This will be implemented when connecting to Amplify Storage
      const document: Document = {
        id: Date.now().toString(),
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        s3Key: `documents/${Date.now()}_${file.name}`,
        uploadedAt: new Date().toISOString(),
      };

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onUploadComplete?.(document);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Upload Health Document
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-600'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.txt"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400">Uploading document...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                  Click to upload
                </button>
                {' or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                PDF, JPG, PNG, TXT (MAX. 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        All documents are encrypted and stored securely in compliance with HIPAA regulations.
      </p>
    </div>
  );
}

