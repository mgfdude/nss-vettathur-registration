const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'uploads';
const SIGNED_URL_TTL_SECONDS = parseInt(process.env.SUPABASE_SIGNED_URL_TTL || '3600', 10);

const uploadTypes = {
  photo: {
    folder: 'photos',
    mimeTypes: new Set(['image/jpeg', 'image/png']),
    extensions: new Set(['.jpg', '.jpeg', '.png'])
  },
  signature: {
    folder: 'signatures',
    mimeTypes: new Set(['image/jpeg', 'image/png']),
    extensions: new Set(['.jpg', '.jpeg', '.png'])
  },
  docs: {
    folder: 'pdfs',
    mimeTypes: new Set(['application/pdf']),
    extensions: new Set(['.pdf'])
  },
  pdf: {
    folder: 'pdfs',
    mimeTypes: new Set(['application/pdf']),
    extensions: new Set(['.pdf'])
  }
};

let supabaseClient = null;

if (supabaseUrl && supabaseServiceKey) {
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
} else {
  console.warn('Supabase storage environment variables are not fully configured.');
}

function sanitizeFilename(name) {
  const base = String(name || 'file').replace(/\\/g, '/').split('/').pop() || 'file';
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'file';
}

function sanitizeFolderSegment(value) {
  const segment = String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '-');
  return segment || null;
}

function sanitizeStoragePath(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const segments = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  return normalized;
}

function buildStoragePath(appId, type, originalName) {
  const uploadType = uploadTypes[type];
  if (!uploadType) {
    throw new Error('Invalid upload type.');
  }

  const studentFolder = sanitizeFolderSegment(appId);
  if (!studentFolder) {
    throw new Error('Invalid NSS UID.');
  }

  const ext = path.extname(originalName || '').toLowerCase();
  if (!uploadType.extensions.has(ext)) {
    throw new Error('Invalid file extension.');
  }

  const baseName = sanitizeFilename(path.basename(originalName || `${type}-file`, ext));
  const safeBase = (baseName || type || 'file').slice(0, 40);
  const randomSuffix = crypto.randomBytes(16).toString('hex');
  const storedName = `${safeBase}-${randomSuffix}${ext}`;

  return path.posix.join(studentFolder, uploadType.folder, storedName);
}

async function uploadStudentFile({ appId, type, fileBuffer, originalName, mimeType }) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not initialized.');
  }

  const uploadType = uploadTypes[type];
  if (!uploadType || !uploadType.mimeTypes.has(mimeType)) {
    throw new Error('Invalid file MIME type.');
  }

  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('Uploaded file is empty or invalid.');
  }

  const storagePath = sanitizeStoragePath(buildStoragePath(appId, type, originalName));
  if (!storagePath) {
    throw new Error('Invalid storage path generated.');
  }

  const { error } = await supabaseClient.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false
    });

  if (error) {
    throw error;
  }

  return {
    path: storagePath,
    bucket: bucketName
  };
}

async function uploadPhoto(appId, file) {
  return uploadStudentFile({
    appId,
    type: 'photo',
    fileBuffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype
  });
}

async function uploadSignature(appId, file) {
  return uploadStudentFile({
    appId,
    type: 'signature',
    fileBuffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype
  });
}

async function uploadPdf(appId, file) {
  return uploadStudentFile({
    appId,
    type: 'docs',
    fileBuffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype
  });
}

function normalizeStoragePathList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object') {
    return [input.photo_path, input.signature_path, input.docs_path, input.pdf_path];
  }
  return [input];
}

async function deleteStudentFiles(storagePaths = []) {
  if (!supabaseClient) {
    return [];
  }

  const validPaths = normalizeStoragePathList(storagePaths)
    .map((value) => sanitizeStoragePath(value))
    .filter(Boolean);

  if (!validPaths.length) {
    return [];
  }

  const { data, error } = await supabaseClient.storage.from(bucketName).remove(validPaths);
  if (error) {
    throw error;
  }

  return data || [];
}

async function getStudentFiles(storagePaths = []) {
  if (!supabaseClient) {
    return [];
  }

  const paths = normalizeStoragePathList(storagePaths)
    .map((value) => sanitizeStoragePath(value))
    .filter(Boolean);

  if (!paths.length) {
    return [];
  }

  const results = [];
  for (const storagePath of paths) {
    const { data, error } = await supabaseClient.storage.from(bucketName).list(storagePath.split('/').slice(0, -1).join('/')); 
    if (error) {
      continue;
    }

    const entry = data && data.find((item) => item.name === storagePath.split('/').pop());
    if (entry) {
      const { data: signedData, error: signedError } = await supabaseClient.storage
        .from(bucketName)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      results.push({
        storagePath,
        path: storagePath,
        filename: storagePath.split('/').pop(),
        size: entry.metadata?.size || null,
        updatedAt: entry.updated_at || null,
        contentType: entry.metadata?.mimetype || null,
        downloadUrl: signedError ? null : signedData?.signedUrl || null
      });
    }
  }

  return results;
}

async function getStorageDownloadUrl(storagePath) {
  if (!supabaseClient) {
    return null;
  }

  const normalizedPath = sanitizeStoragePath(storagePath);
  if (!normalizedPath) {
    return null;
  }

  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    return null;
  }

  return data?.signedUrl || null;
}

module.exports = {
  sanitizeFilename,
  sanitizeFolderSegment,
  sanitizeStoragePath,
  buildStoragePath,
  uploadStudentFile,
  uploadPhoto,
  uploadSignature,
  uploadPdf,
  deleteStudentFiles,
  getStudentFiles,
  getStorageDownloadUrl,
  bucketName,
  uploadTypes
};
