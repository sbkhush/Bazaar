import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  X,
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  uploadShopImage,
  uploadPlatformSubscriptionProof,
  uploadPlatformLogo,
  deleteStorageImageByUrl,
  StorageFolder,
} from '../../services/storageService';
import { SafeImage } from './SafeImage';

interface ImageUploaderProps {
  shopId: string;
  folder: StorageFolder | 'platform_subscription' | 'platform_brand';
  subPath?: string;
  images: string[];
  onChange: (nextImages: string[]) => void;
  multiple?: boolean;
  maxImages?: number;
  label?: string;
  helperText?: string;
  hideUrlMode?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  shopId,
  folder,
  subPath,
  images,
  onChange,
  multiple = false,
  maxImages = 6,
  label = 'Upload Image',
  helperText = 'JPG, PNG, WebP, or GIF up to 5 MB (auto-compressed & saved to Firebase Storage)',
  hideUrlMode = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlMode, setShowUrlMode] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);

  const runUploads = async (filesToUpload: File[]) => {
    setError(null);
    setStatusNotice(null);
    setFailedFiles([]);
    setUploading(true);
    setProgress(5);
    const uploadedUrls: string[] = [];
    let lastSavedPct = 0;
    let totalFinalBytes = 0;

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const progressCb = (pct: number) => {
          const overall = Math.round(((i + pct / 100) / filesToUpload.length) * 100);
          setProgress(Math.max(5, Math.min(100, overall)));
        };

        const res =
          folder === 'platform_brand'
            ? await uploadPlatformLogo(filesToUpload[i], progressCb)
            : folder === 'platform_subscription'
            ? await uploadPlatformSubscriptionProof(shopId, filesToUpload[i], progressCb)
            : await uploadShopImage(filesToUpload[i], {
                shopId,
                folder,
                subPath,
                onProgress: progressCb,
              });

        uploadedUrls.push(res.url);
        totalFinalBytes += res.bytes || 0;
        lastSavedPct = res.savedPercent || lastSavedPct;
      }

      if (uploadedUrls.length === 0) return;

      if (multiple) {
        onChange([...images, ...uploadedUrls]);
      } else {
        if (images[0] && images[0] !== uploadedUrls[0]) {
          deleteStorageImageByUrl(images[0], shopId).catch(() => {});
        }
        onChange(uploadedUrls.slice(0, 1));
      }

      const kb = Math.max(1, Math.round(totalFinalBytes / 1024));
      setStatusNotice(
        lastSavedPct > 0
          ? `Uploaded (${kb} KB, compressed ${lastSavedPct}% smaller).`
          : `Uploaded cleanly (${kb} KB).`
      );
    } catch (err: any) {
      if (uploadedUrls.length > 0 && multiple) {
        onChange([...images, ...uploadedUrls]);
      }
      setFailedFiles(filesToUpload.slice(uploadedUrls.length));
      setError(err?.message || 'Image upload failed. Existing images were preserved.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setStatusNotice(null);

    const files = Array.from(fileList);
    const slotsLeft = multiple ? Math.max(0, maxImages - images.length) : 1;
    const filesToUpload = files.slice(0, slotsLeft);

    if (filesToUpload.length === 0) {
      setError(`Maximum ${maxImages} images allowed.`);
      return;
    }

    await runUploads(filesToUpload);
  };

  const handleRetry = () => {
    if (failedFiles.length === 0 || uploading) return;
    runUploads(failedFiles);
  };

  const handleRemove = async (idx: number) => {
    const target = images[idx];
    setRemovingIdx(idx);
    setError(null);
    try {
      await deleteStorageImageByUrl(target, shopId);
      onChange(images.filter((_, i) => i !== idx));
      setStatusNotice(null);
    } finally {
      setRemovingIdx(null);
    }
  };

  const moveImage = (idx: number, direction: -1 | 1) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= images.length) return;
    const copy = [...images];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    onChange(copy);
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Please enter a valid http/https image URL.');
      return;
    }
    setError(null);
    setStatusNotice('External image URL linked.');
    if (multiple) {
      onChange([...images, trimmed].slice(0, maxImages));
    } else {
      onChange([trimmed]);
    }
    setUrlInput('');
    setShowUrlMode(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700">{label}</label>
        {!hideUrlMode && (
          <button
            type="button"
            onClick={() => setShowUrlMode((v) => !v)}
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            {showUrlMode ? 'Upload File' : 'Paste Image URL'}
          </button>
        )}
      </div>

      {showUrlMode && !hideUrlMode ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            Add
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
            dragging
              ? 'border-emerald-600 bg-emerald-50/70'
              : 'border-slate-200 hover:border-emerald-500 bg-slate-50/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/*"
            multiple={multiple}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          {uploading ? (
            <div className="py-2 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading image... {progress}%</span>
              </div>
              <div className="w-full max-w-xs mx-auto h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-1">
              <UploadCloud className="w-5 h-5 text-emerald-700" />
              <p className="text-xs font-semibold text-slate-800">
                Click to browse or drag &amp; drop {multiple ? 'images' : 'an image'}
              </p>
              <p className="text-[11px] text-slate-500">{helperText}</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </span>
          {failedFiles.length > 0 && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold inline-flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Retry Upload
            </button>
          )}
        </div>
      )}

      {statusNotice && !error && (
        <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
          <span>{statusNotice}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
          {images.map((src, idx) => (
            <div
              key={`${src.slice(0, 32)}_${idx}`}
              className="group relative aspect-square bg-slate-100 rounded-lg border border-slate-200 overflow-hidden"
            >
              <SafeImage
                src={src}
                alt={`Preview ${idx + 1}`}
                fallbackText="Unavailable"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {idx === 0 && multiple && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-slate-900/80 text-white text-[9px] font-semibold rounded">
                  Primary
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 sm:inset-0 bg-slate-900/60 sm:bg-slate-900/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition flex items-center justify-center gap-1 py-1 sm:py-0">
                {multiple && idx > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, -1)}
                    title="Move left"
                    className="p-1 bg-white/95 rounded text-slate-800 hover:bg-white"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                )}
                {multiple && idx < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, 1)}
                    title="Move right"
                    className="p-1 bg-white/95 rounded text-slate-800 hover:bg-white"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={removingIdx === idx}
                  onClick={() => handleRemove(idx)}
                  title="Remove image"
                  className="p-1 bg-red-600 rounded text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {removingIdx === idx ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>No image selected yet</span>
        </div>
      )}
    </div>
  );
};
