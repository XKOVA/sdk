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
export declare function AvatarUploader({ label, helperText, currentUrl, initials, onUpload, onUploadSuccess, onUploadError, disabled, maxBytes, minDimension, maxDimension, outputSize, outputType, outputQuality, }: AvatarUploaderProps): import("react/jsx-runtime.js").JSX.Element;
