from io import BytesIO

from pydantic import BaseModel
from pypdf import PdfReader
from pypdf.errors import PyPdfError


MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PAGES = 50


class PDFProcessingError(ValueError):
    pass


class PageText(BaseModel):
    page_number: int
    text: str


class PDFPreview(BaseModel):
    filename: str
    page_count: int
    pages: list[PageText]
    pages_without_text: list[int]


def extract_pdf(data: bytes, filename: str) -> PDFPreview:
    if not data:
        raise PDFProcessingError("The uploaded file is empty.")

    if not data.startswith(b"%PDF-"):
        raise PDFProcessingError("The file does not have a valid PDF header.")

    try:
        reader = PdfReader(BytesIO(data))

        if reader.is_encrypted:
            raise PDFProcessingError(
                "Password-protected PDFs are not supported."
            )

        page_count = len(reader.pages)

        if not 1 <= page_count <= MAX_PAGES:
            raise PDFProcessingError(
                f"PDF must contain between 1 and {MAX_PAGES} pages."
            )

        pages = []
        pages_without_text = []

        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").replace("\x00", "").strip()

            if text:
                pages.append(PageText(page_number=page_number, text=text))
            else:
                pages_without_text.append(page_number)

    except PDFProcessingError:
        raise
    except (PyPdfError, ValueError, OSError) as exc:
        raise PDFProcessingError(
            "The PDF could not be read. It may be damaged or unsupported."
        ) from exc

    if not pages:
        raise PDFProcessingError(
            "No extractable text was found. "
            "The PDF may be scanned or empty. This version does not support OCR."
        )

    return PDFPreview(
        filename=filename,
        page_count=page_count,
        pages=pages,
        pages_without_text=pages_without_text,
    )