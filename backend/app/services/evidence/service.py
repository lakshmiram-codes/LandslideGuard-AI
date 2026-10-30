import os
import re
import uuid
import hashlib
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status

# Allowed file specifications
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
}

# Magic byte signatures for sanity validation
MAGIC_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",
    b"%PDF": "application/pdf",
}

DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "incident_evidence"


class EvidenceStorageService:
    def __init__(self, upload_dir: Path = DEFAULT_UPLOAD_DIR):
        self.upload_dir = upload_dir.resolve()
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def sanitize_filename(self, filename: str) -> str:
        """Sanitizes incoming original filename, removing path components and dangerous chars."""
        # Strip directory names
        clean = os.path.basename(filename)
        # Strip null bytes and non-printable characters
        clean = clean.replace("\x00", "").strip()
        # Keep only alphanumeric, hyphens, underscores, dots
        clean = re.sub(r"[^\w\.\-]", "_", clean)
        # Prevent hidden files
        clean = clean.lstrip(".")
        if not clean:
            clean = "evidence_file.bin"
        return clean[:100]

    def validate_and_save(
        self, upload_file: UploadFile
    ) -> Tuple[str, str, str, str, int, str]:
        """
        Validates content size, MIME type, extension, and magic bytes,
        then safely writes file into isolated storage directory.

        Returns: (safe_filename, original_sanitized, relative_path, mime_type, size_bytes, sha256_hex)
        """
        original_name = self.sanitize_filename(upload_file.filename or "evidence.jpg")
        ext = Path(original_name).suffix.lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"File extension '{ext}' is not permitted. "
                    f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
                ),
            )

        content_type = (upload_file.content_type or "").lower().strip()
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"MIME type '{content_type}' is not supported. "
                    f"Allowed MIME types: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
                ),
            )

        # Read content and enforce size bound
        content = upload_file.file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size} bytes) exceeds maximum limit of 5 MB ({MAX_FILE_SIZE_BYTES} bytes).",
            )

        # Basic magic bytes check
        header = content[:16]
        valid_magic = False
        for sig, sig_mime in MAGIC_SIGNATURES.items():
            if header.startswith(sig):
                valid_magic = True
                break
            # WebP special case: RIFF....WEBP
            if header.startswith(b"RIFF") and b"WEBP" in header[:16]:
                valid_magic = True
                break

        if not valid_magic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match genuine image or PDF signature.",
            )

        # Compute SHA-256 hash for provenance
        sha256_hash = hashlib.sha256(content).hexdigest()

        # Generate unique storage filename
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        destination_path = (self.upload_dir / safe_filename).resolve()

        # Strict path traversal check
        if not destination_path.is_relative_to(self.upload_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid destination path traversal detected.",
            )

        # Write to disk
        with open(destination_path, "wb") as f:
            f.write(content)

        relative_path = str(destination_path.relative_to(self.upload_dir.parent.parent))

        return (
            safe_filename,
            original_name,
            relative_path,
            content_type,
            file_size,
            sha256_hash,
        )

    def get_file_path(self, safe_filename: str) -> Path:
        """Resolves file path while strictly guarding against path traversal."""
        clean_name = os.path.basename(safe_filename)
        resolved_path = (self.upload_dir / clean_name).resolve()
        if not resolved_path.is_relative_to(self.upload_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Path traversal attempt.",
            )
        if not resolved_path.exists() or not resolved_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evidence file attachment not found on disk.",
            )
        return resolved_path


evidence_service = EvidenceStorageService()
