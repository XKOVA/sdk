"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button.js";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";

const DEFAULT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MIN_DIMENSION = 128;
const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_OUTPUT_SIZE = 512;
const DEFAULT_OUTPUT_TYPE = "image/jpeg";
const DEFAULT_OUTPUT_QUALITY = 0.9;
const PREVIEW_SIZE = 240;

type CropOffset = { x: number; y: number };

interface CropperState {
  image: HTMLImageElement;
  objectUrl: string;
  zoom: number;
  offset: CropOffset;
}

/**
 * Props for {@link AvatarUploader}.
 *
 * @remarks
 * Purpose:
 * - Provide an avatar upload UI with client-side validation and cropping.
 *
 * When to use:
 * - Use in profile settings to collect, crop, and upload a user avatar.
 *
 * When not to use:
 * - Do not use in non-browser contexts (relies on DOM APIs).
 *
 * Data/auth references:
 * - Calls the provided `onUpload` callback, which should handle authenticated upload logic.
 */
export interface AvatarUploaderProps {
  /** Display label above the avatar upload controls. */
  label?: string;
  /** Helper text rendered beneath the controls. */
  helperText?: string;
  /** Existing avatar URL (signed or public). */
  currentUrl?: string | null;
  /** Two-letter initials to display when no avatar is available. */
  initials: string;
  /** Async upload handler for the processed avatar blob. */
  onUpload: (blob: Blob, contentType: string) => Promise<void>;
  /** Optional hook for surfacing upload success. */
  onUploadSuccess?: () => void;
  /** Optional hook for surfacing upload failures. */
  onUploadError?: (error: Error) => void;
  /** Disable the control while parent UI is busy. */
  disabled?: boolean;
  /** Maximum allowed file size in bytes. */
  maxBytes?: number;
  /** Minimum allowed dimension in pixels. */
  minDimension?: number;
  /** Maximum allowed dimension in pixels. */
  maxDimension?: number;
  /** Output square dimension in pixels. */
  outputSize?: number;
  /** Output MIME type for the processed image. */
  outputType?: string;
  /** Output quality for lossy formats (0..1). */
  outputQuality?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBaseScale(img: HTMLImageElement, size: number) {
  return Math.max(size / img.naturalWidth, size / img.naturalHeight);
}

function clampOffsets(offset: CropOffset, img: HTMLImageElement, zoom: number, size: number) {
  const scale = getBaseScale(img, size) * zoom;
  const maxOffsetX = Math.max(0, (img.naturalWidth * scale - size) / 2);
  const maxOffsetY = Math.max(0, (img.naturalHeight * scale - size) / 2);
  return {
    x: clamp(offset.x, -maxOffsetX, maxOffsetX),
    y: clamp(offset.y, -maxOffsetY, maxOffsetY),
  };
}

async function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image file."));
    img.src = objectUrl;
  });
}

export function AvatarUploader({
  label = "Profile photo",
  helperText = "PNG, JPG, or WebP up to 10MB.",
  currentUrl,
  initials,
  onUpload,
  onUploadSuccess,
  onUploadError,
  disabled = false,
  maxBytes = DEFAULT_MAX_BYTES,
  minDimension = DEFAULT_MIN_DIMENSION,
  maxDimension = DEFAULT_MAX_DIMENSION,
  outputSize = DEFAULT_OUTPUT_SIZE,
  outputType = DEFAULT_OUTPUT_TYPE,
  outputQuality = DEFAULT_OUTPUT_QUALITY,
}: AvatarUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperState, setCropperState] = useState<CropperState | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draggingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const allowedTypes = useMemo(() => new Set(DEFAULT_ALLOWED_TYPES), []);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const renderCropper = useCallback(() => {
    if (!cropperState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = PREVIEW_SIZE;
    const scale = getBaseScale(cropperState.image, size) * zoom;
    const drawWidth = cropperState.image.naturalWidth * scale;
    const drawHeight = cropperState.image.naturalHeight * scale;
    const centerX = size / 2 + cropperState.offset.x;
    const centerY = size / 2 + cropperState.offset.y;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      cropperState.image,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
  }, [cropperState, zoom]);

  useEffect(() => {
    if (!cropperState || !cropperOpen) return;
    let raf = 0;
    let attempts = 0;
    const tryRender = () => {
      attempts += 1;
      if (!canvasRef.current) {
        if (attempts < 5) {
          raf = window.requestAnimationFrame(tryRender);
        }
        return;
      }
      renderCropper();
    };
    raf = window.requestAnimationFrame(tryRender);
    return () => window.cancelAnimationFrame(raf);
  }, [cropperOpen, cropperState, renderCropper, zoom]);

  const resetSelection = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setSelectedBlob(null);
    setPreviewUrl(null);
    setError(null);
    if (cropperState?.objectUrl) {
      URL.revokeObjectURL(cropperState.objectUrl);
    }
    setCropperState(null);
    setCropperOpen(false);
  }, [cropperState]);

  const validateAvatarFile = useCallback(
    async (file: File, objectUrl: string) => {
      if (!allowedTypes.has(file.type)) {
        return "Please upload a PNG, JPG, or WebP image.";
      }
      if (file.size > maxBytes) {
        return `Profile photos must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`;
      }
      try {
        const img = await loadImage(objectUrl);
        if (img.naturalWidth < minDimension || img.naturalHeight < minDimension) {
          return `Profile photos must be at least ${minDimension}x${minDimension}px.`;
        }
        if (img.naturalWidth > maxDimension || img.naturalHeight > maxDimension) {
          return `Profile photos must be ${maxDimension}x${maxDimension}px or smaller.`;
        }
      } catch (err) {
        return err instanceof Error ? err.message : "Invalid image file.";
      }
      return null;
    },
    [allowedTypes, maxBytes, minDimension, maxDimension],
  );

  const openCropper = useCallback(async (file: File, objectUrl: string) => {
    try {
      const image = await loadImage(objectUrl);
      const offset = clampOffsets({ x: 0, y: 0 }, image, 1, PREVIEW_SIZE);
      setCropperState({
        image,
        objectUrl,
        zoom: 1,
        offset,
      });
      setZoom(1);
      setCropperOpen(true);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setError(err instanceof Error ? err.message : "Invalid image file.");
    }
  }, []);

  const closeCropper = useCallback(() => {
    if (cropperState?.objectUrl) {
      URL.revokeObjectURL(cropperState.objectUrl);
    }
    setCropperState(null);
    setCropperOpen(false);
  }, [cropperState]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        resetSelection();
        return;
      }
      const rawObjectUrl = URL.createObjectURL(file);
      const validationError = await validateAvatarFile(file, rawObjectUrl);
      if (validationError) {
        URL.revokeObjectURL(rawObjectUrl);
        resetSelection();
        setError(validationError);
        return;
      }
      setError(null);
      await openCropper(file, rawObjectUrl);
    },
    [openCropper, resetSelection, validateAvatarFile],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cropperState) return;
    draggingRef.current = true;
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [cropperState]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!cropperState || !draggingRef.current) return;
      const dx = event.clientX - lastPointRef.current.x;
      const dy = event.clientY - lastPointRef.current.y;
      lastPointRef.current = { x: event.clientX, y: event.clientY };
      setCropperState((prev) => {
        if (!prev) return prev;
        const nextOffset = clampOffsets(
          { x: prev.offset.x + dx, y: prev.offset.y + dy },
          prev.image,
          zoom,
          PREVIEW_SIZE,
        );
        return { ...prev, offset: nextOffset };
      });
    },
    [cropperState, zoom],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cropperState) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, [cropperState]);

  const handleZoomChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!cropperState) return;
      const nextZoom = Number.parseFloat(event.target.value);
      const normalizedZoom = Number.isFinite(nextZoom) ? nextZoom : 1;
      setZoom(normalizedZoom);
      setCropperState((prev) => {
        if (!prev) return prev;
        const nextOffset = clampOffsets(prev.offset, prev.image, normalizedZoom, PREVIEW_SIZE);
        return { ...prev, offset: nextOffset };
      });
    },
    [cropperState],
  );

  const handleCropSave = useCallback(async () => {
    if (!cropperState) return;
    try {
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outputSize;
      outputCanvas.height = outputSize;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to process image.");
      }
      const baseScale = getBaseScale(cropperState.image, outputSize);
      const scaleOut = baseScale * zoom;
      const offsetScale = outputSize / PREVIEW_SIZE;
      const offsetX = cropperState.offset.x * offsetScale;
      const offsetY = cropperState.offset.y * offsetScale;
      const drawWidth = cropperState.image.naturalWidth * scaleOut;
      const drawHeight = cropperState.image.naturalHeight * scaleOut;
      const centerX = outputSize / 2 + offsetX;
      const centerY = outputSize / 2 + offsetY;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.drawImage(
        cropperState.image,
        centerX - drawWidth / 2,
        centerY - drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Unable to process image."));
          },
          outputType,
          outputQuality,
        );
      });
      const objectUrl = URL.createObjectURL(blob);
      setSelectedBlob(blob);
      setPreviewUrl(objectUrl);
      setError(null);
      closeCropper();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process image.");
    }
  }, [closeCropper, cropperState, outputQuality, outputSize, outputType, zoom]);

  const handleUpload = useCallback(async () => {
    if (!selectedBlob) {
      setError("Select a photo before uploading.");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await onUpload(selectedBlob, outputType);
      onUploadSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Upload failed.");
      setError(error.message);
      onUploadError?.(error);
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, onUploadError, onUploadSuccess, outputType, selectedBlob]);

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`h-16 w-16 border border-muted-foreground/30 overflow-hidden flex items-center justify-center bg-muted/40 ${previewRadius}`}
        >
          {previewUrl || currentUrl ? (
            <img
              src={previewUrl ?? currentUrl ?? ""}
              alt="Profile avatar"
              className={`h-full w-full object-cover ${previewRadius}`}
            />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input
            type="file"
            accept={DEFAULT_ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            ref={inputRef}
            disabled={disabled || isUploading}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={disabled || isUploading || !selectedBlob}
              className="sm:w-auto"
            >
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetSelection}
              disabled={disabled || isUploading}
              className="sm:w-auto"
            >
              Clear Selection
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{helperText}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <Dialog open={cropperOpen} onOpenChange={(open) => (!open ? closeCropper() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Adjust your photo</DialogTitle>
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                className={`border border-muted-foreground/30 touch-none ${previewRadius}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  draggingRef.current = false;
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar-zoom">Zoom</Label>
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={handleZoomChange}
                className="w-full accent-foreground"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeCropper} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={handleCropSave} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  const previewRadius = "rounded-lg";
