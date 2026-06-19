import pdfParse from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extracts raw text from a file buffer based on the original file name extension.
 * Supported extensions: .txt, .md, .pdf, .docx
 * 
 * @param {Buffer} buffer - The binary content of the file
 * @param {string} originalname - The original name of the file (including extension)
 * @returns {Promise<string>} - The extracted plain text
 */
export async function parseFileBuffer(buffer, originalname) {
    if (!buffer) {
        throw new Error("No file buffer provided");
    }
    if (!originalname) {
        throw new Error("No file name provided");
    }
    const ext = originalname.split(".").pop().toLowerCase();
    
    if (ext === "txt" || ext === "md") {
        return buffer.toString("utf-8");
    } else if (ext === "pdf") {
        try {
            const data = await pdfParse(buffer);
            return data.text || "";
        } catch (error) {
            throw new Error(`Failed to parse PDF file: ${error.message}`);
        }
    } else if (ext === "docx") {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value || "";
        } catch (error) {
            throw new Error(`Failed to parse DOCX file: ${error.message}`);
        }
    } else {
        throw new Error(`Unsupported file extension: .${ext}`);
    }
}
